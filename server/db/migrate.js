import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import dotenv from 'dotenv';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

dotenv.config({ path: path.join(repoRoot, '.env') });

const getClientConfig = () => {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }

  return {
    host: process.env.POSTGRES_HOST ?? '127.0.0.1',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    database: process.env.POSTGRES_DB ?? 'digital_retail',
    user: process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD ?? 'postgres'
  };
};

const readSqlFile = async (filename) => {
  const filePath = path.join(__dirname, filename);
  return fs.readFile(filePath, 'utf8');
};

const assertTablesExist = async (client) => {
  const expectedTables = [
    'businesses',
    'stores',
    'users',
    'store_employees',
    'catalog',
    'products',
    'inventory_batches',
    'transactions',
    'transaction_items',
    'payments',
    'expiry_alerts'
  ];

  const { rows } = await client.query(
    `
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename = ANY($1::text[])
    `,
    [expectedTables]
  );

  const existingTables = new Set(rows.map((row) => row.tablename));
  const missingTables = expectedTables.filter((table) => !existingTables.has(table));

  if (missingTables.length > 0) {
    throw new Error(`Missing expected tables after migration: ${missingTables.join(', ')}`);
  }
};

const main = async () => {
  const client = new Client(getClientConfig());

  try {
    console.log('Connecting to PostgreSQL...');
    await client.connect();

    console.log('Applying schema.sql...');
    const schemaSql = await readSqlFile('schema.sql');
    await client.query(schemaSql);

    console.log('Applying seed_catalog.sql...');
    const seedSql = await readSqlFile('seed_catalog.sql');
    await client.query(seedSql);

    await assertTablesExist(client);

    console.log('Database migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
};

await main();

