# Script para corrigir configuração de portas
Write-Host "🔧 Corrigindo configuração de portas..." -ForegroundColor Cyan

# Função para matar processos em uma porta específica
function Kill-ProcessOnPort {
    param([int]$Port)
    
    try {
        $processes = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
        if ($processes) {
            foreach ($pid in $processes) {
                Write-Host "🛑 Matando processo $pid na porta $Port" -ForegroundColor Yellow
                Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            }
            Write-Host "✅ Porta $Port liberada" -ForegroundColor Green
        } else {
            Write-Host "ℹ️  Porta $Port já está livre" -ForegroundColor Gray
        }
    } catch {
        Write-Host "ℹ️  Porta $Port já está livre" -ForegroundColor Gray
    }
}

# Liberar portas 3001 e 3002
Write-Host "🛑 Liberando portas..." -ForegroundColor Yellow
Kill-ProcessOnPort -Port 3001
Kill-ProcessOnPort -Port 3002

# Aguardar um pouco
Start-Sleep -Seconds 1

# Configurar backend para porta 3001
Write-Host "🔧 Configurando backend para porta 3001..." -ForegroundColor Green
$backendEnv = @"
# Database
DATABASE_URL="postgresql://postgres:postgres123@localhost:5433/artplim_erp?schema=public"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-in-production"

# Server
PORT=3001
NODE_ENV=development

# CORS
FRONTEND_URL="http://localhost:3000"
"@

$backendEnv | Out-File -FilePath "backend\.env" -Encoding UTF8 -Force

# Configurar frontend para porta 3001
Write-Host "🔧 Configurando frontend para porta 3001..." -ForegroundColor Green
$frontendEnv = "VITE_API_URL=http://localhost:3001"
$frontendEnv | Out-File -FilePath "frontend\.env" -Encoding UTF8 -Force

Write-Host ""
Write-Host "✅ Configuração concluída!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Configuração aplicada:" -ForegroundColor White
Write-Host "  Backend:  Porta 3001 (backend\.env)" -ForegroundColor Gray
Write-Host "  Frontend: Conecta na porta 3001 (frontend\.env)" -ForegroundColor Gray
Write-Host ""
Write-Host "🚀 Agora você pode iniciar os servidores:" -ForegroundColor Cyan
Write-Host ""
Write-Host "Terminal 1 (Backend):" -ForegroundColor White
Write-Host "  cd backend" -ForegroundColor Gray
Write-Host "  npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "Terminal 2 (Frontend):" -ForegroundColor White
Write-Host "  cd frontend" -ForegroundColor Gray
Write-Host "  npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "🌐 URLs do sistema:" -ForegroundColor White
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor Gray
Write-Host "  Backend:  http://localhost:3001" -ForegroundColor Gray
Write-Host "  Health:   http://localhost:3001/health" -ForegroundColor Gray