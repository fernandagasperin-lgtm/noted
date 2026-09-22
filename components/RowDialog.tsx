'use client';

import { useEffect, useRef, useState } from 'react';
import {
  COLUMN_LABELS,
  formatNumber,
  type DbColumn,
  type DbRow,
  type SelectOption,
} from '@/lib/types';
import { Pill } from './DatabasePage';

interface Props {
  row: DbRow;
  columns: DbColumn[];
  canEdit: boolean;
  onClose: () => void;
  onChange: (patch: Partial<DbRow>) => void;
  ensureOption: (column: DbColumn, name: string) => Promise<SelectOption>;
}

export default function RowDialog({
  row,
  columns,
  canEdit,
  onClose,
  onChange,
  ensureOption,
}: Props) {
  const [novaOpcao, setNovaOpcao] = useState<Record<string, string>>({});

  // mesmo motivo da tabela: nao depender de sair do campo para nao perder texto
  const [titulo, setTitulo] = useState(row.title);
  const [corpo, setCorpo] = useState(row.body);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const gravarDepois = (patch: Partial<DbRow>) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(patch), 500);
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const setValue = (columnId: string, value: unknown) =>
    onChange({ values: { ...row.values, [columnId]: value } });

  const campo =
    'w-full rounded border border-transparent bg-transparent px-2 py-1 text-[14px] text-[#37352F] outline-none hover:bg-[#F7F7F5] focus:border-[#2383E2] focus:bg-white';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0F0F0F]/20 p-4 backdrop-blur-sm md:p-10"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex items-center justify-end px-3 py-2">
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-[#9B9A97] transition hover:bg-[#F7F7F5] hover:text-[#37352F]"
          >
            ×
          </button>
        </header>

        <div className="px-6 pb-8 md:px-12">
          <input
            value={titulo}
            readOnly={!canEdit}
            onChange={(e) => {
              setTitulo(e.target.value);
              gravarDepois({ title: e.target.value });
            }}
            placeholder="Sem titulo"
            className="mb-5 w-full bg-transparent text-[32px] font-bold leading-tight tracking-tight text-[#37352F] outline-none placeholder:text-[#E1E1DF]"
          />

          <div className="mb-6 space-y-1">
            {columns.map((c) => (
              <div key={c.id} className="flex items-start gap-2">
                <div className="flex w-36 shrink-0 items-center gap-1.5 px-2 py-1 text-[13px] text-[#9B9A97]">
                  <span className="truncate">{c.name}</span>
                </div>

                <div className="min-w-0 flex-1">
                  {c.type === 'check' && (
                    <input
                      type="checkbox"
                      checked={Boolean(row.values[c.id])}
                      disabled={!canEdit}
                      onChange={(e) => setValue(c.id, e.target.checked)}
                      className="ml-2 mt-1.5 h-3.5 w-3.5 accent-[#2383E2]"
                    />
                  )}

                  {(c.type === 'select' || c.type === 'multi') && (
                    <div className="px-2 py-1">
                      <div className="mb-1 flex flex-wrap gap-1">
                        {(c.type === 'multi'
                          ? ((row.values[c.id] as string[]) ?? [])
                          : row.values[c.id]
                            ? [row.values[c.id] as string]
                            : []
                        )
                          .map((id) => c.options.find((o) => o.id === id))
                          .filter((o): o is SelectOption => Boolean(o))
                          .map((o) => (
                            <span key={o.id} className="inline-flex items-center gap-1">
                              <Pill option={o} />
                              {canEdit && (
                                <button
                                  onClick={() => {
                                    if (c.type === 'multi') {
                                      setValue(
                                        c.id,
                                        ((row.values[c.id] as string[]) ?? []).filter(
                                          (x) => x !== o.id,
                                        ),
                                      );
                                    } else setValue(c.id, null);
                                  }}
                                  className="text-[11px] text-[#C7C6C4] hover:text-[#EB5757]"
                                >
                                  ×
                                </button>
                              )}
                            </span>
                          ))}
                      </div>

                      {canEdit && (
                        <select
                          value=""
                          onChange={async (e) => {
                            const v = e.target.value;
                            if (!v) return;
                            if (v === '__nova__') {
                              const nome = novaOpcao[c.id]?.trim();
                              if (!nome) return;
                              const o = await ensureOption(c, nome);
                              setNovaOpcao({ ...novaOpcao, [c.id]: '' });
                              if (c.type === 'multi') {
                                setValue(c.id, [
                                  ...((row.values[c.id] as string[]) ?? []),
                                  o.id,
                                ]);
                              } else setValue(c.id, o.id);
                              return;
                            }
                            if (c.type === 'multi') {
                              const atuais = (row.values[c.id] as string[]) ?? [];
                              if (!atuais.includes(v)) setValue(c.id, [...atuais, v]);
                            } else setValue(c.id, v);
                          }}
                          className="rounded border border-[#E9E9E7] px-1.5 py-0.5 text-[12px] text-[#787774] outline-none"
                        >
                          <option value="">+ adicionar</option>
                          {c.options.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  {c.type === 'number' && (
                    <input
                      type="number"
                      readOnly={!canEdit}
                      defaultValue={
                        row.values[c.id] === undefined || row.values[c.id] === null
                          ? ''
                          : String(row.values[c.id])
                      }
                      onBlur={(e) =>
                        setValue(c.id, e.target.value === '' ? null : Number(e.target.value))
                      }
                      placeholder={formatNumber(0, c.format)}
                      className={campo}
                    />
                  )}

                  {(c.type === 'text' || c.type === 'url' || c.type === 'date') && (
                    <input
                      type={c.type === 'date' ? 'date' : 'text'}
                      readOnly={!canEdit}
                      defaultValue={row.values[c.id] ? String(row.values[c.id]) : ''}
                      onBlur={(e) => setValue(c.id, e.target.value)}
                      placeholder={COLUMN_LABELS[c.type]}
                      className={campo + ' placeholder:text-[#C7C6C4]'}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-[#E9E9E7] pt-5">
            <textarea
              readOnly={!canEdit}
              value={corpo}
              onChange={(e) => {
                setCorpo(e.target.value);
                gravarDepois({ body: e.target.value });
              }}
              rows={10}
              placeholder="Escreva aqui..."
              className="w-full resize-y bg-transparent text-[15px] leading-7 text-[#37352F] outline-none placeholder:text-[#C7C6C4]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
