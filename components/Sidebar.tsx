'use client';

import { useState } from 'react';
import type { Me, Page, PageType, Project } from '@/lib/types';

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
  onOpenMembers: () => void;
  /** no celular a barra vira gaveta sobre o conteudo */
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
  onOpenMembers,
  open,
  onClose,
}: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [renaming, setRenaming] = useState<{ kind: 'page' | 'project'; id: string } | null>(null);
  const [draft, setDraft] = useState('');
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const startRename = (kind: 'page' | 'project', id: string, current: string) => {
    setRenaming({ kind, id });
    setDraft(current);
    setMenuFor(null);
  };

  const commitRename = () => {
    if (renaming && draft.trim()) {
      if (renaming.kind === 'page') onRenamePage(renaming.id, draft.trim());
      else onRenameProject(renaming.id, draft.trim());
    }
    setRenaming(null);
  };

  const renameInput = (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commitRename}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commitRename();
        if (e.key === 'Escape') setRenaming(null);
        e.stopPropagation();
      }}
      onClick={(e) => e.stopPropagation()}
      className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-sm text-slate-800 outline-none ring-2 ring-slate-200"
    />
  );

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-30 bg-slate-900/25 backdrop-blur-sm md:hidden"
        />
      )}

    <aside
      className={
        'z-40 flex h-full w-64 shrink-0 flex-col border-r border-slate-200/70 bg-[#FBFBFA] ' +
        'max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:shadow-2xl max-md:transition-transform ' +
        (open ? 'max-md:translate-x-0' : 'max-md:-translate-x-full')
      }
    >
      <div className="flex items-center justify-between px-4 py-3.5">
        <span className="text-[13px] font-semibold tracking-tight text-slate-800">
          Meu workspace
        </span>
        <button
          onClick={onCreateProject}
          title="Novo projeto"
          className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-700"
        >
          +
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        {projects.map((project) => {
          const projectPages = pages.filter((p) => p.projectId === project.id);
          const isCollapsed = collapsed[project.id];

          return (
            <div key={project.id} className="mb-1">
              <div
                onClick={() =>
                  setCollapsed((c) => ({ ...c, [project.id]: !c[project.id] }))
                }
                className="group flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 transition hover:bg-slate-200/50"
              >
                <span
                  className={
                    'shrink-0 text-[10px] text-slate-400 transition-transform ' +
                    (isCollapsed ? '' : 'rotate-90')
                  }
                >
                  ▶
                </span>
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: project.color }}
                />

                {renaming?.kind === 'project' && renaming.id === project.id ? (
                  renameInput
                ) : (
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-700">
                    {project.name}
                  </span>
                )}

                <div className="relative shrink-0">
                  <button
                    disabled={!project.mine}
                    title={project.mine ? undefined : 'Projeto de outra pessoa'}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuFor(menuFor === project.id ? null : project.id);
                    }}
                    className="rounded px-1 text-slate-400 opacity-0 transition hover:bg-slate-300/50 hover:text-slate-700 group-hover:opacity-100"
                  >
                    ⋯
                  </button>

                  {menuFor === project.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuFor(null); }} />
                      <div className="absolute right-0 top-6 z-20 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-900/5">
                        <button
                          onClick={(e) => { e.stopPropagation(); onCreatePage(project.id, 'canvas'); setMenuFor(null); }}
                          className="block w-full px-3 py-1.5 text-left text-[13px] text-slate-700 hover:bg-slate-50"
                        >
                          Novo quadro
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onCreatePage(project.id, 'text'); setMenuFor(null); }}
                          className="block w-full px-3 py-1.5 text-left text-[13px] text-slate-700 hover:bg-slate-50"
                        >
                          Nova pagina de texto
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onCreatePage(project.id, 'table'); setMenuFor(null); }}
                          className="block w-full px-3 py-1.5 text-left text-[13px] text-slate-700 hover:bg-slate-50"
                        >
                          Nova tabela
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onCreatePage(project.id, 'assistants'); setMenuFor(null); }}
                          className="block w-full px-3 py-1.5 text-left text-[13px] text-slate-700 hover:bg-slate-50"
                        >
                          Pagina de assistentes
                        </button>
                        <div className="my-1 h-px bg-slate-100" />
                        <button
                          onClick={(e) => { e.stopPropagation(); startRename('project', project.id, project.name); }}
                          className="block w-full px-3 py-1.5 text-left text-[13px] text-slate-700 hover:bg-slate-50"
                        >
                          Renomear
                        </button>
                        <div className="my-1 h-px bg-slate-100" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuFor(null);
                            if (confirm('Excluir o projeto "' + project.name + '" e todas as suas paginas?'))
                              onDeleteProject(project.id);
                          }}
                          className="block w-full px-3 py-1.5 text-left text-[13px] text-rose-600 hover:bg-rose-50"
                        >
                          Excluir projeto
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {!isCollapsed && (
                <div className="ml-3 border-l border-slate-200/80 pl-1.5">
                  {projectPages.map((page) => (
                    <div
                      key={page.id}
                      onClick={() => {
                        onSelect(page.id);
                        onClose();
                      }}
                      onDoubleClick={() =>
                        page.role === 'owner' && startRename('page', page.id, page.title)
                      }
                      className={
                        'group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition ' +
                        (page.id === activeId
                          ? 'bg-slate-200/70 font-medium text-slate-900'
                          : 'text-slate-600 hover:bg-slate-200/40')
                      }
                    >
                      <span className="shrink-0 text-[13px]">{page.icon}</span>

                      {renaming?.kind === 'page' && renaming.id === page.id ? (
                        renameInput
                      ) : (
                        <span className="min-w-0 flex-1 truncate">{page.title}</span>
                      )}

                      {page.role === 'owner' ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Excluir "' + page.title + '"?')) onDeletePage(page.id);
                          }}
                          title="Excluir pagina"
                          className="shrink-0 rounded px-1 text-slate-400 opacity-0 transition hover:bg-slate-300/50 hover:text-rose-600 group-hover:opacity-100"
                        >
                          ×
                        </button>
                      ) : (
                        <span
                          title={
                            page.role === 'editor'
                              ? 'Compartilhada com voce · pode editar'
                              : 'Compartilhada com voce · somente leitura'
                          }
                          className="shrink-0 text-[11px] text-slate-400"
                        >
                          {page.role === 'editor' ? '✎' : '👁'}
                        </span>
                      )}
                    </div>
                  ))}

                  {project.mine && (
                    <button
                      onClick={() => onCreatePage(project.id, 'canvas')}
                      className="w-full rounded-lg px-2 py-1.5 text-left text-[13px] text-slate-400 transition hover:bg-slate-200/40 hover:text-slate-600"
                    >
                      + Nova pagina
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="space-y-0.5 border-t border-slate-200/70 p-2">
        <button
          onClick={onCreateProject}
          className="w-full rounded-lg px-2 py-1.5 text-left text-[13px] text-slate-500 transition hover:bg-slate-200/50 hover:text-slate-800"
        >
          + Novo projeto
        </button>

        {me?.isAdmin && (
          <button
            onClick={onOpenMembers}
            className="w-full rounded-lg px-2 py-1.5 text-left text-[13px] text-slate-500 transition hover:bg-slate-200/50 hover:text-slate-800"
          >
            Pessoas
          </button>
        )}

        {me && (
          <div className="flex items-center gap-2 px-2 pt-1.5">
            <span className="min-w-0 flex-1 truncate text-[12px] text-slate-400" title={me.email}>
              {me.name}
            </span>
            <button
              onClick={async () => {
                await fetch('/api/logout', { method: 'POST' });
                window.location.href = '/login';
              }}
              className="shrink-0 rounded px-1.5 py-0.5 text-[12px] text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-700"
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
