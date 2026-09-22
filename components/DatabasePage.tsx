'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  COLUMN_LABELS,
  OPTION_COLORS,
  formatNumber,
  type ColumnType,
  type DbColumn,
  type DbRow,
  type NumberFormat,
  type SelectOption,
} from '@/lib/types';
import RowDialog from './RowDialog';

/** O Notion identifica o tipo pela cor do icone; sem isso a lista vira texto cinza. */
const TYPE_COLORS: Record<ColumnType, string> = {
  text: '#787774',
  number: '#D9730D',
  select: '#0F7B6C',
  multi: '#6940A5',
  date: '#337EA9',
  check: '#448361',
  url: '#2383E2',
};

const TYPE_ICONS: Record<ColumnType, string> = {
  text: '≡',
  number: '#',
  select: '◉',
  multi: '⛃',
  date: '▤',
  check: '☑',
  url: '⚯',
};

interface Props {
  pageId: string;
  canEdit: boolean;
}

export default function DatabasePage({ pageId, canEdit }: Props) {
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

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-[13px] text-[#9B9A97]">
        Carregando tabela...
      </div>
    );
  }

  const cellBase =
    'border-b border-r border-[#E9E9E7] px-2 py-1.5 text-[14px] text-[#37352F] align-top';

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <table className="w-max min-w-full border-collapse">
        <thead>
          <tr>
            <th
              className={
                'sticky left-0 z-10 w-[190px] min-w-[190px] md:w-[320px] md:min-w-[320px] ' +
                'border-b border-r border-[#E9E9E7] ' +
                'bg-white px-2 py-1.5 text-left text-[13px] font-normal text-[#9B9A97]'
              }
            >
              <span className="mr-1.5 text-[11px]">Aa</span>
              Nome
            </th>

            {columns.map((c) => (
              <th
                key={c.id}
                className="relative w-[150px] min-w-[150px] border-b border-r border-[#E9E9E7] px-2 py-1.5 text-left text-[13px] font-normal text-[#9B9A97] md:w-[180px] md:min-w-[180px]"
              >
                <button
                  onClick={() => canEdit && setMenuColumn(menuColumn === c.id ? null : c.id)}
                  className="flex w-full items-center gap-1.5 truncate text-left hover:text-[#37352F]"
                >
                  <span className="text-[11px]" style={{ color: TYPE_COLORS[c.type] }}>
                    {TYPE_ICONS[c.type]}
                  </span>
                  <span className="truncate">{c.name}</span>
                </button>

                {menuColumn === c.id && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setMenuColumn(null)} />
                    <div className="absolute left-0 top-9 z-30 w-56 rounded-lg border border-[#E9E9E7] bg-white p-1 shadow-lg">
                      <input
                        defaultValue={c.name}
                        onBlur={(e) => saveColumn(c.id, { name: e.target.value })}
                        className="mb-1 w-full rounded border border-[#E9E9E7] px-2 py-1 text-[13px] text-[#37352F] outline-none focus:border-[#2383E2]"
                      />
                      <select
                        value={c.type}
                        onChange={(e) => saveColumn(c.id, { type: e.target.value as ColumnType })}
                        className="mb-1 w-full rounded border border-[#E9E9E7] px-2 py-1 text-[13px] text-[#37352F] outline-none"
                      >
                        {Object.entries(COLUMN_LABELS).map(([t, label]) => (
                          <option key={t} value={t}>
                            {label}
                          </option>
                        ))}
                      </select>
                      {c.type === 'number' && (
                        <select
                          value={c.format}
                          onChange={(e) =>
                            saveColumn(c.id, { format: e.target.value as NumberFormat })
                          }
                          className="mb-1 w-full rounded border border-[#E9E9E7] px-2 py-1 text-[13px] text-[#37352F] outline-none"
                        >
                          <option value="plain">Numero</option>
                          <option value="brl">Real (R$)</option>
                          <option value="usd">Dolar ($)</option>
                          <option value="percent">Porcentagem</option>
                        </select>
                      )}
                      <button
                        onClick={() => removeColumn(c.id)}
                        className="w-full rounded px-2 py-1 text-left text-[13px] text-[#EB5757] hover:bg-[#FBECEC]"
                      >
                        Excluir coluna
                      </button>
                    </div>
                  </>
                )}
              </th>
            ))}

            {/* absorve a largura que sobra, para as colunas nao esticarem */}
            <th className="w-full border-b border-[#E9E9E7] px-2 py-1.5 text-left">
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
                            <span
                              className="w-4 text-center text-[12px]"
                              style={{ color: TYPE_COLORS[t as ColumnType] }}
                            >
                              {TYPE_ICONS[t as ColumnType]}
                            </span>
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
          {rows.map((row) => (
            <tr key={row.id} className="group">
              <td className={'sticky left-0 z-10 bg-white ' + cellBase}>
                <div className="flex items-center gap-1.5">
                  <span className="shrink-0 text-[12px] text-[#9B9A97]">▢</span>
                  <input
                    value={row.title}
                    readOnly={!canEdit}
                    onChange={(e) => saveRowSoon(row.id, { title: e.target.value })}
                    placeholder="Sem titulo"
                    className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#C7C6C4]"
                  />
                  <button
                    onClick={() => setOpenRow(row)}
                    className="shrink-0 rounded border border-[#E9E9E7] px-1.5 py-0.5 text-[11px] text-[#787774] opacity-0 transition hover:bg-[#F7F7F5] group-hover:opacity-100"
                  >
                    ABRIR
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => removeRow(row.id)}
                      title="Excluir linha"
                      className="shrink-0 px-1 text-[13px] text-[#C7C6C4] opacity-0 transition hover:text-[#EB5757] group-hover:opacity-100"
                    >
                      ×
                    </button>
                  )}
                </div>
              </td>

              {columns.map((c) => (
                <td
                  key={c.id}
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
                    editing={editing?.rowId === row.id && editing?.columnId === c.id}
                    canEdit={canEdit}
                    onDone={() => setEditing(null)}
                    onChange={(v) => setCell(row, c.id, v)}
                    ensureOption={ensureOption}
                  />
                </td>
              ))}
              <td className="w-full border-b border-[#E9E9E7]" />
            </tr>
          ))}

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
                  {c.type === 'number' && rows.length > 0 && (
                    <>
                      <span className="mr-1 text-[10px] uppercase">soma</span>
                      {formatNumber(
                        rows.reduce((total, r) => total + (Number(r.values[c.id]) || 0), 0),
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

function Cell({ column, row, editing, canEdit, onDone, onChange, ensureOption }: CellProps) {
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
      return <span>{formatNumber(value, column.format)}</span>;
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

  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onDone} />
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute z-30 -ml-2 mt-1 w-56 rounded-lg border border-[#E9E9E7] bg-white p-1 shadow-lg"
      >
        <input
          autoFocus
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar ou criar..."
          className="mb-1 w-full rounded border border-[#E9E9E7] px-2 py-1 text-[13px] outline-none focus:border-[#2383E2]"
        />
        <div className="max-h-48 overflow-y-auto">
          {encontradas.map((o) => (
            <button
              key={o.id}
              onClick={() => alternar(o.id)}
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
              onClick={async () => {
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
            onClick={onDone}
            className="mt-1 w-full rounded px-1.5 py-1 text-left text-[12px] text-[#9B9A97] hover:bg-[#F7F7F5]"
          >
            Fechar
          </button>
        )}
      </div>
    </>
  );
}
