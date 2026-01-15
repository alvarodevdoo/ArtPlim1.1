@echo off
echo 🔧 Configurando e iniciando servidores...

REM Parar processos nas portas 3001 e 3002
echo 🛑 Parando processos nas portas 3001 e 3002...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001') do (
    echo Matando processo %%a na porta 3001
    taskkill /f /pid %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3002') do (
    echo Matando processo %%a na porta 3002
    taskkill /f /pid %%a >nul 2>&1
)

REM Aguardar um pouco para as portas serem liberadas
timeout /t 2 /nobreak >nul

REM Configurar backend para porta 3001
echo 🔧 Configurando backend para porta 3001...
cd backend
echo # Database > .env
echo DATABASE_URL="postgresql://postgres:postgres123@localhost:5433/artplim_erp?schema=public" >> .env
echo. >> .env
echo # JWT >> .env
echo JWT_SECRET="your-super-secret-jwt-key-change-in-production" >> .env
echo. >> .env
echo # Server >> .env
echo PORT=3001 >> .env
echo NODE_ENV=development >> .env
echo. >> .env
echo # CORS >> .env
echo FRONTEND_URL="http://localhost:3000" >> .env

REM Configurar frontend para porta 3001
echo 🔧 Configurando frontend para porta 3001...
cd ..\frontend
echo VITE_API_URL=http://localhost:3001 > .env

REM Voltar para raiz
cd ..

echo ✅ Configuração concluída!
echo 🚀 Iniciando servidores...
echo.
echo 📋 URLs do sistema:
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:3001
echo   Health:   http://localhost:3001/health
echo.
echo ⚠️  IMPORTANTE: Execute os comandos abaixo em terminais separados:
echo.
echo Terminal 1 (Backend):
echo   cd backend
echo   npm run dev
echo.
echo Terminal 2 (Frontend):
echo   cd frontend  
echo   npm run dev
echo.
pause