#!/usr/bin/env node
/**
 * dev:reset — zera o ambiente de DESENVOLVIMENTO do zero.
 *
 * Faz, em sequência (somente no docker-compose.dev.yml):
 *   1. down -v  → derruba containers e APAGA o volume do Postgres (dados de dev)
 *   2. up -d    → sobe Postgres/Redis/etc. limpos
 *   3. aguarda o Postgres ficar "healthy"
 *   4. prisma db push → recria o schema (este projeto não usa migrate no dev)
 *   5. seed     → recria organização + usuário admin
 *
 * NÃO toca em produção (compose/volume/containers de prod são separados).
 */
const { execSync } = require('node:child_process');

const DEV_COMPOSE = ['-f', 'docker-compose.dev.yml', '--env-file', '.env.dev'];
const PG_CONTAINER = 'artplim_postgres_dev';

function run(cmd, opts = {}) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', ...opts });
}

function waitForPostgres(timeoutMs = 60000) {
  const start = Date.now();
  process.stdout.write('⏳ Aguardando Postgres ficar saudável');
  while (Date.now() - start < timeoutMs) {
    try {
      const status = execSync(
        `docker inspect --format "{{.State.Health.Status}}" ${PG_CONTAINER}`,
        { stdio: ['ignore', 'pipe', 'ignore'] }
      ).toString().trim();
      if (status === 'healthy') {
        console.log('\n✅ Postgres saudável.');
        return;
      }
    } catch {
      // container ainda não existe / sem healthcheck — segue tentando
    }
    process.stdout.write('.');
    execSync(process.platform === 'win32' ? 'powershell -Command "Start-Sleep -Seconds 2"' : 'sleep 2');
  }
  throw new Error(`Postgres não ficou saudável em ${timeoutMs / 1000}s.`);
}

(function main() {
  console.log('🧨 dev:reset — isto APAGA todos os dados de DESENVOLVIMENTO.');
  const compose = DEV_COMPOSE.join(' ');

  run(`docker compose ${compose} down -v`);
  run(`docker compose ${compose} up -d`);
  waitForPostgres();
  run('pnpm exec prisma db push', { cwd: 'backend' });
  run('pnpm exec tsx scripts/seed-ArtPlim.ts', { cwd: 'backend' });

  console.log('\n🏁 Ambiente de dev recriado. Login: admin@artplim.com.br / admin123');
})();
