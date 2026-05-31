#!/bin/bash
set -e

echo "Aguardando PostgreSQL em $POSTGRES_HOST:$POSTGRES_PORT..."
until pg_isready -h "${POSTGRES_HOST:-postgres}" -p "${POSTGRES_PORT:-5432}" -U "${POSTGRES_USER:-postgres}"; do
  echo "PostgreSQL ainda nao esta pronto - aguardando..."
  sleep 2
done
echo "PostgreSQL pronto."

echo "Gerando Prisma Client..."
./node_modules/.bin/prisma generate

# ============================================================
# Estrategia de migracao (SEGURA, sem perda de dados):
#
# - Usa `prisma migrate deploy`, que aplica APENAS o SQL exato de cada
#   arquivo em prisma/migrations/. Nada destrutivo automatico: o operador
#   revisa o SQL antes de commitar. Sem `--accept-data-loss`.
#
# - Na primeira execucao em ambientes que vinham usando `db push`, faz
#   BASELINE: marca todas as migrations existentes como ja aplicadas,
#   pois o schema do banco ja esta em sincronia. Migrations NOVAS,
#   adicionadas depois deste deploy, sao aplicadas automaticamente.
#
# Modo manual de escape (envs):
#   FORCE_BASELINE=1   -> forca rebaseline (cuidado).
#   SKIP_MIGRATIONS=1  -> nao toca no banco; so sobe o servidor.
# ============================================================

PG_HOST="${POSTGRES_HOST:-postgres}"
PG_PORT="${POSTGRES_PORT:-5432}"
PG_USER="${POSTGRES_USER:-postgres}"
PG_DB="${POSTGRES_DB:-artplim_erp}"

if [ "${SKIP_MIGRATIONS}" = "1" ]; then
  echo "SKIP_MIGRATIONS=1 -> pulando todas as etapas de schema."
else
  export PGPASSWORD="${POSTGRES_PASSWORD:-}"

  HAS_MIG_TABLE=$(psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -tAc \
    "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_prisma_migrations'" \
    2>/dev/null | tr -d '[:space:]' || echo "")

  if [ "$HAS_MIG_TABLE" != "1" ] || [ "${FORCE_BASELINE}" = "1" ]; then
    echo ""
    echo "=================================================================="
    echo "BASELINE de migrations (primeira execucao com migrate deploy)."
    echo "O banco vinha sendo mantido em sincronia via db push; estamos"
    echo "registrando o historico de migrations sem executar SQL antigo."
    echo "=================================================================="

    # Aplica SQL ADITIVO que possivelmente esta faltando porque db push
    # antigo foi pulado. Tudo idempotente (IF NOT EXISTS): nao apaga,
    # nao renomeia, nao altera tipo de coluna existente.
    echo "Aplicando ajustes aditivos idempotentes..."
    psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" <<'EOSQL' || true
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "subdomain" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Organization_subdomain_key" ON "organizations"("subdomain");
EOSQL

    echo "Marcando migrations existentes como aplicadas (baseline)..."
    for dir in prisma/migrations/*/; do
      name=$(basename "$dir")
      [ -f "$dir/migration.sql" ] || continue
      echo "  baseline: $name"
      ./node_modules/.bin/prisma migrate resolve --applied "$name" \
        2>&1 | grep -vE "is already recorded as applied|P3008" || true
    done
    echo ""
  fi

  echo "Aplicando migrations pendentes (prisma migrate deploy)..."
  ./node_modules/.bin/prisma migrate deploy
fi

echo "Iniciando servidor (modo producao)..."
node dist/server.js
