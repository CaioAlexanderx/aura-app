// fix-logos.js
// Run from aura-app root: node fix-logos.js

const fs = require('fs');
const p = require('path');
let total = 0;

// 1. Fix sidebar logo
const layout = p.join('app', '(tabs)', '_layout.tsx');
if (fs.existsSync(layout)) {
  let c = fs.readFileSync(layout, 'utf-8');
  
  // Print context around logo for debugging
  const idx = c.indexOf('resizeMode="contain"');
  if (idx > -1) {
    const before = c.substring(Math.max(0, idx - 100), idx + 30);
    console.log('Layout logo context: ...' + before + '...');
  }

  // The actual pattern: style={{ width: 100, height: 36 }} resizeMode="contain"
  // Or after previous fix: width: 120, height: 44
  if (c.includes('width: 100, height: 36')) {
    c = c.replace('width: 100, height: 36', 'width: 140, height: 50');
    fs.writeFileSync(layout, c, 'utf-8');
    console.log('OK: Sidebar logo 100x36 -> 140x50');
    total++;
  } else if (c.includes('width: 120, height: 44')) {
    c = c.replace('width: 120, height: 44', 'width: 140, height: 50');
    fs.writeFileSync(layout, c, 'utf-8');
    console.log('OK: Sidebar logo 120x44 -> 140x50');
    total++;
  } else if (c.includes('width: 130, height: 48')) {
    c = c.replace('width: 130, height: 48', 'width: 140, height: 50');
    fs.writeFileSync(layout, c, 'utf-8');
    console.log('OK: Sidebar logo 130x48 -> 140x50');
    total++;
  } else {
    console.log('WARN: Sidebar logo pattern not found');
  }
}

// 2. Fix login logo
const login = p.join('app', '(auth)', 'login.tsx');
if (fs.existsSync(login)) {
  let c = fs.readFileSync(login, 'utf-8');
  
  // Find all img width patterns
  const widthMatches = c.match(/width: \d+, height: "auto"/g);
  console.log('Login img patterns found: ' + JSON.stringify(widthMatches));
  
  // Replace img width to 320
  let changed = false;
  c = c.replace(/width: \d+, height: "auto"/g, (match) => {
    changed = true;
    return 'width: 320, height: "auto"';
  });
  if (changed) {
    fs.writeFileSync(login, c, 'utf-8');
    console.log('OK: Login logo -> 320px');
    total++;
  }
}

// 3. Fix register logo
const reg = p.join('app', '(auth)', 'register.tsx');
if (fs.existsSync(reg)) {
  let c = fs.readFileSync(reg, 'utf-8');
  let changed = false;
  c = c.replace(/width: \d+, height: "auto"/g, (match) => {
    changed = true;
    return 'width: 320, height: "auto"';
  });
  if (changed) {
    fs.writeFileSync(reg, c, 'utf-8');
    console.log('OK: Register logo -> 320px');
    total++;
  }
}

console.log('\nDONE: ' + total + ' changes');
console.log('git add -A && git commit -m "fix: logo sizing sidebar + auth" && git push');
