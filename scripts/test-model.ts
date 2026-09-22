// Exercita o modelo de dados e de permissao contra um Postgres de verdade,
// rodando dentro do Node (PGlite). Nao precisa de banco externo.
//
//   npm test

import { PGlite } from '@electric-sql/pglite';
import { ensureSchema, sql, useTestDatabase } from '../lib/db';
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
  createColumn,
  createPage,
  createRow,
  deleteColumn,
  deleteRow,
  readTable,
  updateColumn,
  updateRow,
  createProject,
  deletePage,
  deleteProject,
  readWorkspace,
  updatePage,
} from '../lib/store';
import { buildDerivationTitle, fillTemplate, type Assistant, type Me } from '../lib/types';
import { hashPassword, verifyPassword } from '../lib/password';
import { createSessionToken, readSession } from '../lib/session';
import { applyFilters, applySorts, opsFor, type TableFilter } from '../lib/table';
import type { DbColumn, DbRow } from '../lib/types';

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

async function testPureLogic() {
  section('template de prompt');
  check('substitui um campo', fillTemplate('faca {{x}}', { x: 'isso' }) === 'faca isso');
  check('substitui varios', fillTemplate('{{a}} e {{b}}', { a: '1', b: '2' }) === '1 e 2');
  check('ignora espaco dentro das chaves', fillTemplate('{{ x }}', { x: 'ok' }) === 'ok');
  check('nao diferencia maiuscula', fillTemplate('{{Tema}}', { tema: 'cafe' }) === 'cafe');
  check(
    'campo desconhecido fica visivel em vez de sumir',
    fillTemplate('faca {{z}}', { x: '1' }) === 'faca {{z}}',
    fillTemplate('faca {{z}}', { x: '1' }),
  );
  check('campo vazio vira vazio', fillTemplate('[{{x}}]', { x: '' }) === '[]');
  check('texto sem campo passa intacto', fillTemplate('nada aqui', {}) === 'nada aqui');
  check(
    'valor que parece campo nao e substituido de novo',
    fillTemplate('{{a}}', { a: '{{b}}', b: 'bomba' }) === '{{b}}',
  );

  section('titulo das derivacoes');
  const assistant = {
    id: 'a', projectId: 'p', name: 'Roteiro', icon: '✦',
    prompt: '', titlePattern: '{{assistente}} · {{variacao}}', createdAt: '',
  } satisfies Assistant;
  check(
    'monta com nome e numero da variacao',
    buildDerivationTitle(assistant, 3, {}) === 'Roteiro · v3',
    buildDerivationTitle(assistant, 3, {}),
  );
  check(
    'usa os campos preenchidos',
    buildDerivationTitle({ ...assistant, titlePattern: 'R · {{trecho}} · {{variacao}}' }, 1,
      { trecho: 'abertura' }) === 'R · abertura · v1',
  );
  check(
    'padrao vazio cai no padrao da casa',
    buildDerivationTitle({ ...assistant, titlePattern: '' }, 2, {}) === 'Roteiro · v2',
  );

  section('senha');
  const h1 = await hashPassword('mesma-senha');
  const h2 = await hashPassword('mesma-senha');
  check('duas senhas iguais geram hashes diferentes (sal)', h1 !== h2);
  check('a senha certa confere nos dois', (await verifyPassword('mesma-senha', h1)) &&
    (await verifyPassword('mesma-senha', h2)));
  check('senha errada nao confere', !(await verifyPassword('outra', h1)));
  check('hash malformado nao confere', !(await verifyPassword('x', 'lixo')));
  check('hash vazio nao confere', !(await verifyPassword('x', '')));
  check('hash truncado nao confere', !(await verifyPassword('x', h1.slice(0, 20))));

  section('sessao');
  process.env.APP_SECRET = 'segredo-de-teste-bem-longo-para-assinar-1234567890';
  const token = await createSessionToken('usuario-123');
  check('token valido devolve o dono', (await readSession(token)) === 'usuario-123');
  check('token adulterado e recusado', (await readSession(token.slice(0, -3) + 'aaa')) === null);
  check('token vazio e recusado', (await readSession('')) === null);
  check('lixo e recusado', (await readSession('nao.e.um.jwt')) === null);

  const original = process.env.APP_SECRET;
  process.env.APP_SECRET = 'outro-segredo-completamente-diferente-0987654321';
  check('token assinado com outro segredo e recusado', (await readSession(token)) === null);
  process.env.APP_SECRET = original;
  check('e volta a valer com o segredo certo', (await readSession(token)) === 'usuario-123');
}

