'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Invite } from '@/lib/users';

interface Person {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

interface Props {
  meId: string;
  onClose: () => void;
}

export default function MembersDialog({ meId, onClose }: Props) {
  const [people, setPeople] = useState<Person[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    const [u, i] = await Promise.all([
      fetch('/api/users').then((r) => r.json()),
      fetch('/api/invites').then((r) => r.json()),
    ]);
    setPeople(u.users ?? []);
    setInvites(i.invites ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const linkFor = (token: string) => `${window.location.origin}/invite/${token}`;

  const copy = async (token: string) => {
    await navigator.clipboard.writeText(linkFor(token));
    setCopied(token);
    setTimeout(() => setCopied(''), 1800);
  };

  const invite = async () => {
    setError('');
    const res = await fetch('/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'invite', email }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Falhou.');
      return;
    }
    setEmail('');
    await load();
    copy(data.token);
  };

  const resetFor = async (userId: string) => {
    const res = await fetch('/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'reset', userId }),
    });
    const data = await res.json();
    if (res.ok) {
      await load();
      copy(data.token);
    }
  };

  const remove = async (userId: string, name: string) => {
    if (!confirm(`Remover ${name}? As páginas dela passam para você.`)) return;
    await fetch('/api/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    await load();
  };

  const smallButton =
    'shrink-0 rounded-lg px-2 py-1 text-[12px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-800';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-6 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center gap-2 border-b border-slate-200/70 px-5 py-3.5">
          <div className="flex-1 text-[15px] font-semibold text-slate-900">Pessoas</div>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Convidar
            </div>
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <button
                onClick={invite}
                disabled={!email.includes('@')}
                className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-[13px] font-medium text-white transition hover:bg-slate-700 disabled:opacity-40"
              >
                Gerar link
              </button>
            </div>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-400">
              O link vai para a área de transferência. Mande você mesma por onde preferir —
              o app não envia e-mail.
            </p>
            {error && <p className="mt-1.5 text-[12.5px] text-rose-600">{error}</p>}
          </div>

          {invites.length > 0 && (
            <div>
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Links pendentes
              </div>
              <div className="space-y-1">
                {invites.map((i) => (
                  <div
                    key={i.token}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] transition hover:bg-slate-50"
                  >
                    <span className="min-w-0 flex-1 truncate text-slate-600">
                      {i.kind === 'reset' ? `Nova senha · ${i.userName}` : i.email}
                    </span>
                    <button onClick={() => copy(i.token)} className={smallButton}>
                      {copied === i.token ? 'copiado' : 'copiar'}
                    </button>
                    <button
                      onClick={async () => {
                        await fetch('/api/invites/' + i.token, { method: 'DELETE' });
                        load();
                      }}
                      className={smallButton + ' hover:text-rose-600'}
                    >
                      revogar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Contas
            </div>
            <div className="space-y-1">
              {people.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] transition hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-slate-700">
                      {p.name}
                      {p.id === meId && <span className="text-slate-400"> · você</span>}
                      {p.isAdmin && (
                        <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] text-slate-500">
                          admin
                        </span>
                      )}
                    </div>
                    <div className="truncate text-[11.5px] text-slate-400">{p.email}</div>
                  </div>
                  <button onClick={() => resetFor(p.id)} className={smallButton}>
                    nova senha
                  </button>
                  {p.id !== meId && (
                    <button
                      onClick={() => remove(p.id, p.name)}
                      className={smallButton + ' hover:text-rose-600'}
                    >
                      remover
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
