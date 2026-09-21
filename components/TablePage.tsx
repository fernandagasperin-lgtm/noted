'use client';

import { useMemo, useState } from 'react';
import type { Assistant, BoardElement, Page } from '@/lib/types';

const TYPE_LABELS: Record<string, string> = {
  rectangle: 'Retangulo',
  ellipse: 'Elipse',
  sticky: 'Post-it',
  text: 'Texto',
  image: 'Imagem',
  arrow: 'Seta',
  reference: 'Link',
  assistant: 'Assistente',
  derivation: 'Resultado',
};

interface Row {
  el: BoardElement;
  page: Page;
}

interface Props {
  pages: Page[];
  assistants: Assistant[];
  projectId: string;
  onOpen: (pageId: string, elementId: string) => void;
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function TablePage({ pages, assistants, projectId, onOpen }: Props) {
  const [tab, setTab] = useState<'derivations' | 'inventory'>('derivations');
  const [grouped, setGrouped] = useState(true);
  const [query, setQuery] = useState('');

  const boards = useMemo(
    () => pages.filter((p) => p.projectId === projectId && p.type === 'canvas'),
    [pages, projectId],
  );

  const allRows = useMemo<Row[]>(
    () => boards.flatMap((page) => page.elements.map((el) => ({ el, page }))),
    [boards],
  );

  const term = query.trim().toLowerCase();
  const matches = (text: string) => !term || text.toLowerCase().includes(term);

  const derivations = allRows.filter(
    (r) =>
      r.el.type === 'derivation' &&
      matches((r.el.title ?? '') + ' ' + (r.el.output ?? '')),
  );

  const inventory = allRows.filter((r) =>
    matches((r.el.content || r.el.title || '') + ' ' + TYPE_LABELS[r.el.type]),
  );

  const assistantName = (id?: string) =>
    assistants.find((a) => a.id === id)?.name ?? '—';

  const parentTitle = (parentId?: string) => {
    if (!parentId) return '—';
    const parent = allRows.find((r) => r.el.id === parentId);
    return parent?.el.title ?? 'removido';
  };

  const th = 'px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-slate-400';
  const td = 'px-3 py-2.5 align-top text-[13px] text-slate-600';
  const tabClass = (active: boolean) =>
    'rounded-lg px-3 py-1.5 text-[13px] font-medium transition ' +
    (active ? 'bg-slate-200/70 text-slate-900' : 'text-slate-500 hover:bg-slate-100');

  const groups = useMemo(() => {
    if (!grouped) return null;
    const map = new Map<string, Row[]>();
    for (const row of derivations) {
      const key = row.el.assistantId ?? 'sem-assistente';
      const list = map.get(key);
      if (list) list.push(row);
      else map.set(key, [row]);
    }
    return [...map.entries()];
  }, [derivations, grouped]);

  const derivationHeader = (
    <tr className="border-b border-slate-200">
      <th className={th}>Titulo</th>
      {!grouped && <th className={th}>Assistente</th>}
      <th className={th}>Deriva de</th>
      <th className={th}>Quadro</th>
      <th className={th}>Criado</th>
      <th className={th}>Resultado</th>
    </tr>
  );

  const derivationRow = (row: Row) => (
    <tr
      key={row.el.id}
      onClick={() => onOpen(row.page.id, row.el.id)}
      className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50"
    >
      <td className={td + ' font-medium text-slate-800'}>{row.el.title ?? '—'}</td>
      {!grouped && <td className={td}>{assistantName(row.el.assistantId)}</td>}
      <td className={td}>{parentTitle(row.el.parentId)}</td>
      <td className={td}>{row.page.title}</td>
      <td className={td + ' whitespace-nowrap'}>{formatDate(row.el.producedAt)}</td>
      <td className={td}>
        <span className="line-clamp-2 text-slate-500">
          {row.el.output?.replace(/\s+/g, ' ') || '—'}
        </span>
      </td>
    </tr>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-slate-200/70 px-5 py-2.5">
        <button onClick={() => setTab('derivations')} className={tabClass(tab === 'derivations')}>
          Derivacoes
          <span className="ml-1.5 text-slate-400">{derivations.length}</span>
        </button>
        <button onClick={() => setTab('inventory')} className={tabClass(tab === 'inventory')}>
          Inventario
          <span className="ml-1.5 text-slate-400">{inventory.length}</span>
        </button>

        <div className="ml-auto flex items-center gap-2">
          {tab === 'derivations' && (
            <label className="flex cursor-pointer items-center gap-1.5 text-[12.5px] text-slate-500">
              <input
                type="checkbox"
                checked={grouped}
                onChange={(e) => setGrouped(e.target.checked)}
                className="accent-blue-600"
              />
              Agrupar por assistente
            </label>
          )}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar..."
            className="w-44 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {tab === 'derivations' ? (
          derivations.length === 0 ? (
            <p className="p-8 text-[13px] leading-relaxed text-slate-400">
              Nenhum resultado ainda. Crie um assistente, coloque o card dele num quadro e
              use — cada uso vira uma linha aqui.
            </p>
          ) : grouped && groups ? (
            <div className="p-5">
              {groups.map(([assistantId, rows]) => (
                <div key={assistantId} className="mb-6">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-indigo-500">✦</span>
                    <h3 className="text-[13px] font-semibold text-slate-800">
                      {assistantName(assistantId)}
                    </h3>
                    <span className="text-[12px] text-slate-400">
                      {rows.length} {rows.length === 1 ? 'variacao' : 'variacoes'}
                    </span>
                  </div>
                  <table className="w-full border-collapse">
                    <thead>{derivationHeader}</thead>
                    <tbody>{rows.map(derivationRow)}</tbody>
                  </table>
                </div>
              ))}
            </div>
          ) : (
            <table className="w-full border-collapse p-5">
              <thead>{derivationHeader}</thead>
              <tbody>{derivations.map(derivationRow)}</tbody>
            </table>
          )
        ) : inventory.length === 0 ? (
          <p className="p-8 text-[13px] text-slate-400">
            Os quadros deste projeto ainda estao vazios.
          </p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className={th}>Tipo</th>
                <th className={th}>Conteudo</th>
                <th className={th}>Quadro</th>
                <th className={th}>Posicao</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((row) => (
                <tr
                  key={row.el.id}
                  onClick={() => onOpen(row.page.id, row.el.id)}
                  className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50"
                >
                  <td className={td + ' whitespace-nowrap font-medium text-slate-700'}>
                    {TYPE_LABELS[row.el.type] ?? row.el.type}
                  </td>
                  <td className={td}>
                    <span className="line-clamp-2">
                      {(row.el.title || row.el.content || row.el.output || '—').replace(
                        /\s+/g,
                        ' ',
                      )}
                    </span>
                  </td>
                  <td className={td}>{row.page.title}</td>
                  <td className={td + ' whitespace-nowrap tabular-nums text-slate-400'}>
                    {Math.round(row.el.x)}, {Math.round(row.el.y)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
