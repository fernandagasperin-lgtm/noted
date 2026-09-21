'use client';

import { useMemo, useState } from 'react';
import {
  buildDerivationTitle,
  fillTemplate,
  type Assistant,
  type BoardElement,
} from '@/lib/types';

export interface RunResult {
  inputs: Record<string, string>;
  output: string;
  title: string;
  variation: number;
  parentId?: string;
}

interface Props {
  assistant: Assistant;
  /** when branching from an existing result, its output seeds the prompt */
  parent?: BoardElement;
  variation: number;
  aiEnabled: boolean;
  onClose: () => void;
  onSave: (result: RunResult) => void;
}

export function buildPrompt(
  assistant: Assistant,
  inputs: Record<string, string>,
  parent?: BoardElement,
): string {
  const base = fillTemplate(assistant.prompt, inputs);
  if (!parent?.output) return base;
  return (
    'Partindo deste resultado anterior:\n\n' +
    parent.output +
    '\n\n---\n\n' +
    base
  );
}

export default function RunAssistantDialog({
  assistant,
  parent,
  variation,
  aiEnabled,
  onClose,
  onSave,
}: Props) {
  const fields = useMemo(
    () =>
      Array.from(
        new Set(
          [...assistant.prompt.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map((m) => m[1].trim()),
        ),
      ),
    [assistant.prompt],
  );

  const [inputs, setInputs] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f, ''])),
  );
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  const prompt = buildPrompt(assistant, inputs, parent);
  const title = buildDerivationTitle(assistant, variation, inputs);

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const generate = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? 'Falha ao gerar.');
      else setOutput(data.output);
    } catch {
      setError('Nao foi possivel falar com o servidor.');
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-6 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center gap-2.5 border-b border-slate-200/70 px-5 py-3.5">
          <span className="text-indigo-500">✦</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold text-slate-900">
              {assistant.name}
            </div>
            {parent && (
              <div className="truncate text-[12px] text-slate-400">
                derivando de {parent.title}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {fields.length > 0 && (
            <div className="space-y-3">
              {fields.map((f) => (
                <label key={f} className="block">
                  <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    {f}
                  </div>
                  <input
                    value={inputs[f] ?? ''}
                    onChange={(e) => setInputs({ ...inputs, [f]: e.target.value })}
                    className={inputClass}
                  />
                </label>
              ))}
            </div>
          )}

          <div className="rounded-lg bg-slate-50 px-3 py-2.5">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Titulo do card
            </div>
            <div className="mt-0.5 text-[13px] font-medium text-slate-700">{title}</div>
          </div>

          <div>
            <button
              onClick={() => setShowPrompt(!showPrompt)}
              className="text-[12.5px] font-medium text-slate-500 transition hover:text-slate-800"
            >
              {showPrompt ? '▾' : '▸'} Prompt final
            </button>
            {showPrompt && (
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-3 font-mono text-[12px] leading-relaxed text-slate-100">
                {prompt}
              </pre>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyPrompt}
              className="rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-medium text-slate-600 transition hover:bg-slate-50"
            >
              {copied ? 'Copiado' : 'Copiar prompt'}
            </button>
            {aiEnabled && (
              <button
                onClick={generate}
                disabled={busy}
                className="rounded-lg bg-indigo-600 px-3.5 py-2 text-[13px] font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {busy ? 'Gerando...' : 'Gerar com Claude'}
              </button>
            )}
            {!aiEnabled && (
              <span className="text-[12px] text-slate-400">
                Sem ANTHROPIC_API_KEY — cole o resultado abaixo.
              </span>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">
              {error}
            </p>
          )}

          <label className="block">
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Resultado
            </div>
            <textarea
              value={output}
              onChange={(e) => setOutput(e.target.value)}
              rows={8}
              placeholder="Gere acima, ou cole aqui o resultado."
              className={inputClass + ' resize-y leading-relaxed'}
            />
          </label>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-slate-200/70 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-[13px] text-slate-500 transition hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            onClick={() =>
              onSave({ inputs, output, title, variation, parentId: parent?.id })
            }
            disabled={!output.trim()}
            className="rounded-lg bg-slate-900 px-3.5 py-2 text-[13px] font-medium text-white transition hover:bg-slate-700 disabled:opacity-40"
          >
            Salvar card
          </button>
        </footer>
      </div>
    </div>
  );
}
