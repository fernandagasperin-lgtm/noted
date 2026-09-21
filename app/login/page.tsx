'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      window.location.href = '/';
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? 'Nao foi possivel entrar.');
    setBusy(false);
  };

  return (
    <div className="flex h-screen items-center justify-center bg-[#F8F9FB] px-6">
      <form
        onSubmit={submit}
        className="w-full max-w-xs space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-lg shadow-slate-900/[0.06]"
      >
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight text-slate-900">Quadro</h1>
          <p className="mt-0.5 text-[13px] text-slate-400">Entre para continuar.</p>
        </div>

        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px] text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />

        {error && <p className="text-[12.5px] text-rose-600">{error}</p>}

        <button
          type="submit"
          disabled={busy || !password}
          className="w-full rounded-lg bg-slate-900 py-2 text-[14px] font-medium text-white transition hover:bg-slate-700 disabled:opacity-40"
        >
          {busy ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
