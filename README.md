# Quadro

Ferramenta interna de quadro visual: canvas no estilo Miro com a organização em
projetos, páginas e tabelas do Notion, mais assistentes de prompt reutilizáveis.
Usuário único, roda localmente.

## Como rodar local

```bash
npm install
npm run dev
```

Abra http://localhost:3000

Os dados vivem num Postgres, então mesmo local você precisa de `DATABASE_URL` e
`APP_SECRET` no `.env.local`. O login vale igual no local — use a mesma conta.

## Contas, convites e permissões

A primeira pessoa a abrir o app cria a conta de administrador — e essa conta adota
tudo que já existia no workspace, para nada ficar sem dono.

**Convidar.** No rodapé da barra lateral, `Pessoas` (só admin). Você digita o e-mail e
o app gera um **link que vai para a área de transferência**; mande por onde quiser. O app
não envia e-mail de propósito: seria um serviço a mais para contratar e manter. Quem
recebe abre o link, escolhe o nome e a senha, e já entra. O link vale 14 dias e só
funciona uma vez.

**Senha esquecida.** Em `Pessoas`, `nova senha` gera um link de redefinição do mesmo jeito.

**Permissão é por página.** Quem cria é o dono. O dono abre `Compartilhar` no topo da
página e escolhe quem mais entra:

| Papel | Pode |
| --- | --- |
| Dono | tudo, mais renomear, mover, excluir e compartilhar |
| Editor | mexer no conteúdo da página |
| Leitor | abrir e acompanhar, sem alterar nada |

Uma pessoa só enxerga na barra lateral o que é dela ou foi compartilhado com ela. Um
projeto aparece quando ela tem acesso a pelo menos uma página dentro dele, e a tabela de
derivações soma apenas os quadros permitidos. Um bloco de link que aponta para uma página
sem acesso mostra "Página indisponível", sem revelar o título.

Só o dono do projeto cria páginas e assistentes nele.

### O limite que continua de pé

**Dois editores na mesma página se sobrescrevem.** Quem salvar por último apaga o que o
outro fez, sem aviso. O app mostra "fulano está aqui" no topo quando outra pessoa tem a
página aberta, o que ajuda a evitar o esbarrão — mas é um aviso, não sincronização.
Edição simultânea de verdade, estilo Miro, é um projeto à parte.

Por isso o padrão ao compartilhar é **Leitor**. Dê Editor só a quem precisa.

### A primeira conta

A conta de administrador só pode ser criada por quem souber o `SETUP_CODE`, uma variável
de ambiente que você define na hospedagem. Sem ela, a tela de instalação nem aparece.

Isso fecha a janela entre o deploy e a sua primeira visita: sem o código, alguém que
descobrisse o endereço nesse intervalo poderia criar a conta de administrador e ficar
com o workspace. Depois de criar a sua conta, a variável pode ser removida.

## Testes

```bash
npm test
```

Roda o modelo de dados e de permissão contra um Postgres de verdade — o **PGlite**,
que é o Postgres compilado para WebAssembly e roda dentro do Node. Não precisa de banco
externo nem de Docker. São 56 verificações: contas, convites de uso único, isolamento
entre pessoas, papéis de leitor e editor, revogação, JSONB, links órfãos e presença.

Para exercitar o app inteiro por HTTP (middleware, cookies, rotas), suba um Postgres e
rode o servidor apontando para ele:

```bash
node scripts/pglite-server.mjs
DATABASE_URL=postgres://postgres@127.0.0.1:5433/postgres APP_SECRET=... SETUP_CODE=... npm run dev
SETUP_CODE=... node scripts/smoke-test.mjs
```

Aviso: o `pglite-server.mjs` aceita **uma conexão por vez** e trava quando chega uma
segunda. Serve para o smoke test, que é sequencial, mas não para navegar na interface —
para isso use um banco de verdade. O `npm test` não tem essa limitação porque fala com o
PGlite dentro do mesmo processo.

## Hospedagem

O app roda na **Hostinger** (plano Business ou Cloud, que são os que incluem Node.js),
no seu próprio domínio. De fora vem só o **Supabase**, que guarda o banco e as imagens —
é armazenamento, não alguém hospedando o painel.

| Peça | Onde |
| --- | --- |
| App e subdomínio | Hostinger, sua conta |
| Banco e imagens | Supabase |
| Geração de texto | API da Anthropic |

### 1. Supabase

