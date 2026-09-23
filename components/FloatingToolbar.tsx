'use client';

import { useEffect, useRef, useState } from 'react';
import type { Stage } from 'konva/lib/Stage';

const MUTED = '#9CA3AF';

interface Props {
  stage: Stage | null;
  selected: string[];
  onAgrupar: () => void;
  onDesagrupar: () => void;
  onAlignLeft: () => void;
  onAlignCenter: () => void;
  onAlignRight: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
}

export default function FloatingToolbar({
  stage,
  selected,
  onAgrupar,
  onDesagrupar,
  onAlignLeft,
  onAlignCenter,
  onAlignRight,
  onBringForward,
  onSendBackward,
}: Props) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!stage || selected.length === 0) return;

    // Calcular posição do grupo selecionado
    let minX = Infinity,
      minY = Infinity;
    for (const id of selected) {
      const node = stage.findOne<any>('#' + id);
      if (node) {
        minX = Math.min(minX, node.x());
        minY = Math.min(minY, node.y());
      }
    }

    if (minX === Infinity) return;

    // Posicionar toolbar logo acima do primeiro elemento
    setPos({
      x: minX,
      y: minY - 50,
    });
  }, [stage, selected]);

  if (selected.length === 0) return null;

  const multi = selected.length > 1;
  const IconSvg = ({ d }: { d: string }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d={d} />
    </svg>
  );

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 1000,
        pointerEvents: 'auto',
      }}
      className="flex gap-1 bg-white rounded-lg shadow-lg border border-slate-200 p-1"
    >
      {/* Agrupar/Desagrupar */}
      {multi && (
        <>
          <button
            onClick={onAgrupar}
            title="Agrupar (movem juntos)"
            className="p-2 rounded hover:bg-slate-100 transition"
            style={{ color: MUTED }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="12" r="2" />
              <circle cx="15" cy="12" r="2" />
              <path d="M6 12a6 6 0 1 0 12 0" />
            </svg>
          </button>
          <div className="w-px bg-slate-200" />
        </>
      )}
      {selected.length > 0 && (
        <button
          onClick={onDesagrupar}
          title="Desagrupar"
          className="p-2 rounded hover:bg-slate-100 transition"
          style={{ color: MUTED }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="9" cy="12" r="2" />
            <circle cx="15" cy="12" r="2" />
            <path d="M9 14a6 6 0 0 1 6-6M3 12a9 9 0 0 0 9 9" />
          </svg>
        </button>
      )}

      {/* Alinhamento */}
      {multi && (
        <>
          <div className="w-px bg-slate-200" />
          <button
            onClick={onAlignLeft}
            title="Alinhar à esquerda"
            className="p-2 rounded hover:bg-slate-100 transition"
            style={{ color: MUTED }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="6" y1="3" x2="6" y2="21" />
              <rect x="10" y="5" width="8" height="5" />
              <rect x="10" y="14" width="8" height="5" />
            </svg>
          </button>
          <button
            onClick={onAlignCenter}
            title="Centralizar horizontalmente"
            className="p-2 rounded hover:bg-slate-100 transition"
            style={{ color: MUTED }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="3" x2="12" y2="21" />
              <rect x="5" y="5" width="6" height="5" />
              <rect x="13" y="14" width="6" height="5" />
            </svg>
          </button>
          <button
            onClick={onAlignRight}
            title="Alinhar à direita"
            className="p-2 rounded hover:bg-slate-100 transition"
            style={{ color: MUTED }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="3" x2="18" y2="21" />
              <rect x="6" y="5" width="8" height="5" />
              <rect x="6" y="14" width="8" height="5" />
            </svg>
          </button>
        </>
      )}

      {/* Z-Order */}
      <div className="w-px bg-slate-200" />
      <button
        onClick={onBringForward}
        title="Trazer para frente"
        className="p-2 rounded hover:bg-slate-100 transition"
        style={{ color: MUTED }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 8l2-2 6 6" />
          <path d="M4 14v4h4" />
          <rect x="10" y="10" width="8" height="8" />
        </svg>
      </button>
      <button
        onClick={onSendBackward}
        title="Enviar para trás"
        className="p-2 rounded hover:bg-slate-100 transition"
        style={{ color: MUTED }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 16l-2 2-6-6" />
          <path d="M20 10v-4h-4" />
          <rect x="4" y="4" width="8" height="8" />
        </svg>
      </button>
    </div>
  );
}
