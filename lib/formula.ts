// Um interpretador de expressoes pequeno, no espirito de uma planilha.
//
// Ele nao conhece tabela nem tela: recebe uma funcao que resolve referencias e
// devolve o valor. Isso deixa a mesma gramatica servir a tabela pequena do
// mural (referencias A1) e, mais tarde, a tabela grande (referencias {Coluna}).

export type FormulaValue = number | string | boolean;

export interface FormulaResult {
  value: FormulaValue | null;
  /** #CICLO, #NOME, #VALOR, #DIV/0 ou #SINTAXE; null quando deu certo */
  error: string | null;
}

/** Resolve uma referencia. Devolve null para celula vazia. */
export type Resolver = (ref: string) => FormulaValue | null;

export interface Context {
  resolve: Resolver;
  /** expande A1:B3 na lista de referencias que ela cobre */
  expand?: (from: string, to: string) => string[];
  /** valores de uma coluna da tabela grande, quando a tabela esta vinculada */
  column?: (name: string) => number[];
}

class FormulaError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

// ---------------------------------------------------------------- referencias

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** 0 -> A, 25 -> Z, 26 -> AA */
export function colName(index: number): string {
  let nome = '';
  let n = index;
  while (n >= 0) {
    nome = LETRAS[n % 26] + nome;
    n = Math.floor(n / 26) - 1;
  }
  return nome;
}

export function colIndex(nome: string): number {
  let n = 0;
  for (const ch of nome.toUpperCase()) n = n * 26 + (LETRAS.indexOf(ch) + 1);
  return n - 1;
}

/** 'B3' -> { col: 1, row: 2 }; null quando nao e uma referencia. */
export function parseRef(ref: string): { col: number; row: number } | null {
  const m = /^([A-Za-z]+)(\d+)$/.exec(ref.trim());
  if (!m) return null;
  const row = Number(m[2]) - 1;
  if (row < 0) return null;
  return { col: colIndex(m[1]), row };
}

export function refOf(col: number, row: number): string {
  return colName(col) + (row + 1);
}

/** Todas as referencias do retangulo entre duas pontas, em linha depois coluna. */
export function expandRange(from: string, to: string): string[] {
  const a = parseRef(from);
  const b = parseRef(to);
  if (!a || !b) throw new FormulaError('#NOME');
  const refs: string[] = [];
  for (let r = Math.min(a.row, b.row); r <= Math.max(a.row, b.row); r++) {
    for (let c = Math.min(a.col, b.col); c <= Math.max(a.col, b.col); c++) {
      refs.push(refOf(c, r));
    }
  }
  return refs;
}

// ------------------------------------------------------------------ tokenizer

type Token =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'name'; v: string }
  | { t: 'op'; v: string }
  | { t: 'punc'; v: string };

const OPERADORES = ['<>', '<=', '>=', '+', '-', '*', '/', '^', '&', '=', '<', '>'];

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;

  while (i < src.length) {
    const ch = src[i];

    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const aspas = ch;
      let v = '';
      i++;
      while (i < src.length && src[i] !== aspas) {
        // Aspas dobradas viram uma aspa literal, como na planilha.
        if (src[i] === '\\' && i + 1 < src.length) {
          v += src[i + 1];
          i += 2;
          continue;
        }
        v += src[i++];
      }
      if (i >= src.length) throw new FormulaError('#SINTAXE');
      i++;
      out.push({ t: 'str', v });
      continue;
    }

    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      let v = '';
      while (i < src.length && /[0-9.]/.test(src[i])) v += src[i++];
      // Virgula decimal so vale quando nao ha ambiguidade com separador de
      // argumento, entao aqui aceitamos apenas o ponto.
      const n = Number(v);
      if (Number.isNaN(n)) throw new FormulaError('#SINTAXE');
      out.push({ t: 'num', v: n });
      continue;
    }

    if (/[A-Za-z_À-ɏ]/.test(ch)) {
      let v = '';
      while (i < src.length && /[A-Za-z0-9_.À-ɏ]/.test(src[i])) v += src[i++];
      out.push({ t: 'name', v });
      continue;
    }

    if (ch === '(' || ch === ')' || ch === ',' || ch === ';' || ch === ':') {
      out.push({ t: 'punc', v: ch });
      i++;
      continue;
    }

    const op = OPERADORES.find((o) => src.startsWith(o, i));
    if (op) {
      out.push({ t: 'op', v: op });
      i += op.length;
      continue;
    }

    throw new FormulaError('#SINTAXE');
  }

  return out;
}

// --------------------------------------------------------------------- numeros

