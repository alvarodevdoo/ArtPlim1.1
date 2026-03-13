import { readFileSync } from 'fs';
import pg from 'pg';

const envContent = readFileSync('.env', 'utf-8');
const dbUrlLine = envContent.split('\n').find(l => l.startsWith('DATABASE_URL'));
const dbUrl = dbUrlLine.split('=').slice(1).join('=').trim().replace(/^"|"$/g, '');

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();
await client.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS "localFormulaId" TEXT');
console.log('Coluna localFormulaId adicionada com sucesso!');
await client.end();