function testarTabela() {
  const col = (id: string, type: DbColumn['type'], options: DbColumn['options'] = []) =>
    ({ id, pageId: 'p', name: id, type, options, format: 'plain', width: 180, position: 0 }) as DbColumn;

  const linha = (id: string, title: string, values: Record<string, unknown>) =>
    ({ id, pageId: 'p', title, values, body: '', position: 0, createdAt: '', updatedAt: '' }) as DbRow;

  const preco = col('preco', 'number');
  const loja = col('loja', 'multi', [
    { id: 'o1', name: 'nissei', color: '#fff' },
    { id: 'o2', name: 'cellshop', color: '#fff' },
  ]);
  const feito = col('feito', 'check');
  const colunas = [preco, loja, feito];

  const linhas = [
    linha('a', 'Drone', { preco: 2784, loja: ['o1'], feito: true }),
    linha('b', 'Iphone', { preco: 5305, loja: ['o1', 'o2'] }),
    linha('c', 'Cabo', { loja: [] }),
  ];

  const f = (columnId: string, op: TableFilter['op'], value = ''): TableFilter[] => [
    { id: 'f', columnId, op, value },
  ];
  const ids = (rs: DbRow[]) => rs.map((r) => r.id).join(',');

  section('filtros');
  check('maior que compara numero, nao texto',
    ids(applyFilters(linhas, colunas, f('preco', 'gt', '3000'))) === 'b');
  check('menor que', ids(applyFilters(linhas, colunas, f('preco', 'lt', '3000'))) === 'a');
  check('vazio pega quem nao tem valor',
    ids(applyFilters(linhas, colunas, f('preco', 'empty'))) === 'c');
  check('nao vazio pega o resto',
    ids(applyFilters(linhas, colunas, f('preco', 'notEmpty'))) === 'a,b');
  check('multi-selecao compara pelo nome, nao pelo id',
    ids(applyFilters(linhas, colunas, f('loja', 'contains', 'cellshop'))) === 'b');
  check('nao contem exclui quem tem',
    ids(applyFilters(linhas, colunas, f('loja', 'notContains', 'nissei'))) === 'c');
  check('lista vazia conta como vazia',
    ids(applyFilters(linhas, colunas, f('loja', 'empty'))) === 'c');
  check('caixa marcada', ids(applyFilters(linhas, colunas, f('feito', 'checked'))) === 'a');
  check('caixa nao marcada', ids(applyFilters(linhas, colunas, f('feito', 'unchecked'))) === 'b,c');
  check('contem no titulo ignora maiuscula',
    ids(applyFilters(linhas, colunas, f('title', 'contains', 'DRONE'))) === 'a');
  check('filtro sem valor nao esconde nada',
    ids(applyFilters(linhas, colunas, f('title', 'contains', '  '))) === 'a,b,c');
  check('filtro sobre coluna apagada e ignorado',
    ids(applyFilters(linhas, colunas, f('sumiu', 'contains', 'x'))) === 'a,b,c');
  check('dois filtros precisam passar os dois',
    ids(applyFilters(linhas, colunas, [
      { id: '1', columnId: 'preco', op: 'notEmpty', value: '' },
      { id: '2', columnId: 'loja', op: 'contains', value: 'cellshop' },
    ])) === 'b');

  section('ordenacao');
  check('numero crescente',
    ids(applySorts(linhas, colunas, [{ columnId: 'preco', direction: 'asc' }])) === 'a,b,c');
  check('numero decrescente, com vazio sempre no fim',
    ids(applySorts(linhas, colunas, [{ columnId: 'preco', direction: 'desc' }])) === 'b,a,c',
    ids(applySorts(linhas, colunas, [{ columnId: 'preco', direction: 'desc' }])));
  check('texto em ordem alfabetica',
    ids(applySorts(linhas, colunas, [{ columnId: 'title', direction: 'asc' }])) === 'c,a,b');
  check('ordenar nao altera a lista original', ids(linhas) === 'a,b,c');
  check('sem criterio, mantem a ordem', ids(applySorts(linhas, colunas, [])) === 'a,b,c');

  section('operadores por tipo');
  check('caixa so oferece marcada/nao marcada', opsFor('check').join(',') === 'checked,unchecked');
  check('numero oferece maior e menor', opsFor('number').includes('gt'));
  check('texto nao oferece maior que', !opsFor('text').includes('gt'));
}

