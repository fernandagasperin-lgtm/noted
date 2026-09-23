// Sobe o app contra um Postgres descartavel (PGlite), para experimentar na
// tela sem tocar no banco de verdade.
//
//   node scripts/pglite-server.mjs   (num terminal)
//   node scripts/dev-test.mjs        (noutro)

import { spawn } from 'node:child_process';

process.env.DATABASE_URL = 'postgres://postgres@127.0.0.1:5433/postgres';
process.env.PG_POOL_MAX = '1';
process.env.APP_SECRET = 'segredo-so-de-teste-nao-usar-em-producao';
process.env.SETUP_CODE = 'teste';

spawn('npx', ['next', 'dev'], { stdio: 'inherit', shell: true, env: process.env });
