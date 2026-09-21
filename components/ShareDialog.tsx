'use client';

import { useEffect, useState } from 'react';
import type { ShareEntry } from '@/lib/access';
import type { Page } from '@/lib/types';

interface Person {
  id: string;
  name: string;
  email: string;
}

interface Props {
  page: Page;
  meId: string;
  onClose: () => void;
}

export default function ShareDialog({ page, meId, onClose }: Props) {
  const [shares, setShares] = useState<ShareEntry[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [pick, setPick] = useState('');
  const [role, setRole] = useState<'viewer' | 'editor'>('viewer');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/pages/${page.id}/shares`)
      .then((r) => r.json())
      .then((d) => setShares(d.shares ?? []));
    fetch('/api/users')
      .then((r) => r.json())
      .then((d) => setPeople(d.users ?? []));
  }, [page.id]);

  const apply = async (method: 'PUT' | 'DELETE', body: object) => {
    const res = await fetch(`/api/pages/${page.id}/shares`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Falhou.');
      return;
    }
    setError('');
    setShares(data.shares ?? []);
  };

  const shared = new Set(shares.map((s) => s.userId));
  const available = people.filter((p) => p.id !== meId && !shared.has(p.id));

  const selectClass =
    'rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[13px] text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-6 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center gap-2 border-b border-slate-200/70 px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-slate-900">Compartilhar</div>
            <div className="truncate text-[12.5px] text-slate-400">
              {page.icon} {page.title}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            ×
          </button>
        </header>

        <div className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <select
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              className={selectClass + ' min-w-0 flex-1'}
            >
              <option value="">Escolha uma pessoa...</option>
              {available.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.email})
                </option>
              ))}
            </select>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'viewer' | 'editor')}
              className={selectClass}
            >
              <option value="viewer">Leitor</option>
              <option value="editor">Editor</option>
            </select>
            <button
              disabled={!pick}
              onClick={() => {
                apply('PUT', { userId: pick, role });
                setPick('');
              }}
              className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-slate-700 disabled:opacity-40"
            >
              Adicionar
            </button>
          </div>

          {available.length === 0 && people.length > 0 && (
            <p className="text-[12.5px] text-slate-400">
              Todo mundo ja tem acesso. Convide mais pessoas no menu do workspace.
            </p>
          )}

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>
          )}

          <div className="space-y-1">
            <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px]">
              <span className="min-w-0 flex-1 truncate font-medium text-slate-700">
                Você
              </span>
              <span className="text-[12.5px] text-slate-400">Dono</span>
            </div>

            {shares.map((s) => (
              <div
                key={s.userId}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] transition hover:bg-slate-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-slate-700">{s.name}</div>
                  <div className="truncate text-[11.5px] text-slate-400">{s.email}</div>
                </div>
                <select
                  value={s.role}
                  onChange={(e) => apply('PUT', { userId: s.userId, role: e.target.value })}
                  className={selectClass}
                >
                  <option value="viewer">Leitor</option>
                  <option value="editor">Editor</option>
                </select>
                <button
                  onClick={() => apply('DELETE', { userId: s.userId })}
                  title="Remover acesso"
                  className="shrink-0 rounded px-1.5 py-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <p className="text-[11.5px] leading-relaxed text-slate-400">
            Leitor abre e acompanha, sem alterar nada. Editor pode mexer no conteúdo — mas
            se dois editores abrirem a mesma página ao mesmo tempo, quem salvar por último
            sobrescreve o outro.
          </p>
        </div>
      </div>
    </div>
  );
}
