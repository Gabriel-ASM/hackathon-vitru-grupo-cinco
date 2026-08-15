import { z } from "zod";

export const transcriptEntrySchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().trim().min(1).max(4_000),
  timestamp: z.string().optional(),
});

export type TranscriptEntry = z.infer<typeof transcriptEntrySchema>;

const referenceSpeakerPattern = /^(aluno|aluna|estudante|usuario|usuário|voc[eê]|user|student|ia|ai|assistente|assistant)\s*:\s*(.*)$/i;
const assistantSpeakers = new Set(["ia", "ai", "assistente", "assistant"]);

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += 4_000) {
    const chunk = text.slice(index, index + 4_000).trim();
    if (chunk) chunks.push(chunk);
  }
  return chunks;
}

/**
 * Turns a pasted debug reference into the same transcript contract used by
 * the realtime conversation. Plain text is treated as the student's answer;
 * optional `Aluno:`/`IA:` prefixes allow a copied conversation to preserve
 * which lines are questions and which lines are evidence.
 */
export function parseReferenceText(text: string): TranscriptEntry[] {
  const normalized = text.trim();
  if (!normalized) return [];

  const lines = normalized.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const hasSpeakerPrefix = lines.some((line) => referenceSpeakerPattern.test(line));
  if (!hasSpeakerPrefix) {
    return chunkText(normalized).map((chunk) => ({
      role: "user" as const,
      text: chunk,
      timestamp: new Date().toISOString(),
    }));
  }

  const entries: TranscriptEntry[] = [];
  for (const line of lines) {
    const match = line.match(referenceSpeakerPattern);
    if (!match) {
      const previous = entries.at(-1);
      if (previous) {
        const continuation = `${previous.text}\n${line}`;
        const chunks = chunkText(continuation);
        previous.text = chunks[0] ?? previous.text;
        for (const chunk of chunks.slice(1)) {
          entries.push({ role: previous.role, text: chunk, timestamp: previous.timestamp });
        }
      } else {
        entries.push({ role: "user", text: line, timestamp: new Date().toISOString() });
      }
      continue;
    }

    const speaker = match[1].toLowerCase();
    const content = match[2].trim();
    if (!content) continue;
    const role = assistantSpeakers.has(speaker) ? "assistant" : "user";
    for (const chunk of chunkText(content)) {
      entries.push({ role, text: chunk, timestamp: new Date().toISOString() });
    }
  }

  return entries;
}
