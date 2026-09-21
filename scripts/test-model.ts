// Exercita o modelo de dados e de permissao contra um Postgres de verdade,
// rodando dentro do Node (PGlite). Nao precisa de banco externo.
//
//   npm test

import { PGlite } from '@electric-sql/pglite';
import { ensureSchema, useTestDatabase } from '../lib/db';
import {
  canSeeProject,
  listShares,
  ownsProject,
  pageRole,
  removeShare,
  setShare,
  othersOnPage,
  touchPresence,
} from '../lib/access';
import {
  authenticate,
  consumeInvite,
  countUsers,
  createInvite,
  createUser,
  deleteUser,
  emailTaken,
  listInvites,
  readInvite,
  setPassword,
} from '../lib/users';
import {
  createAssistant,
  createPage,
  createProject,
  deletePage,
  deleteProject,
  readWorkspace,
  updatePage,
} from '../lib/store';
import type { Me } from '../lib/types';

let passed = 0;
let failed = 0;

function check(label: string, ok: unknown, detail = '') {
  if (ok) {
    passed++;
    console.log(`  ok    ${label}`);
  } else {
    failed++;
    console.log(`  FALHA ${label}${detail ? `  -> ${detail}` : ''}`);
  }
}

function section(title: string) {
  console.log(`\n${title}`);
}

const me = (id: string): Me => ({ id, name: '', email: '', isAdmin: false });

