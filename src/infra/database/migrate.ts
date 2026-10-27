import { loadEnv } from '../../config/env';
import { createDataSource } from './data-source';

/** `npm run migrate`: applies pending migrations. `npm run migrate -- --revert` undoes the last one. */
async function main() {
  const env = loadEnv();
  const dataSource = await createDataSource({ url: env.DATABASE_URL, logging: true }).initialize();
  try {
    if (process.argv.includes('--revert')) {
      await dataSource.undoLastMigration();
      console.log('Last migration reverted');
    } else {
      const applied = await dataSource.runMigrations({ transaction: 'each' });
      console.log(
        applied.length
          ? `Applied: ${applied.map((m) => m.name).join(', ')}`
          : 'Database is up to date',
      );
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
