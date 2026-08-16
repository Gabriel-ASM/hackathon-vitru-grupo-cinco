import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import express, { type Request } from "express";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  config,
  requireApiKey,
  resolveRealtimeConfig,
  resolveRealtimeConfigForInstitution,
  supportsReasoning,
  type RealtimeRuntimeConfig,
} from "./config";
import { realtimeTools } from "./realtime-tools";
import { buildScheduleInput, scheduleGeneratorPrompt } from "./prompts/schedule-generator";
import { buildVoiceAgentInstructions } from "./prompts/voice-agent";
import {
  buildRoutineExtractionInput,
  routineExtractorPrompt,
} from "./prompts/routine-extractor";
import { normalizeRoutineExtractionResult, normalizeStudentRoutine } from "./routine-normalization";
import {
  appendVoiceDiagnosticEvents,
  createVoiceDiagnosticSession,
  readVoiceDiagnosticSession,
} from "./voice-diagnostics";
import {
  applyTemporaryClassChanges,
  scheduleGenerationRequestSchema,
  studentScheduleSchema,
  validateWeeklySchedule,
  weeklyScheduleSchema,
} from "../shared/schemas/schedule";
import {
  routineExtractionStructuredResultSchema,
} from "../shared/schemas/routine";
import { transcriptEntrySchema } from "../shared/voice-transcript";
import {
  getAssistantVoiceProfile,
  institutionKeys,
  type AssistantVoiceProfile,
  type Institution,
} from "../shared/voice-profile";

const app = express();
app.use(express.json({ limit: "1mb" }));

function getOpenAIClient(): OpenAI {
  return new OpenAI({ apiKey: requireApiKey() });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Erro desconhecido.";
}

function safetyIdentifier(request: Request): string {
  const source = request.ip || "prototype-local-user";
  return crypto.createHash("sha256").update(source).digest("hex").slice(0, 32);
}

function realtimeSessionConfig(
  schedule: ReturnType<typeof studentScheduleSchema.parse>,
  profile: AssistantVoiceProfile,
  runtimeConfig: RealtimeRuntimeConfig = config,
  clarificationContext?: string,
  presentationAlreadyShown = false,
) {
  const session = {
    type: "realtime",
    model: runtimeConfig.realtimeModel,
    instructions: buildVoiceAgentInstructions(
      schedule,
      profile,
      clarificationContext,
      presentationAlreadyShown,
    ),
    audio: {
      input: {
        format: {
          type: "audio/pcm",
          rate: 24000,
        },
        transcription: {
          model: "gpt-realtime-whisper",
          language: "pt",
        },
        noise_reduction: {
          type: runtimeConfig.noiseReduction,
        },
        turn_detection: {
          type: "semantic_vad",
          eagerness: runtimeConfig.vadEagerness,
          create_response: true,
          interrupt_response: true,
        },
      },
      output: {
        format: {
          type: "audio/pcm",
          rate: 24000,
        },
        voice: runtimeConfig.realtimeVoice,
      },
    },
    output_modalities: ["audio"],
    tools: realtimeTools,
    max_output_tokens: runtimeConfig.maxOutputTokens,
  } as Record<string, unknown>;

  if (supportsReasoning(runtimeConfig.realtimeModel)) {
    session.reasoning = { effort: runtimeConfig.reasoningEffort };
  }

  return {
    session,
  };
}

