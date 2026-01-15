@echo off
echo 🚀 Configurando ArtPlim ERP...

REM Verificar se Docker está instalado
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker não encontrado. Por favor, instale o Docker primeiro.
    pause
    exit /b 1
)

docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker Compose não encontrado. Por favor, instale o Docker Compose primeiro.
    pause
    exit /b 1
)

REM Verificar se pnpm está instalado
pnpm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 📚 Instalando pnpm...
    npm install -g pnpm
)

REM Criar arquivo .env do backend se não existir
if not exist backend\.env (
    echo 📝 Criando arquivo .env do backend...
    copy backend\.env.example backend\.env
)

REM Criar arquivo .env do frontend se não existir
if not exist frontend\.env (
    echo 📝 Criando arquivo .env do frontend...
    echo VITE_API_URL=http://localhost:3001 > frontend\.env
)

echo 🐳 Iniciando containers Docker...
docker-compose up -d postgres redis

echo ⏳ Aguardando PostgreSQL inicializar...
timeout /t 10 /nobreak >nul

echo 📦 Instalando dependências do backend...
cd backend
pnpm install
cd ..

echo 📦 Instalando dependências do frontend...
cd frontend
pnpm install
cd ..

echo 🗄️ Configurando banco de dados...
cd backend
pnpx prisma db push
cd ..

echo 🚀 Iniciando aplicação...
docker-compose up -d

echo.
echo ✅ ArtPlim ERP configurado com sucesso!
echo.
echo 🌐 Acesse a aplicação:
echo    Frontend: http://localhost:3000
echo    Backend:  http://localhost:3001
echo.
echo 📚 Para parar a aplicação:
echo    docker-compose down
echo.
echo 🔧 Para ver os logs:
echo    docker-compose logs -f
echo.
echo 🎉 Bom trabalho!
pause