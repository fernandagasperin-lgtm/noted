'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Rect, Ellipse, Text, Group, Arrow, Line, Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import type { Assistant, BoardElement, Page, Project } from '@/lib/types';
import { MINI_ROW_H, connectorPoints, curveThrough } from '@/lib/geometry';
import { displayValue, evaluateGrid, refOf } from '@/lib/formula';

const INK = '#334155';
const MUTED = '#94A3B8';

function useImage(src?: string) {
  const [img, setImg] = useState<HTMLImageElement | undefined>();
  useEffect(() => {
    if (!src) return;
    const image = new window.Image();
    image.src = src;
    image.onload = () => setImg(image);
    return () => {
      image.onload = null;
    };
  }, [src]);
  return img;
}

/** O texto que mora dentro de uma forma, centrado como no Miro. */
function ShapeLabel({
  el,
  width,
  height,
}: {
  el: BoardElement;
  width: number;
  height: number;
}) {
  const pad = 10;
  return (
    <Text
      text={el.content || 'Escreva...'}
      x={pad}
      y={pad}
      width={Math.max(10, width - pad * 2)}
      height={Math.max(10, height - pad * 2)}
      align="center"
      verticalAlign="middle"
      fontSize={el.style.fontSize}
      fontFamily="Inter, system-ui, sans-serif"
      fill={el.content ? INK : '#CBD5E1'}
      lineHeight={1.3}
      wrap="word"
      ellipsis
      listening={false}
    />
  );
}

interface Props {
  el: BoardElement;
  elements: BoardElement[];
  /** somas por pagina e por nome de coluna, para COLUNA() nas tabelinhas */
  linked?: Record<string, Record<string, number[]>>;
  pages: Page[];
  projects: Project[];
  assistants: Assistant[];
  isSelected: boolean;
  draggable: boolean;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  onDragStart?: () => void;
  onDragMove?: () => void;
  onChange: (patch: Partial<BoardElement>) => void;
  onEditText: () => void;
  onOpenRef: (pageId: string) => void;
}

