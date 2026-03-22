#!/bin/bash

echo "🚀 Configurando ArtPlim ERP..."

# Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker não encontrado. Por favor, instale o Docker primeiro."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose não encontrado. Por favor, instale o Docker Compose primeiro."
    exit 1
fi

# Criar arquivo .env do backend se não existir
if [ ! -f backend/.env ]; then
    echo "📝 Criando arquivo .env do backend..."
    cp backend/.env.example backend/.env
fi

# Criar arquivo .env do frontend se não existir
if [ ! -f frontend/.env ]; then
    echo "📝 Criando arquivo .env do frontend..."
    echo "VITE_API_URL=http://localhost:3001" > frontend/.env
fi

echo "🐳 Iniciando containers Docker..."
docker-compose up -d postgres redis

echo "⏳ Aguardando PostgreSQL inicializar..."
sleep 10

echo "📦 Instalando dependências do backend..."
cd backend && npm install && cd ..

echo "📦 Instalando dependências do frontend..."
cd frontend && npm install && cd ..

echo "🗄️ Configurando banco de dados..."
cd backend && npx prisma db push && cd ..

echo "🚀 Iniciando aplicação..."
docker-compose up -d

echo ""
echo "✅ ArtPlim ERP configurado com sucesso!"
echo ""
echo "🌐 Acesse a aplicação:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:3001"
echo ""
echo "📚 Para parar a aplicação:"
echo "   docker-compose down"
echo ""
echo "🔧 Para ver os logs:"
echo "   docker-compose logs -f"
echo ""
echo "🎉 Bom trabalho!"