#!/bin/bash

echo "🔄 Aguardando PostgreSQL..."

# Aguardar PostgreSQL estar pronto
until pg_isready -h postgres -p 5432 -U postgres; do
  echo "⏳ PostgreSQL não está pronto - aguardando..."
  sleep 2
done

echo "✅ PostgreSQL está pronto!"

echo "🔄 Gerando Prisma Client com binary targets corretos..."
./node_modules/.bin/prisma generate

echo "🔄 Sincronizando banco de dados..."
./node_modules/.bin/prisma db push --accept-data-loss

echo "🚀 Iniciando aplicação..."
pnpm run dev