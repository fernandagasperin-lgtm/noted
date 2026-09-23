'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Stage, Layer, Transformer } from 'react-konva';
import type Konva from 'konva';
import Shape from './Shape';
import FloatingToolbar from './FloatingToolbar';
import type { Assistant, BoardElement, Page, Project } from '@/lib/types';
import { CONNECTABLE, groupOf, boundsOf } from '@/lib/geometry';
import type { Tool } from './Toolbar';

export type Lado = 'cima' | 'baixo' | 'esquerda' | 'direita';

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 4;
const GRID = 26;

interface Props {
  page: Page;
  pages: Page[];
  projects: Project[];
  assistants: Assistant[];
  tool: Tool;
  setTool: (t: Tool) => void;
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  onCreate: (x: number, y: number) => void;
  onChange: (id: string, patch: Partial<BoardElement>) => void;
  onOpenRef: (pageId: string) => void;
  onOpenCard: (el: BoardElement) => void;
  /** cria um balao ligado a este, do lado escolhido */
  onCreateLinked: (sourceId: string, lado: Lado) => void;
  /** liga dois elementos que ja existem */
  onConnect: (fromId: string, toId: string) => void;
  /** move varios de uma vez, quando estao agrupados */
  onMoveMany: (movimentos: { id: string; x: number; y: number }[]) => void;
  linked: Record<string, Record<string, number[]>>;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onGroup?: () => void;
  onUngroup?: () => void;
  onAlignLeft?: () => void;
  onAlignCenter?: () => void;
  onAlignRight?: () => void;
  onBringToFront?: () => void;
  onSendToBack?: () => void;
}

interface Editing {
  id: string;
  value: string;
  box: { x: number; y: number; width: number; height: number };
  fontSize: number;
}

