import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

const poolConfig = env.DATABASE_URL
  ? { connectionString: env.DATABASE_URL }
  : {
      host: env.POSTGRES_HOST,
      port: env.POSTGRES_PORT,
      database: env.POSTGRES_DB,
      user: env.POSTGRES_USER,
      password: env.POSTGRES_PASSWORD
    };

export const pool = new Pool(poolConfig);

export const checkPostgresConnection = async () => {
  const client = await pool.connect();

  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
};

export const closePostgresConnection = async () => {
  await pool.end();
};

