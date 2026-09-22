export type ElementType =
  | 'rectangle'
  | 'ellipse'
  | 'sticky'
  | 'text'
  | 'image'
  | 'arrow'
  | 'reference'
  | 'assistant'
  | 'derivation';

export interface Style {
  fill: string;
  stroke: string;
  strokeWidth: number;
  fontSize: number;
  opacity: number;
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
export type NumberFormat = 'plain' | 'brl' | 'usd' | 'percent';

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

export function formatNumber(value: unknown, format: NumberFormat): string {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  if (format === 'percent') return n.toLocaleString('pt-BR') + '%';
  if (format === 'brl') {
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  if (format === 'usd') {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }
  return n.toLocaleString('pt-BR');
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
