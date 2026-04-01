// fix-clientes-v2.js  
// Run from aura-app root: node fix-clientes-v2.js

const fs = require('fs');
const p = require('path');

const file = p.join('app', '(tabs)', 'clientes.tsx');
let c = fs.readFileSync(file, 'utf-8');

// The problem: filter callback is never closed. 
// Current broken code:
//   const fil=cust.filter(c=>{if(!q)return true;
//   const tot=cust.length;...  <-- this is OUTSIDE the filter but written as if inside
//
// Fix: close the filter properly and separate the variables

const broken = "  const fil=cust.filter(c=>{if(!q)return true;\n  const tot=";

if (c.includes(broken)) {
  c = c.replace(
    broken,
    "  const fil=cust.filter(c=>{if(!q)return true;const s=q.toLowerCase();return c.name.toLowerCase().includes(s)||c.phone.includes(s)||c.email.toLowerCase().includes(s)||c.instagram.toLowerCase().includes(s);});\n  const tot="
  );
  fs.writeFileSync(file, c, 'utf-8');
  console.log('OK: Filter closed properly + search logic restored');
} else {
  console.log('Pattern not found. Checking alternative...');
  // Try with different whitespace
  const alt = "const fil=cust.filter(c=>{if(!q)return true;";
  const idx = c.indexOf(alt);
  if (idx > -1) {
    const afterFilter = c.indexOf("\n", idx);
    const nextLine = c.substring(afterFilter + 1, afterFilter + 30);
    console.log('Found filter at idx ' + idx + ', next line starts with: "' + nextLine + '"');
    
    // Check if it's properly closed
    const filterLine = c.substring(idx, afterFilter);
    if (!filterLine.includes('});')) {
      c = c.substring(0, idx) + 
        "const fil=cust.filter(c=>{if(!q)return true;const s=q.toLowerCase();return c.name.toLowerCase().includes(s)||c.phone.includes(s)||c.email.toLowerCase().includes(s)||c.instagram.toLowerCase().includes(s);});" +
        c.substring(afterFilter);
      fs.writeFileSync(file, c, 'utf-8');
      console.log('OK: Fixed with alternative pattern');
    }
  }
}

console.log('Run: git add -A && git commit -m "fix: clientes.tsx filter closure" && git push');
