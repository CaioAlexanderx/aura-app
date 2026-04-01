// fix-clientes-syntax.js
// Run from aura-app root: node fix-clientes-syntax.js
// Fixes: handleExportCSV/handleImportCSV inserted inside .filter() callback

const fs = require('fs');
const p = require('path');

const file = p.join('app', '(tabs)', 'clientes.tsx');
let c = fs.readFileSync(file, 'utf-8');

// 1. Remove the misplaced functions from inside the filter
const badStart = '  const fil=cust.filter(c=>{if(!q)\n  function handleExportCSV()';
const badEnd = '}\n\nreturn true;';

if (c.includes('const fil=cust.filter(c=>{if(!q)\n  function handleExportCSV')) {
  // Extract the broken section and rebuild
  const filterStart = c.indexOf('const fil=cust.filter(c=>{if(!q)\n  function handleExportCSV');
  const returnTrue = c.indexOf('return true;', filterStart);
  const afterReturn = c.indexOf('\n', returnTrue);

  // The original filter line should be:
  // const fil=cust.filter(c=>{if(!q)return true;const s=q.toLowerCase();...
  const afterFunctions = c.substring(afterReturn);
  const beforeFilter = c.substring(0, filterStart);

  // Rebuild with correct filter + functions placed before filter
  const fixedFunctions = `
  function handleExportCSV() {
    if (Platform.OS === "web") {
      const header = "Nome,Telefone,Email,Instagram,Aniversario,LTV\\n";
      const rows = cust.map(cc => [cc.name, cc.phone || "", cc.email || "", cc.instagram || "", cc.birthday || "", cc.totalSpent || ""].join(",")).join("\\n");
      const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "clientes_aura_" + new Date().toISOString().slice(0,10) + ".csv";
      link.click();
    }
  }

  function handleImportCSV() {
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".csv,.xlsx,.xls";
      input.onchange = (ev: any) => {
        const f = ev.target?.files?.[0];
        if (f) { alert("Arquivo " + f.name + " recebido!"); }
      };
      input.click();
    }
  }

`;

  c = beforeFilter + fixedFunctions + '  const fil=cust.filter(c=>{if(!q)return true;' + afterFunctions.replace(/^return true;/, '');

  console.log('OK: Removed misplaced functions from filter');
} else {
  console.log('SKIP: Pattern not found (maybe already fixed)');
}

// 2. Also check estoque.tsx for the same issue
const estoqueFile = p.join('app', '(tabs)', 'estoque.tsx');
if (fs.existsSync(estoqueFile)) {
  let e = fs.readFileSync(estoqueFile, 'utf-8');
  // Check if estoque has the same problem (functions inside a callback)
  if (e.includes('function handleExportCSV') && e.includes('function handleImportCSV')) {
    console.log('OK: Estoque has export/import functions (verify placement manually if errors)');
  }
}

fs.writeFileSync(file, c, 'utf-8');
console.log('\nDONE. Run:');
console.log('  git add -A && git commit -m "fix: clientes.tsx syntax - move export/import out of filter callback" && git push');