export default function Shape({
  el,
  elements,
  linked,
  pages,
  projects,
  assistants,
  isSelected,
  draggable,
  onSelect,
  onDragStart,
  onDragMove,
  onChange,
  onEditText,
  onOpenRef,
}: Props) {
  const img = useImage(el.type === 'image' ? el.src : undefined);

  const common = {
    id: el.id,
    name: 'element',
    x: el.x,
    y: el.y,
    rotation: el.rotation,
    opacity: el.style.opacity,
    draggable,
    onMouseDown: onSelect,
    onDragStart,
    onDragMove,
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) =>
      onChange({ x: e.target.x(), y: e.target.y() }),
  };

  const softShadow = {
    shadowColor: '#0F172A',
    shadowBlur: isSelected ? 18 : 10,
    shadowOpacity: isSelected ? 0.14 : 0.07,
    shadowOffsetY: isSelected ? 4 : 2,
  };

  switch (el.type) {
    // Forma e texto andam juntos: no Miro a forma e o suporte da escrita.
    case 'rectangle':
      return (
        <Group {...common} onDblClick={onEditText} onDblTap={onEditText}>
          <Rect
            {...softShadow}
            width={el.width}
            height={el.height}
            fill={el.style.fill}
            stroke={el.style.stroke}
            strokeWidth={el.style.strokeWidth}
            cornerRadius={10}
          />
          <ShapeLabel el={el} width={el.width} height={el.height} />
        </Group>
      );

    case 'ellipse':
      return (
        <Group {...common} onDblClick={onEditText} onDblTap={onEditText}>
          <Ellipse
            {...softShadow}
            radiusX={el.width / 2}
            radiusY={el.height / 2}
            fill={el.style.fill}
            stroke={el.style.stroke}
            strokeWidth={el.style.strokeWidth}
          />
          {/* A elipse e desenhada a partir do centro, o texto a partir do canto. */}
          <Group x={-el.width / 2} y={-el.height / 2}>
            <ShapeLabel el={el} width={el.width} height={el.height} />
          </Group>
        </Group>
      );

    case 'arrow': {
      // Preso a dois elementos, o traco e recalculado a cada render: e assim
      // que ele acompanha quem se move, como num organograma.
      const presos = connectorPoints(el, elements);
      if (presos) {
        return (
          <Arrow
            {...common}
            x={0}
            y={0}
            rotation={0}
            points={curveThrough(presos)}
            bezier
            stroke={el.style.stroke}
            strokeWidth={el.style.strokeWidth}
            fill={el.style.stroke}
            pointerLength={8}
            pointerWidth={7}
            lineCap="round"
            hitStrokeWidth={20}
            draggable={false}
          />
        );
      }
      return (
        <Arrow
          {...common}
          points={el.points ?? [0, 0, el.width, el.height]}
          stroke={el.style.stroke}
          strokeWidth={el.style.strokeWidth}
          fill={el.style.stroke}
          pointerLength={11}
          pointerWidth={11}
          lineCap="round"
          hitStrokeWidth={20}
        />
      );
    }

    case 'image':
      return img ? (
        <KonvaImage
          {...common}
          {...softShadow}
          image={img}
          width={el.width}
          height={el.height}
          cornerRadius={8}
        />
      ) : (
        <Rect
          {...common}
          width={el.width}
          height={el.height}
          fill="#F1F5F9"
          stroke="#E2E8F0"
          strokeWidth={1.5}
          cornerRadius={8}
          dash={[6, 5]}
        />
      );

    case 'text':
      return (
        <Text
          {...common}
          text={el.content || 'Texto'}
          width={el.width}
          fontSize={el.style.fontSize}
          fontFamily="Inter, system-ui, sans-serif"
          fill={el.style.stroke}
          lineHeight={1.35}
          wrap="word"
          onDblClick={onEditText}
          onDblTap={onEditText}
        />
      );

    case 'sticky':
      return (
        <Group {...common} onDblClick={onEditText} onDblTap={onEditText}>
          <Rect
            width={el.width}
            height={el.height}
            fill={el.style.fill}
            cornerRadius={3}
            shadowColor="#0F172A"
            shadowBlur={isSelected ? 22 : 14}
            shadowOpacity={isSelected ? 0.18 : 0.1}
            shadowOffsetY={isSelected ? 6 : 4}
          />
          <Text
            text={el.content || 'Escreva algo...'}
            width={el.width - 24}
            height={el.height - 24}
            x={12}
            y={12}
            fontSize={el.style.fontSize}
            fontFamily="Inter, system-ui, sans-serif"
            fill={el.content ? INK : MUTED}
            lineHeight={1.35}
            wrap="word"
            ellipsis
          />
        </Group>
      );

    case 'reference': {
      const target = pages.find((p) => p.id === el.refPageId);
      const project = projects.find((p) => p.id === target?.projectId);
      return (
        <Group
          {...common}
          onDblClick={() => el.refPageId && onOpenRef(el.refPageId)}
          onDblTap={() => el.refPageId && onOpenRef(el.refPageId)}
        >
          <Rect
            width={el.width}
            height={el.height}
            fill="#FFFFFF"
            stroke={isSelected ? '#3B82F6' : '#E2E8F0'}
            strokeWidth={isSelected ? 2 : 1.5}
            cornerRadius={12}
            shadowColor="#0F172A"
            shadowBlur={isSelected ? 20 : 12}
            shadowOpacity={isSelected ? 0.12 : 0.07}
            shadowOffsetY={3}
          />
          {project && (
            <Rect x={0} y={14} width={3} height={el.height - 28} fill={project.color} cornerRadius={2} />
          )}
          <Text
            text={target?.title ?? 'Pagina indisponivel'}
            x={18}
            y={16}
            width={el.width - 62}
            fontSize={15}
            fontStyle="600"
            fontFamily="Inter, system-ui, sans-serif"
            fill={INK}
            ellipsis
            wrap="none"
          />
          <Text
            text={
              target
                ? (project ? project.name + ' · ' : '') +
                  (target.type === 'text' ? 'Pagina de texto' : 'Mural')
                : ''
            }
            x={46}
            y={37}
            width={el.width - 62}
            fontSize={12}
            fontFamily="Inter, system-ui, sans-serif"
            fill={MUTED}
            ellipsis
            wrap="none"
          />
          <Text
            text="duplo clique para abrir"
            x={18}
            y={el.height - 22}
            fontSize={11}
            fontFamily="Inter, system-ui, sans-serif"
            fill="#CBD5E1"
          />
        </Group>
      );
    }

    case 'assistant': {
      const assistant = assistants.find((a) => a.id === el.assistantId);
      const cut = 18;
      const w = el.width;
      const h = el.height;
      return (
        <Group {...common} onDblClick={onEditText} onDblTap={onEditText}>
          <Line
            points={[cut, 0, w - cut, 0, w, h / 2, w - cut, h, cut, h, 0, h / 2]}
            closed
            fill="#EEF2FF"
            stroke={isSelected ? '#6366F1' : '#C7D2FE'}
            strokeWidth={isSelected ? 2.5 : 1.5}
            shadowColor="#312E81"
            shadowBlur={isSelected ? 20 : 12}
            shadowOpacity={isSelected ? 0.18 : 0.1}
            shadowOffsetY={3}
          />
          <Text text="✦" x={cut + 10} y={h / 2 - 22} fontSize={18} fill="#6366F1" />
          <Text
            text={assistant?.name ?? 'Assistente removido'}
            x={cut + 32}
            y={h / 2 - 24}
            width={w - cut * 2 - 40}
            fontSize={15}
            fontStyle="600"
            fontFamily="Inter, system-ui, sans-serif"
            fill="#3730A3"
            ellipsis
            wrap="none"
          />
          <Text
            text={assistant?.prompt?.replace(/\s+/g, ' ').slice(0, 60) || 'Sem prompt'}
            x={cut + 32}
            y={h / 2 - 4}
            width={w - cut * 2 - 40}
            fontSize={11.5}
            fontFamily="Inter, system-ui, sans-serif"
            fill="#818CF8"
            ellipsis
            wrap="none"
          />
          <Text
            text="duplo clique para usar"
            x={cut + 32}
            y={h / 2 + 14}
            fontSize={10.5}
            fontFamily="Inter, system-ui, sans-serif"
            fill="#A5B4FC"
          />
        </Group>
      );
    }

    case 'derivation': {
      const assistant = assistants.find((a) => a.id === el.assistantId);
      const fold = 20;
      const w = el.width;
      const h = el.height;
      const preview = (el.output || 'Sem resultado ainda').replace(/\s+/g, ' ');
      return (
        <Group {...common} onDblClick={onEditText} onDblTap={onEditText}>
          <Line
            points={[0, 0, w - fold, 0, w, fold, w, h, 0, h]}
            closed
            fill="#FFFFFF"
            stroke={isSelected ? '#3B82F6' : '#E2E8F0'}
            strokeWidth={isSelected ? 2 : 1.5}
            shadowColor="#0F172A"
            shadowBlur={isSelected ? 20 : 12}
            shadowOpacity={isSelected ? 0.13 : 0.08}
            shadowOffsetY={3}
          />
          <Line points={[w - fold, 0, w, fold, w - fold, fold]} closed fill="#E2E8F0" />
          <Rect x={0} y={0} width={4} height={h} fill="#6366F1" />
          <Text
            text={el.title || 'Sem titulo'}
            x={16}
            y={14}
            width={w - fold - 22}
            fontSize={14}
            fontStyle="600"
            fontFamily="Inter, system-ui, sans-serif"
            fill={INK}
            ellipsis
            wrap="none"
          />
          <Text
            text={
              (assistant?.name ?? 'assistente removido') +
              (el.parentId ? ' · derivado' : '')
            }
            x={16}
            y={33}
            width={w - 26}
            fontSize={11}
            fontFamily="Inter, system-ui, sans-serif"
            fill="#818CF8"
            ellipsis
            wrap="none"
          />
          <Text
            text={preview}
            x={16}
            y={54}
            width={w - 30}
            height={h - 68}
            fontSize={11.5}
            lineHeight={1.4}
            fontFamily="Inter, system-ui, sans-serif"
            fill={el.output ? '#475569' : MUTED}
            wrap="word"
            ellipsis
          />
        </Group>
      );
    }

    case 'minitable': {
      const t = el.table;
      if (!t) return null;
      const dados = linked?.[t.linkedPageId ?? ''] ?? null;
      // Os valores da tabela vinculada chegam por rede. Ate la, COLUNA() nao
      // existe e daria #NOME: melhor esperar do que acusar um erro que nao ha.
      const aguardandoVinculo = Boolean(t.linkedPageId) && !dados;
      const resultados = evaluateGrid(
        t.cells,
        dados ? { column: (nome) => dados[nome] ?? [] } : {},
      );

      const larguras = t.widths.slice(0, t.cols);
      const total = larguras.reduce((a, b) => a + b, 0);
      const altura = t.rows * MINI_ROW_H;
      const xDe = (c: number) => larguras.slice(0, c).reduce((a, b) => a + b, 0);

      const celulas: ReactNode[] = [];
      for (let r = 0; r < t.rows; r++) {
        for (let c = 0; c < t.cols; c++) {
          const ref = refOf(c, r);
          const pendente = aguardandoVinculo && resultados[ref]?.error === '#NOME';
          const texto = pendente ? '...' : displayValue(resultados[ref]);
          const erro = pendente ? null : resultados[ref]?.error;
          const numero = typeof resultados[ref]?.value === 'number';
          const cabecalho = t.header && r === 0;
          celulas.push(
            <Text
              key={ref}
              text={texto}
              x={xDe(c) + 7}
              y={r * MINI_ROW_H + 8}
              width={Math.max(8, larguras[c] - 14)}
              fontSize={12}
              fontStyle={cabecalho ? '600' : 'normal'}
              fontFamily="Inter, system-ui, sans-serif"
              fill={erro ? '#DC2626' : cabecalho ? '#334155' : numero ? '#1E293B' : '#475569'}
              align={numero && !cabecalho ? 'right' : 'left'}
              ellipsis
              wrap="none"
              listening={false}
            />,
          );
        }
      }

      const linhas: ReactNode[] = [];
      for (let r = 1; r < t.rows; r++) {
        linhas.push(
          <Line
            key={'h' + r}
            points={[0, r * MINI_ROW_H, total, r * MINI_ROW_H]}
            stroke="#E8EDF3"
            strokeWidth={1}
            listening={false}
          />,
        );
      }
      for (let c = 1; c < t.cols; c++) {
        linhas.push(
          <Line
            key={'v' + c}
            points={[xDe(c), 0, xDe(c), altura]}
            stroke="#E8EDF3"
            strokeWidth={1}
            listening={false}
          />,
        );
      }

      return (
        <Group {...common} onDblClick={onEditText} onDblTap={onEditText}>
          <Rect
            width={total}
            height={altura}
            fill="#FFFFFF"
            stroke={isSelected ? '#3B82F6' : '#DCE3EC'}
            strokeWidth={isSelected ? 2 : 1.5}
            cornerRadius={8}
            shadowColor="#0F172A"
            shadowBlur={isSelected ? 20 : 12}
            shadowOpacity={isSelected ? 0.12 : 0.07}
            shadowOffsetY={3}
          />
          {t.header && (
            <Rect
              width={total}
              height={MINI_ROW_H}
              fill="#F4F7FB"
              cornerRadius={[8, 8, 0, 0]}
              listening={false}
            />
          )}
          {linhas}
          {celulas}
          {t.linkedPageId && (
            <Text
              text="vinculada"
              x={total - 62}
              y={altura + 5}
              fontSize={10}
              fontFamily="Inter, system-ui, sans-serif"
              fill="#94A3B8"
              listening={false}
            />
          )}
        </Group>
      );
    }

    default:
      return null;
  }
}
