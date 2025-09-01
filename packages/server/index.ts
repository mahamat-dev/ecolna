import 'dotenv/config';
import app from './src/app.ts';
import { closeDb } from './src/db/client.ts';

const port = Number(process.env.PORT || 3000);

const server = app.listen(port, () => {
   console.log(`Server is running on port ${port}`);
});

async function shutdown(signal: string) {
   console.log(`\nReceived ${signal}. Shutting down...`);
   server.close(async () => {
      try {
         await closeDb();
      } catch (e) {
         console.error('Error closing DB:', e);
      } finally {
         process.exit(0);
      }
   });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
