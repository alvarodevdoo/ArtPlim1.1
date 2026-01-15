#!/usr/bin/env node

import { spawn } from 'child_process';

// Limpar terminal antes de iniciar
console.clear();

// Executar vite dev diretamente
const vite = spawn('npx', ['vite'], { 
  stdio: 'inherit',
  shell: true 
});

vite.on('close', (code) => {
  process.exit(code);
});

// Encaminhar sinais
process.on('SIGINT', () => vite.kill('SIGINT'));
process.on('SIGTERM', () => vite.kill('SIGTERM'));