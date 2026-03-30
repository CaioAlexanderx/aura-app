// fix-auth-acentos.js
// Run from aura-app root: node fix-auth-acentos.js
// Converts Unicode escape sequences to real UTF-8 in auth screens

const fs = require('fs');

const FILES = [
  'app/(auth)/login.tsx',
  'app/(auth)/register.tsx',
];

// Unicode escapes found in auth files -> real characters
const ESCAPES = [
  ['\\u00e7\\u00e3o', 'ção'],     // Organização, ção
  ['\\u00f3', 'ó'],               // negócio
  ['\\u00e3', 'ã'],               // não, ã (standalone)
  ['\\u00e9', 'é'],               // é
  ['\\u00ea', 'ê'],               // você
  ['\\u00e1', 'á'],               // Grátis, já, grátis
  ['\\u00ed', 'í'],               // saída
  ['\\u00fa', 'ú'],               // único
  ['\\u00e7', 'ç'],               // começar, ç (standalone)
  ['\\u00f5', 'õ'],               // opções
  ['\\u00e2', 'â'],               // câmara
  ['\\u00f4', 'ô'],               // ô
  ['\\u00c9', 'É'],               // É (uppercase)
  ['\\u00c1', 'Á'],               // Á
  ['\\u00cd', 'Í'],               // Í
  ['\\u00d3', 'Ó'],               // Ó
  ['\\u00da', 'Ú'],               // Ú
  ['\\u00c3', 'Ã'],               // Ã
  ['\\u00d5', 'Õ'],               // Õ
  ['\\u00c7', 'Ç'],               // Ç
];

// Also fix {"\u{1F4CA}"} emoji escapes -> real emojis (optional, these work fine as escapes)
// We leave emoji escapes as-is since they render correctly

let totalChanges = 0;

for (const filePath of FILES) {
  if (!fs.existsSync(filePath)) {
    console.log(`SKIP: ${filePath} (not found)`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;
  let fileChanges = 0;

  for (const [escaped, real] of ESCAPES) {
    const count = content.split(escaped).length - 1;
    if (count > 0) {
      content = content.split(escaped).join(real);
      fileChanges += count;
    }
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`OK: ${filePath} (${fileChanges} escape sequences fixed)`);
    totalChanges += fileChanges;
  } else {
    console.log(`SKIP: ${filePath} (no escape sequences found)`);
  }
}

// Verify the result
console.log(`\nDone: ${totalChanges} Unicode escapes converted to UTF-8`);
console.log('\nVerification (should show real accents):');

for (const filePath of FILES) {
  if (!fs.existsSync(filePath)) continue;
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Check for remaining escapes
  const remaining = (content.match(/\\u00[a-f0-9]{2}/g) || []);
  if (remaining.length > 0) {
    console.log(`  WARNING: ${filePath} still has ${remaining.length} escape sequences: ${remaining.slice(0, 5).join(', ')}`);
  } else {
    console.log(`  ${filePath}: Clean - no Unicode escapes remaining`);
  }
  
  // Show sample strings
  const orgMatch = content.match(/Organiza.+Financeira/);
  if (orgMatch) console.log(`  Sample: "${orgMatch[0]}"`);
  const vocMatch = content.match(/Voc.+ fez/);
  if (vocMatch) console.log(`  Sample: "${vocMatch[0]}"`);
}

console.log('\ngit add -A && git commit -m "fix: D-02 auth screens - Unicode escapes to UTF-8" && git push');
