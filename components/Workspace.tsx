'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from './Sidebar';
import Toolbar, { type Tool } from './Toolbar';
import type { Lado } from './Canvas';
import PropertiesPanel from './PropertiesPanel';
import AssistantsPage from './AssistantsPage';
import TablePage from './TablePage';
import DatabasePage from './DatabasePage';
import Icon, { PAGE_COLOR } from './Icon';
import RunAssistantDialog, { type RunResult } from './RunAssistantDialog';
import ShareDialog from './ShareDialog';
import MiniTableDialog from './MiniTableDialog';
import MembersDialog from './MembersDialog';
import { boundsOf, miniSize } from '@/lib/geometry';
import {
  DEFAULT_STYLE,
  type Assistant,
  type MiniTable,
  type BoardElement,
  type ElementType,
  type Me,
  type Page,
  type PageType,
  type Project,
} from '@/lib/types';

const Canvas = dynamic(() => import('./Canvas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-slate-400">
      Carregando mural...
    </div>
  ),
});

/** A tabelinha ja nasce mostrando o que sabe fazer: uma soma. */
function novaMiniTabela(): MiniTable {
  return {
    cols: 3,
    rows: 4,
    widths: [120, 70, 90],
    header: true,
    cells: {
      A1: 'Item',
      B1: 'Qtd',
      C1: 'Valor',
      A4: 'Total',
      C4: '=SOMA(C2:C3)',
    },
  };
}

const MINI_PADRAO = novaMiniTabela();

const DEFAULTS: Record<ElementType, { width: number; height: number; content: string }> = {
  rectangle: { width: 180, height: 110, content: '' },
  ellipse: { width: 140, height: 140, content: '' },
  sticky: { width: 180, height: 180, content: '' },
  text: { width: 260, height: 40, content: 'Texto' },
  arrow: { width: 180, height: 0, content: '' },
  image: { width: 320, height: 240, content: '' },
  reference: { width: 270, height: 88, content: '' },
  assistant: { width: 260, height: 96, content: '' },
  derivation: { width: 270, height: 170, content: '' },
  minitable: { ...miniSize(MINI_PADRAO), content: '' },
};

const FILL_BY_TYPE: Partial<Record<ElementType, string>> = {
  rectangle: '#FFFFFF',
  ellipse: '#FFFFFF',
  sticky: '#FFF9B1',
};

const STROKE_BY_TYPE: Partial<Record<ElementType, string>> = {
  rectangle: '#CBD5E1',
  ellipse: '#CBD5E1',
  sticky: '#334155',
  text: '#334155',
  arrow: '#64748B',
};

