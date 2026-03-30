// fix-screen-bg.js
// Run from the aura-app root: node fix-screen-bg.js
// Changes backgroundColor: Colors.bg to "transparent" on screen root styles
// Does NOT touch Colors.bg2, bg3, bg4 (used by cards/sidebar)

const fs = require('fs');
const path = require('path');

const files = [
  'app/(tabs)/financeiro.tsx',
  'app/(tabs)/pdv.tsx',
  'app/(tabs)/estoque.tsx',
  'app/(tabs)/clientes.tsx',
  'app/(tabs)/contabilidade.tsx',
];

let totalChanges = 0;

files.forEach(file => {
  const fullPath = path.resolve(file);
  if (!fs.existsSync(fullPath)) {
    console.log(`SKIP: ${file} (not found)`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf-8');
  
  // Match backgroundColor: Colors.bg but NOT Colors.bg2, bg3, bg4, bgScreen etc
  // Handles both spaced and compressed formats:
  //   backgroundColor: Colors.bg
  //   backgroundColor:Colors.bg
  //   backgroundColor: Colors.bg,
  //   backgroundColor:Colors.bg}
  const regex = /backgroundColor:\s*Colors\.bg(?=[,}\s\)])/g;
  const matches = content.match(regex);
  
  if (matches && matches.length > 0) {
    content = content.replace(regex, 'backgroundColor: "transparent"');
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`OK: ${file} (${matches.length} change${matches.length > 1 ? 's' : ''})`);
    totalChanges += matches.length;
  } else {
    console.log(`SKIP: ${file} (no Colors.bg found)`);
  }
});

console.log(`\nDone! ${totalChanges} changes across ${files.length} files.`);
console.log('Run: git add -A && git commit -m "polish: transparent screen backgrounds for global gradient" && git push origin main');