function toNumber(v: FormulaValue | null): number {
  if (v === null || v === '') return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  // Aceita "1.234,56" e "R$ 12,00": o usuario digita como fala.
  const limpo = String(v)
    .replace(/[^\d,.\-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  // Number('') e zero, entao texto que sobra vazio precisa ser barrado aqui:
  // sem isso 'x' viraria 0 e entraria nas contagens.
  if (limpo === '' || limpo === '-' || limpo === '.') throw new FormulaError('#VALOR');
  const n = Number(limpo);
  if (Number.isNaN(n)) throw new FormulaError('#VALOR');
  return n;
}

function toText(v: FormulaValue | null): string {
  if (v === null) return '';
  if (typeof v === 'boolean') return v ? 'VERDADEIRO' : 'FALSO';
  return String(v);
}

function toBool(v: FormulaValue | null): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const s = toText(v).trim().toUpperCase();
  if (s === 'VERDADEIRO' || s === 'TRUE') return true;
  if (s === 'FALSO' || s === 'FALSE' || s === '') return false;
  return true;
}

/** Uma faixa vira lista; um valor solto vira lista de um. */
type Arg = FormulaValue | null | (FormulaValue | null)[];

function flatten(args: Arg[]): (FormulaValue | null)[] {
  const out: (FormulaValue | null)[] = [];
  for (const a of args) {
    if (Array.isArray(a)) out.push(...a);
    else out.push(a);
  }
  return out;
}

/** So entram na conta os que sao mesmo numeros: texto solto e ignorado. */
function numbersOf(args: Arg[]): number[] {
  const out: number[] = [];
  for (const v of flatten(args)) {
    if (v === null || v === '') continue;
    if (typeof v === 'boolean') {
      out.push(v ? 1 : 0);
      continue;
    }
    if (typeof v === 'number') {
      out.push(v);
      continue;
    }
    try {
      out.push(toNumber(v));
    } catch {
      // texto que nao e numero nao entra na soma, como na planilha
    }
  }
  return out;
}

// -------------------------------------------------------------------- funcoes

type Fn = (args: Arg[], ctx: Context) => FormulaValue | null;

function arredondar(n: number, casas: number): number {
  const f = Math.pow(10, casas);
  return Math.round((n + Number.EPSILON) * f) / f;
}

const FUNCOES: Record<string, Fn> = {
  SOMA: (a) => numbersOf(a).reduce((t, n) => t + n, 0),
  MEDIA: (a) => {
    const ns = numbersOf(a);
    if (ns.length === 0) throw new FormulaError('#DIV/0');
    return ns.reduce((t, n) => t + n, 0) / ns.length;
  },
  MIN: (a) => {
    const ns = numbersOf(a);
    return ns.length ? Math.min(...ns) : 0;
  },
  MAX: (a) => {
    const ns = numbersOf(a);
    return ns.length ? Math.max(...ns) : 0;
  },
  CONT: (a) => numbersOf(a).length,
  CONTA: (a) => flatten(a).filter((v) => v !== null && v !== '').length,
  SE: (a) => {
    if (a.length < 2) throw new FormulaError('#VALOR');
    const cond = toBool(Array.isArray(a[0]) ? (a[0][0] ?? null) : a[0]);
    const escolhido = cond ? a[1] : (a[2] ?? null);
    return Array.isArray(escolhido) ? (escolhido[0] ?? null) : escolhido;
  },
  E: (a) => flatten(a).every((v) => toBool(v)),
  OU: (a) => flatten(a).some((v) => toBool(v)),
  NAO: (a) => !toBool(flatten(a)[0] ?? null),
  ARRED: (a) => {
    const ns = flatten(a);
    return arredondar(toNumber(ns[0] ?? null), Math.trunc(toNumber(ns[1] ?? 0)));
  },
  ABS: (a) => Math.abs(toNumber(flatten(a)[0] ?? null)),
  TETO: (a) => Math.ceil(toNumber(flatten(a)[0] ?? null)),
  PISO: (a) => Math.floor(toNumber(flatten(a)[0] ?? null)),
  RAIZ: (a) => {
    const n = toNumber(flatten(a)[0] ?? null);
    if (n < 0) throw new FormulaError('#VALOR');
    return Math.sqrt(n);
  },
  CONCAT: (a) => flatten(a).map(toText).join(''),
  MAIUSC: (a) => toText(flatten(a)[0] ?? null).toUpperCase(),
  MINUSC: (a) => toText(flatten(a)[0] ?? null).toLowerCase(),
  HOJE: () => new Date().toISOString().slice(0, 10),

  /** Puxa uma coluna da tabela grande a que este quadrinho foi vinculado. */
  COLUNA: (a, ctx) => {
    if (!ctx.column) throw new FormulaError('#NOME');
    const nome = toText(flatten(a)[0] ?? null);
    const valores = ctx.column(nome);
    return valores.reduce((t, n) => t + n, 0);
  },
};

/** Nomes em ingles custam pouco e evitam frustracao. */
const APELIDOS: Record<string, string> = {
  SUM: 'SOMA',
  AVERAGE: 'MEDIA',
  AVG: 'MEDIA',
  COUNT: 'CONT',
  COUNTA: 'CONTA',
  IF: 'SE',
  AND: 'E',
  OR: 'OU',
  NOT: 'NAO',
  ROUND: 'ARRED',
  CEILING: 'TETO',
  FLOOR: 'PISO',
  SQRT: 'RAIZ',
  UPPER: 'MAIUSC',
  LOWER: 'MINUSC',
  TODAY: 'HOJE',
  COLUMN: 'COLUNA',
};

function lookupFn(nome: string): Fn | null {
  const chave = nome.toUpperCase();
  return FUNCOES[chave] ?? FUNCOES[APELIDOS[chave] ?? ''] ?? null;
}

export const FUNCTION_NAMES = Object.keys(FUNCOES);

// --------------------------------------------------------------------- parser

class Parser {
  private i = 0;
  constructor(
    private tokens: Token[],
    private ctx: Context,
  ) {}

  parse(): FormulaValue | null {
    const v = this.compare();
    if (this.i < this.tokens.length) throw new FormulaError('#SINTAXE');
    return this.single(v);
  }

  private peek(): Token | undefined {
    return this.tokens[this.i];
  }

  private eatOp(...ops: string[]): string | null {
    const t = this.peek();
    if (t && t.t === 'op' && ops.includes(t.v)) {
      this.i++;
      return t.v;
    }
    return null;
  }

  private eatPunc(v: string): boolean {
    const t = this.peek();
    if (t && t.t === 'punc' && t.v === v) {
      this.i++;
      return true;
    }
    return false;
  }

  /** Faixas so fazem sentido dentro de funcao; fora dela vale a primeira. */
  private single(v: Arg): FormulaValue | null {
    return Array.isArray(v) ? (v[0] ?? null) : v;
  }

  private compare(): Arg {
    let left = this.concat();
    for (;;) {
      const op = this.eatOp('=', '<>', '<', '>', '<=', '>=');
      if (!op) return left;
      const right = this.concat();
      const a = this.single(left);
      const b = this.single(right);
      const numerico = typeof a !== 'string' && typeof b !== 'string';
      const x = numerico ? toNumber(a) : toText(a);
      const y = numerico ? toNumber(b) : toText(b);
      left =
        op === '=' ? x === y
        : op === '<>' ? x !== y
        : op === '<' ? x < y
        : op === '>' ? x > y
        : op === '<=' ? x <= y
        : x >= y;
    }
  }

  private concat(): Arg {
    let left = this.add();
    for (;;) {
      if (!this.eatOp('&')) return left;
      const right = this.add();
      left = toText(this.single(left)) + toText(this.single(right));
    }
  }

  private add(): Arg {
    let left = this.mul();
    for (;;) {
      const op = this.eatOp('+', '-');
      if (!op) return left;
      const right = toNumber(this.single(this.mul()));
      const a = toNumber(this.single(left));
      left = op === '+' ? a + right : a - right;
    }
  }

  private mul(): Arg {
    let left = this.unary();
    for (;;) {
      const op = this.eatOp('*', '/');
      if (!op) return left;
      const right = toNumber(this.single(this.unary()));
      const a = toNumber(this.single(left));
      if (op === '/' && right === 0) throw new FormulaError('#DIV/0');
      left = op === '*' ? a * right : a / right;
    }
  }

  private unary(): Arg {
    const op = this.eatOp('-', '+');
    if (op) {
      const v = toNumber(this.single(this.unary()));
      return op === '-' ? -v : v;
    }
    return this.power();
  }

  private power(): Arg {
    const base = this.primary();
    if (!this.eatOp('^')) return base;
    const exp = toNumber(this.single(this.unary()));
    return Math.pow(toNumber(this.single(base)), exp);
  }

  private args(): Arg[] {
    const out: Arg[] = [];
    if (this.eatPunc(')')) return out;
    for (;;) {
      out.push(this.compare());
      if (this.eatPunc(',') || this.eatPunc(';')) continue;
      if (this.eatPunc(')')) return out;
      throw new FormulaError('#SINTAXE');
    }
  }

  private primary(): Arg {
    const t = this.peek();
    if (!t) throw new FormulaError('#SINTAXE');

    if (t.t === 'num') {
      this.i++;
      return t.v;
    }
    if (t.t === 'str') {
      this.i++;
      return t.v;
    }
    if (t.t === 'punc' && t.v === '(') {
      this.i++;
      const v = this.compare();
      if (!this.eatPunc(')')) throw new FormulaError('#SINTAXE');
      return v;
    }
    if (t.t === 'name') {
      this.i++;
      const nome = t.v;

      if (this.eatPunc('(')) {
        const fn = lookupFn(nome);
        if (!fn) throw new FormulaError('#NOME');
        return fn(this.args(), this.ctx);
      }

      const maiusc = nome.toUpperCase();
      if (maiusc === 'VERDADEIRO' || maiusc === 'TRUE') return true;
      if (maiusc === 'FALSO' || maiusc === 'FALSE') return false;

      // Uma referencia sozinha, ou o comeco de uma faixa.
      if (!parseRef(nome)) throw new FormulaError('#NOME');
      if (this.eatPunc(':')) {
        const fim = this.peek();
        if (!fim || fim.t !== 'name' || !parseRef(fim.v)) {
          throw new FormulaError('#SINTAXE');
        }
        this.i++;
        const expand = this.ctx.expand ?? expandRange;
        return expand(nome, fim.v).map((r) => this.ctx.resolve(r));
      }
      return this.ctx.resolve(nome);
    }

    throw new FormulaError('#SINTAXE');
  }
}

// ------------------------------------------------------------------- avaliacao

export function isFormula(raw: unknown): boolean {
  return typeof raw === 'string' && raw.trim().startsWith('=');
}

/** Avalia uma expressao ja sem o '=' inicial. */
export function evaluate(expression: string, ctx: Context): FormulaResult {
  try {
    return { value: new Parser(tokenize(expression), ctx).parse(), error: null };
  } catch (e) {
    if (e instanceof FormulaError) return { value: null, error: e.code };
    if (e instanceof RangeError) return { value: null, error: '#CICLO' };
    return { value: null, error: '#VALOR' };
  }
}

/**
 * Resolve uma grade inteira de uma vez. Celulas que comecam com '=' viram
 * formula; as demais viram numero quando parecem numero, e texto quando nao.
 */
export function evaluateGrid(
  cells: Record<string, string>,
  extra: { column?: (name: string) => number[] } = {},
): Record<string, FormulaResult> {
  const resultados: Record<string, FormulaResult> = {};
  const visitando = new Set<string>();

  const bruto = (ref: string): FormulaValue | null => {
    const v = cells[ref];
    if (v === undefined || v === null || v === '') return null;
    if (isFormula(v)) return null;
    const n = Number(String(v).replace(',', '.'));
    return String(v).trim() !== '' && !Number.isNaN(n) ? n : v;
  };

  const resolve = (ref: string): FormulaValue | null => {
    const chave = ref.toUpperCase();
    const v = cells[chave];
    if (!isFormula(v)) return bruto(chave);

    if (visitando.has(chave)) throw new FormulaError('#CICLO');
    if (resultados[chave]) {
      if (resultados[chave].error) throw new FormulaError(resultados[chave].error!);
      return resultados[chave].value;
    }

    visitando.add(chave);
    const r = evaluate(v.trim().slice(1), { resolve, column: extra.column });
    visitando.delete(chave);

    resultados[chave] = r;
    if (r.error) throw new FormulaError(r.error);
    return r.value;
  };

  for (const ref of Object.keys(cells)) {
    const chave = ref.toUpperCase();
    if (resultados[chave]) continue;
    if (!isFormula(cells[chave])) {
      resultados[chave] = { value: bruto(chave), error: null };
      continue;
    }
    try {
      resolve(chave);
    } catch (e) {
      resultados[chave] = {
        value: null,
        error: e instanceof FormulaError ? e.code : '#VALOR',
      };
    }
  }

  return resultados;
}

/** O que aparece na celula: o erro, quando houve, ou o valor formatado. */
export function displayValue(r: FormulaResult | undefined): string {
  if (!r) return '';
  if (r.error) return r.error;
  if (r.value === null) return '';
  if (typeof r.value === 'boolean') return r.value ? 'VERDADEIRO' : 'FALSO';
  if (typeof r.value === 'number') {
    if (!Number.isFinite(r.value)) return '#VALOR';
    return Number.isInteger(r.value)
      ? String(r.value)
      : String(arredondar(r.value, 6));
  }
  return r.value;
}
