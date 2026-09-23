import type { BoardElement, MiniTable } from './types';

/** Altura de cada linha da tabelinha; a largura vem de table.widths. */
export const MINI_ROW_H = 30;

export function miniSize(t: MiniTable): { width: number; height: number } {
  const width = t.widths.slice(0, t.cols).reduce((a, b) => a + b, 0);
  return { width: Math.max(60, width), height: t.rows * MINI_ROW_H };
}

export interface Bounds {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

/**
 * No Konva a elipse e posicionada pelo centro e o resto pelo canto, entao
 * quem precisa da caixa de um elemento passa por aqui em vez de adivinhar.
 */
export function boundsOf(el: BoardElement): Bounds {
  if (el.type === 'ellipse') {
    return { cx: el.x, cy: el.y, w: el.width, h: el.height };
  }
  return {
    cx: el.x + el.width / 2,
    cy: el.y + el.height / 2,
    w: el.width,
    h: el.height,
  };
}

/** O ponto da borda do elemento na direcao de (tx, ty). */
export function borderPoint(
  el: BoardElement,
  tx: number,
  ty: number,
): { x: number; y: number } {
  const b = boundsOf(el);
  const dx = tx - b.cx;
  const dy = ty - b.cy;
  if (dx === 0 && dy === 0) return { x: b.cx, y: b.cy };

  if (el.type === 'ellipse') {
    const rx = Math.max(1, b.w / 2);
    const ry = Math.max(1, b.h / 2);
    const t = 1 / Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
    return { x: b.cx + dx * t, y: b.cy + dy * t };
  }

  const hw = Math.max(1, b.w / 2);
  const hh = Math.max(1, b.h / 2);
  const t = Math.min(
    hw / Math.abs(dx || 1e-6),
    hh / Math.abs(dy || 1e-6),
  );
  return { x: b.cx + dx * t, y: b.cy + dy * t };
}

/**
 * Os dois pontos de uma seta presa a elementos. Devolve null quando alguma
 * ponta aponta para um elemento que nao existe mais.
 */
export function connectorPoints(
  arrow: BoardElement,
  elements: BoardElement[],
): number[] | null {
  const from = arrow.fromId ? elements.find((e) => e.id === arrow.fromId) : null;
  const to = arrow.toId ? elements.find((e) => e.id === arrow.toId) : null;
  if (!from && !to) return null;

  // Uma ponta solta fica onde o usuario deixou, medida a partir de x,y.
  const pts = arrow.points ?? [0, 0, arrow.width, arrow.height];
  const livreA = { x: arrow.x + pts[0], y: arrow.y + pts[1] };
  const livreB = { x: arrow.x + pts[2], y: arrow.y + pts[3] };

  const alvoA = from ? boundsOf(from) : null;
  const alvoB = to ? boundsOf(to) : null;

  const miraA = alvoB ? { x: alvoB.cx, y: alvoB.cy } : livreB;
  const miraB = alvoA ? { x: alvoA.cx, y: alvoA.cy } : livreA;

  const a = from ? borderPoint(from, miraA.x, miraA.y) : livreA;
  const b = to ? borderPoint(to, miraB.x, miraB.y) : livreB;
  return [a.x, a.y, b.x, b.y];
}

/**
 * Os pontos de uma curva de Bezier entre as duas pontas. A curva sai reta do
 * balao e so depois vira, que e o que faz o traco parecer desenhado a mao em
 * vez de um risco de regua.
 */
export function curveThrough(pts: number[]): number[] {
  const [ax, ay, bx, by] = pts;
  const dx = bx - ax;
  const dy = by - ay;
  const deitada = Math.abs(dx) > Math.abs(dy);
  const folga = Math.min(140, Math.max(36, (deitada ? Math.abs(dx) : Math.abs(dy)) * 0.5));
  const sx = Math.sign(dx) || 1;
  const sy = Math.sign(dy) || 1;

  const c1 = deitada ? [ax + folga * sx, ay] : [ax, ay + folga * sy];
  const c2 = deitada ? [bx - folga * sx, by] : [bx, by - folga * sy];
  return [ax, ay, c1[0], c1[1], c2[0], c2[1], bx, by];
}

/** Todos os elementos que andam junto com este, ele incluido. */
export function groupOf(el: BoardElement, elements: BoardElement[]): BoardElement[] {
  if (!el.groupId) return [el];
  return elements.filter((e) => e.groupId === el.groupId);
}

export const CONNECTABLE = new Set([
  'rectangle',
  'ellipse',
  'sticky',
  'text',
  'image',
  'reference',
  'assistant',
  'derivation',
  'minitable',
]);
