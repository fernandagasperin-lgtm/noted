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

Os dados vivem num banco Postgres na nuvem, então mesmo local você precisa de
`DATABASE_URL` no `.env.local` (copie a connection string do painel do Neon).
Sem `APP_PASSWORD` preenchido, o local abre direto, sem pedir senha.

## Hospedagem

O app roda na Vercel com três serviços: **Neon Postgres** (dados), **Vercel Blob**
(imagens) e a **API da Anthropic** (geração). Todos têm plano gratuito para este volume.

Passo a passo, a partir de uma conta na Vercel:

1. Suba o projeto para um repositório no GitHub e importe ele na Vercel.
2. No painel do projeto, aba **Storage**, crie um banco **Neon Postgres** e um
   **Blob store**. Isso preenche `DATABASE_URL` e `BLOB_READ_WRITE_TOKEN` sozinho.
3. Em **Settings → Environment Variables**, adicione:
   - `APP_PASSWORD` — a senha para entrar no app
   - `APP_SECRET` — string aleatória longa; gere com
     `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `ANTHROPIC_API_KEY` — opcional, liga o botão "Gerar com Claude"
4. Faça o deploy. As tabelas são criadas sozinhas no primeiro acesso.

Se o app subir sem `APP_PASSWORD` e `APP_SECRET`, ele recusa todo acesso com uma
mensagem em vez de ficar aberto na internet.

### Levar os dados locais para a nuvem

Se você já usou o app localmente, copie `DATABASE_URL` para o `.env.local` e rode:

```bash
node --env-file=.env.local scripts/migrate-to-cloud.mjs
```

Pode rodar mais de uma vez — ele atualiza por id em vez de duplicar. Imagens que
ainda apontam para `/uploads/` precisam ser subidas de novo pelo app, porque o
disco local não existe na nuvem; o script avisa quando encontra alguma.

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

- **Neon Postgres** — projetos, assistentes e páginas (uma linha por página, com os
  elementos em JSONB). Backup pelo painel do Neon.
- **Vercel Blob** — as imagens enviadas.

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
  auth.ts               senha e cookie de sessão
middleware.ts           exige login em tudo, menos /login
scripts/
  migrate-to-cloud.mjs  leva data/workspace.json para o banco
```

## No celular

As páginas de texto e as tabelas funcionam bem no celular. O canvas é desktop-first
— barra lateral, quadro e painel lado a lado — e fica apertado numa tela pequena.
Adaptar isso é um trabalho à parte, ainda não feito.
