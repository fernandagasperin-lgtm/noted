'use client';

import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_TITLE_PATTERN, fillTemplate, type Assistant } from '@/lib/types';

interface Props {
  assistants: Assistant[];
  projectId: string;
  onCreate: () => void;
  onChange: (id: string, patch: Partial<Assistant>) => void;
  onDelete: (id: string) => void;
}

export default function AssistantsPage({
  assistants,
  projectId,
  onCreate,
  onChange,
  onDelete,
}: Props) {
  const mine = useMemo(
    () => assistants.filter((a) => a.projectId === projectId),
    [assistants, projectId],
  );
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    if (!mine.some((a) => a.id === activeId)) setActiveId(mine[0]?.id ?? '');
  }, [mine, activeId]);

  const active = mine.find((a) => a.id === activeId);

  const label = (text: string) => (
    <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
      {text}
    </div>
  );

  const inputClass =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

  const detectedFields = active
    ? Array.from(
        new Set(
          [...active.prompt.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map((m) => m[1].trim()),
        ),
      )
    : [];

  return (
    <div className="flex min-h-0 flex-1">
      <div className="w-64 shrink-0 overflow-y-auto border-r border-slate-200/70 bg-[#FBFBFA] p-2">
        {mine.map((a) => (
          <div
            key={a.id}
            onClick={() => setActiveId(a.id)}
            className={
              'group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] transition ' +
              (a.id === activeId
                ? 'bg-indigo-50 font-medium text-indigo-900'
                : 'text-slate-600 hover:bg-slate-200/50')
            }
          >
            <span className="shrink-0 text-indigo-500">✦</span>
            <span className="min-w-0 flex-1 truncate">{a.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('Excluir o assistente "' + a.name + '"?')) onDelete(a.id);
              }}
              className="shrink-0 rounded px-1 text-slate-400 opacity-0 transition hover:text-rose-600 group-hover:opacity-100"
            >
              ×
            </button>
          </div>
        ))}

        <button
          onClick={onCreate}
          className="mt-1 w-full rounded-lg px-2.5 py-2 text-left text-[13px] text-slate-500 transition hover:bg-slate-200/50 hover:text-slate-800"
        >
          + Novo assistente
        </button>
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto">
        {!active ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
            <p className="max-w-sm text-[13px] leading-relaxed text-slate-400">
              Um assistente guarda um prompt reutilizavel. Toda vez que voce usa ele num
              quadro, nasce um card de resultado com titulo padronizado — e a tabela mostra
              todas as variacoes que sairam dali.
            </p>
            <button
              onClick={onCreate}
              className="rounded-lg bg-indigo-600 px-3.5 py-2 text-[13px] font-medium text-white transition hover:bg-indigo-700"
            >
              Criar o primeiro assistente
            </button>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-5 p-8">
            <div>
              {label('Nome')}
              <input
                value={active.name}
                onChange={(e) => onChange(active.id, { name: e.target.value })}
                className={inputClass}
              />
            </div>

            <div>
              {label('Prompt')}
              <textarea
                value={active.prompt}
                onChange={(e) => onChange(active.id, { prompt: e.target.value })}
                rows={10}
                placeholder={
                  'Escreva um roteiro para a abertura de um video sobre {{tema}}.\nPublico: {{publico}}.\nTom: {{tom}}.'
                }
                className={inputClass + ' resize-y font-mono text-[12.5px] leading-relaxed'}
              />
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-400">
                Use <code className="rounded bg-slate-100 px-1">{'{{campo}}'}</code> para o
                que muda a cada uso. Os campos viram formulario na hora de rodar.
              </p>
            </div>

            <div>
              {label('Campos detectados')}
              {detectedFields.length === 0 ? (
                <p className="text-[13px] text-slate-400">
                  Nenhum ainda — adicione {'{{campo}}'} no prompt.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {detectedFields.map((f) => (
                    <span
                      key={f}
                      className="rounded-md bg-indigo-50 px-2 py-1 text-[12px] font-medium text-indigo-700"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              {label('Padrao do titulo')}
              <input
                value={active.titlePattern}
                onChange={(e) => onChange(active.id, { titlePattern: e.target.value })}
                placeholder={DEFAULT_TITLE_PATTERN}
                className={inputClass}
              />
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-400">
                Disponiveis: <code className="rounded bg-slate-100 px-1">{'{{assistente}}'}</code>,{' '}
                <code className="rounded bg-slate-100 px-1">{'{{variacao}}'}</code> (v1, v2, v3...)
                e qualquer campo do prompt.
              </p>
              <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[12.5px] text-slate-500">
                Vai gerar:{' '}
                <span className="font-medium text-slate-700">
                  {fillTemplate(active.titlePattern || DEFAULT_TITLE_PATTERN, {
                    assistente: active.name,
                    variacao: 'v3',
                    ...Object.fromEntries(detectedFields.map((f) => [f, '…'])),
                  })}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
