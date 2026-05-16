import { runMigrations } from './migrate';

runMigrations()
  .then(() => { console.log('All migrations applied.'); process.exit(0); })
  .catch((e) => { console.error(e.message); process.exit(1); });
