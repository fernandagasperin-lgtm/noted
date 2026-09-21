'use client';

import { use, useEffect, useState } from 'react';

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [state, setState] = useState<'loading' | 'ready' | 'invalid'>('loading');
  const [kind, setKind] = useState<'invite' | 'reset'>('invite');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/invites/accept?token=' + encodeURIComponent(token))
      .then(async (r) => {
        if (!r.ok) {
          setState('invalid');
          return;
        }
        const d = await r.json();
        setKind(d.kind);
        setEmail(d.email ?? '');
        setState('ready');
      })
      .catch(() => setState('invalid'));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('As senhas nao conferem.');
      return;
    }
    setBusy(true);
    setError('');

    const res = await fetch('/api/invites/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, name, password }),
    });

    if (res.ok) {
      window.location.href = '/';
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? 'Nao foi possivel concluir.');
    setBusy(false);
  };

  const inputClass =
    'w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px] text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

  if (state === 'loading') {
    return <div className="flex h-screen items-center justify-center text-sm text-slate-400">...</div>;
  }

  if (state === 'invalid') {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8F9FB] px-6">
        <div className="w-full max-w-xs rounded-2xl border border-slate-200/80 bg-white p-6 text-center shadow-lg shadow-slate-900/[0.06]">
          <h1 className="text-[15px] font-semibold text-slate-900">Link invalido</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">
            Este convite expirou ou ja foi usado. Peca um novo para quem te convidou.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-[#F8F9FB] px-6">
      <form
        onSubmit={submit}
        className="w-full max-w-xs space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-lg shadow-slate-900/[0.06]"
      >
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight text-slate-900">
            {kind === 'reset' ? 'Nova senha' : 'Criar sua conta'}
          </h1>
          {kind === 'invite' && email && (
            <p className="mt-0.5 text-[13px] text-slate-400">{email}</p>
          )}
        </div>

        {kind === 'invite' && (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
            className={inputClass}
          />
        )}

        <input
          type="password"
          autoFocus={kind === 'reset'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha (min. 8 caracteres)"
          className={inputClass}
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repita a senha"
          className={inputClass}
        />

        {error && <p className="text-[12.5px] text-rose-600">{error}</p>}

        <button
          type="submit"
          disabled={busy || !password || !confirm || (kind === 'invite' && !name)}
          className="w-full rounded-lg bg-slate-900 py-2 text-[14px] font-medium text-white transition hover:bg-slate-700 disabled:opacity-40"
        >
          {busy ? 'Aguarde...' : kind === 'reset' ? 'Salvar senha' : 'Criar conta'}
        </button>
      </form>
    </div>
  );
}
