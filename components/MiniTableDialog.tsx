'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon';
import { displayValue, evaluateGrid, refOf } from '@/lib/formula';
import type { MiniTable, Page } from '@/lib/types';

interface Props {
  table: MiniTable;
  pages: Page[];
  canEdit: boolean;
  /** somas disponiveis da tabela grande vinculada, por nome de coluna */
  linked: Record<string, number[]> | null;
  onSave: (next: MiniTable) => void;
  onClose: () => void;
}

const LARGURA_PADRAO = 100;

export default function MiniTableDialog({
  table: t,
  pages,
  canEdit,
  linked,
  onSave,
  onClose,
}: Props) {
  const [foco, setFoco] = useState<string | null>(null);
  const [mostrarAvancado, setMostrarAvancado] = useState(false);

  /**
   * Preencher uma tabela e teclar, nao clicar: Enter desce, Tab anda para o
   * lado (a ordem do DOM ja faz isso) e Enter na ultima linha cria a proxima.
   */
  const campos = useRef<Record<string, HTMLInputElement | null>>({});
  const focarDepois = useRef<string | null>(null);

  useEffect(() => {
    const alvo = focarDepois.current;
    if (!alvo) return;
    const campo = campos.current[alvo];
    if (!campo) return;
    focarDepois.current = null;
    campo.focus();
    campo.select();
  });

  const andar = (c: number, r: number, passo: number) => {
    const destino = r + passo;
    if (destino < 0) return;
    if (destino >= t.rows) {
      if (passo < 0) return;
      focarDepois.current = refOf(c, destino);
      mudar({ rows: t.rows + 1 });
      return;
    }
    const campo = campos.current[refOf(c, destino)];
    campo?.focus();
    campo?.select();
  };

  const resultados = useMemo(
    () =>
      evaluateGrid(t.cells, linked ? { column: (n) => linked[n] ?? [] } : {}),
    [t.cells, linked],
  );

  const tabelasGrandes = pages.filter((p) => p.type === 'database');
  // Mesmo motivo do mural: enquanto a tabela vinculada nao chega, COLUNA()
  // daria #NOME sem que haja erro nenhum.
  const aguardandoVinculo = Boolean(t.linkedPageId) && !linked;

  // A tabela vive no elemento do mural, nao aqui: guardar uma copia local
  // faria a copia e o original disputarem quem manda a cada tecla.
  const mudar = (patch: Partial<MiniTable>) => onSave({ ...t, ...patch });

  const setCelula = (ref: string, valor: string) => {
    const cells = { ...t.cells };
    if (valor === '') delete cells[ref];
    else cells[ref] = valor;
    mudar({ cells });
  };

  const addColuna = () =>
    mudar({ cols: t.cols + 1, widths: [...t.widths, LARGURA_PADRAO] });

  const addLinha = () => mudar({ rows: t.rows + 1 });

  /** Apagar mexe nas referencias, entao as celulas que somem vao junto. */
  const tirarColuna = (col?: number) => {
    if (t.cols <= 1) return;
    const idx = col ?? t.cols - 1;
    if (idx < 0 || idx >= t.cols) return;

    const cells = { ...t.cells };
    // Apagar celulas da coluna
    for (let r = 0; r < t.rows; r++) delete cells[refOf(idx, r)];
    // Deslocar referencias das colunas apos a deletada
    for (let r = 0; r < t.rows; r++) {
      for (let c = idx + 1; c < t.cols; c++) {
        const velho = refOf(c, r);
        if (velho in cells) {
          const novo = refOf(c - 1, r);
          cells[novo] = cells[velho];
          delete cells[velho];
        }
      }
    }
    const novas = t.widths.filter((_, i) => i !== idx);
    mudar({ cols: t.cols - 1, widths: novas, cells });
  };

  const tirarLinha = (row?: number) => {
    if (t.rows <= 1) return;
    const idx = row ?? t.rows - 1;
    if (idx < 0 || idx >= t.rows) return;

    const cells = { ...t.cells };
    // Apagar celulas da linha
    for (let c = 0; c < t.cols; c++) delete cells[refOf(c, idx)];
    // Deslocar referencias das linhas apos a deletada
    for (let c = 0; c < t.cols; c++) {
      for (let r = idx + 1; r < t.rows; r++) {
        const velho = refOf(c, r);
        if (velho in cells) {
          const novo = refOf(c, r - 1);
          cells[novo] = cells[velho];
          delete cells[velho];
        }
      }
    }
    mudar({ rows: t.rows - 1, cells });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl shadow-slate-900/20"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-[15px] font-semibold text-slate-800">Tabela</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-5">
          <table className="border-separate border-spacing-0 text-[13px] group/tabela">
            <thead>
              <tr>
                <th className="w-6" />
                {Array.from({ length: t.cols }, (_, c) => (
                  <th
                    key={c}
                    style={{ minWidth: t.widths[c] ?? LARGURA_PADRAO }}
                    className="pb-0.5 text-center opacity-0 group-hover/tabela:opacity-100 transition-opacity"
                  >
                    {canEdit && t.cols > 1 && (
                      <button
                        onClick={() => tirarColuna(c)}
                        title="Apagar coluna"
                        className="rounded px-1 py-0.5 text-[13px] leading-none text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                      >
                        ×
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: t.rows }, (_, r) => (
                <tr key={r} className={!t.header && r === 0 ? 'hidden' : 'group/linha'}>
                  <td className="pr-1 text-right text-[11px] text-slate-300 relative">
                    <span className="group-hover/linha:opacity-0 transition-opacity">{r + 1}</span>
                    {canEdit && t.rows > 1 && (
                      <button
                        onClick={() => tirarLinha(r)}
                        title="Apagar linha"
                        className="absolute inset-0 opacity-0 group-hover/linha:opacity-100 transition-opacity text-slate-300 hover:text-red-500"
                      >
                        ×
                      </button>
                    )}
                  </td>
                  {Array.from({ length: t.cols }, (_, c) => {
                    const ref = refOf(c, r);
                    const bruto = t.cells[ref] ?? '';
                    const bruta = resultados[ref];
                    const pendente = aguardandoVinculo && bruta?.error === '#NOME';
                    const res = pendente ? { value: '...', error: null } : bruta;
                    const editando = foco === ref;
                    const cabecalho = t.header && r === 0;
                    return (
                      <td key={ref} className="p-0">
                        <input
                          ref={(no) => {
                            campos.current[ref] = no;
                          }}
                          autoFocus={canEdit && c === 0 && r === (t.header ? 1 : 0)}
                          value={editando ? bruto : displayValue(res)}
                          readOnly={!canEdit}
                          onFocus={() => setFoco(ref)}
                          onBlur={() => setFoco(null)}
                          onChange={(e) => setCelula(ref, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              (e.target as HTMLInputElement).blur();
                              return;
                            }
                            if (e.key === 'Enter' || e.key === 'ArrowDown') {
                              e.preventDefault();
                              andar(c, r, e.key === 'Enter' && e.shiftKey ? -1 : 1);
                              return;
                            }
                            if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              andar(c, r, -1);
                            }
                          }}
                          style={{ width: t.widths[c] ?? LARGURA_PADRAO }}
                          className={
                            'border border-slate-200 px-2 py-1.5 outline-none transition ' +
                            '-ml-px -mt-px focus:relative focus:z-10 focus:ring-2 focus:ring-blue-400 ' +
                            (cabecalho ? 'bg-slate-50 font-semibold text-slate-700 ' : 'bg-white ') +
                            (res?.error
                              ? 'text-red-600 '
                              : typeof res?.value === 'number' && !cabecalho
                                ? 'text-right text-slate-800 '
                                : 'text-slate-700 ')
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {canEdit && (
            <div className="mt-3 flex items-center gap-3 text-[12px] text-slate-400">
              <button
                onClick={addLinha}
                title="Adicionar linha"
                className="rounded px-1.5 py-0.5 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                + linha
              </button>
              <button
                onClick={addColuna}
                title="Adicionar coluna"
                className="rounded px-1.5 py-0.5 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                + coluna
              </button>
              <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-700">
                <input
                  type="checkbox"
                  checked={t.header}
                  onChange={(e) => mudar({ header: e.target.checked })}
                  className="accent-blue-500 h-3 w-3"
                />
                cabeçalho
              </label>

              <div className="flex-1" />

              <button
                onClick={() => setMostrarAvancado((v) => !v)}
                className="text-[11px] hover:text-slate-700 transition"
              >
                {mostrarAvancado ? 'Menos' : 'Mais'} opções
              </button>
            </div>
          )}

          {canEdit && mostrarAvancado && (
            <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
              <select
                value={t.linkedPageId ?? ''}
                onChange={(e) => mudar({ linkedPageId: e.target.value || undefined })}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] text-slate-600 outline-none focus:border-blue-400"
              >
                <option value="">Vincular a uma tabela do mural…</option>
                {tabelasGrandes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              <p className="text-[11px] leading-relaxed text-slate-400">
                Fórmulas: comece com <code className="rounded bg-slate-100 px-1">=</code>. Ex: <code className="rounded bg-slate-100 px-1">=SOMA(A:A)</code>, <code className="rounded bg-slate-100 px-1">=A2*B2</code>
                {t.linkedPageId && (
                  <> · <code className="rounded bg-slate-100 px-1">=COLUNA(&quot;Nome&quot;)</code> soma coluna da tabela vinculada.</>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
