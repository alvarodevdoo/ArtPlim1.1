#!/usr/bin/env node
/**
 * Detecta arquivos de rota órfãos no backend.
 *
 * Um arquivo de rota é considerado "órfão" quando nenhuma de suas
 * funções/classes exportadas é importada em outro arquivo do projeto.
 *
 * Execução: node scripts/check-orphan-routes.js
 * Sai com código 1 se encontrar órfãos (útil para CI).
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, '..', 'src');
const ROUTE_FILE_PATTERN = /\.routes\.ts$/;
const EXPORT_PATTERN = /^export\s+(?:async\s+)?(?:function|class|const)\s+([A-Za-z_][\w$]*)/gm;

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      walk(full, files);
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

function getExports(file) {
  const content = fs.readFileSync(file, 'utf8');
  const names = [];
  let match;
  while ((match = EXPORT_PATTERN.exec(content)) !== null) {
    names.push(match[1]);
  }
  return names;
}

function isImportedAnywhere(name, routeFile, allFiles) {
  // Procura por importações do símbolo em qualquer arquivo .ts que não seja o próprio
  const importRegex = new RegExp(`\\b${name}\\b`);
  for (const file of allFiles) {
    if (file === routeFile) continue;
    if (!file.endsWith('.ts')) continue;
    const content = fs.readFileSync(file, 'utf8');
    if (importRegex.test(content)) return true;
  }
  return false;
}

function main() {
  const allFiles = walk(SRC_DIR);
  const routeFiles = allFiles.filter(f => ROUTE_FILE_PATTERN.test(f));
  const orphans = [];

  for (const routeFile of routeFiles) {
    const exports = getExports(routeFile);
    if (exports.length === 0) continue;
    const anyUsed = exports.some(name => isImportedAnywhere(name, routeFile, allFiles));
    if (!anyUsed) {
      orphans.push({ file: routeFile, exports });
    }
  }

  if (orphans.length === 0) {
    console.log('OK: nenhum arquivo de rota orfao encontrado.');
    process.exit(0);
  }

  console.error('Arquivos de rota orfaos detectados:');
  for (const { file, exports } of orphans) {
    const rel = path.relative(SRC_DIR, file);
    console.error(`  - src/${rel}  (exporta: ${exports.join(', ')})`);
  }
  console.error('\nDelete-os ou registre suas funcoes no fluxo de inicializacao.');
  process.exit(1);
}

main();