1. Crie um projeto em supabase.com (plano gratuito serve).
2. Em **Project Settings → Database**, copie a *connection string* → é a `DATABASE_URL`.
   Se a conexão direta não funcionar a partir da Hostinger, use a do **Session pooler**.
3. Em **Storage**, crie um bucket chamado `uploads` e marque como **público** — senão as
   imagens não carregam no quadro.
4. Em **Project Settings → API**, copie a *URL* e a *service_role key* → `SUPABASE_URL`
   e `SUPABASE_SERVICE_ROLE_KEY`.

A service_role key dá acesso total ao projeto. Ela fica só nas variáveis de ambiente do
servidor, nunca no navegador e nunca no git.

### 2. Subdomínio na Hostinger

No hPanel, **Domínios → Subdomínios**, crie por exemplo `ideias`. Seu site principal
continua onde está; o subdomínio é roteado separado.

### 3. Deploy

No hPanel, **Website → Node.js**, crie a aplicação apontando para o subdomínio:

- Repositório do GitHub (ou envio do .zip)
- Versão do Node: 20 ou superior
- Comando de build: `npm run build`
- Comando de start: `npm start`

Nas variáveis de ambiente da aplicação, preencha `DATABASE_URL`, `APP_SECRET`,
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e, se quiser a geração automática,
`ANTHROPIC_API_KEY`. Gere o `APP_SECRET` com:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

As tabelas são criadas sozinhas no primeiro acesso, e a primeira pessoa a abrir o app
cria a conta de administrador. Se o app subir sem `APP_SECRET`, ele recusa todo acesso
com uma mensagem em vez de ficar aberto na internet.

### Trocar de hospedagem depois

A dependência de fornecedor está em dois arquivos: `lib/db.ts` (qualquer Postgres serve)
e `app/api/upload/route.ts` (Supabase Storage). Todo o resto é Next.js comum, então mudar
para uma VPS ou outro provedor é trocar esses dois e o comando de start.

### Levar os dados locais para a nuvem

Se você já usou o app localmente com o arquivo JSON, copie `DATABASE_URL` para o
`.env.local` e rode:

```bash
node --env-file=.env.local scripts/migrate-to-cloud.mjs
```

Pode rodar mais de uma vez — ele atualiza por id em vez de duplicar. Imagens que ainda
apontam para `/uploads/` precisam ser enviadas de novo pelo app, porque agora elas ficam
no Supabase; o script avisa quando encontra alguma.

Depois de migrar, abra o app e crie sua conta: ela vira administradora e adota os
projetos e páginas que vieram do arquivo.

### Geração automática (opcional)

O card de assistente sempre monta o prompt final e deixa copiável. Se você quiser que
ele também gere o resultado sozinho, copie `.env.example` para `.env.local` e preencha
`ANTHROPIC_API_KEY`. Sem a chave nada quebra — só não aparece o botão "Gerar com Claude".

Para rodar em modo produção:

```bash
npm run build
npm start
```

## O que dá para fazer

**Projetos e páginas (barra lateral)**
- Um projeto agrupa páginas; toda página pertence a exatamente um projeto
- `+ Novo projeto` cria o projeto já com um quadro dentro
- O menu `⋯` do projeto cria página (quadro, texto, tabela ou assistentes), renomeia ou exclui o projeto
- Página: duplo clique no nome para renomear, `×` para excluir
- Para mover uma página de projeto, use o seletor de projeto no topo da página
- Excluir um projeto apaga as páginas dele e remove os links que apontavam para elas

**Canvas**

| Ferramenta | Atalho | O que faz |
| --- | --- | --- |
| Selecionar | `V` | Mover, redimensionar e girar |
| Post-it | `S` | Nota adesiva editável |
| Retângulo | `R` | Forma |
| Elipse | `E` | Forma |
| Texto | `T` | Texto livre |
| Seta | `A` | Conector |
| Link de página | `L` | Bloco que aponta para outra página |
| Assistente | `G` | Card com um prompt reutilizável |
| Imagem | — | Upload pelo botão da barra |

Cada ferramenta cria o elemento no ponto clicado e volta para "Selecionar".

**Interações**
- Arrastar o fundo: move o canvas. Roda do mouse: zoom
- Duplo clique em post-it ou texto: editar o conteúdo (`Ctrl+Enter` confirma, `Esc` cancela)
- Duplo clique num bloco de link: abre a página vinculada
- `Delete` apaga, `Ctrl+D` duplica, `Ctrl+Z` / `Ctrl+Shift+Z` desfaz e refaz
- Shift + clique para selecionar vários

