import { buildApp } from './app';

const start = async () => {
  try {
    const app = await buildApp();
    
    const port = Number(process.env.PORT) || 3001;
    const host = process.env.HOST || '0.0.0.0';
    
    await app.listen({ port, host });
    
    const displayHost = host === '0.0.0.0' ? 'localhost' : host;
    
    console.log(`🚀 Servidor rodando em http://${displayHost}:${port}`);
    console.log(`📚 Health check: http://${displayHost}:${port}/health`);
    console.log(`🔐 Auth: http://${displayHost}:${port}/auth`);
    console.log(`📊 API: http://${displayHost}:${port}/api`);
    
  } catch (err) {
    console.error('❌ Erro ao iniciar servidor:', err);
    process.exit(1);
  }
};

start();