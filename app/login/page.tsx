'use client';

import { useEffect, useState } from 'react';

export default function LoginPage() {
  const [mode, setMode] = useState<'loading' | 'login' | 'setup' | 'locked'>('loading');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/auth/status')
      .then((r) => r.json())
      .then((d) => setMode(d.hasUsers ? 'login' : d.setupOpen ? 'setup' : 'locked'))
      .catch(() => setMode('login'));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');

    const res = await fetch(mode === 'setup' ? '/api/setup' : '/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        mode === 'setup' ? { email, name, password, code } : { email, password },
      ),
    });

    if (res.ok) {
      window.location.href = '/';
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? 'Nao foi possivel entrar.');
    setBusy(false);
  };

  const inputClass =
    'w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px] text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

  if (mode === 'loading') {
    return <div className="flex h-screen items-center justify-center text-sm text-slate-400">...</div>;
  }

  if (mode === 'locked') {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8F9FB] px-6">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white p-6 shadow-lg shadow-slate-900/[0.06]">
          <h1 className="text-[15px] font-semibold text-slate-900">Workspace sem conta</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">
            Para criar a conta de administrador, defina a variavel de ambiente{' '}
            <code className="rounded bg-slate-100 px-1 text-slate-600">SETUP_CODE</code> na
            hospedagem e recarregue esta pagina.
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
          <h1 className="text-[17px] font-semibold tracking-tight text-slate-900">Quadro</h1>
          <p className="mt-0.5 text-[13px] text-slate-400">
            {mode === 'setup'
              ? 'Crie a conta de administrador do workspace.'
              : 'Entre para continuar.'}
          </p>
        </div>

        {mode === 'setup' && (
          <input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Codigo de instalacao"
            className={inputClass}
          />
        )}

        {mode === 'setup' && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
            className={inputClass}
          />
        )}

        <input
          type="email"
          autoFocus={mode === 'login'}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail"
          className={inputClass}
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === 'setup' ? 'Senha (min. 8 caracteres)' : 'Senha'}
          className={inputClass}
        />

        {error && <p className="text-[12.5px] text-rose-600">{error}</p>}

        <button
          type="submit"
          disabled={busy || !email || !password || (mode === 'setup' && (!name || !code))}
          className="w-full rounded-lg bg-slate-900 py-2 text-[14px] font-medium text-white transition hover:bg-slate-700 disabled:opacity-40"
        >
          {busy ? 'Aguarde...' : mode === 'setup' ? 'Criar conta' : 'Entrar'}
        </button>

        {mode === 'login' && (
          <p className="text-[12px] leading-relaxed text-slate-400">
            Esqueceu a senha? Peça ao administrador um link de redefinição.
          </p>
        )}
      </form>
    </div>
  );
}
