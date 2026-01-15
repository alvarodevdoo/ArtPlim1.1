const { execSync } = require('child_process');

const PORT = process.env.PORT || 3001;

function killProcessOnPort(port) {
  try {
    if (process.platform === 'win32') {
      const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      const lines = result.split('\n').filter(line => line.includes('LISTENING'));
      
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0') {
          try {
            execSync(`taskkill /f /pid ${pid}`, { stdio: 'ignore' });
            console.log(`🛑 Porta ${port} liberada (PID: ${pid})`);
          } catch (e) {
            // Processo já finalizado
          }
        }
      });
    } else {
      try {
        const pid = execSync(`lsof -ti:${port}`, { encoding: 'utf8' }).trim();
        if (pid) {
          execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
          console.log(`🛑 Porta ${port} liberada (PID: ${pid})`);
        }
      } catch (e) {
        // Porta já livre
      }
    }
  } catch (error) {
    // Porta já livre
  }
}

function checkDockerServices() {
  try {
    console.log('🔍 Verificando serviços Docker...');
    
    // Verificar se os containers estão rodando
    const result = execSync('docker ps --format "table {{.Names}}"', { encoding: 'utf8' });
    const runningContainers = result.split('\n').map(line => line.trim()).filter(Boolean);
    
    const requiredServices = ['artplim_postgres', 'artplim_redis'];
    const missingServices = requiredServices.filter(service => 
      !runningContainers.some(container => container.includes(service))
    );
    
    if (missingServices.length > 0) {
      console.log('🚀 Iniciando serviços necessários...');
      execSync('docker-compose up -d postgres redis', { 
        stdio: 'inherit',
        cwd: process.cwd().replace('\\backend', '')
      });
      console.log('✅ Serviços Docker iniciados');
      
      // Aguardar alguns segundos para os serviços iniciarem
      console.log('⏳ Aguardando inicialização dos serviços...');
      setTimeout(() => {
        console.log('✅ Serviços prontos');
      }, 3000);
    } else {
      console.log('✅ Todos os serviços Docker estão rodando');
    }
  } catch (error) {
    console.log('⚠️  Erro ao verificar Docker:', error.message);
    console.log('💡 Certifique-se de que o Docker está instalado e rodando');
  }
}

console.log(`🔍 Verificando porta ${PORT}...`);
killProcessOnPort(PORT);
console.log(`✅ Porta ${PORT} está livre`);

checkDockerServices();