## Assistentes e variações

Um **assistente** é um prompt reutilizável que mora na página de assistentes do projeto.
No prompt, escreva `{{campo}}` para tudo que muda a cada uso — esses campos viram
formulário na hora de rodar.

Coloque o card do assistente num quadro (ferramenta `G`) e dê duplo clique para usar:
você preenche os campos, e o app monta o prompt final. Copie o prompt ou gere com o
Claude, cole o resultado, e salve — nasce um **card de resultado** com o título seguindo
o padrão do assistente.

O padrão do título aceita `{{assistente}}`, `{{variacao}}` (`v1`, `v2`, `v3`...) e
qualquer campo do prompt. Com `Roteiro · {{trecho}} · {{variacao}}` você obtém
"Roteiro · a abertura · v1", "Roteiro · o meio · v2", e assim por diante.

Duplo clique num card de resultado **deriva uma nova variação a partir dele**: o resultado
anterior entra no começo do prompt, e a nova variação guarda de quem derivou.

A **página de tabela** é onde isso se cruza, em duas abas:

- **Derivações** — uma linha por resultado, com título, de qual resultado derivou, quadro,
  data e o texto. Agrupe por assistente para ver lado a lado todas as variações da mesma
  ideia.
- **Inventário** — tudo que existe nos quadros do projeto, com tipo, conteúdo e posição.

Clicar numa linha abre o quadro com aquele elemento já selecionado.

**Blocos de link** são a parte "Notion": um card no quadro que aponta para outra página do
workspace — inclusive de outro projeto. O card mostra o nome da página, o projeto de origem e
uma faixa com a cor do projeto. Troque o destino no seletor do painel da direita, onde as
opções aparecem agrupadas por projeto.

## Onde ficam os dados

- **Supabase Postgres** — contas, projetos, assistentes e páginas (uma linha por página,
  com os elementos em JSONB). Backup pelo painel do Supabase.
- **Supabase Storage**, bucket `uploads` — as imagens enviadas.

Uma linha por página significa que celular e computador podem editar páginas
diferentes ao mesmo tempo sem um sobrescrever o outro.

## Estrutura

```
app/
  page.tsx              entrada
  api/pages/            CRUD de páginas
  api/projects/         CRUD de projetos
  api/assistants/       CRUD de assistentes
  api/generate/         geração via Claude (opcional)
  api/login/            troca a senha por um cookie de sessão
  login/                tela de login
  api/upload/           upload de imagens
components/
  Workspace.tsx         estado, histórico, autosave, atalhos
  Canvas.tsx            stage do Konva: zoom, pan, seleção, transformação
  Shape.tsx             renderização de cada tipo de elemento
  Sidebar.tsx           projetos e páginas
  Toolbar.tsx           ferramentas
  PropertiesPanel.tsx   edição de estilo do que está selecionado
  AssistantsPage.tsx    biblioteca de prompts do projeto
  TablePage.tsx         tabela de derivações e inventário
  RunAssistantDialog.tsx  formulário, prompt final e resultado
lib/
  types.ts              tipos, template de prompt e padrão de título
  db.ts                 conexão e criação das tabelas
  store.ts              leitura e escrita no Postgres
  session.ts            cookie de sessão (roda no Edge, junto do middleware)
  password.ts           hash scrypt, sem dependência nativa
  users.ts              contas e convites
  access.ts             quem pode ver e editar cada página
middleware.ts           exige sessão em tudo, menos login e convite
scripts/
  migrate-to-cloud.mjs  leva data/workspace.json para o banco
  smoke-test.mjs        verifica o modelo de permissão de ponta a ponta
```

## No celular

A interface se adapta abaixo de 768px:

- A barra lateral vira **gaveta**, aberta pelo botão de menu e fechada ao escolher uma página
- A barra de ferramentas vai para o **rodapé**, na horizontal, com rolagem lateral
- O painel de propriedades vira uma **folha que sobe** quando você seleciona algo, e a
  barra de ferramentas sai de cena enquanto ela está aberta
- **Pinça com dois dedos** dá zoom e arrasta ao mesmo tempo, ancorada no ponto entre os dedos
- A página de assistentes empilha: a lista vira uma tira horizontal e o editor ocupa a largura
- As tabelas rolam na horizontal em vez de espremer as colunas