async function main() {
  await testPureLogic();
  testarTabela();

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

  section('espaco proprio de quem e convidada');
  {
    const carol = await createUser('carol@teste.com', 'Carol', 'senha-carol-1');
    // compartilha ANTES de ela abrir o app pela primeira vez
    await setShare(pageA.id, carol.id, 'viewer');
    const wsC = await readWorkspace(me(carol.id));
    check('enxerga a pagina que lhe deram', wsC.pages.some((p) => p.id === pageA.id));
    check(
      'e mesmo assim ganha um projeto proprio onde possa criar',
      wsC.projects.some((p) => p.mine),
      JSON.stringify(wsC.projects.map((p) => p.mine)),
    );
    await deleteUser(carol.id, alice.id);
  }

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

  section('tabelas');
  const tablePage = await createPage(alice.id, projA.id, 'Compras', 'database');
  const inicial = await readTable(tablePage!.id);
  check('tabela nova nasce limpa, como no Notion', inicial.columns.length === 0,
    `${inicial.columns.length} colunas`);
  check('e sem linhas', inicial.rows.length === 0);

  const colValor = await createColumn(tablePage!.id, 'Valor', 'number');
  await updateColumn(colValor.id, { format: 'brl' });
  const colLoja = await createColumn(tablePage!.id, 'Loja', 'multi');
  await updateColumn(colLoja.id, {
    options: [
      { id: 'o1', name: 'nissei', color: '#FADEC9' },
      { id: 'o2', name: 'cellshop', color: '#D3E5EF' },
    ],
  });

  const depoisDeColunas = await readTable(tablePage!.id);
  check('colunas novas entram na ordem', depoisDeColunas.columns.length === 2);
  check('formato de moeda e guardado',
    depoisDeColunas.columns.find((c) => c.id === colValor.id)?.format === 'brl');
  check('opcoes de selecao sao guardadas',
    depoisDeColunas.columns.find((c) => c.id === colLoja.id)?.options.length === 2);

  const linha = await createRow(tablePage!.id, 'Drone DJI');
  await updateRow(linha.id, {
    values: { [colValor.id]: 509, [colLoja.id]: ['o1', 'o2'] },
    body: 'anotacao da linha',
  });
  const comLinha = await readTable(tablePage!.id);
  const salva = comLinha.rows[0];
  check('titulo da linha grava', salva.title === 'Drone DJI');
  check('numero grava', salva.values[colValor.id] === 509);
  check('multi-selecao grava uma lista',
    Array.isArray(salva.values[colLoja.id]) &&
      (salva.values[colLoja.id] as string[]).length === 2);
  check('o texto da pagina da linha grava', salva.body === 'anotacao da linha');

  // trocar o titulo nao pode apagar os valores das outras colunas
  await updateRow(linha.id, { title: 'Drone DJI Mini 4K' });
  const soTitulo = (await readTable(tablePage!.id)).rows[0];
  check('editar so o titulo preserva os valores', soTitulo.values[colValor.id] === 509);
  check('e preserva o texto da pagina', soTitulo.body === 'anotacao da linha');

  await deleteColumn(colValor.id);
  const semColuna = await readTable(tablePage!.id);
  check('excluir coluna some com ela', semColuna.columns.length === 1);
  check('e limpa o valor orfao das linhas',
    !(colValor.id in semColuna.rows[0].values),
    JSON.stringify(semColuna.rows[0].values));
  check('sem tocar nos valores das outras colunas',
    Array.isArray(semColuna.rows[0].values[colLoja.id]));

  const outraLinha = await createRow(tablePage!.id, 'Segunda');
  check('linhas novas entram depois', (await readTable(tablePage!.id)).rows.length === 2);
  await deleteRow(outraLinha.id);
  check('e podem ser excluidas', (await readTable(tablePage!.id)).rows.length === 1);

  // a tabela e uma pagina: excluir a pagina tem que levar colunas e linhas junto
  await deletePage(tablePage!.id, alice.id);
  const orfas = await sql`SELECT count(*)::int AS n FROM db_rows WHERE page_id = ${tablePage!.id}`;
  check('excluir a pagina leva as linhas junto', (orfas[0].n as number) === 0);

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
