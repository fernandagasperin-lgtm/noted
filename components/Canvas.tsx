'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Stage, Layer, Transformer } from 'react-konva';
import type Konva from 'konva';
import Shape from './Shape';
import type { Assistant, BoardElement, Page, Project } from '@/lib/types';
import type { Tool } from './Toolbar';

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
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
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

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;

    if (tool !== 'select') {
      const pos = toCanvasCoords(stage);
      if (pos) onCreate(pos.x, pos.y);
      setTool('select');
      return;
    }
    if (e.target === stage) setSelectedIds([]);
  };

  const beginEdit = (el: BoardElement) => {
    if (el.type === 'assistant' || el.type === 'derivation') {
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
    e.cancelBubble = true;
    const additive = e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey;
    if (additive) {
      setSelectedIds(
        selectedIds.includes(el.id)
          ? selectedIds.filter((i) => i !== el.id)
          : [...selectedIds, el.id],
      );
    } else if (!selectedIds.includes(el.id)) {
      setSelectedIds([el.id]);
    }
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
      }}
    >
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        draggable={tool === 'select' && !editing}
        onWheel={handleWheel}
        onMouseDown={handleStageMouseDown}
        onDragMove={(e) => e.target === stageRef.current && syncView(e.target as Konva.Stage)}
        onDragEnd={(e) => e.target === stageRef.current && syncView(e.target as Konva.Stage)}
        style={{ cursor: tool === 'select' ? 'default' : 'crosshair' }}
      >
        <Layer>
          {page.elements.map((el) => (
            <Shape
              key={el.id}
              el={el}
              pages={pages}
              projects={projects}
              assistants={assistants}
              isSelected={selectedIds.includes(el.id)}
              draggable={tool === 'select'}
              onSelect={selectElement(el)}
              onChange={(patch) => onChange(el.id, patch)}
              onEditText={() => beginEdit(el)}
              onOpenRef={onOpenRef}
            />
          ))}
          <Transformer
            ref={trRef}
            rotateEnabled
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

      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-0.5 rounded-xl border border-slate-200/80 bg-white/95 p-1 shadow-lg shadow-slate-900/[0.06] backdrop-blur">
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

      <div className="absolute bottom-4 right-4 z-10 flex items-center gap-0.5 rounded-xl border border-slate-200/80 bg-white/95 p-1 shadow-lg shadow-slate-900/[0.06] backdrop-blur">
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
