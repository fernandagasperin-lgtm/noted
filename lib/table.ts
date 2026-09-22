import type { ColumnType, DbColumn, DbRow } from './types';

export type FilterOp =
  | 'contains'
  | 'notContains'
  | 'is'
  | 'isNot'
  | 'gt'
  | 'lt'
  | 'before'
  | 'after'
  | 'checked'
  | 'unchecked'
  | 'empty'
  | 'notEmpty';

export interface TableFilter {
  id: string;
  columnId: string;
  op: FilterOp;
  value: string;
}

export interface TableSort {
  columnId: string;
  direction: 'asc' | 'desc';
}

export const OP_LABELS: Record<FilterOp, string> = {
  contains: 'contem',
  notContains: 'nao contem',
  is: 'e',
  isNot: 'nao e',
  gt: 'maior que',
  lt: 'menor que',
  before: 'antes de',
  after: 'depois de',
  checked: 'esta marcada',
  unchecked: 'nao esta marcada',
  empty: 'esta vazio',
  notEmpty: 'nao esta vazio',
};

/** Cada tipo aceita as comparacoes que fazem sentido para ele. */
export function opsFor(type: ColumnType): FilterOp[] {
  switch (type) {
    case 'number':
      return ['is', 'isNot', 'gt', 'lt', 'empty', 'notEmpty'];
    case 'select':
      return ['is', 'isNot', 'empty', 'notEmpty'];
    case 'multi':
      return ['contains', 'notContains', 'empty', 'notEmpty'];
    case 'date':
      return ['is', 'before', 'after', 'empty', 'notEmpty'];
    case 'check':
      return ['checked', 'unchecked'];
    default:
      return ['contains', 'notContains', 'is', 'isNot', 'empty', 'notEmpty'];
  }
}

/** Operadores que nao pedem um valor ao lado. */
export function opNeedsValue(op: FilterOp): boolean {
  return !['empty', 'notEmpty', 'checked', 'unchecked'].includes(op);
}

function vazio(v: unknown): boolean {
  if (v === null || v === undefined || v === '') return true;
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function texto(v: unknown): string {
  if (Array.isArray(v)) return v.join(' ');
  return v === null || v === undefined ? '' : String(v);
}

function passa(row: DbRow, column: DbColumn, filter: TableFilter): boolean {
  const bruto = column.id === 'title' ? row.title : row.values[column.id];
  const alvo = filter.value.trim();

  switch (filter.op) {
    case 'empty':
      return vazio(bruto);
    case 'notEmpty':
      return !vazio(bruto);
    case 'checked':
      return Boolean(bruto);
    case 'unchecked':
      return !bruto;
  }

  // Sem valor digitado, o filtro nao deve esconder nada.
  if (!alvo) return true;

  if (column.type === 'number') {
    const n = Number(bruto);
    const alvoN = Number(alvo);
    if (Number.isNaN(n) || Number.isNaN(alvoN)) return false;
    if (filter.op === 'is') return n === alvoN;
    if (filter.op === 'isNot') return n !== alvoN;
    if (filter.op === 'gt') return n > alvoN;
    if (filter.op === 'lt') return n < alvoN;
    return true;
  }

  if (column.type === 'date') {
    const d = texto(bruto);
    if (!d) return false;
    if (filter.op === 'is') return d === alvo;
    if (filter.op === 'before') return d < alvo;
    if (filter.op === 'after') return d > alvo;
    return true;
  }

  // Selecao guarda ids; comparar pelo nome e o que a pessoa espera.
  if (column.type === 'select' || column.type === 'multi') {
    const ids = Array.isArray(bruto) ? (bruto as string[]) : bruto ? [String(bruto)] : [];
    const nomes = ids
      .map((id) => column.options.find((o) => o.id === id)?.name.toLowerCase())
      .filter(Boolean) as string[];
    const a = alvo.toLowerCase();
    if (filter.op === 'is') return nomes.length === 1 && nomes[0] === a;
    if (filter.op === 'isNot') return !nomes.includes(a);
    if (filter.op === 'contains') return nomes.includes(a);
    if (filter.op === 'notContains') return !nomes.includes(a);
    return true;
  }

  const t = texto(bruto).toLowerCase();
  const a = alvo.toLowerCase();
  if (filter.op === 'contains') return t.includes(a);
  if (filter.op === 'notContains') return !t.includes(a);
  if (filter.op === 'is') return t === a;
  if (filter.op === 'isNot') return t !== a;
  return true;
}

/** Todos os filtros precisam passar; um filtro sobre coluna apagada e ignorado. */
export function applyFilters(
  rows: DbRow[],
  columns: DbColumn[],
  filters: TableFilter[],
): DbRow[] {
  if (filters.length === 0) return rows;
  return rows.filter((row) =>
    filters.every((f) => {
      const col =
        f.columnId === 'title'
          ? ({ id: 'title', type: 'text', options: [] } as unknown as DbColumn)
          : columns.find((c) => c.id === f.columnId);
      return col ? passa(row, col, f) : true;
    }),
  );
}

function comparar(a: unknown, b: unknown, column: DbColumn): number {
  if (column.type === 'number') return Number(a) - Number(b);
  if (column.type === 'check') {
    return Number(Boolean(a)) - Number(Boolean(b));
  }
  if (column.type === 'select' || column.type === 'multi') {
    const nome = (v: unknown) => {
      const ids = Array.isArray(v) ? (v as string[]) : v ? [String(v)] : [];
      return ids
        .map((id) => column.options.find((o) => o.id === id)?.name ?? '')
        .join(', ');
    };
    return nome(a).localeCompare(nome(b), 'pt-BR');
  }
  return String(a ?? '').localeCompare(String(b ?? ''), 'pt-BR');
}

/** Ordena por varios criterios; o primeiro que diferencia decide. */
export function applySorts(
  rows: DbRow[],
  columns: DbColumn[],
  sorts: TableSort[],
): DbRow[] {
  if (sorts.length === 0) return rows;
  const copia = [...rows];
  copia.sort((ra, rb) => {
    for (const s of sorts) {
      const col =
        s.columnId === 'title'
          ? ({ id: 'title', type: 'text', options: [] } as unknown as DbColumn)
          : columns.find((c) => c.id === s.columnId);
      if (!col) continue;
      const a = s.columnId === 'title' ? ra.title : ra.values[s.columnId];
      const b = s.columnId === 'title' ? rb.title : rb.values[s.columnId];
      // O vazio fica no fim nos dois sentidos, entao decide antes da inversao:
      // dentro de comparar, a inversao do decrescente o jogava para o comeco.
      const aVazio = col.type === 'check' ? false : vazio(a);
      const bVazio = col.type === 'check' ? false : vazio(b);
      if (aVazio && bVazio) continue;
      if (aVazio) return 1;
      if (bVazio) return -1;

      const d = comparar(a, b, col);
      if (d !== 0) return s.direction === 'asc' ? d : -d;
    }
    return 0;
  });
  return copia;
}