app.post("/api/realtime/session", async (request, response) => {
  const parsedSchedule = studentScheduleSchema.safeParse(request.body?.schedule);
  if (!parsedSchedule.success) {
    response.status(400).json({
      error: "A grade enviada para iniciar a conversa é inválida.",
      details: parsedSchedule.error.flatten(),
    });
    return;
  }

  const institutionResult = z.enum(institutionKeys).safeParse(request.body?.institution ?? "uniasselvi");
  if (!institutionResult.success) {
    response.status(400).json({
      error: "A instituiÃ§Ã£o escolhida para a conversa Ã© invÃ¡lida.",
      details: institutionResult.error.flatten(),
    });
    return;
  }
  const institution = institutionResult.data as Institution;
  const profile = getAssistantVoiceProfile(institution);

  let clarificationContext: string | undefined;
  if (request.body?.clarification_context !== undefined) {
    const parsedContext = z.string().trim().max(8_000).safeParse(request.body?.clarification_context);
    if (!parsedContext.success) {
      response.status(400).json({
        error: "O contexto de esclarecimento da conversa é inválido.",
        details: parsedContext.error.flatten(),
      });
      return;
    }
    clarificationContext = parsedContext.data;
  }

  try {
    const runtimeConfig = config.diagnosticsEnabled && request.body?.preset
      ? resolveRealtimeConfig(request.body.preset)
      : resolveRealtimeConfigForInstitution(institution);
    const diagnosticSession = config.diagnosticsEnabled
      ? await createVoiceDiagnosticSession(config.diagnosticsDir, runtimeConfig, profile)
      : null;
    const apiKey = requireApiKey();
    const openAiResponse = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": safetyIdentifier(request),
      },
      body: JSON.stringify(
        realtimeSessionConfig(
          parsedSchedule.data,
          profile,
          runtimeConfig,
          clarificationContext,
          request.body?.presentation_already_shown === true,
        ),
      ),
    });

    const data = (await openAiResponse.json()) as {
      value?: string;
      expires_at?: number;
      client_secret?: { value?: string; expires_at?: number };
      error?: { message?: string };
    };

    if (!openAiResponse.ok) {
      response.status(openAiResponse.status).json({
        error: "Não consegui iniciar a sessão de voz.",
        details: data.error?.message ?? "A API da OpenAI recusou a criação da sessão.",
      });
      return;
    }

    const value = data.value ?? data.client_secret?.value;
    if (!value) {
      response.status(502).json({
        error: "A sessão de voz não retornou uma credencial efêmera.",
        details: "Resposta inesperada do endpoint /v1/realtime/client_secrets.",
      });
      return;
    }

    response.json({
      value,
      expires_at: data.expires_at ?? data.client_secret?.expires_at,
      diagnostic_session_id: diagnosticSession?.session_id,
      diagnostic_config: diagnosticSession?.config,
      voice_profile: profile,
    });
  } catch (error) {
    response.status(500).json({
      error: "Não consegui iniciar a sessão de voz.",
      details: errorMessage(error),
    });
  }
});

app.post("/api/debug/voice-sessions/:sessionId/events", async (request, response) => {
  if (!config.diagnosticsEnabled) {
    response.status(404).json({ error: "Diagnóstico desativado." });
    return;
  }

  const events = Array.isArray(request.body?.events) ? request.body.events : [];
  try {
    const accepted = await appendVoiceDiagnosticEvents(
      config.diagnosticsDir,
      request.params.sessionId,
      events,
    );
    response.json({ accepted });
  } catch (error) {
    response.status(400).json({ error: errorMessage(error) });
  }
});

app.get("/api/debug/voice-sessions/:sessionId", async (request, response) => {
  if (!config.diagnosticsEnabled) {
    response.status(404).send("Diagnóstico desativado.");
    return;
  }

  try {
    const contents = await readVoiceDiagnosticSession(config.diagnosticsDir, request.params.sessionId);
    response.type("application/x-ndjson").send(contents);
  } catch (error) {
    response.status(404).send(errorMessage(error));
  }
});

const routineExtractionRequestSchema = z.object({
  academic_schedule: studentScheduleSchema,
  transcript: z.array(transcriptEntrySchema).max(200),
});

app.post("/api/routine/extract", async (request, response) => {
  const parsedRequest = routineExtractionRequestSchema.safeParse(request.body);
  if (!parsedRequest.success) {
    response.status(400).json({
      error: "Os dados da conversa para organizar a rotina são inválidos.",
      details: parsedRequest.error.flatten(),
    });
    return;
  }

  try {
    const client = getOpenAIClient();
    const completion = await client.responses.parse({
      model: config.plannerModel,
      reasoning: { effort: config.plannerReasoningEffort },
      input: [
        { role: "system", content: routineExtractorPrompt },
        {
          role: "user",
          content: buildRoutineExtractionInput(
            parsedRequest.data.academic_schedule,
            parsedRequest.data.transcript,
          ),
        },
      ],
      text: {
        format: zodTextFormat(routineExtractionStructuredResultSchema, "routine_extraction"),
      },
    });

    if (!completion.output_parsed) {
      throw new Error("O organizador de rotina não retornou um objeto estruturado.");
    }

    response.json(normalizeRoutineExtractionResult(completion.output_parsed));
  } catch (error) {
    response.status(500).json({
      error: "Não consegui organizar os dados da conversa.",
      details: errorMessage(error),
    });
  }
});

