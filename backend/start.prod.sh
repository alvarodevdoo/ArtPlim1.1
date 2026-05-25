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

echo "Sincronizando schema do banco (prisma db push)..."
./node_modules/.bin/prisma db push --accept-data-loss

echo "Iniciando servidor (modo producao)..."
node dist/server.js
