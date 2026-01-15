# Script para configurar e iniciar os servidores corretamente
Write-Host "🔧 Configurando e iniciando servidores..." -ForegroundColor Cyan

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
        }
    } catch {
        # Porta não está em uso, tudo bem
    }
}

# Parar processos nas portas 3001 e 3002
Write-Host "🛑 Liberando portas 3001 e 3002..." -ForegroundColor Yellow
Kill-ProcessOnPort -Port 3001
Kill-ProcessOnPort -Port 3002

# Aguardar um pouco para as portas serem liberadas
Start-Sleep -Seconds 2

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

$backendEnv | Out-File -FilePath "backend\.env" -Encoding UTF8

# Configurar frontend para porta 3001
Write-Host "🔧 Configurando frontend para porta 3001..." -ForegroundColor Green
$frontendEnv = "VITE_API_URL=http://localhost:3001"
$frontendEnv | Out-File -FilePath "frontend\.env" -Encoding UTF8

Write-Host "✅ Configuração concluída!" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Iniciando servidores..." -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 URLs do sistema:" -ForegroundColor White
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor Gray
Write-Host "  Backend:  http://localhost:3001" -ForegroundColor Gray
Write-Host "  Health:   http://localhost:3001/health" -ForegroundColor Gray
Write-Host ""

# Verificar se npm está disponível
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "❌ NPM não encontrado! Instale o Node.js primeiro." -ForegroundColor Red
    exit 1
}

# Iniciar backend em background
Write-Host "🔄 Iniciando backend..." -ForegroundColor Blue
$backendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD\backend
    npm run dev
}

# Aguardar um pouco para o backend iniciar
Start-Sleep -Seconds 5

# Verificar se backend está rodando
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ Backend iniciado com sucesso!" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Backend ainda não está respondendo, mas continuando..." -ForegroundColor Yellow
}

# Iniciar frontend em background
Write-Host "🔄 Iniciando frontend..." -ForegroundColor Blue
$frontendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD\frontend
    npm run dev
}

# Aguardar um pouco para o frontend iniciar
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "🎉 Servidores iniciados!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Status dos Jobs:" -ForegroundColor White
Write-Host "Backend Job ID: $($backendJob.Id)" -ForegroundColor Gray
Write-Host "Frontend Job ID: $($frontendJob.Id)" -ForegroundColor Gray
Write-Host ""
Write-Host "🔍 Para ver os logs:" -ForegroundColor White
Write-Host "  Backend:  Receive-Job $($backendJob.Id) -Keep" -ForegroundColor Gray
Write-Host "  Frontend: Receive-Job $($frontendJob.Id) -Keep" -ForegroundColor Gray
Write-Host ""
Write-Host "🛑 Para parar os servidores:" -ForegroundColor White
Write-Host "  Stop-Job $($backendJob.Id), $($frontendJob.Id)" -ForegroundColor Gray
Write-Host "  Remove-Job $($backendJob.Id), $($frontendJob.Id)" -ForegroundColor Gray
Write-Host ""
Write-Host "🌐 Acesse: http://localhost:3000" -ForegroundColor Cyan

# Manter o script rodando para monitorar os jobs
Write-Host "Pressione Ctrl+C para parar todos os servidores..." -ForegroundColor Yellow
try {
    while ($true) {
        Start-Sleep -Seconds 10
        
        # Verificar se os jobs ainda estão rodando
        if ($backendJob.State -eq "Failed") {
            Write-Host "❌ Backend falhou!" -ForegroundColor Red
            Receive-Job $backendJob
        }
        if ($frontendJob.State -eq "Failed") {
            Write-Host "❌ Frontend falhou!" -ForegroundColor Red
            Receive-Job $frontendJob
        }
    }
} finally {
    Write-Host "🛑 Parando servidores..." -ForegroundColor Yellow
    Stop-Job $backendJob, $frontendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob, $frontendJob -ErrorAction SilentlyContinue
    Write-Host "✅ Servidores parados!" -ForegroundColor Green
}