'use client';

import { useEffect, useRef, useState } from 'react';
import type { Stage } from 'konva/lib/Stage';

interface Props {
  stage: Stage | null;
  selected: string[];
  /** true quando pelo menos um dos selecionados esta num grupo */
  algumAgrupado: boolean;
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
  algumAgrupado,
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
      className="flex items-center gap-0.5 bg-white rounded-lg shadow-lg border border-slate-200 p-1 text-[12px] text-slate-600"
    >
      {multi && !algumAgrupado && (
        <button
          onClick={onAgrupar}
          title="Agrupar - movem juntos"
          className="px-2.5 py-1.5 rounded hover:bg-blue-50 hover:text-blue-700 transition font-medium"
        >
          Agrupar
        </button>
      )}
      {algumAgrupado && (
        <button
          onClick={onDesagrupar}
          title="Desagrupar"
          className="px-2.5 py-1.5 rounded hover:bg-slate-100 transition"
        >
          Desagrupar
        </button>
      )}

      {multi && (
        <>
          <div className="w-px h-6 bg-slate-200 mx-0.5" />
          <button onClick={onAlignLeft} title="Alinhar a esquerda" className="px-2 py-1.5 rounded hover:bg-slate-100 transition">Alinhar E</button>
          <button onClick={onAlignCenter} title="Centralizar" className="px-2 py-1.5 rounded hover:bg-slate-100 transition">Centro</button>
          <button onClick={onAlignRight} title="Alinhar a direita" className="px-2 py-1.5 rounded hover:bg-slate-100 transition">Alinhar D</button>
        </>
      )}

      <div className="w-px h-6 bg-slate-200 mx-0.5" />
      <button onClick={onBringForward} title="Trazer para frente" className="px-2 py-1.5 rounded hover:bg-slate-100 transition">Frente</button>
      <button onClick={onSendBackward} title="Enviar para tras" className="px-2 py-1.5 rounded hover:bg-slate-100 transition">Tras</button>
    </div>
  );
}
