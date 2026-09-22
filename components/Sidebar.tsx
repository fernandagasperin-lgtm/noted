'use client';

import { useMemo, useState } from 'react';
import type { Me, Page, PageType, Project } from '@/lib/types';

const INK = '#37352F';
const MUTED = '#9B9A97';
const HOVER = '#F1F1EF';

const TIPOS: { tipo: PageType; icone: string; cor: string; rotulo: string }[] = [
  { tipo: 'canvas', icone: '🎨', cor: '#D9730D', rotulo: 'Quadro' },
  { tipo: 'database', icone: '▦', cor: '#0F7B6C', rotulo: 'Tabela' },
  { tipo: 'text', icone: '📄', cor: '#337EA9', rotulo: 'Pagina de texto' },
  { tipo: 'assistants', icone: '✦', cor: '#6940A5', rotulo: 'Assistentes' },
  { tipo: 'table', icone: '▤', cor: '#787774', rotulo: 'Relatorio de variacoes' },
];

interface Props {
  me: Me | null;
  projects: Project[];
  pages: Page[];
  activeId: string;
  onSelect: (id: string) => void;
  onCreatePage: (projectId: string, type: PageType) => void;
  onRenamePage: (id: string, title: string) => void;
  onDeletePage: (id: string) => void;
  onCreateProject: () => void;
  onRenameProject: (id: string, name: string) => void;
  onDeleteProject: (id: string) => void;
  onToggleFavorite: (id: string, favorite: boolean) => void;
  onOpenMembers: () => void;
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({
  me,
  projects,
  pages,
  activeId,
  onSelect,
  onCreatePage,
  onRenamePage,
  onDeletePage,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
  onToggleFavorite,
  onOpenMembers,
  open,
  onClose,
}: Props) {
  const [busca, setBusca] = useState('');
  const [recolhido, setRecolhido] = useState<Record<string, boolean>>({});
  const [renomeando, setRenomeando] = useState<{ tipo: 'page' | 'project'; id: string } | null>(
    null,
  );
  const [rascunho, setRascunho] = useState('');
  const [menuDe, setMenuDe] = useState<string | null>(null);

  const termo = busca.trim().toLowerCase();
  const casa = (texto: string) => !termo || texto.toLowerCase().includes(termo);

  const favoritas = useMemo(
    () => pages.filter((p) => p.favorite && casa(p.title)),
    [pages, termo],
  );

  /** Meus projetos de um lado; o que os outros me deram acesso, do outro. */
  const meusProjetos = useMemo(() => projects.filter((p) => p.mine), [projects]);
  const projetosDeOutros = useMemo(() => projects.filter((p) => !p.mine), [projects]);

  const paginasDe = (projectId: string, minhas: boolean) =>
    pages.filter(
      (p) => p.projectId === projectId && (minhas ? p.role === 'owner' : p.role !== 'owner') && casa(p.title),
    );

  /** Com a busca ativa, um projeto so aparece se ele ou alguma pagina dele casa. */
  const projetoVisivel = (project: Project, minhas: boolean) =>
    !termo || casa(project.name) || paginasDe(project.id, minhas).length > 0;

  const privadosVisiveis = meusProjetos.filter((p) => projetoVisivel(p, true));
  const compartilhadosVisiveis = [
    ...projetosDeOutros.filter((p) => projetoVisivel(p, false)),
    ...meusProjetos.filter((p) => paginasDe(p.id, false).length > 0 && projetoVisivel(p, false)),
  ];

  const comecarRename = (tipo: 'page' | 'project', id: string, atual: string) => {
    setRenomeando({ tipo, id });
    setRascunho(atual);
    setMenuDe(null);
  };

  const confirmarRename = () => {
    if (renomeando && rascunho.trim()) {
      if (renomeando.tipo === 'page') onRenamePage(renomeando.id, rascunho.trim());
      else onRenameProject(renomeando.id, rascunho.trim());
    }
    setRenomeando(null);
  };

  const campoRename = (
    <input
      autoFocus
      value={rascunho}
      onChange={(e) => setRascunho(e.target.value)}
      onBlur={confirmarRename}
      onKeyDown={(e) => {
        if (e.key === 'Enter') confirmarRename();
        if (e.key === 'Escape') setRenomeando(null);
        e.stopPropagation();
      }}
      onClick={(e) => e.stopPropagation()}
      className="min-w-0 flex-1 rounded border border-[#2383E2] bg-white px-1.5 py-0.5 text-[14px] outline-none"
      style={{ color: INK }}
    />
  );

  const Cabecalho = ({ texto }: { texto: string }) => (
    <div
      className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide"
      style={{ color: MUTED }}
    >
      {texto}
    </div>
  );

  const LinhaPagina = ({ page, aninhada }: { page: Page; aninhada: boolean }) => (
    <div
      onClick={() => {
        onSelect(page.id);
        onClose();
      }}
      onDoubleClick={() => page.role === 'owner' && comecarRename('page', page.id, page.title)}
      className={'group flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-[14px] ' + (aninhada ? 'ml-3' : '')}
      style={{
        background: page.id === activeId ? HOVER : undefined,
        color: page.id === activeId ? INK : '#5F5E5B',
      }}
      onMouseEnter={(e) => {
        if (page.id !== activeId) e.currentTarget.style.background = '#F7F7F5';
      }}
      onMouseLeave={(e) => {
        if (page.id !== activeId) e.currentTarget.style.background = '';
      }}
    >
      <span className="shrink-0 text-[13px]">{page.icon}</span>

      {renomeando?.tipo === 'page' && renomeando.id === page.id ? (
        campoRename
      ) : (
        <span className="min-w-0 flex-1 truncate">{page.title}</span>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(page.id, !page.favorite);
        }}
        title={page.favorite ? 'Tirar dos favoritos' : 'Favoritar'}
        className={
          'shrink-0 px-0.5 text-[12px] transition ' +
          (page.favorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')
        }
        style={{ color: page.favorite ? '#D9730D' : MUTED }}
      >
        {page.favorite ? '★' : '☆'}
      </button>

      {page.role === 'owner' ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm('Excluir "' + page.title + '"?')) onDeletePage(page.id);
          }}
          title="Excluir pagina"
          className="shrink-0 px-0.5 text-[13px] opacity-0 transition group-hover:opacity-100"
          style={{ color: MUTED }}
        >
          ×
        </button>
      ) : (
        <span
          title={page.role === 'editor' ? 'Voce pode editar' : 'Somente leitura'}
          className="shrink-0 px-0.5 text-[11px]"
          style={{ color: MUTED }}
        >
          {page.role === 'editor' ? '✎' : '👁'}
        </span>
      )}
    </div>
  );

  const BlocoProjeto = ({ project, minhas }: { project: Project; minhas: boolean }) => {
    const paginas = paginasDe(project.id, minhas);
    if (termo && paginas.length === 0 && !casa(project.name)) return null;
    const fechado = recolhido[project.id];

    return (
      <div className="mb-0.5">
        <div
          onClick={() => setRecolhido((c) => ({ ...c, [project.id]: !c[project.id] }))}
          className="group flex cursor-pointer items-center gap-1.5 rounded px-2 py-1"
          onMouseEnter={(e) => (e.currentTarget.style.background = '#F7F7F5')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '')}
        >
          <span
            className={'shrink-0 text-[9px] transition-transform ' + (fechado ? '' : 'rotate-90')}
            style={{ color: MUTED }}
          >
            ▶
          </span>
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: project.color }}
          />

          {renomeando?.tipo === 'project' && renomeando.id === project.id ? (
            campoRename
          ) : (
            <span className="min-w-0 flex-1 truncate text-[14px] font-medium" style={{ color: INK }}>
              {project.name}
            </span>
          )}

          {project.mine && (
            <div className="relative shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuDe(menuDe === project.id ? null : project.id);
                }}
                className="rounded px-1 text-[13px] opacity-0 transition group-hover:opacity-100"
                style={{ color: MUTED }}
              >
                ⋯
              </button>

              {menuDe === project.id && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuDe(null);
                    }}
                  />
                  <div className="absolute right-0 top-6 z-30 w-56 overflow-hidden rounded-xl border border-[#E9E9E7] bg-white py-1 shadow-xl">
                    <div
                      className="px-3 py-1 text-[11px] uppercase tracking-wide"
                      style={{ color: MUTED }}
                    >
                      Adicionar
                    </div>
                    {TIPOS.map(({ tipo, icone, cor, rotulo }) => (
                      <button
                        key={tipo}
                        onClick={(e) => {
                          e.stopPropagation();
                          onCreatePage(project.id, tipo);
                          setMenuDe(null);
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13.5px] hover:bg-[#F1F1EF]"
                        style={{ color: INK }}
                      >
                        <span className="w-4 text-center text-[12px]" style={{ color: cor }}>
                          {icone}
                        </span>
                        {rotulo}
                      </button>
                    ))}

                    <div className="my-1 h-px bg-[#E9E9E7]" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        comecarRename('project', project.id, project.name);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13.5px] hover:bg-[#F1F1EF]"
                      style={{ color: INK }}
                    >
                      <span className="w-4 text-center text-[12px]" style={{ color: MUTED }}>
                        ✎
                      </span>
                      Renomear
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuDe(null);
                        if (
                          confirm(
                            'Excluir o projeto "' + project.name + '" e todas as suas paginas?',
                          )
                        )
                          onDeleteProject(project.id);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13.5px] text-[#EB5757] hover:bg-[#FBECEC]"
                    >
                      <span className="w-4 text-center text-[12px]">🗑</span>
                      Excluir projeto
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {!fechado && (
          <>
            {paginas.map((p) => (
              <LinhaPagina key={p.id} page={p} aninhada />
            ))}
            {project.mine && !termo && (
              <button
                onClick={() => onCreatePage(project.id, 'canvas')}
                className="ml-3 w-full rounded px-2 py-1 text-left text-[13.5px] hover:bg-[#F7F7F5]"
                style={{ color: MUTED }}
              >
                + Nova pagina
              </button>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-30 bg-[#0F0F0F]/20 backdrop-blur-sm md:hidden"
        />
      )}

      <aside
        className={
          'z-40 flex h-full w-64 shrink-0 flex-col border-r border-[#E9E9E7] bg-[#F7F7F5] ' +
          'max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:shadow-2xl max-md:transition-transform ' +
          (open ? 'max-md:translate-x-0' : 'max-md:-translate-x-full')
        }
      >
        <div className="px-3 pb-1 pt-3">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar..."
            className="w-full rounded-md border border-[#E9E9E7] bg-white px-2.5 py-1.5 text-[13px] outline-none transition focus:border-[#2383E2]"
            style={{ color: INK }}
          />
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-3">
          {favoritas.length > 0 && (
            <>
              <Cabecalho texto="Favoritos" />
              {favoritas.map((p) => (
                <LinhaPagina key={'fav-' + p.id} page={p} aninhada={false} />
              ))}
            </>
          )}

          {privadosVisiveis.length > 0 && (
            <>
              <Cabecalho texto="Privado" />
              {privadosVisiveis.map((p) => (
                <BlocoProjeto key={p.id} project={p} minhas />
              ))}
            </>
          )}

          {!termo && (
            <button
              onClick={onCreateProject}
              className="w-full rounded px-2 py-1 text-left text-[13.5px] hover:bg-[#F7F7F5]"
              style={{ color: MUTED }}
            >
              + Novo projeto
            </button>
          )}

          {compartilhadosVisiveis.length > 0 && (
            <>
              <Cabecalho texto="Compartilhado comigo" />
              {compartilhadosVisiveis.map((p) => (
                <BlocoProjeto key={'sh-' + p.id} project={p} minhas={false} />
              ))}
            </>
          )}

          {termo &&
            favoritas.length === 0 &&
            privadosVisiveis.length === 0 &&
            compartilhadosVisiveis.length === 0 && (
              <p className="px-2 py-6 text-center text-[13px]" style={{ color: MUTED }}>
                Nada encontrado.
              </p>
            )}
        </nav>

        <div className="border-t border-[#E9E9E7] px-2 py-2">
          {me?.isAdmin && (
            <button
              onClick={onOpenMembers}
              className="w-full rounded px-2 py-1 text-left text-[13.5px] hover:bg-[#EDEDEB]"
              style={{ color: '#5F5E5B' }}
            >
              Pessoas
            </button>
          )}

          {me && (
            <div className="mt-1 flex items-center gap-2 px-2">
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                style={{ background: '#787774' }}
              >
                {me.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12.5px]" title={me.email} style={{ color: '#5F5E5B' }}>
                {me.name}
              </span>
              <button
                onClick={async () => {
                  await fetch('/api/logout', { method: 'POST' });
                  window.location.href = '/login';
                }}
                className="shrink-0 rounded px-1.5 py-0.5 text-[12px] hover:bg-[#EDEDEB]"
                style={{ color: MUTED }}
              >
                Sair
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
