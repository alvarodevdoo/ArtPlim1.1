const { execSync } = require('child_process');

const PORT = process.env.PORT || 3001;

function killProcessOnPort(port) {
  try {
    // Windows
    if (process.platform === 'win32') {
      const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      const lines = result.split('\n').filter(line => line.includes('LISTENING'));
      
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0') {
          try {
            execSync(`taskkill /f /pid ${pid}`, { stdio: 'ignore' });
            console.log(`🛑 Processo ${pid} na porta ${port} foi finalizado`);
          } catch (e) {
            // Processo já pode ter sido finalizado
          }
        }
      });
    } else {
      // Linux/Mac
      try {
        const pid = execSync(`lsof -ti:${port}`, { encoding: 'utf8' }).trim();
        if (pid) {
          execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
          console.log(`🛑 Processo ${pid} na porta ${port} foi finalizado`);
        }
      } catch (e) {
        // Porta já está livre
      }
    }
  } catch (error) {
    // Porta já está livre ou erro ao verificar
  }
}

console.log(`🔍 Verificando porta ${PORT}...`);
killProcessOnPort(PORT);
console.log(`✅ Porta ${PORT} está livre`);