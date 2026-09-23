'use client';

import { useRef } from 'react';

export type Tool =
  | 'select'
  | 'sticky'
  | 'rectangle'
  | 'ellipse'
  | 'text'
  | 'arrow'
  | 'reference'
  | 'assistant'
  | 'minitable';

const TOOLS: { id: Tool; label: string; hint: string; icon: React.ReactNode }[] = [
  {
    id: 'select',
    label: 'Selecionar',
    hint: 'V',
    icon: (
      <path d="M5 3l14 7.5-6 1.6L10.6 19 5 3z" fill="currentColor" />
    ),
  },
  {
    id: 'sticky',
    label: 'Post-it',
    hint: 'S',
    icon: (
      <path
        d="M5 5h14v9l-5 5H5V5z"
        fill="currentColor"
        fillOpacity="0.18"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: 'rectangle',
    label: 'Retangulo',
    hint: 'R',
    icon: (
      <rect x="4" y="6" width="16" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
    ),
  },
  {
    id: 'ellipse',
    label: 'Elipse',
    hint: 'E',
    icon: <circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.7" />,
  },
  {
    id: 'text',
    label: 'Texto',
    hint: 'T',
    icon: (
      <path
        d="M5 6h14M12 6v12M9 18h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    ),
  },
  {
    id: 'arrow',
    label: 'Seta',
    hint: 'A',
    icon: (
      <path
        d="M4 12h15m0 0l-5.5-5M19 12l-5.5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: 'minitable',
    label: 'Tabela',
    hint: 'B',
    icon: (
      <g fill="none" stroke="currentColor" strokeWidth="1.7">
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="M4 10h16M10 10v9M4 14.5h16" strokeLinecap="round" />
      </g>
    ),
  },
  {
    id: 'assistant',
    label: 'Assistente',
    hint: 'G',
    icon: (
      <path
        d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4L12 3zM18 16l.9 2.1L21 19l-2.1.9L18 22l-.9-2.1L15 19l2.1-.9L18 16z"
        fill="currentColor"
      />
    ),
  },
  {
    id: 'reference',
    label: 'Link de pagina',
    hint: 'L',
    icon: (
      <path
        d="M10 13.5a3.5 3.5 0 005 0l2.5-2.5a3.54 3.54 0 00-5-5L11 7.5M14 10.5a3.5 3.5 0 00-5 0L6.5 13a3.54 3.54 0 005 5L13 16.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    ),
  },
];

interface Props {
  tool: Tool;
  setTool: (t: Tool) => void;
  onUploadImage: (file: File) => void;
  /** no celular a barra sai de cena quando o painel de edicao sobe */
  hiddenOnMobile: boolean;
}

export default function Toolbar({ tool, setTool, onUploadImage, hiddenOnMobile }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const buttonClass = (active: boolean) =>
    'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ' +
    (active
      ? 'bg-blue-50 text-blue-600'
      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800');

  return (
    <div
      className={
        // celular: barra horizontal no rodape. desktop: pilula vertical a esquerda
        'z-10 max-md:absolute max-md:inset-x-0 max-md:bottom-0 max-md:px-2 max-md:pb-2 ' +
        'md:absolute md:left-4 md:top-1/2 md:-translate-y-1/2 ' +
        (hiddenOnMobile ? 'max-md:hidden' : '')
      }
    >
      <div
        className={
          'flex gap-0.5 border border-slate-200/80 bg-white/95 shadow-lg shadow-slate-900/[0.06] backdrop-blur ' +
          'max-md:overflow-x-auto max-md:rounded-2xl max-md:p-1.5 ' +
          'md:flex-col md:rounded-2xl md:p-1.5'
        }
      >
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            title={t.label + ' (' + t.hint + ')'}
            className={buttonClass(tool === t.id)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24">
              {t.icon}
            </svg>
          </button>
        ))}

        <div className="shrink-0 bg-slate-200/80 max-md:my-1.5 max-md:w-px md:mx-2 md:my-1 md:h-px" />

        <button
          onClick={() => fileRef.current?.click()}
          title="Imagem"
          className={buttonClass(false)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24">
            <rect x="4" y="5" width="16" height="14" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
            <circle cx="9" cy="10" r="1.5" fill="currentColor" />
            <path d="M5.5 17l4-4 3.5 3 2.5-2 3 3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUploadImage(file);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
