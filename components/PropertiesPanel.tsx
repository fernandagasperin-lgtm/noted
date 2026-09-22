'use client';

import {
  STICKY_COLORS,
  type Assistant,
  type BoardElement,
  type Page,
  type Project,
} from '@/lib/types';

const INK_COLORS = ['#334155', '#64748B', '#2563EB', '#059669', '#D97706', '#DC2626', '#7C3AED'];

const TYPE_LABELS: Record<string, string> = {
  rectangle: 'Retangulo',
  ellipse: 'Elipse',
  sticky: 'Post-it',
  text: 'Texto',
  image: 'Imagem',
  arrow: 'Seta',
  reference: 'Link de pagina',
  assistant: 'Assistente',
  derivation: 'Resultado',
};

interface Props {
  elements: BoardElement[];
  pages: Page[];
  projects: Project[];
  assistants: Assistant[];
  currentPageId: string;
  onChange: (id: string, patch: Partial<BoardElement>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onDeselect: () => void;
}

export default function PropertiesPanel({
  elements,
  pages,
  projects,
  assistants,
  currentPageId,
  onChange,
  onDelete,
  onDuplicate,
  onBringToFront,
  onSendToBack,
  onDeselect,
}: Props) {
  if (elements.length === 0) {
    return (
      <aside className="w-64 shrink-0 border-l border-slate-200/70 bg-white p-5 max-md:hidden">
        <p className="text-[13px] leading-relaxed text-slate-400">
          Selecione um elemento para editar cor, tamanho e posicao.
        </p>
      </aside>
    );
  }

  const first = elements[0];
  const applyAll = (patch: Partial<BoardElement>) =>
    elements.forEach((el) => onChange(el.id, patch));
  const applyStyle = (patch: Partial<BoardElement['style']>) =>
    elements.forEach((el) => onChange(el.id, { style: { ...el.style, ...patch } }));

  const hasFill = elements.some((el) =>
    ['rectangle', 'ellipse', 'sticky'].includes(el.type),
  );
  const hasStroke = elements.some((el) =>
    ['rectangle', 'ellipse', 'arrow'].includes(el.type),
  );
  const hasFont = elements.some((el) => ['sticky', 'text'].includes(el.type));
  const isReference = first.type === 'reference';
  const isCard = first.type === 'assistant' || first.type === 'derivation';

  const label = (text: string) => (
    <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
      {text}
    </div>
  );

  const rowButton =
    'w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] text-slate-600 transition hover:bg-slate-100 hover:text-slate-900';

  return (
    <aside
      className={
        'space-y-5 overflow-y-auto bg-white ' +
        // celular: folha que sobe pelo rodape. desktop: coluna a direita
        'max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-20 max-md:max-h-[50vh] ' +
        'max-md:rounded-t-2xl max-md:border-t max-md:border-slate-200 max-md:p-4 max-md:shadow-2xl ' +
        'md:w-64 md:shrink-0 md:border-l md:border-slate-200/70 md:p-5'
      }
    >
      <div className="flex items-center gap-2">
        <div className="flex-1 text-[13px] font-semibold text-slate-800">
          {elements.length > 1
            ? elements.length + ' elementos'
            : TYPE_LABELS[first.type] ?? first.type}
        </div>
        <button
          onClick={onDeselect}
          title="Fechar"
          className="rounded-lg px-2 py-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 md:hidden"
        >
          ×
        </button>
      </div>

      {first.type === 'assistant' && (
        <label className="block">
          {label('Assistente')}
          <select
            value={first.assistantId ?? ''}
            onChange={(e) => applyAll({ assistantId: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            {assistants.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {first.type === 'derivation' && (
        <div className="space-y-2">
          <div>
            {label('Titulo')}
            <input
              value={first.title ?? ''}
              onChange={(e) => applyAll({ title: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[13px] text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="rounded-lg bg-slate-50 px-2.5 py-2 text-[12px] leading-relaxed text-slate-500">
            {assistants.find((a) => a.id === first.assistantId)?.name ?? 'assistente removido'}
            {first.variation ? ' · v' + first.variation : ''}
          </div>
        </div>
      )}

      {hasFill && !isCard && (
        <div>
          {label('Preenchimento')}
          <div className="grid grid-cols-8 gap-1.5">
            {STICKY_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => applyStyle({ fill: c })}
                style={{ background: c }}
                title={c}
                className={
                  'h-6 w-6 rounded-full transition ' +
                  (first.style.fill === c
                    ? 'ring-2 ring-blue-500 ring-offset-2'
                    : 'ring-1 ring-slate-200 hover:ring-slate-300')
                }
              />
            ))}
          </div>
        </div>
      )}

      {!isCard && (
      <div>
        {label(hasStroke ? 'Traco e texto' : 'Cor do texto')}
        <div className="grid grid-cols-8 gap-1.5">
          {INK_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => applyStyle({ stroke: c })}
              style={{ background: c }}
              title={c}
              className={
                'h-6 w-6 rounded-full transition ' +
                (first.style.stroke === c
                  ? 'ring-2 ring-blue-500 ring-offset-2'
                  : 'ring-1 ring-slate-200 hover:ring-slate-300')
              }
            />
          ))}
        </div>
      </div>
      )}

      {hasStroke && !isCard && (
        <label className="block">
          {label('Espessura · ' + first.style.strokeWidth)}
          <input
            type="range"
            min={0}
            max={12}
            value={first.style.strokeWidth}
            onChange={(e) => applyStyle({ strokeWidth: Number(e.target.value) })}
            className="w-full accent-blue-600"
          />
        </label>
      )}

      {hasFont && !isCard && (
        <label className="block">
          {label('Fonte · ' + first.style.fontSize + 'px')}
          <input
            type="range"
            min={10}
            max={64}
            value={first.style.fontSize}
            onChange={(e) => applyStyle({ fontSize: Number(e.target.value) })}
            className="w-full accent-blue-600"
          />
        </label>
      )}

      <label className="block">
        {label('Opacidade · ' + Math.round(first.style.opacity * 100) + '%')}
        <input
          type="range"
          min={10}
          max={100}
          value={first.style.opacity * 100}
          onChange={(e) => applyStyle({ opacity: Number(e.target.value) / 100 })}
          className="w-full accent-blue-600"
        />
      </label>

      {isReference && (
        <label className="block">
          {label('Pagina vinculada')}
          <select
            value={first.refPageId ?? ''}
            onChange={(e) => applyAll({ refPageId: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            {projects.map((project) => {
              const options = pages.filter(
                (p) => p.projectId === project.id && p.id !== currentPageId,
              );
              if (options.length === 0) return null;
              return (
                <optgroup key={project.id} label={project.name}>
                  {options.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </label>
      )}

      <div className="space-y-0.5 border-t border-slate-100 pt-4">
        <button onClick={onBringToFront} className={rowButton}>
          Trazer para frente
        </button>
        <button onClick={onSendToBack} className={rowButton}>
          Enviar para tras
        </button>
        <button onClick={onDuplicate} className={rowButton}>
          Duplicar
          <span className="float-right text-slate-300">Ctrl+D</span>
        </button>
        <button
          onClick={onDelete}
          className="w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] text-rose-600 transition hover:bg-rose-50"
        >
          Excluir
          <span className="float-right text-rose-300">Del</span>
        </button>
      </div>
    </aside>
  );
}