app.post("/api/schedule", async (request, response) => {
  const parsedRequest = scheduleGenerationRequestSchema.safeParse(request.body);
  if (!parsedRequest.success) {
    response.status(400).json({
      error: "Os dados para gerar a semana são inválidos.",
      details: parsedRequest.error.flatten(),
    });
    return;
  }

  try {
    const client = getOpenAIClient();
    const planningRequest = scheduleGenerationRequestSchema.parse({
      ...parsedRequest.data,
      academic_schedule: applyTemporaryClassChanges(parsedRequest.data.academic_schedule),
      routine: normalizeStudentRoutine(parsedRequest.data.routine),
    });
    const completion = await client.responses.parse({
      model: config.plannerModel,
      reasoning: { effort: config.plannerReasoningEffort },
      input: [
        { role: "system", content: scheduleGeneratorPrompt },
        {
          role: "user",
          content: buildScheduleInput(planningRequest),
        },
      ],
      text: {
        format: zodTextFormat(weeklyScheduleSchema, "weekly_schedule"),
      },
    });

    if (!completion.output_parsed) {
      throw new Error("O Schedule Generator não retornou um objeto estruturado.");
    }

    let candidate = completion.output_parsed;
    let repairAttempted = false;
    let schedule;
    try {
      schedule = validateWeeklySchedule(candidate, planningRequest.academic_schedule);
    } catch (validationError) {
      repairAttempted = true;
      const repairCompletion = await client.responses.parse({
        model: config.plannerModel,
        reasoning: { effort: config.plannerReasoningEffort },
        input: [
          {
            role: "system",
            content: `${scheduleGeneratorPrompt}\n\nMODO DE REPARO: corrija o candidato abaixo sem perder nenhum compromisso confirmado. Todos os start/end devem ser HH:MM válidos; nunca use marcadores de ausência. Retorne somente o JSON final.`,
          },
          {
            role: "user",
            content: `${buildScheduleInput(planningRequest)}\n\nCANDIDATO A CORRIGIR:\n${JSON.stringify(candidate)}\n\nERROS DE VALIDAÇÃO:\n${errorMessage(validationError).slice(0, 4_000)}`,
          },
        ],
        text: {
          format: zodTextFormat(weeklyScheduleSchema, "weekly_schedule_repair"),
        },
      });

      if (!repairCompletion.output_parsed) {
        throw new Error("A tentativa de reparo não retornou um objeto estruturado.");
      }
      candidate = repairCompletion.output_parsed;
      schedule = validateWeeklySchedule(candidate, planningRequest.academic_schedule);
    }
    response.json({
      schedule,
      planner: {
        model: config.plannerModel,
        reasoning_effort: config.plannerReasoningEffort,
        repair_attempted: repairAttempted,
      },
    });
  } catch (error) {
    response.status(500).json({
      error: "Não consegui montar sua semana.",
      details: errorMessage(error),
    });
  }
});

app.use("/api", (_request, response) => {
  response.status(404).json({ error: "Endpoint não encontrado." });
});

const calendarRoot = path.resolve(
  process.cwd(),
  "Calendário",
  "sistema-de-recompensa-",
  "calendario",
);
app.use("/calendario", express.static(calendarRoot, { index: "index.html" }));

const analyticsDist = path.resolve(
  process.cwd(),
  "Analytics",
  "vitru-analytics-dashboard",
  "dist",
);
if (fs.existsSync(analyticsDist)) {
  app.use("/analytics", express.static(analyticsDist));
  app.get("/analytics", (_request, response) => {
    response.sendFile(path.join(analyticsDist, "index.html"));
  });
  app.get("/analytics/*", (_request, response) => {
    response.sendFile(path.join(analyticsDist, "index.html"));
  });
}

const clientDist = path.resolve(process.cwd(), "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api(?:\/|$)).*/, (_request, response) => {
    response.sendFile(path.join(clientDist, "index.html"));
  });
}

app.listen(config.port, () => {
  console.log(`Servidor em http://localhost:${config.port}`);
});
