// Testa o modelo de permissao de ponta a ponta, contra um servidor rodando.
//
// Uso:
//   1. tenha DATABASE_URL e APP_SECRET no .env.local
//   2. num terminal:  npm run dev
//   3. noutro:        SETUP_CODE=<o mesmo do servidor> node scripts/smoke-test.mjs
//
// ATENCAO: use um banco de teste. O roteiro cria contas e paginas, e so
// funciona num workspace que ainda nao tem nenhuma conta.

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const SETUP_CODE = process.env.SETUP_CODE ?? '';

let failures = 0;
function check(label, condition, detail = '') {
  const ok = Boolean(condition);
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FALHA'}  ${label}${ok || !detail ? '' : `  -> ${detail}`}`);
}

function jar() {
  let cookie = '';
  return {
    get header() {
      return cookie ? { cookie } : {};
    },
    absorb(res) {
      const set = res.headers.get('set-cookie');
      if (set) cookie = set.split(';')[0];
    },
  };
}

async function call(path, { method = 'GET', body, as } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(as ? as.header : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  if (as) as.absorb(res);
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* redirects and empty bodies have no json */
  }
  return { status: res.status, data };
}

const alice = jar();
const bob = jar();

console.log('\n--- porta de entrada ---');
{
  const anon = await call('/api/pages');
  check('API sem sessao responde 401', anon.status === 401, `status ${anon.status}`);
}

console.log('\n--- contas ---');
const status = await call('/api/auth/status');
if (status.data?.hasUsers) {
  console.log('\nEste workspace ja tem contas. Rode contra um banco limpo.\n');
  process.exit(1);
}

{
  const r = await call('/api/setup', {
    method: 'POST',
    as: alice,
    body: {
      email: 'alice@teste.com',
      name: 'Alice',
      password: 'senha-alice-1',
      code: SETUP_CODE,
    },
  });
  check('primeira conta vira admin', r.status === 200, `status ${r.status}`);
}

const invite = await call('/api/invites', {
  method: 'POST',
  as: alice,
  body: { kind: 'invite', email: 'bob@teste.com' },
});
check('admin gera convite', invite.status === 201, `status ${invite.status}`);

{
  const r = await call('/api/invites/accept', {
    method: 'POST',
    as: bob,
    body: { token: invite.data.token, name: 'Bob', password: 'senha-bob-12' },
  });
  check('convidado cria a conta pelo link', r.status === 200, `status ${r.status}`);

  const reuse = await call('/api/invites/accept', {
    method: 'POST',
    body: { token: invite.data.token, name: 'Intruso', password: 'senha-intrusa' },
  });
  check('mesmo link nao serve duas vezes', reuse.status === 404, `status ${reuse.status}`);
}

console.log('\n--- isolamento ---');
const wsA = await call('/api/pages', { as: alice });
const page = wsA.data.pages[0];
check('Alice enxerga a propria pagina', Boolean(page));
check('e aparece como dona', page?.role === 'owner', `role ${page?.role}`);

{
  const wsB = await call('/api/pages', { as: bob });
  check(
    'Bob nao enxerga a pagina de Alice',
    !wsB.data.pages.some((p) => p.id === page.id),
  );

  const write = await call('/api/pages/' + page.id, {
    method: 'PATCH',
    as: bob,
    body: { title: 'invadido' },
  });
  check('Bob nao consegue escrever nela', write.status === 404, `status ${write.status}`);
}

console.log('\n--- compartilhar como leitor ---');
const people = await call('/api/users', { as: alice });
const bobId = people.data.users.find((u) => u.email === 'bob@teste.com')?.id;
check('Alice consegue listar pessoas', Boolean(bobId));

{
  const r = await call(`/api/pages/${page.id}/shares`, {
    method: 'PUT',
    as: alice,
    body: { userId: bobId, role: 'viewer' },
  });
  check('Alice compartilha como leitor', r.status === 200, `status ${r.status}`);

  const wsB = await call('/api/pages', { as: bob });
  const seen = wsB.data.pages.find((p) => p.id === page.id);
  check('Bob passa a enxergar a pagina', Boolean(seen));
  check('com papel de leitor', seen?.role === 'viewer', `role ${seen?.role}`);

  const write = await call('/api/pages/' + page.id, {
    method: 'PATCH',
    as: bob,
    body: { elements: [] },
  });
  check('leitor nao consegue escrever', write.status === 403, `status ${write.status}`);

  const share = await call(`/api/pages/${page.id}/shares`, {
    method: 'PUT',
    as: bob,
    body: { userId: bobId, role: 'editor' },
  });
  check('leitor nao consegue se promover', share.status === 403, `status ${share.status}`);
}

console.log('\n--- promover a editor ---');
{
  await call(`/api/pages/${page.id}/shares`, {
    method: 'PUT',
    as: alice,
    body: { userId: bobId, role: 'editor' },
  });

  const write = await call('/api/pages/' + page.id, {
    method: 'PATCH',
    as: bob,
    body: { elements: [] },
  });
  check('editor consegue escrever', write.status === 200, `status ${write.status}`);

  const rename = await call('/api/pages/' + page.id, {
    method: 'PATCH',
    as: bob,
    body: { title: 'renomeado pelo editor' },
  });
  const after = await call('/api/pages', { as: alice });
  const still = after.data.pages.find((p) => p.id === page.id);
  check(
    'editor nao renomeia a pagina',
    rename.status === 200 && still.title === page.title,
    `titulo virou "${still?.title}"`,
  );

  const del = await call('/api/pages/' + page.id, { method: 'DELETE', as: bob });
  check('editor nao exclui a pagina', del.status === 403, `status ${del.status}`);
}

console.log('\n--- revogar ---');
{
  await call(`/api/pages/${page.id}/shares`, {
    method: 'DELETE',
    as: alice,
    body: { userId: bobId },
  });
  const wsB = await call('/api/pages', { as: bob });
  check(
    'Bob perde o acesso ao ser removido',
    !wsB.data.pages.some((p) => p.id === page.id),
  );
}

console.log(
  failures === 0
    ? '\nTudo passou.\n'
    : `\n${failures} verificacao(oes) falharam.\n`,
);
process.exit(failures === 0 ? 1 - 1 : 1);
