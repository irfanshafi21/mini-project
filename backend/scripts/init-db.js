import { classifyBloom } from '../src/blooms.js';
// Creates the tables: npm run db:init
import 'dotenv/config';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const sql = fs.readFileSync(fileURLToPath(new URL('../sql/schema.sql', import.meta.url)), 'utf8');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query(sql);
const legacy=(await client.query('SELECT id,subject,text FROM questions WHERE bloom_level IS NULL')).rows;
for(const row of legacy)await client.query('UPDATE questions SET bloom_level=$1 WHERE id=$2 AND subject=$3',[classifyBloom(row.text),row.id,row.subject]);
await client.end();
console.log('Database ready: table "questions" created.');
