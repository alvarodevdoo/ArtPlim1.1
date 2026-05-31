#!/usr/bin/env node
/**
 * Deploy de producao com backup automatico.
 *
 * Fluxo:
 *   1. Detecta se o container do Postgres ja existe e esta rodando.
 *   2. Se sim, gera pg_dump em ./backups/backup_YYYYMMDD_HHMM.sql ANTES de qualquer alteracao.
 *      (Pula gracefulmente se for o primeiro deploy e o container nao existir ainda.)
 *   3. Roda `docker compose ... up -d --build`.
 *
 * Variaveis opcionais (.env.prod ou ambiente):
 *   SKIP_BACKUP=1   -> pula o backup (use com cuidado).
 *   BACKUP_DIR=...  -> diretorio onde salvar (default: ./backups).
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const COMPOSE_FILE = 'docker-compose.prod.yml';
const ENV_FILE = '.env.prod';
const POSTGRES_SERVICE = 'postgres';

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: ROOT, shell: false, ...opts });
  return r.status ?? 1;
}

function capture(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: ROOT, shell: false, encoding: 'utf-8' });
  return { code: r.status ?? 1, stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim() };
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);
  const out = {};
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx === -1) continue;
    const key = t.slice(0, idx).trim();
    let val = t.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function ts() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function postgresContainerRunning() {
  const r = capture('docker', [
    'compose', '-f', COMPOSE_FILE, '--env-file', ENV_FILE,
    'ps', '--status', 'running', '--services'
  ]);
  if (r.code !== 0) return false;
  return r.stdout.split(/\r?\n/).map(s => s.trim()).includes(POSTGRES_SERVICE);
}

function backup(env) {
  if (process.env.SKIP_BACKUP === '1' || env.SKIP_BACKUP === '1') {
    console.log('[deploy] SKIP_BACKUP=1 -> pulando backup.');
    return;
  }
  if (!postgresContainerRunning()) {
    console.log('[deploy] Container do Postgres nao esta rodando (provavel primeiro deploy). Pulando backup.');
    return;
  }

  const pgUser = env.POSTGRES_USER || 'postgres';
  const pgDb = env.POSTGRES_DB || 'artplim_erp';
  const backupDir = path.resolve(ROOT, env.BACKUP_DIR || process.env.BACKUP_DIR || 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const outFile = path.join(backupDir, `backup_${ts()}.sql`);

  console.log(`[deploy] Fazendo backup do Postgres em ${outFile} ...`);
  const fd = fs.openSync(outFile, 'w');
  const r = spawnSync('docker', [
    'compose', '-f', COMPOSE_FILE, '--env-file', ENV_FILE,
    'exec', '-T', POSTGRES_SERVICE,
    'pg_dump', '-U', pgUser, pgDb,
  ], { cwd: ROOT, stdio: ['ignore', fd, 'inherit'] });
  fs.closeSync(fd);

  if (r.status !== 0) {
    console.error('[deploy] FALHA no pg_dump. Abortando deploy para nao arriscar.');
    try {
      const stat = fs.statSync(outFile);
      if (stat.size === 0) fs.unlinkSync(outFile);
    } catch {}
    process.exit(r.status ?? 1);
  }

  const size = fs.statSync(outFile).size;
  if (size < 1024) {
    console.error(`[deploy] Backup gerado parece vazio/corrompido (${size} bytes). Abortando.`);
    process.exit(1);
  }
  console.log(`[deploy] Backup OK (${(size / 1024 / 1024).toFixed(2)} MB).`);
}

function deploy() {
  console.log('[deploy] docker compose up -d --build ...');
  const code = run('docker', [
    'compose', '-f', COMPOSE_FILE, '--env-file', ENV_FILE,
    'up', '-d', '--build',
  ]);
  if (code !== 0) process.exit(code);
}

(function main() {
  const env = readEnvFile(path.resolve(ROOT, ENV_FILE));
  backup(env);
  deploy();
  console.log('[deploy] Concluido.');
})();