export default function Workspace() {
  const [me, setMe] = useState<Me | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [tool, setTool] = useState<Tool>('select');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [runTarget, setRunTarget] = useState<{
    assistant: Assistant;
    parent?: BoardElement;
  } | null>(null);
  const [tableTarget, setTableTarget] = useState<string | null>(null);
  const [linked, setLinked] = useState<Record<string, Record<string, number[]>>>({});
  const [showShare, setShowShare] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [others, setOthers] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const pagesRef = useRef<Page[]>([]);
  const pendingSelect = useRef<string[] | null>(null);
  const history = useRef<BoardElement[][]>([]);
  const histIndex = useRef(-1);
  const [, setHistVersion] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSave = useRef(true);

  const activePage = useMemo(
    () => pages.find((p) => p.id === activeId),
    [pages, activeId],
  );
  const activeProject = useMemo(
    () => projects.find((p) => p.id === activePage?.projectId),
    [projects, activePage],
  );

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  const loadWorkspace = useCallback(async (selectPageId?: string) => {
    const res = await fetch('/api/pages');
    if (!res.ok) {
      // Sessao expirada ou conta removida: sem isso a tela quebrava ao ler
      // a resposta de erro como se fosse o workspace.
      window.location.href = '/login';
      return { me: null, projects: [], assistants: [], pages: [] };
    }
    const ws = await res.json();
    setMe(ws.me);
    setProjects(ws.projects);
    setAssistants(ws.assistants ?? []);
    setPages(ws.pages);
    pagesRef.current = ws.pages;
    setActiveId((current) => {
      if (selectPageId) return selectPageId;
      return ws.pages.some((p: Page) => p.id === current)
        ? current
        : ws.pages[0]?.id ?? '';
    });
    return ws;
  }, []);

  useEffect(() => {
    loadWorkspace().then(() => setLoaded(true));
    fetch('/api/generate')
      .then((r) => r.json())
      .then((d) => setAiEnabled(Boolean(d.enabled)))
      .catch(() => setAiEnabled(false));
  }, [loadWorkspace]);

  // reset undo history when the active page changes
  useEffect(() => {
    const page = pagesRef.current.find((p) => p.id === activeId);
    if (!page) return;
    history.current = [page.elements];
    histIndex.current = 0;
    setHistVersion((v) => v + 1);
    setSelectedIds(pendingSelect.current ?? []);
    pendingSelect.current = null;
    skipSave.current = true;
  }, [activeId]);

  const persist = useCallback((page: Page) => {
    setSaving(true);
    fetch('/api/pages/' + page.id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: page.title,
        icon: page.icon,
        projectId: page.projectId,
        elements: page.elements,
        body: page.body,
      }),
    }).finally(() => setSaving(false));
  }, []);

  useEffect(() => {
    if (!loaded || !activePage) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(activePage), 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [activePage, loaded, persist]);

  // History is recorded outside the state updater: React invokes updaters twice
  // under StrictMode, which would otherwise push every change onto the stack twice.
  const setElements = useCallback(
    (updater: (prev: BoardElement[]) => BoardElement[], recordHistory = true) => {
      const current = pagesRef.current.find((p) => p.id === activeId);
      if (!current || current.role === 'viewer') return;
      const next = updater(current.elements);

      if (recordHistory) {
        history.current = history.current.slice(0, histIndex.current + 1);
        history.current.push(next);
        histIndex.current = history.current.length - 1;
        setHistVersion((v) => v + 1);
      }

      pagesRef.current = pagesRef.current.map((p) =>
        p.id === activeId ? { ...p, elements: next } : p,
      );
      setPages(pagesRef.current);
    },
    [activeId],
  );

  const createElement = useCallback(
    (type: ElementType, x: number, y: number, extra: Partial<BoardElement> = {}) => {
      const def = DEFAULTS[type];
      // A elipse e desenhada a partir do centro; as demais, do canto.
      const canto = type === 'ellipse' ? { x, y } : {
        x: x - def.width / 2,
        y: y - def.height / 2,
      };
      const el: BoardElement = {
        id: crypto.randomUUID(),
        type,
        x: canto.x,
        y: canto.y,
        width: def.width,
        height: def.height,
        rotation: 0,
        content: def.content,
        style: {
          ...DEFAULT_STYLE,
          fill: FILL_BY_TYPE[type] ?? DEFAULT_STYLE.fill,
          stroke: STROKE_BY_TYPE[type] ?? DEFAULT_STYLE.stroke,
        },
        ...(type === 'arrow' ? { points: [0, 0, def.width, 0] } : {}),
        ...(type === 'minitable' ? { table: novaMiniTabela() } : {}),
        ...extra,
      };
      setElements((prev) => [...prev, el]);
      setSelectedIds([el.id]);
      return el;
    },
    [setElements],
  );

  const projectAssistants = useMemo(
    () => assistants.filter((a) => a.projectId === activePage?.projectId),
    [assistants, activePage],
  );

  const handleCanvasCreate = useCallback(
    (x: number, y: number) => {
      if (tool === 'select') return;
      if (tool === 'reference') {
        const target = pages.find((p) => p.id !== activeId);
        if (!target) {
          alert('Crie outra pagina primeiro para poder vincula-la.');
          return;
        }
        createElement('reference', x, y, { refPageId: target.id });
        return;
      }
      if (tool === 'assistant') {
        if (projectAssistants.length === 0) {
          alert(
            'Este projeto ainda nao tem assistentes. Crie um na pagina de Assistentes.',
          );
          return;
        }
        createElement('assistant', x, y, { assistantId: projectAssistants[0].id });
        return;
      }
      createElement(tool as ElementType, x, y);
    },
    [tool, pages, activeId, createElement, projectAssistants],
  );

  const updateElement = useCallback(
    (id: string, patch: Partial<BoardElement>) => {
      setElements((prev) => prev.map((el) => (el.id === id ? { ...el, ...patch } : el)));
    },
    [setElements],
  );


  /** Onde fica o canto de um elemento cujo centro deve cair em (cx, cy). */
  const cantoDe = (type: ElementType, w: number, h: number, cx: number, cy: number) =>
    type === 'ellipse' ? { x: cx, y: cy } : { x: cx - w / 2, y: cy - h / 2 };

  /**
   * O '+' ao lado de um balao cria o proximo ja ligado por uma seta. A seta
   * guarda os dois ids, entao continua certa depois que qualquer um se mexe.
   */
  const createLinked = useCallback(
    (sourceId: string, lado: Lado) => {
      const atual = pagesRef.current.find((p) => p.id === activeId);
      const fonte = atual?.elements.find((e) => e.id === sourceId);
      if (!fonte) return;

      const tipo: ElementType = ['rectangle', 'ellipse', 'sticky', 'minitable'].includes(
        fonte.type,
      )
        ? fonte.type
        : 'rectangle';

      const tabela = tipo === 'minitable' ? novaMiniTabela() : undefined;
      const tamanho = tabela ? miniSize(tabela) : DEFAULTS[tipo];
      const b = boundsOf(fonte);
      const vao = 72;

      const cx =
        lado === 'esquerda' ? b.cx - b.w / 2 - vao - tamanho.width / 2
        : lado === 'direita' ? b.cx + b.w / 2 + vao + tamanho.width / 2
        : b.cx;
      const cy =
        lado === 'cima' ? b.cy - b.h / 2 - vao - tamanho.height / 2
        : lado === 'baixo' ? b.cy + b.h / 2 + vao + tamanho.height / 2
        : b.cy;

      const canto = cantoDe(tipo, tamanho.width, tamanho.height, cx, cy);
      const novo: BoardElement = {
        id: crypto.randomUUID(),
        type: tipo,
        x: canto.x,
        y: canto.y,
        width: tamanho.width,
        height: tamanho.height,
        rotation: 0,
        content: '',
        style: {
          ...DEFAULT_STYLE,
          fill: FILL_BY_TYPE[tipo] ?? DEFAULT_STYLE.fill,
          stroke: STROKE_BY_TYPE[tipo] ?? DEFAULT_STYLE.stroke,
        },
        ...(tabela ? { table: tabela } : {}),
      };

      const seta: BoardElement = {
        id: crypto.randomUUID(),
        type: 'arrow',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
        content: '',
        style: { ...DEFAULT_STYLE, stroke: '#A9B4C4', strokeWidth: 1.5 },
        points: [0, 0, 0, 0],
        fromId: sourceId,
        toId: novo.id,
      };

      // A seta entra antes para ficar atras dos baloes.
      setElements((prev) => [seta, ...prev, novo]);
      setSelectedIds([novo.id]);
    },
    [activeId, setElements],
  );

  /**
   * Digitar numa celula nao merece um ponto de desfazer por tecla, entao a
   * tabelinha grava direto e deixa um unico ponto quando o editor fecha.
   */
  const tabelaMexida = useRef(false);

  const updateTable = useCallback(
    (id: string, table: MiniTable) => {
      tabelaMexida.current = true;
      setElements(
        (prev) =>
          prev.map((el) =>
            el.id === id ? { ...el, table, ...miniSize(table) } : el,
          ),
        false,
      );
    },
    [setElements],
  );

  const fecharTabela = useCallback(() => {
    if (tabelaMexida.current) {
      tabelaMexida.current = false;
      setElements((prev) => prev, true);
    }
    setTableTarget(null);
  }, [setElements]);


  /** Uma seta entre dois elementos que ja existem, sem criar nada novo. */
  const connectElements = useCallback(
    (fromId: string, toId: string) => {
      const atual = pagesRef.current.find((p) => p.id === activeId);
      const elementos = atual?.elements ?? [];
      if (!elementos.some((e) => e.id === fromId)) return;
      if (!elementos.some((e) => e.id === toId)) return;
      // Ligar de novo o mesmo par so empilharia tracos por cima do outro.
      const repetida = elementos.some(
        (e) =>
          e.type === 'arrow' &&
          ((e.fromId === fromId && e.toId === toId) ||
            (e.fromId === toId && e.toId === fromId)),
      );
      if (repetida) return;

      const seta: BoardElement = {
        id: crypto.randomUUID(),
        type: 'arrow',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
        content: '',
        style: { ...DEFAULT_STYLE, stroke: '#A9B4C4', strokeWidth: 1.5 },
        points: [0, 0, 0, 0],
        fromId,
        toId,
      };
      setElements((prev) => [seta, ...prev]);
    },
    [activeId, setElements],
  );

  /** Move varios de uma vez, com um unico ponto de desfazer. */
  const moveMany = useCallback(
    (movimentos: { id: string; x: number; y: number }[]) => {
      const porId = new Map(movimentos.map((m) => [m.id, m]));
      const prox = (prev: BoardElement[]) =>
        prev.map((el) => {
          const m = porId.get(el.id);
          return m ? { ...el, x: m.x, y: m.y } : el;
        });
      setElements(prox);
      // Persistir os novos positions no banco.
      const atual = pagesRef.current.find((p) => p.id === activeId);
      if (atual) {
        const proxPagina = { ...atual, elements: prox(atual.elements) };
        pagesRef.current = pagesRef.current.map((p) =>
          p.id === atual.id ? proxPagina : p,
        );
        fetch('/api/pages/' + activeId, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ elements: proxPagina.elements }),
        });
      }
    },
    [activeId, setElements],
  );

  /**
   * Agrupar nao cria pai nem filho: os escolhidos passam a andar juntos, e
   * mover qualquer um move todos. As setas ficam de fora porque ja seguem
   * as pontas sozinhas.
   */
  const agrupar = useCallback(() => {
    const atual = pagesRef.current.find((p) => p.id === activeId);
    const alvos = (atual?.elements ?? []).filter(
      (el) => selectedIds.includes(el.id) && el.type !== 'arrow',
    );
    if (alvos.length < 2) return;
    // Entrar num grupo que ja existe e mais util do que criar outro por cima.
    const existente = alvos.find((el) => el.groupId)?.groupId;
    const grupo = existente ?? crypto.randomUUID();
    const ids = new Set(alvos.map((el) => el.id));
    setElements((prev) =>
      prev.map((el) => (ids.has(el.id) ? { ...el, groupId: grupo } : el)),
    );
  }, [activeId, selectedIds, setElements]);

  const desagrupar = useCallback(() => {
    const ids = new Set(selectedIds);
    setElements((prev) =>
      prev.map((el) => (ids.has(el.id) ? { ...el, groupId: undefined } : el)),
    );
  }, [selectedIds, setElements]);

  const deleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    // Uma seta presa a um balao apagado nao tem mais o que mostrar.
    setElements((prev) =>
      prev.filter(
        (el) =>
          !selectedIds.includes(el.id) &&
          !(el.fromId && selectedIds.includes(el.fromId)) &&
          !(el.toId && selectedIds.includes(el.toId)),
      ),
    );
    setSelectedIds([]);
  }, [selectedIds, setElements]);

  const duplicateSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const source = pagesRef.current.find((p) => p.id === activeId)?.elements ?? [];
    // As copias formam um grupo proprio: herdar o grupo do original faria a
    // copia arrastar o original junto.
    const grupoNovo = crypto.randomUUID();
    const copies = source
      .filter((el) => selectedIds.includes(el.id))
      .map((el) => ({
        ...el,
        id: crypto.randomUUID(),
        x: el.x + 24,
        y: el.y + 24,
        groupId: el.groupId ? grupoNovo : undefined,
      }));
    if (copies.length === 0) return;
    setElements((prev) => [...prev, ...copies]);
    setSelectedIds(copies.map((c) => c.id));
  }, [selectedIds, activeId, setElements]);

  const reorder = useCallback(
    (toFront: boolean) => {
      setElements((prev) => {
        const moving = prev.filter((el) => selectedIds.includes(el.id));
        const rest = prev.filter((el) => !selectedIds.includes(el.id));
        return toFront ? [...rest, ...moving] : [...moving, ...rest];
      });
    },
    [selectedIds, setElements],
  );

  const restoreSnapshot = useCallback(
    (snapshot: BoardElement[]) => {
      pagesRef.current = pagesRef.current.map((p) =>
        p.id === activeId ? { ...p, elements: snapshot } : p,
      );
      setPages(pagesRef.current);
      setSelectedIds([]);
      setHistVersion((v) => v + 1);
    },
    [activeId],
  );

  const vinculadas = useMemo(() => {
    const ids = new Set<string>();
    for (const el of activePage?.elements ?? []) {
      if (el.type === 'minitable' && el.table?.linkedPageId) {
        ids.add(el.table.linkedPageId);
      }
    }
    return [...ids].sort().join(',');
  }, [activePage]);

  useEffect(() => {
    if (!vinculadas) {
      setLinked({});
      return;
    }
    let vivo = true;
    (async () => {
      const mapa: Record<string, Record<string, number[]>> = {};
      for (const id of vinculadas.split(',')) {
        const res = await fetch(`/api/pages/${id}/table`);
        if (!res.ok) continue;
        const { columns, rows } = await res.json();
        const porNome: Record<string, number[]> = {};
        for (const c of columns) {
          if (c.type !== 'number') continue;
          porNome[c.name] = rows
            .map((r: { values: Record<string, unknown> }) => Number(r.values[c.id]))
            .filter((n: number) => !Number.isNaN(n));
        }
        mapa[id] = porNome;
      }
      if (vivo) setLinked(mapa);
    })();
    return () => {
      vivo = false;
    };
  }, [vinculadas]);

  const undo = useCallback(() => {
    if (histIndex.current <= 0) return;
    histIndex.current -= 1;
    restoreSnapshot(history.current[histIndex.current]);
  }, [restoreSnapshot]);

  const redo = useCallback(() => {
    if (histIndex.current >= history.current.length - 1) return;
    histIndex.current += 1;
    restoreSnapshot(history.current[histIndex.current]);
  }, [restoreSnapshot]);

  const uploadImage = useCallback(
    async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (!res.ok) {
        alert('Nao foi possivel enviar a imagem.');
        return;
      }
      const { src } = await res.json();
      const img = new window.Image();
      img.src = src;
      img.onload = () => {
        const scale = Math.min(1, 420 / img.width);
        createElement('image', 420, 320, {
          src,
          width: img.width * scale,
          height: img.height * scale,
        });
      };
    },
    [createElement],
  );

  /** Opening a card: assistant cards start a run, result cards branch a new variation. */
  const openCard = useCallback(
    (el: BoardElement) => {
      if (el.type === 'minitable') {
        setTableTarget(el.id);
        return;
      }
      const assistant = assistants.find((a) => a.id === el.assistantId);
      if (!assistant) {
        alert('O assistente deste card foi removido.');
        return;
      }
      setRunTarget({
        assistant,
        parent: el.type === 'derivation' ? el : undefined,
      });
    },
    [assistants],
  );

  const nextVariation = (assistantId: string, projectId: string) => {
    const used = pagesRef.current
      .filter((p) => p.projectId === projectId)
      .flatMap((p) => p.elements)
      .filter((e) => e.type === 'derivation' && e.assistantId === assistantId)
      .map((e) => e.variation ?? 0);
    return (used.length ? Math.max(...used) : 0) + 1;
  };

  const saveRun = (result: RunResult) => {
    if (!runTarget || !activePage) return;
    const anchor = runTarget.parent;
    createElement(
      'derivation',
      (anchor ? anchor.x + anchor.width + 180 : 420) + DEFAULTS.derivation.width / 2,
      (anchor ? anchor.y : 300) + DEFAULTS.derivation.height / 2,
      {
        assistantId: runTarget.assistant.id,
        parentId: result.parentId,
        title: result.title,
        inputs: result.inputs,
        output: result.output,
        variation: result.variation,
        producedAt: new Date().toISOString(),
      },
    );
    setRunTarget(null);
  };

  const createPage = async (projectId: string, type: PageType) => {
    const titles: Record<PageType, string> = {
      canvas: 'Novo mural',
      text: 'Nova pagina',
      table: 'Relatorio de variacoes',
      assistants: 'Assistentes',
      database: 'Nova tabela',
    };
    const res = await fetch('/api/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, title: titles[type], type }),
    });
    if (!res.ok) return;
    const page: Page = await res.json();
    setPages((prev) => [...prev, page]);
    setActiveId(page.id);
  };

  const toggleFavorite = async (id: string, favorite: boolean) => {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, favorite } : p)));
    await fetch('/api/pages/' + id + '/favorite', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorite }),
    });
  };

  const renamePage = (id: string, title: string) => {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, title } : p)));
    fetch('/api/pages/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
  };

  const movePage = async (id: string, projectId: string) => {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, projectId } : p)));
    await fetch('/api/pages/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId }),
    });
  };

  const deletePage = async (id: string) => {
    await fetch('/api/pages/' + id, { method: 'DELETE' });
    await loadWorkspace(id === activeId ? undefined : activeId);
  };

  const createProject = async () => {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Novo projeto' }),
    });
    const project: Project = await res.json();
    const ws = await loadWorkspace();
    const first = ws.pages.find((p: Page) => p.projectId === project.id);
    if (first) setActiveId(first.id);
  };

  const renameProject = (id: string, name: string) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
    fetch('/api/projects/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
  };

  const deleteProject = async (id: string) => {
    await fetch('/api/projects/' + id, { method: 'DELETE' });
    await loadWorkspace();
  };

  const createAssistant = async () => {
    if (!activePage) return;
    const res = await fetch('/api/assistants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: activePage.projectId, name: 'Novo assistente' }),
    });
    if (!res.ok) return;
    const assistant: Assistant = await res.json();
    setAssistants((prev) => [...prev, assistant]);
  };

  const updateAssistant = (id: string, patch: Partial<Assistant>) => {
    setAssistants((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    fetch('/api/assistants/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
  };

  const deleteAssistant = async (id: string) => {
    await fetch('/api/assistants/' + id, { method: 'DELETE' });
    await loadWorkspace(activeId);
  };

  const openFromTable = (pageId: string, elementId: string) => {
    pendingSelect.current = [elementId];
    setActiveId(pageId);
  };

  useEffect(() => {
    if (!activePage) return;
    let alive = true;
    const beat = async () => {
      try {
        const res = await fetch('/api/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageId: activePage.id }),
        });
        const data = await res.json();
        if (alive) setOthers(data.others ?? []);
      } catch {
        // a missed heartbeat just means a stale list; the next one corrects it
      }
    };
    beat();
    const timer = setInterval(beat, 20000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [activePage?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelected();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
        return;
      }
      if (e.key === 'Escape') {
        setSelectedIds([]);
        setTool('select');
        return;
      }
      if (mod) return;

      const map: Record<string, Tool> = {
        v: 'select',
        s: 'sticky',
        r: 'rectangle',
        e: 'ellipse',
        t: 'text',
        a: 'arrow',
        l: 'reference',
        g: 'assistant',
      };
      const next = map[e.key.toLowerCase()];
      if (next) setTool(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, duplicateSelected, deleteSelected]);

  if (!loaded || !activePage) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-slate-400">
        Carregando...
      </div>
    );
  }

  const selectedElements = activePage.elements.filter((el) => selectedIds.includes(el.id));
  const isOwner = activePage.role === 'owner';
  const canEdit = isOwner || activePage.role === 'editor';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-slate-800">
      <Sidebar
        onToggleFavorite={toggleFavorite}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        me={me}
        projects={projects}
        pages={pages}
        activeId={activeId}
        onSelect={setActiveId}
        onCreatePage={createPage}
        onRenamePage={renamePage}
        onDeletePage={deletePage}
        onCreateProject={createProject}
        onRenameProject={renameProject}
        onDeleteProject={deleteProject}
        onOpenMembers={() => setShowMembers(true)}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2.5 border-b border-slate-200/70 px-3 py-3 md:px-5">
          <button
            onClick={() => setDrawerOpen(true)}
            title="Abrir menu"
            className="-ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 md:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>

          {activeProject && (
            <>
              <span
                className="h-2 w-2 shrink-0 rounded-full max-md:hidden"
                style={{ background: activeProject.color }}
              />
              <select
                value={activeProject.id}
                onChange={(e) => movePage(activePage.id, e.target.value)}
                disabled={!isOwner}
                title={isOwner ? 'Mover para outro projeto' : 'Só o dono pode mover a página'}
                className="cursor-pointer appearance-none rounded-md bg-transparent py-0.5 text-[13px] font-medium text-slate-500 outline-none transition hover:text-slate-800 max-md:hidden"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <span className="text-slate-300 max-md:hidden">/</span>
            </>
          )}

          <span className="shrink-0">
            <Icon name={activePage.type} size={17} color={PAGE_COLOR[activePage.type]} />
          </span>
          <input
            value={activePage.title}
            readOnly={!isOwner}
            onChange={(e) => renamePage(activePage.id, e.target.value)}
            className={
              'min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 text-[17px] font-semibold tracking-tight text-slate-900 outline-none transition ' +
              (isOwner ? 'focus:bg-slate-50' : 'cursor-default')
            }
          />

          {!canEdit && (
            <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[11.5px] font-medium text-slate-500">
              Somente leitura
            </span>
          )}

          {others.length > 0 && (
            <span
              title={others.join(', ') + ' com esta pagina aberta'}
              className="shrink-0 rounded-md bg-amber-50 px-2 py-1 text-[11.5px] font-medium text-amber-700"
            >
              <span className="max-md:hidden">
                {others.length === 1 ? `${others[0]} está aqui` : `${others.length} pessoas aqui`}
              </span>
              <span className="md:hidden">{others.length}</span>
            </span>
          )}

          {isOwner && (
            <button
              onClick={() => setShowShare(true)}
              title="Compartilhar"
              className="shrink-0 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              <span className="max-md:hidden">Compartilhar</span>
              <span className="md:hidden"><Icon name="share" size={17} /></span>
            </button>
          )}

          <span className="shrink-0 text-xs text-slate-400 max-md:hidden">
            {saving ? 'Salvando...' : 'Salvo'}
          </span>
        </header>

        {activePage.type === 'canvas' && (
          <div className="flex min-h-0 flex-1">
            <div className="relative min-w-0 flex-1">
              <Canvas
                key={activePage.id}
                page={activePage}
                pages={pages}
                projects={projects}
                assistants={assistants}
                tool={tool}
                setTool={setTool}
                selectedIds={selectedIds}
                setSelectedIds={setSelectedIds}
                onCreate={handleCanvasCreate}
                onChange={updateElement}
                onOpenRef={setActiveId}
                onOpenCard={openCard}
                onCreateLinked={createLinked}
                onConnect={connectElements}
                onMoveMany={moveMany}
                linked={linked}
                onUndo={undo}
                onRedo={redo}
                canUndo={histIndex.current > 0}
                canRedo={histIndex.current < history.current.length - 1}
              />
              {canEdit && (
                <Toolbar
                  tool={tool}
                  setTool={setTool}
                  onUploadImage={uploadImage}
                  hiddenOnMobile={selectedIds.length > 0}
                />
              )}
            </div>
            {canEdit && (
            <PropertiesPanel
              elements={selectedElements}
              pages={pages}
              projects={projects}
              assistants={projectAssistants}
              currentPageId={activeId}
              onChange={updateElement}
              onDelete={deleteSelected}
              onDuplicate={duplicateSelected}
              onBringToFront={() => reorder(true)}
              onSendToBack={() => reorder(false)}
              onGroup={agrupar}
              onUngroup={desagrupar}
              onDeselect={() => setSelectedIds([])}
            />
            )}
          </div>
        )}

        {activePage.type === 'text' && (
          <div className="flex-1 overflow-y-auto">
            <textarea
              value={activePage.body}
              onChange={(e) =>
                setPages((prev) =>
                  prev.map((p) => (p.id === activeId ? { ...p, body: e.target.value } : p)),
                )
              }
              readOnly={!canEdit}
              placeholder={canEdit ? 'Escreva aqui...' : ''}
              className="mx-auto block h-full w-full max-w-3xl resize-none px-8 py-10 text-[15px] leading-7 text-slate-700 outline-none placeholder:text-slate-300"
            />
          </div>
        )}

        {activePage.type === 'assistants' && (
          <AssistantsPage
            assistants={assistants}
            projectId={activePage.projectId}
            onCreate={createAssistant}
            onChange={updateAssistant}
            onDelete={deleteAssistant}
          />
        )}

        {activePage.type === 'database' && (
          <DatabasePage
            pageId={activePage.id}
            canEdit={canEdit}
            titleWidth={activePage.titleWidth}
            sorts={activePage.sorts}
            filters={activePage.filters}
            groupBy={activePage.groupBy}
            showTitle={activePage.showTitle}
            onView={(patch) => {
              setPages((prev) =>
                prev.map((p) => (p.id === activePage.id ? { ...p, ...patch } : p)),
              );
              fetch('/api/pages/' + activePage.id, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patch),
              });
            }}
            onTitleWidth={(w) => {
              setPages((prev) =>
                prev.map((p) => (p.id === activePage.id ? { ...p, titleWidth: w } : p)),
              );
              fetch('/api/pages/' + activePage.id, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ titleWidth: w }),
              });
            }}
          />
        )}

        {activePage.type === 'table' && (
          <TablePage
            pages={pages}
            assistants={assistants}
            projectId={activePage.projectId}
            onOpen={openFromTable}
          />
        )}
      </main>

      {tableTarget &&
        (() => {
          const el = activePage?.elements.find((e) => e.id === tableTarget);
          if (!el?.table) return null;
          return (
            <MiniTableDialog
              table={el.table}
              pages={pages}
              canEdit={activePage?.role !== 'viewer'}
              linked={linked[el.table.linkedPageId ?? ''] ?? null}
              onSave={(next) => updateTable(el.id, next)}
              onClose={fecharTabela}
            />
          );
        })()}

      {showShare && me && (
        <ShareDialog page={activePage} meId={me.id} onClose={() => setShowShare(false)} />
      )}

      {showMembers && me && (
        <MembersDialog meId={me.id} onClose={() => setShowMembers(false)} />
      )}

      {runTarget && (
        <RunAssistantDialog
          assistant={runTarget.assistant}
          parent={runTarget.parent}
          variation={nextVariation(runTarget.assistant.id, activePage.projectId)}
          aiEnabled={aiEnabled}
          onClose={() => setRunTarget(null)}
          onSave={saveRun}
        />
      )}
    </div>
  );
}
