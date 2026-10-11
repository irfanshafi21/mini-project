// Creates the tables: npm run db:init
import 'dotenv/config';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const sql = fs.readFileSync(fileURLToPath(new URL('../sql/schema.sql', import.meta.url)), 'utf8');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query(sql);
await client.end();
console.log('Database ready: table "questions" created.');
