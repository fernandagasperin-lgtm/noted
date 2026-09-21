'use client';

import { useEffect, useState } from 'react';
import { Rect, Ellipse, Text, Group, Arrow, Line, Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import type { Assistant, BoardElement, Page, Project } from '@/lib/types';

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

interface Props {
  el: BoardElement;
  pages: Page[];
  projects: Project[];
  assistants: Assistant[];
  isSelected: boolean;
  draggable: boolean;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  onChange: (patch: Partial<BoardElement>) => void;
  onEditText: () => void;
  onOpenRef: (pageId: string) => void;
}

export default function Shape({
  el,
  pages,
  projects,
  assistants,
  isSelected,
  draggable,
  onSelect,
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
    case 'rectangle':
      return (
        <Rect
          {...common}
          {...softShadow}
          width={el.width}
          height={el.height}
          fill={el.style.fill}
          stroke={el.style.stroke}
          strokeWidth={el.style.strokeWidth}
          cornerRadius={10}
        />
      );

    case 'ellipse':
      return (
        <Ellipse
          {...common}
          {...softShadow}
          radiusX={el.width / 2}
          radiusY={el.height / 2}
          fill={el.style.fill}
          stroke={el.style.stroke}
          strokeWidth={el.style.strokeWidth}
        />
      );

    case 'arrow':
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
          <Text text={target?.icon ?? '🔗'} x={16} y={15} fontSize={20} />
          <Text
            text={target?.title ?? 'Pagina removida'}
            x={46}
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
                  (target.type === 'text' ? 'Pagina de texto' : 'Quadro')
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
            x={46}
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

    default:
      return null;
  }
}
