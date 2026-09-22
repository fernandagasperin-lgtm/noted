'use client';

import type { ColumnType, PageType } from '@/lib/types';

/**
 * Um conjunto unico de icones em vez de emoji: emoji muda de desenho conforme
 * o sistema e nao aceita cor, entao a interface ficava sem padrao.
 */
export type IconName =
  | PageType
  | ColumnType
  | 'title'
  | 'star'
  | 'starFilled'
  | 'search'
  | 'menu'
  | 'plus'
  | 'close'
  | 'trash'
  | 'pencil'
  | 'eye'
  | 'share'
  | 'open'
  | 'chevron';

const PATHS: Record<IconName, React.ReactNode> = {
  // tipos de pagina
  canvas: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 9v11" />
    </>
  ),
  text: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  database: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M3 15h18M9 4v16M15 4v16" />
    </>
  ),
  assistants: (
    <path d="M12 3l1.7 4.6L18 9l-4.3 1.6L12 15l-1.7-4.4L6 9l4.3-1.4L12 3zM18 16l.8 1.9L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-1.1L18 16z" />
  ),
  table: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M3 15h18" />
    </>
  ),

  // tipos de coluna
  title: <path d="M5 7V5h14v2M12 5v14M9 19h6" />,
  number: <path d="M6 9h12M6 15h12M10 4l-1.5 16M16 4l-1.5 16" />,
  select: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </>
  ),
  multi: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="18" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  date: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  check: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </>
  ),
  url: (
    <path d="M10 13.5a3.5 3.5 0 005 0l2.5-2.5a3.54 3.54 0 00-5-5L11 7.5M14 10.5a3.5 3.5 0 00-5 0L6.5 13a3.54 3.54 0 005 5L13 16.5" />
  ),

  // acoes
  star: <path d="M12 4l2.4 5 5.6.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.6-.8L12 4z" />,
  starFilled: (
    <path
      d="M12 4l2.4 5 5.6.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.6-.8L12 4z"
      fill="currentColor"
    />
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  trash: <path d="M4 7h16M10 7V5h4v2M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  pencil: <path d="M4 20l4-1 10-10a2.1 2.1 0 00-3-3L5 16l-1 4z" />,
  eye: (
    <>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5" r="2.6" />
      <circle cx="6" cy="12" r="2.6" />
      <circle cx="18" cy="19" r="2.6" />
      <path d="M8.3 10.8l7.4-4.3M8.3 13.2l7.4 4.3" />
    </>
  ),
  open: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4l-8 8" />
      <path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
    </>
  ),
  chevron: <path d="M9 6l6 6-6 6" />,
};

interface Props {
  name: IconName;
  size?: number;
  className?: string;
  color?: string;
}

export default function Icon({ name, size = 16, className, color }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? 'currentColor'}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}

/** A cor identifica o tipo de imediato, como no Notion. */
export const TYPE_COLOR: Record<ColumnType, string> = {
  text: '#787774',
  number: '#D9730D',
  select: '#0F7B6C',
  multi: '#6940A5',
  date: '#337EA9',
  check: '#448361',
  url: '#2383E2',
};

export const PAGE_COLOR: Record<PageType, string> = {
  canvas: '#D9730D',
  database: '#0F7B6C',
  text: '#337EA9',
  assistants: '#6940A5',
  table: '#787774',
};
