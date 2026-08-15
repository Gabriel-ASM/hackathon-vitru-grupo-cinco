import type { TranscriptEntry } from "../hooks/useRealtimeVoice";
import type { StudentRoutine } from "../../../shared/schemas/routine";
import type { VoiceDiagnosticEvent } from "../../../shared/voice-diagnostics";

function JsonBlock({ value }: { value: unknown }) {
  return <pre className="debug-json">{value ? JSON.stringify(value, null, 2) : "(ainda não disponível)"}</pre>;
}

export function DebugPanel({
  transcript,
  routine,
  extractionWarnings,
  extractionError,
  referenceText,
  onReferenceTextChange,
  onUseReferenceText,
  referenceLoading,
  referenceError,
  plannerRequest,
  plannerResponse,
  technicalError,
  recordAudio,
  onRecordAudioChange,
  voicePreset,
  onVoicePresetChange,
  diagnosticSessionId,
  diagnosticEvents,
  recordedAudioUrl,
  onDownloadDiagnosticLog,
}: {
  transcript: TranscriptEntry[];
  routine: StudentRoutine;
  extractionWarnings?: string[];
  extractionError?: string | null;
  referenceText: string;
  onReferenceTextChange: (value: string) => void;
  onUseReferenceText: () => void;
  referenceLoading: boolean;
  referenceError?: string | null;
  plannerRequest: unknown;
  plannerResponse: unknown;
  technicalError: string | null;
  recordAudio: boolean;
  onRecordAudioChange: (value: boolean) => void;
  voicePreset: "marin_2_1" | "cedar_2_1" | "sage_2_1" | "marin_1_5";
  onVoicePresetChange: (value: "marin_2_1" | "cedar_2_1" | "sage_2_1" | "marin_1_5") => void;
  diagnosticSessionId: string | null;
  diagnosticEvents: VoiceDiagnosticEvent[];
  recordedAudioUrl: string | null;
  onDownloadDiagnosticLog: () => void;
}) {
  return (
    <aside className="debug-panel">
      <div className="debug-title">
        <div>
          <p className="eyebrow">Modo debug</p>
          <h2>Fluxo do protótipo</h2>
        </div>
        <code>?debug=true</code>
      </div>

      <section className="debug-section debug-controls">
        <h3>Diagnóstico da voz</h3>
        <label className="debug-checkbox">
          <input
            type="checkbox"
            checked={recordAudio}
            onChange={(event) => onRecordAudioChange(event.target.checked)}
          />
          <span>Gravar áudio local desta sessão</span>
        </label>
        <label className="debug-select-label">
          <span>Preset da sessão</span>
          <select value={voicePreset} onChange={(event) => onVoicePresetChange(event.target.value as typeof voicePreset)}>
            <option value="marin_2_1">marin · Realtime 2.1</option>
            <option value="cedar_2_1">cedar · Realtime 2.1</option>
            <option value="sage_2_1">sage · Realtime 2.1</option>
            <option value="marin_1_5">marin · Realtime 1.5</option>
          </select>
        </label>
        <p className="muted">A gravação só fica no navegador e exige consentimento.</p>
        <p className="debug-meta">Sessão: {diagnosticSessionId ?? "ainda não iniciada"}</p>
        <p className="debug-meta">Eventos capturados: {diagnosticEvents.length}</p>
        <div className="debug-actions">
          <button className="secondary-button" type="button" onClick={onDownloadDiagnosticLog} disabled={diagnosticEvents.length === 0}>
            Baixar log JSON
          </button>
          {recordedAudioUrl && (
            <a className="secondary-button" href={recordedAudioUrl} download="vitru-voice-session.webm">
              Baixar áudio
            </a>
          )}
        </div>
      </section>

      <section className="debug-section debug-reference">
        <h3>Referência textual (sem voz)</h3>
        <p className="muted">
          Cole uma descrição da rotina ou uma transcrição. Prefixos opcionais: <code>Aluno:</code> e <code>IA:</code>.
        </p>
        <textarea
          className="debug-reference-input"
          value={referenceText}
          onChange={(event) => onReferenceTextChange(event.target.value)}
          placeholder={"Aluno: Eu durmo por volta das 23h.\nIA: Como é seu trabalho?\nAluno: Trabalho de manhã e levo 30 minutos no trajeto."}
          rows={8}
          maxLength={16_000}
          aria-label="Texto de referência para testar a extração"
        />
        <div className="debug-reference-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={onUseReferenceText}
            disabled={referenceLoading || !referenceText.trim()}
          >
            {referenceLoading ? "Extraindo rotina…" : "Extrair rotina do texto"}
          </button>
          <span className="debug-meta">{referenceText.length.toLocaleString("pt-BR")}/16.000 caracteres</span>
        </div>
        {referenceError && <p className="error-message">Referência: {referenceError}</p>}
      </section>

      {technicalError && (
        <section className="debug-section debug-section--error">
          <h3>Erro técnico</h3>
          <pre className="debug-json">{technicalError}</pre>
        </section>
      )}

      <section className="debug-section">
        <h3>Transcrição da conversa</h3>
        {transcript.length === 0 ? (
          <p className="muted">A conversa ainda não começou.</p>
        ) : (
          <div className="debug-transcript">
            {transcript.map((entry, index) => (
              <p key={`${entry.timestamp}-${index}`}><strong>{entry.role === "user" ? "Aluno" : "IA"}:</strong> {entry.text}</p>
            ))}
          </div>
        )}
      </section>

      <section className="debug-section">
        <h3>Rotina extraída da transcrição</h3>
        <JsonBlock value={routine} />
        {extractionError && <p className="error-message">Extração: {extractionError}</p>}
        {extractionWarnings && extractionWarnings.length > 0 && (
          <div className="warning-box">
            <strong>Advertências da extração</strong>
            <ul>
              {extractionWarnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          </div>
        )}
      </section>

      <section className="debug-section">
        <h3>Eventos e tempos</h3>
        <JsonBlock value={diagnosticEvents} />
      </section>

      <section className="debug-section">
        <h3>JSON enviado ao Schedule Generator</h3>
        <JsonBlock value={plannerRequest} />
      </section>

      <section className="debug-section">
        <h3>JSON retornado pelo Schedule Generator</h3>
        <JsonBlock value={plannerResponse} />
      </section>
    </aside>
  );
}
