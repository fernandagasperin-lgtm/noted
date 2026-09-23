export type ElementType =
  | 'rectangle'
  | 'ellipse'
  | 'sticky'
  | 'text'
  | 'image'
  | 'arrow'
  | 'reference'
  | 'assistant'
  | 'derivation'
  | 'minitable';

export interface Style {
  fill: string;
  stroke: string;
  strokeWidth: number;
  fontSize: number;
  opacity: number;
}

/** A tabelinha que vive dentro de um balao do mural. */
export interface MiniTable {
  cols: number;
  rows: number;
  /** largura de cada coluna, em pixels */
  widths: number[];
  /** a primeira linha e cabecalho */
  header: boolean;
  /** valores por referencia de planilha: A1, B2... '=' comeca uma formula */
  cells: Record<string, string>;
  /** quando preenchido, COLUNA("Nome") le dessa tabela grande */
  linkedPageId?: string;
}

export interface BoardElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  content: string;
  style: Style;
  /** arrow only: endpoint offsets relative to x,y */
  points?: number[];
  /** reference only: the page this block links to */
  refPageId?: string;
  /** image only: url under /uploads */
  src?: string;

  /** arrow only: pontas presas a outros elementos, para organogramas */
  fromId?: string;
  toId?: string;

  /** minitable only */
  table?: MiniTable;

  /** assistant and derivation: which assistant this card belongs to */
  assistantId?: string;
  /** derivation: the derivation it was branched from, if any */
  parentId?: string;
  /** derivation: the generated title, following the assistant's pattern */
  title?: string;
  /** derivation: values the user filled into the assistant's fields */
  inputs?: Record<string, string>;
  /** derivation: the produced result */
  output?: string;
  /** derivation: sequence number among the siblings of one assistant */
  variation?: number;
  /** derivation: ISO timestamp of when it was produced */
  producedAt?: string;
}

import type { TableFilter, TableSort } from './table';

export type PageType = 'canvas' | 'text' | 'table' | 'assistants' | 'database';

export type ColumnType =
  | 'text'
  | 'number'
  | 'select'
  | 'multi'
  | 'date'
  | 'check'
  | 'url';

/** Como o numero e apresentado; nao muda o que fica guardado. */
export type NumberFormat = 'plain' | 'brl' | 'usd' | 'eur' | 'percent';

/** Numero cru ou barra proporcional ao maior valor da coluna. */
export type NumberDisplay = 'number' | 'bar';

export const FORMAT_LABELS: Record<NumberFormat, string> = {
  plain: 'Numero',
  brl: 'Real (R$)',
  usd: 'Dolar (US$)',
  eur: 'Euro (EUR)',
  percent: 'Porcentagem',
};

export interface SelectOption {
  id: string;
  name: string;
  color: string;
}

export interface DbColumn {
  id: string;
  pageId: string;
  name: string;
  type: ColumnType;
  /** opcoes das colunas de selecao */
  options: SelectOption[];
  format: NumberFormat;
  /** casas decimais; null deixa o proprio numero decidir */
  decimals: number | null;
  display: NumberDisplay;
  /** largura em pixels, ajustavel arrastando a borda */
  width: number;
  position: number;
}

export interface DbRow {
  id: string;
  pageId: string;
  /** a coluna principal, que abre a linha como pagina */
  title: string;
  /** valores das demais colunas, por id de coluna */
  values: Record<string, unknown>;
  /** o texto livre da pagina da linha */
  body: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

/** Tons suaves, no espirito do Notion: legiveis sem gritar. */
export const OPTION_COLORS = [
  '#E8E8E6',
  '#FFE2DD',
  '#FADEC9',
  '#FDECC8',
  '#DBEDDB',
  '#D3E5EF',
  '#E8DEEE',
  '#F5E0E9',
];

export const COLUMN_LABELS: Record<ColumnType, string> = {
  text: 'Texto',
  number: 'Numero',
  select: 'Selecao',
  multi: 'Multi-selecao',
  date: 'Data',
  check: 'Caixa',
  url: 'Link',
};

const MOEDAS: Partial<Record<NumberFormat, { locale: string; currency: string }>> = {
  brl: { locale: 'pt-BR', currency: 'BRL' },
  usd: { locale: 'en-US', currency: 'USD' },
  eur: { locale: 'de-DE', currency: 'EUR' },
};

export function formatNumber(
  value: unknown,
  format: NumberFormat,
  decimals: number | null = null,
): string {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);

  const casas =
    decimals === null || decimals === undefined
      ? undefined
      : { minimumFractionDigits: decimals, maximumFractionDigits: decimals };

  const moeda = MOEDAS[format];
  if (moeda) {
    return n.toLocaleString(moeda.locale, {
      style: 'currency',
      currency: moeda.currency,
      ...casas,
    });
  }
  if (format === 'percent') return n.toLocaleString('pt-BR', casas) + '%';
  return n.toLocaleString('pt-BR', casas);
}

export type PageRole = 'owner' | 'editor' | 'viewer';

export interface Project {
  id: string;
  name: string;
  icon: string;
  color: string;
  ownerId: string | null;
  /** true when the signed-in user owns it */
  mine: boolean;
  createdAt: string;
}

export interface Me {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

export interface Assistant {
  id: string;
  projectId: string;
  name: string;
  icon: string;
  /** the reusable prompt, with {{campo}} placeholders */
  prompt: string;
  /** supports {{assistente}}, {{variacao}} and any field name */
  titlePattern: string;
  createdAt: string;
}

export interface Page {
  id: string;
  projectId: string;
  ownerId: string | null;
  /** what the signed-in user may do with this page */
  role: PageRole;
  /** marcada com estrela por quem esta vendo */
  favorite: boolean;
  /** o dono compartilhou esta pagina com alguem */
  sharedOut: boolean;
  /** tabelas: largura da coluna de titulo */
  titleWidth: number;
  /** tabelas: ordenacao e filtros da visualizacao */
  sorts: TableSort[];
  filters: TableFilter[];
  /** tabelas: coluna pela qual as linhas sao agrupadas */
  groupBy: string | null;
  /** tabelas: a coluna Nome e opcional, ao contrario do Notion */
  showTitle: boolean;
  title: string;
  type: PageType;
  icon: string;
  /** canvas pages */
  elements: BoardElement[];
  /** text pages */
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  me: Me;
  projects: Project[];
  assistants: Assistant[];
  pages: Page[];
}

export const PROJECT_COLORS = [
  '#F59E0B',
  '#10B981',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#64748B',
];

export const STICKY_COLORS = [
  '#FFF9B1',
  '#FFD599',
  '#FFCEE0',
  '#D5F692',
  '#A6E5FF',
  '#D0C6FF',
  '#F1F3F5',
  '#FFFFFF',
];

export const DEFAULT_STYLE: Style = {
  fill: '#FFF9B1',
  stroke: '#64748B',
  strokeWidth: 2,
  fontSize: 16,
  opacity: 1,
};

export const DEFAULT_TITLE_PATTERN = '{{assistente}} · {{variacao}}';

/** Placeholders are {{campo}}; unknown names are left untouched so they stay visible. */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, rawName: string) => {
    const name = rawName.trim();
    const hit = Object.keys(values).find(
      (k) => k.toLowerCase() === name.toLowerCase(),
    );
    return hit ? values[hit] : match;
  });
}

export function buildDerivationTitle(
  assistant: Assistant,
  variation: number,
  inputs: Record<string, string>,
): string {
  return fillTemplate(assistant.titlePattern || DEFAULT_TITLE_PATTERN, {
    ...inputs,
    assistente: assistant.name,
    variacao: 'v' + variation,
  });
}
