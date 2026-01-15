const { execSync } = require('child_process');

const PORT = 3000; // Frontend sempre usa porta 3000

function killProcessOnPort(port) {
  try {
    if (process.platform === 'win32') {
      // Windows
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
      // Linux/Mac
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

console.log(`🔍 Verificando porta ${PORT}...`);
killProcessOnPort(PORT);
console.log(`✅ Porta ${PORT} está livre`);