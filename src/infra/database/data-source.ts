import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { InitialSchema1761500000000 } from './migrations/1761500000000-InitialSchema';
import { schemas } from './schemas';

export function createDataSource(options: { url: string; logging?: boolean }): DataSource {
  return new DataSource({
    type: 'postgres',
    url: options.url,
    entities: schemas,
    migrations: [InitialSchema1761500000000],
    migrationsTableName: 'migrations',
    synchronize: false, // schema is controlled only by migrations
    logging: options.logging ?? false,
    extra: { max: 20 }, // connection pool size
  });
}
