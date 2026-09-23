'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon';
import { colName, displayValue, evaluateGrid, refOf } from '@/lib/formula';
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

  const tirarLinha = () => {
    if (t.rows <= 1) return;
    const ultima = t.rows - 1;
    const cells = { ...t.cells };
    for (let c = 0; c < t.cols; c++) delete cells[refOf(c, ultima)];
    mudar({ rows: ultima, cells });
  };

  const somarColuna = (c: number) => {
    const primeira = t.header ? 1 : 0;
    const ultima = t.rows - 1;
    if (ultima <= primeira) return;
    const destino = refOf(c, ultima);
    setCelula(
      destino,
      `=SOMA(${refOf(c, primeira)}:${refOf(c, ultima - 1)})`,
    );
    setFoco(destino);
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
          <table className="border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr>
                <th className="w-8" />
                {Array.from({ length: t.cols }, (_, c) => (
                  <th
                    key={c}
                    style={{ minWidth: t.widths[c] ?? LARGURA_PADRAO }}
                    className="pb-1 text-center text-[11px] font-medium text-slate-400"
                  >
                    <span>{colName(c)}</span>
                    {canEdit && (
                      <div className="inline-flex gap-0.5 ml-1">
                        <button
                          onClick={() => somarColuna(c)}
                          title="Somar esta coluna"
                          className="rounded px-1 text-[10px] text-slate-300 transition hover:bg-slate-100 hover:text-blue-500"
                        >
                          Σ
                        </button>
                        {t.cols > 1 && (
                          <button
                            onClick={() => tirarColuna(c)}
                            title="Apagar esta coluna"
                            className="rounded px-0.5 text-[10px] text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: t.rows }, (_, r) => (
                <tr key={r} className={!t.header && r === 0 ? 'hidden' : ''}>
                  <td className="pr-1 text-right text-[11px] text-slate-300">{r + 1}</td>
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
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[12.5px]">
              <button onClick={addLinha} className={botao}>+ Linha</button>
              {t.rows > 1 && (
                <button onClick={() => tirarLinha()} className={botao}>− Linha</button>
              )}
              <button onClick={addColuna} className={botao}>+ Coluna</button>
              <label className="flex items-center gap-1.5 text-slate-500">
                <input
                  type="checkbox"
                  checked={t.header}
                  onChange={(e) => mudar({ header: e.target.checked })}
                  className="accent-blue-500"
                />
                Cabeçalho
              </label>
            </div>
          )}

          {canEdit && (
            <div className="mt-4 rounded-xl bg-slate-50 p-3.5">
              <label className="block text-[12px] font-medium text-slate-600">
                Vincular a uma tabela do mural
              </label>
              <select
                value={t.linkedPageId ?? ''}
                onChange={(e) => mudar({ linkedPageId: e.target.value || undefined })}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-700 outline-none focus:border-blue-400"
              >
                <option value="">Nenhuma — esta tabela vive sozinha</option>
                {tabelasGrandes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              {t.linkedPageId && (
                <p className="mt-2 text-[11.5px] leading-relaxed text-slate-500">
                  Use <code className="rounded bg-white px-1">=COLUNA(&quot;Nome&quot;)</code> para
                  trazer a soma de uma coluna de numeros daquela tabela.
                  {linked && Object.keys(linked).length > 0 && (
                    <> Disponiveis: {Object.keys(linked).join(', ')}.</>
                  )}
                </p>
              )}
            </div>
          )}

          <p className="mt-4 text-[11.5px] leading-relaxed text-slate-400">
            Comece uma celula com <code className="rounded bg-slate-100 px-1">=</code> para
            calcular: <code className="rounded bg-slate-100 px-1">=A2*B2</code>,{' '}
            <code className="rounded bg-slate-100 px-1">=SOMA(C2:C9)</code>,{' '}
            <code className="rounded bg-slate-100 px-1">=SE(C4&gt;100;&quot;alto&quot;;&quot;ok&quot;)</code>.
            Tambem valem MEDIA, MIN, MAX, CONT, ARRED, CONCAT.
          </p>
        </div>
      </div>
    </div>
  );
}

const botao =
  'rounded-lg border border-slate-200 px-2.5 py-1 text-slate-600 transition hover:bg-slate-50';
