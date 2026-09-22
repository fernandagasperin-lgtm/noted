'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import {
  COLUMN_LABELS,
  FORMAT_LABELS,
  OPTION_COLORS,
  formatNumber,
  type ColumnType,
  type DbColumn,
  type DbRow,
  type NumberDisplay,
  type NumberFormat,
  type SelectOption,
} from '@/lib/types';
import RowDialog from './RowDialog';
import Icon, { TYPE_COLOR } from './Icon';
import {
  OP_LABELS,
  applyFilters,
  applySorts,
  opNeedsValue,
  opsFor,
  type FilterOp,
  type TableFilter,
  type TableSort,
} from '@/lib/table';

interface Props {
  pageId: string;
  canEdit: boolean;
  titleWidth: number;
  onTitleWidth: (width: number) => void;
  sorts: TableSort[];
  filters: TableFilter[];
  groupBy: string | null;
  onView: (patch: {
    sorts?: TableSort[];
    filters?: TableFilter[];
    groupBy?: string | null;
  }) => void;
}

export default function DatabasePage({
  pageId,
  canEdit,
  titleWidth,
  onTitleWidth,
  sorts,
  filters,
  groupBy,
  onView,
}: Props) {
  const [painel, setPainel] = useState<'sort' | 'filter' | 'group' | null>(null);
  const [gruposFechados, setGruposFechados] = useState<Record<string, boolean>>({});
  const [arrastandoColuna, setArrastandoColuna] = useState<string | null>(null);
  const [alvoSolta, setAlvoSolta] = useState<string | null>(null);
  const [columns, setColumns] = useState<DbColumn[]>([]);
  const [rows, setRows] = useState<DbRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ rowId: string; columnId: string } | null>(null);
  const [menuColumn, setMenuColumn] = useState<string | null>(null);
  const [openRow, setOpenRow] = useState<DbRow | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/pages/${pageId}/table`);
    if (!res.ok) return;
    const data = await res.json();
    setColumns(data.columns);
    setRows(data.rows);
    setLoading(false);
  }, [pageId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // --- gravacao ---

  /** Digitar e trocar de pagina nao pode perder o texto: grava sozinho,
   *  como o resto do app faz, em vez de depender de sair do campo. */
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const saveRowSoon = (rowId: string, patch: Partial<DbRow>) => {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
    clearTimeout(timers.current[rowId]);
    timers.current[rowId] = setTimeout(() => {
      fetch(`/api/pages/${pageId}/table/rows/${rowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
    }, 500);
  };

  useEffect(() => {
    const pendentes = timers.current;
    return () => Object.values(pendentes).forEach(clearTimeout);
  }, []);

  const saveRow = async (rowId: string, patch: Partial<DbRow>) => {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
    await fetch(`/api/pages/${pageId}/table/rows/${rowId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
  };

  const setCell = (row: DbRow, columnId: string, value: unknown) =>
    saveRow(row.id, { values: { ...row.values, [columnId]: value } });

  const saveColumn = async (columnId: string, patch: Partial<DbColumn>) => {
    setColumns((prev) => prev.map((c) => (c.id === columnId ? { ...c, ...patch } : c)));
    await fetch(`/api/pages/${pageId}/table/columns/${columnId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
  };

  const addColumn = async (type: ColumnType) => {
    setAddingColumn(false);
    const res = await fetch(`/api/pages/${pageId}/table/columns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: COLUMN_LABELS[type], type }),
    });
    if (!res.ok) return;
    const nova = await res.json();
    setColumns((prev) => [...prev, nova]);
  };

  const removeColumn = async (columnId: string) => {
    setMenuColumn(null);
    setColumns((prev) => prev.filter((c) => c.id !== columnId));
    await fetch(`/api/pages/${pageId}/table/columns/${columnId}`, { method: 'DELETE' });
    load();
  };

  const addRow = async () => {
    const res = await fetch(`/api/pages/${pageId}/table/rows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '' }),
    });
    if (!res.ok) return;
    const nova = await res.json();
    setRows((prev) => [...prev, nova]);
  };

  const removeRow = async (rowId: string) => {
    setRows((prev) => prev.filter((r) => r.id !== rowId));
    await fetch(`/api/pages/${pageId}/table/rows/${rowId}`, { method: 'DELETE' });
  };

  /**
   * Arrastar a borda do cabecalho: a largura muda na hora e so vai para o
   * servidor ao soltar, para nao disparar uma gravacao a cada pixel.
   */
  const arrastando = useRef<{ inicioX: number; inicioLargura: number } | null>(null);
  const [larguraTitulo, setLarguraTitulo] = useState(titleWidth);

  useEffect(() => setLarguraTitulo(titleWidth), [titleWidth]);

  const iniciarArrasto = (
    e: React.PointerEvent,
    larguraAtual: number,
    aoMover: (w: number) => void,
    aoSoltar: (w: number) => void,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    arrastando.current = { inicioX: e.clientX, inicioLargura: larguraAtual };
    let ultima = larguraAtual;

    const mover = (ev: PointerEvent) => {
      const d = arrastando.current;
      if (!d) return;
      ultima = Math.max(80, Math.min(800, d.inicioLargura + (ev.clientX - d.inicioX)));
      aoMover(ultima);
    };
    const soltar = () => {
      arrastando.current = null;
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      document.body.style.cursor = '';
      aoSoltar(ultima);
    };

    document.body.style.cursor = 'col-resize';
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
  };

  const Alca = ({ onStart }: { onStart: (e: React.PointerEvent) => void }) =>
    canEdit ? (
      <span
        onPointerDown={onStart}
        onClick={(e) => e.stopPropagation()}
        title="Arraste para redimensionar"
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-[#2383E2]"
      />
    ) : null;

  /** Reordena gravando a nova posicao de cada coluna afetada. */
  const moverColuna = async (origemId: string, destinoId: string) => {
    if (origemId === destinoId) return;
    const ordem = columns.map((c) => c.id);
    const de = ordem.indexOf(origemId);
    const para = ordem.indexOf(destinoId);
    if (de === -1 || para === -1) return;
    ordem.splice(para, 0, ...ordem.splice(de, 1));

    const reordenadas = ordem.map(
      (id, i) => ({ ...columns.find((c) => c.id === id)!, position: i }),
    );
    setColumns(reordenadas);
    await Promise.all(
      reordenadas.map((c) =>
        fetch(`/api/pages/${pageId}/table/columns/${c.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position: c.position }),
        }),
      ),
    );
  };

  /** Uma opcao nova nasce ao ser digitada, como no Notion. */
  const ensureOption = async (column: DbColumn, name: string): Promise<SelectOption> => {
    const existing = column.options.find(
      (o) => o.name.toLowerCase() === name.trim().toLowerCase(),
    );
    if (existing) return existing;
    const option: SelectOption = {
      id: crypto.randomUUID(),
      name: name.trim(),
      color: OPTION_COLORS[column.options.length % OPTION_COLORS.length],
    };
    await saveColumn(column.id, { options: [...column.options, option] });
    return option;
  };

  /** A coluna de titulo nao vive em db_columns, mas serve de criterio. */
  const criterios = [
    { id: 'title', nome: 'Nome', type: 'text' as ColumnType },
    ...columns.map((c) => ({ id: c.id, nome: c.name, type: c.type })),
  ];
  const tipoDe = (id: string) => criterios.find((c) => c.id === id)?.type ?? 'text';

  const visiveis = applySorts(applyFilters(rows, columns, filters), columns, sorts);

  /** A barra e proporcional ao maior valor da coluna, como no Notion. */
  const maximos: Record<string, number> = {};
  for (const c of columns) {
    if (c.type !== 'number') continue;
    maximos[c.id] = visiveis.reduce(
      (m, r) => Math.max(m, Number(r.values[c.id]) || 0),
      0,
    );
  }

  /** Agrupa preservando a ordem ja aplicada dentro de cada grupo. */
  const colunaGrupo = columns.find((c) => c.id === groupBy) ?? null;
  const rotuloGrupo = (row: DbRow): string => {
    if (!colunaGrupo) return '';
    const v = row.values[colunaGrupo.id];
    if (colunaGrupo.type === 'check') return v ? 'Marcado' : 'Nao marcado';
    const ids = Array.isArray(v) ? (v as string[]) : v ? [String(v)] : [];
    if (colunaGrupo.type === 'select' || colunaGrupo.type === 'multi') {
      const nomes = ids
        .map((id) => colunaGrupo.options.find((o) => o.id === id)?.name)
        .filter(Boolean);
      return nomes.length ? nomes.join(', ') : 'Sem valor';
    }
    return v === null || v === undefined || v === '' ? 'Sem valor' : String(v);
  };

  const grupos: { rotulo: string; linhas: DbRow[] }[] = [];
  if (colunaGrupo) {
    for (const row of visiveis) {
      const rotulo = rotuloGrupo(row);
      const achado = grupos.find((g) => g.rotulo === rotulo);
      if (achado) achado.linhas.push(row);
      else grupos.push({ rotulo, linhas: [row] });
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-[13px] text-[#9B9A97]">
        Carregando tabela...
      </div>
    );
  }

  const cellBase =
    'border-b border-r border-[#E9E9E7] px-2 py-1.5 text-[14px] text-[#37352F] align-top';

  const renderLinha = (row: DbRow) => (
            <tr key={row.id} className="group">
        <td
          style={{ width: larguraTitulo, minWidth: larguraTitulo }}
          className={'sticky left-0 z-10 bg-white ' + cellBase}
        >
          <div className="flex items-center gap-1.5">
            <span className="shrink-0">
              <Icon name="text" size={13} color="#C7C6C4" />
            </span>
            <input
              value={row.title}
              readOnly={!canEdit}
              onChange={(e) => saveRowSoon(row.id, { title: e.target.value })}
              placeholder="Sem titulo"
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#C7C6C4]"
            />
            <button
              onClick={() => setOpenRow(row)}
              className="flex shrink-0 items-center gap-1 rounded border border-[#E9E9E7] px-1.5 py-0.5 text-[11px] text-[#787774] opacity-0 transition hover:bg-[#F7F7F5] group-hover:opacity-100"
            >
              <Icon name="open" size={11} />
              ABRIR
            </button>
            {canEdit && (
              <button
                onClick={() => removeRow(row.id)}
                title="Excluir linha"
                className="shrink-0 px-1 text-[#C7C6C4] opacity-0 transition hover:text-[#EB5757] group-hover:opacity-100"
              >
                <Icon name="close" size={13} />
              </button>
            )}
          </div>
        </td>

        {columns.map((c) => (
          <td
            key={c.id}
            style={{ width: c.width, minWidth: c.width }}
            onClick={() => canEdit && setEditing({ rowId: row.id, columnId: c.id })}
            className={
              cellBase +
              ' cursor-text hover:bg-[#F7F7F5] ' +
              (c.type === 'number' ? ' text-right' : '')
            }
          >
            <Cell
              column={c}
              row={row}
              maxDaColuna={maximos[c.id] ?? 0}
              editing={editing?.rowId === row.id && editing?.columnId === c.id}
              canEdit={canEdit}
              onDone={() => setEditing(null)}
              onChange={(v) => setCell(row, c.id, v)}
              ensureOption={ensureOption}
            />
          </td>
        ))}
        <td className="border-b border-[#E9E9E7]" />
      </tr>
  );

  const botaoBarra = (ativo: boolean) =>
    'flex items-center gap-1.5 rounded px-2 py-1 text-[13px] transition ' +
    (ativo ? 'bg-[#E7F3F8] text-[#2383E2]' : 'text-[#787774] hover:bg-[#F1F1EF]');

  const seletorDeCriterio = (valor: string, aoTrocar: (id: string) => void) => (
    <select
      value={valor}
      onChange={(e) => aoTrocar(e.target.value)}
      className="min-w-0 flex-1 rounded border border-[#E9E9E7] px-1.5 py-1 text-[13px] outline-none"
    >
      {criterios.map((c) => (
        <option key={c.id} value={c.id}>
          {c.nome}
        </option>
      ))}
    </select>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {canEdit && (
        <div className="relative flex shrink-0 items-center gap-1 border-b border-[#E9E9E7] px-3 py-1.5">
          <button
            onClick={() => setPainel(painel === 'filter' ? null : 'filter')}
            className={botaoBarra(filters.length > 0)}
          >
            Filtrar
            {filters.length > 0 && <span>{filters.length}</span>}
          </button>
          <button
            onClick={() => setPainel(painel === 'sort' ? null : 'sort')}
            className={botaoBarra(sorts.length > 0)}
          >
            Ordenar
            {sorts.length > 0 && <span>{sorts.length}</span>}
          </button>
          <button
            onClick={() => setPainel(painel === 'group' ? null : 'group')}
            className={botaoBarra(Boolean(groupBy))}
          >
            Agrupar
          </button>

          <span className="ml-auto text-[12px] text-[#9B9A97]">
            {visiveis.length === rows.length
              ? rows.length + (rows.length === 1 ? ' linha' : ' linhas')
              : visiveis.length + ' de ' + rows.length}
          </span>

          {painel && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setPainel(null)} />
              <div className="absolute left-3 top-9 z-30 w-[23rem] rounded-lg border border-[#E9E9E7] bg-white p-2 shadow-xl">
                {painel === 'group' ? (
                  <>
                    <div className="px-1 pb-1 text-[11px] uppercase tracking-wide text-[#9B9A97]">
                      Agrupar por
                    </div>
                    <button
                      onClick={() => onView({ groupBy: null })}
                      className={
                        'flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[13px] hover:bg-[#F1F1EF] ' +
                        (groupBy ? 'text-[#37352F]' : 'text-[#2383E2]')
                      }
                    >
                      Sem agrupamento
                    </button>
                    {columns
                      .filter((c) => c.type !== 'url' && c.type !== 'text')
                      .map((c) => (
                        <button
                          key={c.id}
                          onClick={() => onView({ groupBy: c.id })}
                          className={
                            'flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[13px] hover:bg-[#F1F1EF] ' +
                            (groupBy === c.id ? 'text-[#2383E2]' : 'text-[#37352F]')
                          }
                        >
                          <Icon name={c.type} size={14} color={TYPE_COLOR[c.type]} />
                          {c.name}
                        </button>
                      ))}
                    <p className="px-1.5 pt-2 text-[11.5px] leading-relaxed text-[#9B9A97]">
                      Colunas de texto livre ficam de fora: agrupar por elas daria um grupo
                      por linha.
                    </p>
                  </>
                ) : painel === 'sort' ? (
                  <>
                    {sorts.length === 0 && (
                      <p className="px-1 py-2 text-[13px] text-[#9B9A97]">Nenhuma ordenacao.</p>
                    )}
                    {sorts.map((criterio, i) => (
                      <div key={i} className="mb-1 flex items-center gap-1">
                        {seletorDeCriterio(criterio.columnId, (id) =>
                          onView({
                            sorts: sorts.map((x, j) => (j === i ? { ...x, columnId: id } : x)),
                          }),
                        )}
                        <select
                          value={criterio.direction}
                          onChange={(e) =>
                            onView({
                              sorts: sorts.map((x, j) =>
                                j === i
                                  ? { ...x, direction: e.target.value as 'asc' | 'desc' }
                                  : x,
                              ),
                            })
                          }
                          className="rounded border border-[#E9E9E7] px-1.5 py-1 text-[13px] outline-none"
                        >
                          <option value="asc">crescente</option>
                          <option value="desc">decrescente</option>
                        </select>
                        <button
                          onClick={() => onView({ sorts: sorts.filter((_, j) => j !== i) })}
                          className="shrink-0 px-1 text-[#C7C6C4] hover:text-[#EB5757]"
                        >
                          <Icon name="close" size={13} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() =>
                        onView({ sorts: [...sorts, { columnId: 'title', direction: 'asc' }] })
                      }
                      className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[13px] text-[#787774] hover:bg-[#F1F1EF]"
                    >
                      <Icon name="plus" size={13} />
                      Adicionar ordenacao
                    </button>
                  </>
                ) : (
                  <>
                    {filters.length === 0 && (
                      <p className="px-1 py-2 text-[13px] text-[#9B9A97]">Nenhum filtro.</p>
                    )}
                    {filters.map((f, i) => (
                      <div key={f.id} className="mb-1 flex items-center gap-1">
                        {seletorDeCriterio(f.columnId, (id) =>
                          onView({
                            filters: filters.map((x, j) =>
                              j === i ? { ...x, columnId: id, op: opsFor(tipoDe(id))[0] } : x,
                            ),
                          }),
                        )}
                        <select
                          value={f.op}
                          onChange={(e) =>
                            onView({
                              filters: filters.map((x, j) =>
                                j === i ? { ...x, op: e.target.value as FilterOp } : x,
                              ),
                            })
                          }
                          className="rounded border border-[#E9E9E7] px-1.5 py-1 text-[13px] outline-none"
                        >
                          {opsFor(tipoDe(f.columnId)).map((op) => (
                            <option key={op} value={op}>
                              {OP_LABELS[op]}
                            </option>
                          ))}
                        </select>
                        {opNeedsValue(f.op) && (
                          <input
                            type={tipoDe(f.columnId) === 'date' ? 'date' : 'text'}
                            value={f.value}
                            onChange={(e) =>
                              onView({
                                filters: filters.map((x, j) =>
                                  j === i ? { ...x, value: e.target.value } : x,
                                ),
                              })
                            }
                            placeholder="valor"
                            className="w-20 min-w-0 rounded border border-[#E9E9E7] px-1.5 py-1 text-[13px] outline-none"
                          />
                        )}
                        <button
                          onClick={() => onView({ filters: filters.filter((_, j) => j !== i) })}
                          className="shrink-0 px-1 text-[#C7C6C4] hover:text-[#EB5757]"
                        >
                          <Icon name="close" size={13} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() =>
                        onView({
                          filters: [
                            ...filters,
                            {
                              id: crypto.randomUUID(),
                              columnId: 'title',
                              op: 'contains' as FilterOp,
                              value: '',
                            },
                          ],
                        })
                      }
                      className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[13px] text-[#787774] hover:bg-[#F1F1EF]"
                    >
                      <Icon name="plus" size={13} />
                      Adicionar filtro
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">

      {/* table-fixed com largura explicita: sem isso o navegador dava a sobra
          para a primeira coluna e ela ignorava o redimensionamento */}
      <table
        style={{
          tableLayout: 'fixed',
          width: larguraTitulo + columns.reduce((t, c) => t + c.width, 0) + 160,
        }}
        className="border-collapse"
      >
        <thead>
          <tr>
            <th
              style={{ width: larguraTitulo, minWidth: larguraTitulo }}
              className={
                'sticky left-0 z-10 border-b border-r border-[#E9E9E7] ' +
                'relative bg-white px-2 py-1.5 text-left text-[13px] font-normal text-[#9B9A97]'
              }
            >
              <span className="mr-1.5 inline-block align-[-2px]">
                <Icon name="title" size={13} color="#9B9A97" />
              </span>
              Nome
              <Alca
                onStart={(e) =>
                  iniciarArrasto(e, larguraTitulo, setLarguraTitulo, onTitleWidth)
                }
              />
            </th>

            {columns.map((c) => (
              <th
                key={c.id}
                style={{ width: c.width, minWidth: c.width }}
                draggable={canEdit}
                onDragStart={() => setArrastandoColuna(c.id)}
                onDragOver={(e) => {
                  if (!arrastandoColuna || arrastandoColuna === c.id) return;
                  e.preventDefault();
                  setAlvoSolta(c.id);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (arrastandoColuna) moverColuna(arrastandoColuna, c.id);
                  setArrastandoColuna(null);
                  setAlvoSolta(null);
                }}
                onDragEnd={() => {
                  setArrastandoColuna(null);
                  setAlvoSolta(null);
                }}
                className={
                  'relative border-b border-r border-[#E9E9E7] px-2 py-1.5 text-left text-[13px] font-normal text-[#9B9A97] ' +
                  (arrastandoColuna === c.id ? 'opacity-40 ' : '') +
                  (alvoSolta === c.id ? 'bg-[#E7F3F8] ' : '')
                }
              >
                <button
                  onClick={() => canEdit && setMenuColumn(menuColumn === c.id ? null : c.id)}
                  className="flex w-full items-center gap-1.5 truncate text-left hover:text-[#37352F]"
                >
                  <Icon name={c.type} size={14} color={TYPE_COLOR[c.type]} />
                  <span className="truncate">{c.name}</span>
                </button>

                <Alca
                  onStart={(e) =>
                    iniciarArrasto(
                      e,
                      c.width,
                      (w) =>
                        setColumns((prev) =>
                          prev.map((x) => (x.id === c.id ? { ...x, width: w } : x)),
                        ),
                      (w) => saveColumn(c.id, { width: w }),
                    )
                  }
                />

                {menuColumn === c.id && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setMenuColumn(null)} />
                    <div className="absolute left-0 top-9 z-30 w-64 rounded-lg border border-[#E9E9E7] bg-white p-1.5 shadow-xl">
                      <input
                        defaultValue={c.name}
                        onBlur={(e) => saveColumn(c.id, { name: e.target.value })}
                        className="mb-2 w-full rounded border border-[#E9E9E7] px-2 py-1 text-[13px] text-[#37352F] outline-none focus:border-[#2383E2]"
                      />

                      <div className="px-1 pb-1 text-[11px] uppercase tracking-wide text-[#9B9A97]">
                        Tipo
                      </div>
                      <div className="mb-2 max-h-40 overflow-y-auto">
                        {(Object.keys(COLUMN_LABELS) as ColumnType[]).map((t) => (
                          <button
                            key={t}
                            onClick={() => saveColumn(c.id, { type: t })}
                            className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[13px] text-[#37352F] hover:bg-[#F1F1EF]"
                          >
                            <Icon name={t} size={14} color={TYPE_COLOR[t]} />
                            <span className="flex-1">{COLUMN_LABELS[t]}</span>
                            {c.type === t && <span className="text-[#2383E2]">✓</span>}
                          </button>
                        ))}
                      </div>

                      {c.type === 'number' && (
                        <>
                          <div className="px-1 pb-1 text-[11px] uppercase tracking-wide text-[#9B9A97]">
                            Formato
                          </div>
                          <select
                            value={c.format}
                            onChange={(e) =>
                              saveColumn(c.id, { format: e.target.value as NumberFormat })
                            }
                            className="mb-2 w-full rounded border border-[#E9E9E7] px-2 py-1 text-[13px] text-[#37352F] outline-none"
                          >
                            {(Object.keys(FORMAT_LABELS) as NumberFormat[]).map((f) => (
                              <option key={f} value={f}>
                                {FORMAT_LABELS[f]}
                              </option>
                            ))}
                          </select>

                          <div className="px-1 pb-1 text-[11px] uppercase tracking-wide text-[#9B9A97]">
                            Casas decimais
                          </div>
                          <select
                            value={c.decimals === null ? 'auto' : String(c.decimals)}
                            onChange={(e) =>
                              saveColumn(c.id, {
                                decimals: e.target.value === 'auto' ? null : Number(e.target.value),
                              })
                            }
                            className="mb-2 w-full rounded border border-[#E9E9E7] px-2 py-1 text-[13px] text-[#37352F] outline-none"
                          >
                            <option value="auto">Automatico</option>
                            {[0, 1, 2, 3, 4].map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>

                          <div className="px-1 pb-1 text-[11px] uppercase tracking-wide text-[#9B9A97]">
                            Mostrar como
                          </div>
                          <div className="mb-2 flex gap-1">
                            {(['number', 'bar'] as NumberDisplay[]).map((d) => (
                              <button
                                key={d}
                                onClick={() => saveColumn(c.id, { display: d })}
                                className={
                                  'flex-1 rounded border px-2 py-1 text-[12.5px] ' +
                                  (c.display === d
                                    ? 'border-[#2383E2] text-[#2383E2]'
                                    : 'border-[#E9E9E7] text-[#787774] hover:bg-[#F1F1EF]')
                                }
                              >
                                {d === 'number' ? 'Numero' : 'Barra'}
                              </button>
                            ))}
                          </div>
                        </>
                      )}

                      {(c.type === 'select' || c.type === 'multi') && (
                        <>
                          <div className="px-1 pb-1 text-[11px] uppercase tracking-wide text-[#9B9A97]">
                            Opcoes
                          </div>
                          <div className="mb-1 max-h-44 space-y-0.5 overflow-y-auto">
                            {c.options.map((o) => (
                              <div key={o.id} className="flex items-center gap-1 px-1">
                                <input
                                  defaultValue={o.name}
                                  onBlur={(e) =>
                                    saveColumn(c.id, {
                                      options: c.options.map((x) =>
                                        x.id === o.id ? { ...x, name: e.target.value } : x,
                                      ),
                                    })
                                  }
                                  className="min-w-0 flex-1 rounded px-1.5 py-0.5 text-[12.5px] text-[#37352F] outline-none"
                                  style={{ background: o.color }}
                                />
                                <div className="flex shrink-0 gap-0.5">
                                  {OPTION_COLORS.map((cor) => (
                                    <button
                                      key={cor}
                                      title="Trocar a cor"
                                      onClick={() =>
                                        saveColumn(c.id, {
                                          options: c.options.map((x) =>
                                            x.id === o.id ? { ...x, color: cor } : x,
                                          ),
                                        })
                                      }
                                      className={
                                        'h-3 w-3 rounded-full ' +
                                        (o.color === cor ? 'ring-1 ring-[#37352F]' : '')
                                      }
                                      style={{ background: cor }}
                                    />
                                  ))}
                                </div>
                                <button
                                  title="Excluir opcao"
                                  onClick={() =>
                                    saveColumn(c.id, {
                                      options: c.options.filter((x) => x.id !== o.id),
                                    })
                                  }
                                  className="shrink-0 text-[#C7C6C4] hover:text-[#EB5757]"
                                >
                                  <Icon name="close" size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={() =>
                              saveColumn(c.id, {
                                options: [
                                  ...c.options,
                                  {
                                    id: crypto.randomUUID(),
                                    name: 'Opcao ' + (c.options.length + 1),
                                    color: OPTION_COLORS[c.options.length % OPTION_COLORS.length],
                                  },
                                ],
                              })
                            }
                            className="mb-2 flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[13px] text-[#787774] hover:bg-[#F1F1EF]"
                          >
                            <Icon name="plus" size={13} />
                            Nova opcao
                          </button>
                        </>
                      )}

                      <div className="my-1 h-px bg-[#E9E9E7]" />
                      <button
                        onClick={() => removeColumn(c.id)}
                        className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[13px] text-[#EB5757] hover:bg-[#FBECEC]"
                      >
                        <Icon name="trash" size={14} />
                        Excluir coluna
                      </button>
                    </div>
                  </>
                )}
              </th>
            ))}

            {/* absorve a largura que sobra, para as colunas nao esticarem */}
            <th className="border-b border-[#E9E9E7] px-2 py-1.5 text-left">
              {canEdit && (
                <div className="relative inline-block">
                  <button
                    onClick={() => setAddingColumn(!addingColumn)}
                    title="Nova coluna"
                    className="whitespace-nowrap text-[13px] font-normal text-[#9B9A97] hover:text-[#37352F]"
                  >
                    {columns.length === 0 ? '+  Adicionar propriedade' : '+'}
                  </button>
                  {addingColumn && (
                    <>
                      <div className="fixed inset-0 z-20" onClick={() => setAddingColumn(false)} />
                      <div className="absolute left-0 top-7 z-30 w-52 rounded-lg border border-[#E9E9E7] bg-white p-1 shadow-xl">
                        <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-[#9B9A97]">
                          Tipo da propriedade
                        </div>
                        {Object.entries(COLUMN_LABELS).map(([t, label]) => (
                          <button
                            key={t}
                            onClick={() => addColumn(t as ColumnType)}
                            className="flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-[14px] text-[#37352F] hover:bg-[#F1F1EF]"
                          >
                            <Icon name={t as ColumnType} size={15} color={TYPE_COLOR[t as ColumnType]} />
                            {label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </th>
          </tr>
        </thead>

        <tbody>
          {colunaGrupo
            ? grupos.map((g) => (
                <Fragment key={g.rotulo}>
                  <tr>
                    <td
                      colSpan={columns.length + 2}
                      onClick={() =>
                        setGruposFechados((f) => ({ ...f, [g.rotulo]: !f[g.rotulo] }))
                      }
                      className="cursor-pointer border-b border-[#E9E9E7] bg-[#FBFBFA] px-2 py-1.5"
                    >
                      <span className="flex items-center gap-1.5 text-[13px] font-medium text-[#37352F]">
                        <span
                          className={
                            'transition-transform ' +
                            (gruposFechados[g.rotulo] ? '' : 'rotate-90')
                          }
                        >
                          <Icon name="chevron" size={11} color="#9B9A97" />
                        </span>
                        {g.rotulo}
                        <span className="font-normal text-[#9B9A97]">{g.linhas.length}</span>
                      </span>
                    </td>
                  </tr>
                  {!gruposFechados[g.rotulo] && g.linhas.map(renderLinha)}
                </Fragment>
              ))
            : visiveis.map(renderLinha)}

          {canEdit && (
            <tr>
              <td
                colSpan={columns.length + 2}
                onClick={addRow}
                className="cursor-pointer border-b border-[#E9E9E7] px-2 py-2 text-[14px] text-[#9B9A97] hover:bg-[#F7F7F5]"
              >
                + Nova
              </td>
            </tr>
          )}
        </tbody>

        {columns.some((c) => c.type === 'number') && (
          <tfoot>
            <tr>
              <td className="sticky left-0 z-10 bg-white px-2 py-2" />
              {columns.map((c) => (
                <td key={c.id} className="px-2 py-2 text-right text-[12px] text-[#9B9A97]">
                  {c.type === 'number' && visiveis.length > 0 && (
                    <>
                      <span className="mr-1 text-[10px] uppercase">soma</span>
                      {formatNumber(
                        visiveis.reduce((total, r) => total + (Number(r.values[c.id]) || 0), 0),
                        c.format,
                      )}
                    </>
                  )}
                </td>
              ))}
              <td />
            </tr>
          </tfoot>
        )}
      </table>

      </div>

      {openRow && (
        <RowDialog
          row={rows.find((r) => r.id === openRow.id) ?? openRow}
          columns={columns}
          canEdit={canEdit}
          onClose={() => setOpenRow(null)}
          onChange={(patch) => saveRow(openRow.id, patch)}
          ensureOption={ensureOption}
        />
      )}
    </div>
  );
}

// ---------- celulas ----------

interface CellProps {
  column: DbColumn;
  row: DbRow;
  maxDaColuna: number;
  editing: boolean;
  canEdit: boolean;
  onDone: () => void;
  onChange: (value: unknown) => void;
  ensureOption: (column: DbColumn, name: string) => Promise<SelectOption>;
}

export function Pill({ option }: { option: SelectOption }) {
  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 text-[12px] text-[#37352F]"
      style={{ background: option.color }}
    >
      {option.name}
    </span>
  );
}

function Cell({
  column,
  row,
  maxDaColuna,
  editing,
  canEdit,
  onDone,
  onChange,
  ensureOption,
}: CellProps) {
  const value = row.values[column.id];
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const inputClass = 'w-full bg-transparent text-[14px] outline-none';

  if (column.type === 'check') {
    return (
      <input
        type="checkbox"
        checked={Boolean(value)}
        disabled={!canEdit}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 accent-[#2383E2]"
      />
    );
  }

  if (column.type === 'select' || column.type === 'multi') {
    const chosen = column.type === 'multi'
      ? ((value as string[]) ?? [])
      : value
        ? [value as string]
        : [];
    const pills = chosen
      .map((id) => column.options.find((o) => o.id === id))
      .filter((o): o is SelectOption => Boolean(o));

    if (!editing) {
      return (
        <div className="flex min-h-[20px] flex-wrap gap-1">
          {pills.map((o) => (
            <Pill key={o.id} option={o} />
          ))}
        </div>
      );
    }

    return (
      <OptionPicker
        column={column}
        chosen={chosen}
        multi={column.type === 'multi'}
        onDone={onDone}
        onChange={onChange}
        ensureOption={ensureOption}
      />
    );
  }

  if (!editing) {
    if (column.type === 'number') {
      const texto = formatNumber(value, column.format, column.decimals);
      if (column.display === 'bar' && value !== null && value !== undefined && value !== '') {
        const proporcao = maxDaColuna > 0 ? Math.min(1, Number(value) / maxDaColuna) : 0;
        return (
          <div className="flex items-center justify-end gap-1.5">
            <span className="text-[12px] text-[#787774]">{texto}</span>
            <span className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-[#E9E9E7]">
              <span
                className="block h-full rounded-full bg-[#2383E2]"
                style={{ width: Math.max(2, proporcao * 100) + '%' }}
              />
            </span>
          </div>
        );
      }
      return <span>{texto}</span>;
    }
    if (column.type === 'url' && value) {
      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noreferrer noopener"
          onClick={(e) => e.stopPropagation()}
          className="block truncate text-[#2383E2] underline decoration-[#C7E0F5] hover:decoration-[#2383E2]"
        >
          {String(value).replace(/^https?:\/\//, '')}
        </a>
      );
    }
    if (column.type === 'date' && value) {
      return <span>{new Date(String(value) + 'T00:00:00').toLocaleDateString('pt-BR')}</span>;
    }
    return <span className="whitespace-pre-wrap">{value ? String(value) : ''}</span>;
  }

  return (
    <input
      ref={inputRef}
      type={column.type === 'number' ? 'number' : column.type === 'date' ? 'date' : 'text'}
      defaultValue={value === undefined || value === null ? '' : String(value)}
      onBlur={(e) => {
        const raw = e.target.value;
        onChange(column.type === 'number' ? (raw === '' ? null : Number(raw)) : raw);
        onDone();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') onDone();
      }}
      className={inputClass}
    />
  );
}

function OptionPicker({
  column,
  chosen,
  multi,
  onDone,
  onChange,
  ensureOption,
}: {
  column: DbColumn;
  chosen: string[];
  multi: boolean;
  onDone: () => void;
  onChange: (value: unknown) => void;
  ensureOption: (column: DbColumn, name: string) => Promise<SelectOption>;
}) {
  const [busca, setBusca] = useState('');
  const encontradas = column.options.filter((o) =>
    o.name.toLowerCase().includes(busca.trim().toLowerCase()),
  );
  const podeCriar =
    busca.trim() &&
    !column.options.some((o) => o.name.toLowerCase() === busca.trim().toLowerCase());

  const alternar = (id: string) => {
    if (multi) {
      onChange(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]);
    } else {
      onChange(chosen[0] === id ? null : id);
      onDone();
    }
  };

  // O painel vive dentro da celula, e a celula reabre a edicao ao ser clicada.
  // Sem conter o clique aqui, fechar reabria na hora e o campo parecia travado.
  const conter = (e: React.MouseEvent) => e.stopPropagation();
  const fechar = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDone();
  };

  return (
    <>
      <div className="fixed inset-0 z-20" onClick={fechar} />
      <div
        onClick={conter}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onDone();
          }
        }}
        className="absolute z-30 -ml-2 mt-1 w-56 rounded-lg border border-[#E9E9E7] bg-white p-1 shadow-lg"
      >
        <input
          autoFocus
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={async (e) => {
            e.stopPropagation();
            if (e.key === 'Escape') onDone();
            if (e.key !== 'Enter' || !busca.trim()) return;
            const nova = await ensureOption(column, busca);
            setBusca('');
            alternar(nova.id);
          }}
          placeholder="Buscar ou criar..."
          className="mb-1 w-full rounded border border-[#E9E9E7] px-2 py-1 text-[13px] outline-none focus:border-[#2383E2]"
        />
        <div className="max-h-48 overflow-y-auto">
          {encontradas.map((o) => (
            <button
              key={o.id}
              onClick={(e) => {
                e.stopPropagation();
                alternar(o.id);
              }}
              className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-[#F7F7F5]"
            >
              <span className="w-3 text-[11px] text-[#9B9A97]">
                {chosen.includes(o.id) ? '✓' : ''}
              </span>
              <Pill option={o} />
            </button>
          ))}
          {podeCriar && (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                const nova = await ensureOption(column, busca);
                setBusca('');
                alternar(nova.id);
              }}
              className="w-full rounded px-1.5 py-1 text-left text-[13px] text-[#787774] hover:bg-[#F7F7F5]"
            >
              Criar <span className="font-medium text-[#37352F]">{busca.trim()}</span>
            </button>
          )}
        </div>
        {multi && (
          <button
            onClick={fechar}
            className="mt-1 w-full rounded px-1.5 py-1 text-left text-[12px] text-[#9B9A97] hover:bg-[#F7F7F5]"
          >
            Fechar
          </button>
        )}
      </div>
    </>
  );
}