export default function Canvas({
  page,
  pages,
  projects,
  assistants,
  tool,
  setTool,
  selectedIds,
  setSelectedIds,
  onCreate,
  onChange,
  onOpenRef,
  onOpenCard,
  onCreateLinked,
  onConnect,
  onMoveMany,
  linked,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const [editing, setEditing] = useState<Editing | null>(null);
  const [alcas, setAlcas] = useState<
    { x: number; y: number; width: number; height: number } | null
  >(null);
  /** traco de previa enquanto se arrasta um '+' ate outro elemento */
  const [ligando, setLigando] = useState<{
    sourceId: string;
    lado: Lado;
    de: { x: number; y: number };
    para: { x: number; y: number };
    alvo: string | null;
  } | null>(null);
  /** retangulo de selecao enquanto se arrasta no palco vazio */
  const [boxSel, setBoxSel] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Tabelinha tem tamanho proprio e seta presa segue os baloes: esticar as
  // duas so criaria um estado que o proximo render desfaz.
  const selecaoTemTabela = page.elements.some(
    (el) =>
      selectedIds.includes(el.id) &&
      (el.type === 'minitable' || el.fromId || el.toId),
  );

  /** Um so elemento selecionado ganha os '+' que puxam o proximo balao. */
  const alvoAlcas =
    selectedIds.length === 1
      ? (page.elements.find((el) => el.id === selectedIds[0]) ?? null)
      : null;
  const podeLigar = Boolean(alvoAlcas && CONNECTABLE.has(alvoAlcas.type) && !editing);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    const nodes = selectedIds
      .map((id) => stage.findOne<Konva.Node>('#' + id))
      .filter((n): n is Konva.Node => Boolean(n));
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectedIds, page.elements, page.id]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !alvoAlcas || !podeLigar) {
      setAlcas(null);
      return;
    }
    const node = stage.findOne<Konva.Node>('#' + alvoAlcas.id);
    setAlcas(node ? node.getClientRect() : null);
    // A caixa depende da posicao, do zoom e do tamanho do painel, por isso
    // todos eles entram aqui.
  }, [alvoAlcas, podeLigar, page.elements, view, size]);

  const toCanvasCoords = useCallback((stage: Konva.Stage) => {
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    return stage.getAbsoluteTransform().copy().invert().point(pointer);
  }, []);

  const syncView = (stage: Konva.Stage) =>
    setView({ x: stage.x(), y: stage.y(), zoom: stage.scaleX() });

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const oldScale = stage.scaleX();
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };
    const factor = e.evt.deltaY > 0 ? 1 / 1.1 : 1.1;
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldScale * factor));

    stage.scale({ x: next, y: next });
    stage.position({
      x: pointer.x - mousePointTo.x * next,
      y: pointer.y - mousePointTo.y * next,
    });
    syncView(stage);
  };

  const pinch = useRef<{ dist: number; center: { x: number; y: number } } | null>(null);

  const handleTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
    const touches = e.evt.touches;
    const stage = stageRef.current;
    if (!stage || touches.length !== 2) return;

    e.evt.preventDefault();
    stage.stopDrag();

    const box = stage.container().getBoundingClientRect();
    const a = { x: touches[0].clientX - box.left, y: touches[0].clientY - box.top };
    const b = { x: touches[1].clientX - box.left, y: touches[1].clientY - box.top };
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

    if (!pinch.current) {
      pinch.current = { dist, center };
      return;
    }

    const oldScale = stage.scaleX();
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldScale * (dist / pinch.current.dist)));
    // Ancorar no ponto entre os dedos faz o quadro seguir a mao: o zoom e o
    // arrasto saem do mesmo gesto.
    const pointTo = {
      x: (pinch.current.center.x - stage.x()) / oldScale,
      y: (pinch.current.center.y - stage.y()) / oldScale,
    };
    stage.scale({ x: next, y: next });
    stage.position({ x: center.x - pointTo.x * next, y: center.y - pointTo.y * next });

    pinch.current = { dist, center };
    syncView(stage);
  };

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;

    if (tool !== 'select') {
      const pos = toCanvasCoords(stage);
      if (pos) onCreate(pos.x, pos.y);
      setTool('select');
      return;
    }
    if (e.target === stage) {
      // Comecou no vazio: inicio do box selection.
      const pos = stage.getRelativePointerPosition();
      if (pos) setBoxSel({ x: pos.x, y: pos.y, width: 0, height: 0 });
      setSelectedIds([]);
    }
  };

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!boxSel || tool !== 'select') return;
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getRelativePointerPosition();
    if (!pos) return;
    setBoxSel({
      x: Math.min(boxSel.x, pos.x),
      y: Math.min(boxSel.y, pos.y),
      width: Math.abs(pos.x - boxSel.x),
      height: Math.abs(pos.y - boxSel.y),
    });
  };

  const handleStageMouseUp = () => {
    if (!boxSel) return;
    // Quem esta dentro do box selection entra na selecao.
    const dentro = page.elements.filter((el) => {
      const b = boundsOf(el);
      return (
        b.cx - b.w / 2 >= boxSel.x &&
        b.cx + b.w / 2 <= boxSel.x + boxSel.width &&
        b.cy - b.h / 2 >= boxSel.y &&
        b.cy + b.h / 2 <= boxSel.y + boxSel.height
      );
    });
    if (dentro.length > 0) setSelectedIds(dentro.map((el) => el.id));
    setBoxSel(null);
  };

  const beginEdit = (el: BoardElement) => {
    if (el.type === 'assistant' || el.type === 'derivation' || el.type === 'minitable') {
      onOpenCard(el);
      return;
    }
    const stage = stageRef.current;
    if (!stage) return;
    const node = stage.findOne<Konva.Node>('#' + el.id);
    if (!node) return;
    setEditing({
      id: el.id,
      value: el.content,
      box: node.getClientRect(),
      fontSize: el.style.fontSize * stage.scaleX(),
    });
  };

  const commitEdit = () => {
    if (!editing) return;
    onChange(editing.id, { content: editing.value });
    setEditing(null);
  };

  const handleTransformEnd = () => {
    const stage = stageRef.current;
    if (!stage) return;
    for (const id of selectedIds) {
      const node = stage.findOne<Konva.Node>('#' + id);
      if (!node) continue;
      const el = page.elements.find((x) => x.id === id);
      if (!el) continue;

      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);

      if (el.type === 'arrow') {
        const pts = el.points ?? [0, 0, el.width, el.height];
        onChange(id, {
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          points: pts.map((p, i) => (i % 2 === 0 ? p * scaleX : p * scaleY)),
        });
      } else {
        onChange(id, {
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          width: Math.max(20, el.width * scaleX),
          height: Math.max(20, el.height * scaleY),
        });
      }
    }
  };

  const selectElement = (el: BoardElement) => (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Com uma ferramenta ativa o toque cria um elemento novo, mesmo em cima de
    // outro: deixar o clique subir ate o stage e o que permite isso.
    if (tool !== 'select') return;
    e.cancelBubble = true;
    // Quem esta agrupado e escolhido junto: clicar num e clicar em todos.
    const doGrupo = groupOf(el, page.elements).map((g) => g.id);
    const additive = e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey;
    if (additive) {
      setSelectedIds(
        selectedIds.includes(el.id)
          ? selectedIds.filter((i) => !doGrupo.includes(i))
          : [...selectedIds, ...doGrupo.filter((i) => !selectedIds.includes(i))],
      );
    } else if (!selectedIds.includes(el.id)) {
      setSelectedIds(doGrupo);
    }
  };

  /**
   * Arrastar um elemento agrupado arrasta os companheiros. Enquanto o dedo
   * esta na tela mexemos os nos do Konva direto; so no fim o estado e gravado,
   * senao o React redesenharia por cima do arrasto em curso.
   */
  const arrasto = useRef<{
    id: string;
    base: { x: number; y: number };
    outros: { id: string; x: number; y: number }[];
  } | null>(null);

  /** Retorna elementos que estão dentro de um frame (bounding box). */
  const elementsInside = (frame: BoardElement): BoardElement[] => {
    if (frame.type !== 'frame') return [];
    const frameX = frame.x;
    const frameY = frame.y;
    const frameRight = frame.x + frame.width;
    const frameBottom = frame.y + frame.height;

    return page.elements.filter((el) => {
      if (el.id === frame.id) return false;
      // Verificar se el está totalmente dentro do frame (centro + metade das dimensões)
      const elLeft = el.x - el.width / 2;
      const elTop = el.y - el.height / 2;
      const elRight = el.x + el.width / 2;
      const elBottom = el.y + el.height / 2;

      return elLeft >= frameX && elRight <= frameRight && elTop >= frameY && elBottom <= frameBottom;
    });
  };

  const iniciarArrastoGrupo = (el: BoardElement) => () => {
    // Zerar antes evita herdar um arrasto anterior que nao chegou ao fim.
    arrasto.current = null;

    // Coletar companheiros de grupo
    const companheiros = groupOf(el, page.elements).filter((g) => g.id !== el.id);

    // Se for frame, adicionar elementos dentro dele
    const filhos = el.type === 'frame' ? elementsInside(el) : [];

    const todosCompanheiros = [...companheiros, ...filhos];
    if (todosCompanheiros.length === 0) return;

    arrasto.current = {
      id: el.id,
      base: { x: el.x, y: el.y },
      outros: todosCompanheiros.map((g) => ({ id: g.id, x: g.x, y: g.y })),
    };
  };

  const moverGrupo = () => {
    const a = arrasto.current;
    const stage = stageRef.current;
    if (!a || !stage) return;
    const no = stage.findOne<Konva.Node>('#' + a.id);
    if (!no) return;
    const dx = no.x() - a.base.x;
    const dy = no.y() - a.base.y;
    for (const o of a.outros) {
      stage.findOne<Konva.Node>('#' + o.id)?.position({ x: o.x + dx, y: o.y + dy });
    }
    stage.batchDraw();
  };

  const soltarGrupo = (el: BoardElement) => (patch: Partial<BoardElement>) => {
    const a = arrasto.current;
    if (!a || a.id !== el.id) {
      onChange(el.id, patch);
      return;
    }
    const dx = (patch.x ?? el.x) - a.base.x;
    const dy = (patch.y ?? el.y) - a.base.y;
    onMoveMany([
      { id: el.id, x: patch.x ?? el.x, y: patch.y ?? el.y },
      ...a.outros.map((o) => ({ id: o.id, x: o.x + dx, y: o.y + dy })),
    ]);
    arrasto.current = null;
  };


  /** Qual elemento esta debaixo do ponteiro, se houver. */
  const elementoEm = (x: number, y: number): string | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    const achado = stage.getIntersection({ x, y });
    const grupo = achado?.findAncestor('.element', true) as Konva.Node | undefined;
    const id = grupo?.id();
    return id && page.elements.some((el) => el.id === id) ? id : null;
  };

  /**
   * Um '+' serve para duas coisas: clicado, cria o proximo balao; arrastado
   * ate outro elemento, liga os dois que ja existem.
   */
  const comecarLigacao =
    (sourceId: string, lado: Lado, origem: { x: number; y: number }) =>
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const caixa = containerRef.current?.getBoundingClientRect();
      if (!caixa) return;
      // Sem preventDefault o navegador ainda manda os eventos de mouse
      // equivalentes, e o stage comeca a arrastar o quadro junto.
      e.preventDefault();
      e.stopPropagation();

      const noQuadro = (ev: PointerEvent) => ({
        x: ev.clientX - caixa.left,
        y: ev.clientY - caixa.top,
      });

      setLigando({ sourceId, lado, de: origem, para: origem, alvo: null });

      // Escutar na janela em vez de capturar o ponteiro: a captura pode ser
      // recusada, e ai o gesto inteiro morria sem aviso.
      const mover = (ev: PointerEvent) => {
        const p = noQuadro(ev);
        setLigando({ sourceId, lado, de: origem, para: p, alvo: elementoEm(p.x, p.y) });
      };

      const soltar = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', mover);
        window.removeEventListener('pointerup', soltar);
        window.removeEventListener('pointercancel', soltar);
        setLigando(null);

        const p = noQuadro(ev);
        const andou = Math.hypot(p.x - origem.x, p.y - origem.y) > 8;
        const alvo = elementoEm(p.x, p.y);
        if (andou && alvo && alvo !== sourceId) onConnect(sourceId, alvo);
        else if (!andou) onCreateLinked(sourceId, lado);
      };

      window.addEventListener('pointermove', mover);
      window.addEventListener('pointerup', soltar);
      window.addEventListener('pointercancel', soltar);
    };

  const applyZoom = (next: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    const center = { x: size.width / 2, y: size.height / 2 };
    const old = stage.scaleX();
    const pointTo = {
      x: (center.x - stage.x()) / old,
      y: (center.y - stage.y()) / old,
    };
    stage.scale({ x: clamped, y: clamped });
    stage.position({
      x: center.x - pointTo.x * clamped,
      y: center.y - pointTo.y * clamped,
    });
    syncView(stage);
  };

  const resetView = () => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.scale({ x: 1, y: 1 });
    stage.position({ x: 0, y: 0 });
    syncView(stage);
  };

  const pillButton =
    'flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30 disabled:hover:bg-transparent';

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-[#F8F9FB]"
      style={{
        backgroundImage: 'radial-gradient(circle, #D8DDE6 1.1px, transparent 1.1px)',
        backgroundSize: `${GRID * view.zoom}px ${GRID * view.zoom}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
        touchAction: 'none',
      }}
    >
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        draggable={tool === 'select' && !editing && !boxSel}
        onWheel={handleWheel}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onDragMove={(e) => e.target === stageRef.current && syncView(e.target as Konva.Stage)}
        onDragEnd={(e) => e.target === stageRef.current && syncView(e.target as Konva.Stage)}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => (pinch.current = null)}
        style={{ cursor: tool === 'select' ? 'default' : 'crosshair' }}
      >
        <Layer>
          {page.elements.map((el) => (
            <Shape
              key={el.id}
              el={el}
              elements={page.elements}
              linked={linked}
              pages={pages}
              projects={projects}
              assistants={assistants}
              isSelected={selectedIds.includes(el.id)}
              draggable={tool === 'select'}
              onSelect={selectElement(el)}
              onDragStart={iniciarArrastoGrupo(el)}
              onDragMove={moverGrupo}
              onChange={soltarGrupo(el)}
              onEditText={() => beginEdit(el)}
              onOpenRef={onOpenRef}
            />
          ))}
          <Transformer
            ref={trRef}
            resizeEnabled={!selecaoTemTabela}
            rotateEnabled={!selecaoTemTabela}
            anchorSize={9}
            anchorCornerRadius={4}
            anchorStroke="#3B82F6"
            anchorFill="#FFFFFF"
            anchorStrokeWidth={1.5}
            borderStroke="#3B82F6"
            borderStrokeWidth={1.5}
            rotateAnchorOffset={26}
            onTransformEnd={handleTransformEnd}
            boundBoxFunc={(oldBox, newBox) =>
              newBox.width < 20 || newBox.height < 20 ? oldBox : newBox
            }
          />
        </Layer>
      </Stage>

      {editing && (
        <textarea
          autoFocus
          value={editing.value}
          onChange={(e) => setEditing({ ...editing, value: e.target.value })}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditing(null);
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commitEdit();
            e.stopPropagation();
          }}
          className="absolute z-20 resize-none rounded-lg border-0 bg-white/95 p-3 text-slate-700 shadow-lg shadow-slate-900/10 outline-none ring-2 ring-blue-500"
          style={{
            left: editing.box.x,
            top: editing.box.y,
            width: Math.max(90, editing.box.width),
            height: Math.max(44, editing.box.height),
            fontSize: editing.fontSize,
            lineHeight: 1.35,
          }}
        />
      )}

      {ligando && (
        <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full">
          <line
            x1={ligando.de.x}
            y1={ligando.de.y}
            x2={ligando.para.x}
            y2={ligando.para.y}
            stroke={ligando.alvo ? '#2383E2' : '#C3CBD8'}
            strokeWidth={ligando.alvo ? 2 : 1.5}
            strokeDasharray="5 4"
          />
          {ligando.alvo && (
            <circle cx={ligando.para.x} cy={ligando.para.y} r={5} fill="#2383E2" />
          )}
        </svg>
      )}

      {boxSel && (
        <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full">
          <rect
            x={boxSel.x}
            y={boxSel.y}
            width={boxSel.width}
            height={boxSel.height}
            fill="rgba(35, 131, 226, 0.1)"
            stroke="#2383E2"
            strokeWidth="1"
            strokeDasharray="4 2"
          />
        </svg>
      )}

      {alcas && alvoAlcas && (
        <>
          {(
            [
              ['cima', alcas.x + alcas.width / 2, alcas.y - 17],
              ['baixo', alcas.x + alcas.width / 2, alcas.y + alcas.height + 17],
              ['esquerda', alcas.x - 17, alcas.y + alcas.height / 2],
              ['direita', alcas.x + alcas.width + 17, alcas.y + alcas.height / 2],
            ] as const
          ).map(([lado, cx, cy]) => (
            <button
              key={lado}
              onPointerDown={comecarLigacao(alvoAlcas.id, lado, { x: cx, y: cy })}
              title="Clique para criar um balao ligado, ou arraste ate outro para ligar os dois"
              style={{ left: cx - 11, top: cy - 11, touchAction: 'none' }}
              className="absolute z-10 flex h-[22px] w-[22px] items-center justify-center rounded-full border border-blue-200 bg-white text-blue-500 shadow-md shadow-slate-900/10 transition hover:bg-blue-500 hover:text-white"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          ))}
        </>
      )}

      <div className="absolute left-3 z-10 flex items-center gap-0.5 rounded-xl border border-slate-200/80 bg-white/95 p-1 shadow-lg shadow-slate-900/[0.06] backdrop-blur max-md:bottom-[4.75rem] md:bottom-4 md:left-4">
        <button onClick={onUndo} disabled={!canUndo} title="Desfazer (Ctrl+Z)" className={pillButton}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8h11a5 5 0 010 10h-7M3 8l4-4M3 8l4 4" />
          </svg>
        </button>
        <button onClick={onRedo} disabled={!canRedo} title="Refazer (Ctrl+Shift+Z)" className={pillButton}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 8H10a5 5 0 000 10h7M21 8l-4-4M21 8l-4 4" />
          </svg>
        </button>
      </div>

      <FloatingToolbar
        stage={stageRef.current}
        selected={selectedIds}
        onAgrupar={onGroup ?? (() => {})}
        onDesagrupar={onUngroup ?? (() => {})}
        onAlignLeft={onAlignLeft ?? (() => {})}
        onAlignCenter={onAlignCenter ?? (() => {})}
        onAlignRight={onAlignRight ?? (() => {})}
        onBringForward={onBringToFront ?? (() => {})}
        onSendBackward={onSendToBack ?? (() => {})}
      />

      <div className="absolute right-3 z-10 flex items-center gap-0.5 rounded-xl border border-slate-200/80 bg-white/95 p-1 shadow-lg shadow-slate-900/[0.06] backdrop-blur max-md:top-3 md:bottom-4 md:right-4">
        <button onClick={() => applyZoom(view.zoom / 1.2)} title="Diminuir zoom" className={pillButton}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M5 12h14" />
          </svg>
        </button>
        <button
          onClick={resetView}
          title="Redefinir visualizacao"
          className="min-w-[52px] rounded-lg px-2 py-1.5 text-xs font-medium tabular-nums text-slate-600 transition hover:bg-slate-100"
        >
          {Math.round(view.zoom * 100)}%
        </button>
        <button onClick={() => applyZoom(view.zoom * 1.2)} title="Aumentar zoom" className={pillButton}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
    </div>
  );
}
