// P2 #13: Remove Nuvem Fiscal references from nfe.tsx
// Run: node scripts/fix-nuvem-fiscal.js
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app', '(tabs)', 'nfe.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace all references
const replacements = [
  ['Empresa registrada na Nuvem Fiscal!', 'Empresa registrada com sucesso!'],
  ['1. Registrar empresa na Nuvem Fiscal', '1. Registrar empresa no provedor fiscal'],
  ['Nuvem Fiscal', 'provedor fiscal'],
];

let count = 0;
for (const [from, to] of replacements) {
  if (content.includes(from)) {
    content = content.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), to);
    count++;
    console.log(`  ✓ "${from}" → "${to}"`);
  }
}

if (count > 0) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`\n✅ ${count} substituicao(oes) feita(s) em nfe.tsx`);
} else {
  console.log('⚠️  Nenhuma referencia a Nuvem Fiscal encontrada');
}