async function main() {
  const pg = new PGlite();
  useTestDatabase({
    query: (text, values) => pg.query(text, values) as Promise<{ rows: Record<string, unknown>[] }>,
  });

  section('schema');
  await ensureSchema();
  await ensureSchema(); // idempotente: rodar de novo nao pode explodir
  check('cria as tabelas e aguenta rodar duas vezes', true);

  section('contas');
  check('workspace comeca vazio', (await countUsers()) === 0);

  const alice = await createUser('Alice@Teste.com ', 'Alice', 'senha-alice-1');
  check('primeira conta vira admin', alice.isAdmin);
  check('e-mail e normalizado', alice.email === 'alice@teste.com', alice.email);

  const bob = await createUser('bob@teste.com', 'Bob', 'senha-bob-12');
  check('segunda conta nao e admin', !bob.isAdmin);
  check('emailTaken enxerga maiuscula/minuscula', await emailTaken('BOB@teste.com'));

  check('login certo passa', Boolean(await authenticate('alice@teste.com', 'senha-alice-1')));
  check('login com senha errada falha', !(await authenticate('alice@teste.com', 'errada')));
  check('login com e-mail inexistente falha', !(await authenticate('x@y.com', 'seja-o-que-for')));
  check(
    'login ignora caixa do e-mail',
    Boolean(await authenticate('ALICE@TESTE.COM', 'senha-alice-1')),
  );

  await setPassword(alice.id, 'nova-senha-alice');
  check('troca de senha invalida a antiga', !(await authenticate('alice@teste.com', 'senha-alice-1')));
  check('e valida a nova', Boolean(await authenticate('alice@teste.com', 'nova-senha-alice')));

  section('convites');
  const invite = await createInvite('invite', alice.id, { email: 'carol@teste.com' });
  check('convite aparece na lista de pendentes', (await listInvites()).length === 1);
  check('convite pode ser lido pelo token', Boolean(await readInvite(invite.token)));
  check('consumir o convite funciona', await consumeInvite(invite.token));
  check('consumir de novo falha', !(await consumeInvite(invite.token)));
  check('convite usado some dos pendentes', (await listInvites()).length === 0);
  check('token invalido nao resolve', !(await readInvite('token-que-nao-existe')));

  section('isolamento entre contas');
  const projA = await createProject(alice.id, 'Projeto da Alice');
  const wsA = await readWorkspace(me(alice.id));
  const pageA = wsA.pages[0];
  check('criar projeto ja traz um quadro', Boolean(pageA));
  check('e traz exatamente um, sem duplicar', wsA.pages.length === 1, `${wsA.pages.length} paginas`);
  check('Alice e dona do quadro', pageA.role === 'owner', pageA.role);
  check('projeto aparece como dela', wsA.projects[0].mine);

  const wsB0 = await readWorkspace(me(bob.id));
  check('Bob nao enxerga o projeto da Alice', !wsB0.projects.some((p) => p.id === projA.id));
  check('nem o quadro', !wsB0.pages.some((p) => p.id === pageA.id));
  check('Bob nao tem papel no quadro', (await pageRole(bob.id, pageA.id)) === null);
  check('Bob nao enxerga o projeto', !(await canSeeProject(bob.id, projA.id)));
  check('Bob nao e dono do projeto', !(await ownsProject(bob.id, projA.id)));

  // readWorkspace cria um workspace proprio para quem ainda nao tem nenhum
  check(
    'Bob ganhou um espaco proprio, e nao o da Alice',
    wsB0.projects.length === 1 && wsB0.projects[0].mine && wsB0.projects[0].id !== projA.id,
  );
  check('com um unico quadro', wsB0.pages.length === 1, `${wsB0.pages.length} paginas`);

  section('compartilhar como leitor');
  await setShare(pageA.id, bob.id, 'viewer');
  check('papel de Bob vira leitor', (await pageRole(bob.id, pageA.id)) === 'viewer');
  check('Bob passa a enxergar o projeto', await canSeeProject(bob.id, projA.id));

  const wsB1 = await readWorkspace(me(bob.id));
  const seen = wsB1.pages.find((p) => p.id === pageA.id);
  check('o quadro aparece para Bob', Boolean(seen));
  check('com papel de leitor', seen?.role === 'viewer', seen?.role);
  check('o projeto da Alice aparece, marcado como de outra pessoa',
    wsB1.projects.some((p) => p.id === projA.id && !p.mine));

  check('listShares mostra o convidado', (await listShares(pageA.id)).length === 1);

  section('promover a editor e revogar');
  await setShare(pageA.id, bob.id, 'editor');
  check('papel vira editor sem duplicar linha', (await pageRole(bob.id, pageA.id)) === 'editor');
  check('continua uma unica entrada', (await listShares(pageA.id)).length === 1);

  await removeShare(pageA.id, bob.id);
  check('revogar remove o papel', (await pageRole(bob.id, pageA.id)) === null);
  const wsB2 = await readWorkspace(me(bob.id));
  check('e o quadro some da lista de Bob', !wsB2.pages.some((p) => p.id === pageA.id));

  section('conteudo da pagina');
  const elements = [
    { id: 'e1', type: 'sticky', x: 1, y: 2, width: 3, height: 4, rotation: 0, content: 'oi',
      style: { fill: '#fff', stroke: '#000', strokeWidth: 1, fontSize: 12, opacity: 1 } },
  ];
  const updated = await updatePage(pageA.id, { elements: elements as never }, 'owner');
  check('elementos gravam e voltam do JSONB', updated?.elements[0]?.content === 'oi');
  check('e o titulo nao foi apagado por um patch parcial', updated?.title === pageA.title);

  const renamed = await updatePage(pageA.id, { title: 'Renomeado' }, 'owner');
  check('renomear preserva os elementos', renamed?.elements.length === 1, JSON.stringify(renamed?.elements));

  section('valores vazios em patch parcial');
  const textPage = await createPage(alice.id, projA.id, 'Anotacoes', 'text');
  await updatePage(textPage!.id, { body: 'algum texto' }, 'owner');
  const cleared = await updatePage(textPage!.id, { body: '' }, 'owner');
  check('apagar todo o texto de uma pagina realmente grava vazio', cleared?.body === '',
    JSON.stringify(cleared?.body));

  await updatePage(pageA.id, { elements: elements as never }, 'owner');
  const emptied = await updatePage(pageA.id, { elements: [] }, 'owner');
  check('esvaziar o quadro grava lista vazia', emptied?.elements.length === 0,
    JSON.stringify(emptied?.elements));

  const untouched = await updatePage(pageA.id, { title: 'So o titulo' }, 'owner');
  check('e um patch so de titulo nao ressuscita elementos', untouched?.elements.length === 0);

  await updatePage(pageA.id, { elements: elements as never }, 'owner');

  section('links orfaos');
  const other = await createPage(alice.id, projA.id, 'Alvo', 'canvas');
  const withRef = [
    ...elements,
    { id: 'r1', type: 'reference', x: 0, y: 0, width: 1, height: 1, rotation: 0, content: '',
      refPageId: other!.id,
      style: { fill: '#fff', stroke: '#000', strokeWidth: 1, fontSize: 12, opacity: 1 } },
  ];
  await updatePage(pageA.id, { elements: withRef as never }, 'owner');
  await deletePage(other!.id, alice.id);
  const after = await readWorkspace(me(alice.id));
  const cleaned = after.pages.find((p) => p.id === pageA.id);
  check('excluir a pagina alvo remove o link que apontava para ela',
    !cleaned?.elements.some((e) => e.type === 'reference'));
  check('mas preserva os outros elementos', cleaned?.elements.length === 1);

  section('assistentes');
  const assistant = await createAssistant(projA.id, { name: 'Roteiro', prompt: 'faca {{x}}' });
  check('assistente e criado no projeto', assistant?.name === 'Roteiro');
  const wsWithAssistant = await readWorkspace(me(alice.id));
  check('e aparece no workspace da dona', wsWithAssistant.assistants.length === 1);
  const wsBobAssistants = await readWorkspace(me(bob.id));
  check('mas nao no de quem nao ve o projeto',
    !wsBobAssistants.assistants.some((a) => a.id === assistant!.id));

  section('presenca');
  await touchPresence(pageA.id, alice.id);
  check('quem esta sozinho nao ve ninguem', (await othersOnPage(pageA.id, alice.id)).length === 0);
  await touchPresence(pageA.id, bob.id);
  const others = await othersOnPage(pageA.id, alice.id);
  check('Alice enxerga Bob na pagina', others.length === 1 && others[0] === 'Bob', JSON.stringify(others));

  section('remover conta');
  const projB = await createProject(bob.id, 'Projeto do Bob');
  await deleteUser(bob.id, alice.id);
  check('conta some', (await countUsers()) === 1);
  check('o projeto dele passa para quem removeu', await ownsProject(alice.id, projB.id));

  section('excluir projeto');
  await deleteProject(projB.id, alice.id);
  const finalWs = await readWorkspace(me(alice.id));
  check('projeto some', !finalWs.projects.some((p) => p.id === projB.id));
  check('e as paginas dele tambem', !finalWs.pages.some((p) => p.projectId === projB.id));

  console.log(`\n${passed} passaram, ${failed} falharam.\n`);
  await pg.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\nO teste quebrou:', err);
  process.exit(1);
});
