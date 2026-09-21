// Sobe o PGlite como um servidor Postgres de verdade, para testar o app
// inteiro sem depender de banco externo.
//
//   node scripts/pglite-server.mjs
//   DATABASE_URL=postgres://postgres@127.0.0.1:5433/postgres npm run dev

import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const db = await new PGlite();
const server = new PGLiteSocketServer({ db, port: 5433, host: '127.0.0.1' });
await server.start();
console.log('pglite ouvindo em postgres://postgres@127.0.0.1:5433/postgres');

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  });
}
