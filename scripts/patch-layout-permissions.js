#!/usr/bin/env node
// Patch _layout.tsx to use external useVisibleModules hook
// Run: node scripts/patch-layout-permissions.js

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'app', '(tabs)', '_layout.tsx');
let content = fs.readFileSync(file, 'utf-8');

// 1. Add import for the new hook (after last import line)
if (!content.includes('useVisibleModules') || !content.includes('hooks/useVisibleModules')) {
  // Find the last import line
  const importLines = content.match(/^import .+$/gm);
  const lastImport = importLines[importLines.length - 1];
  content = content.replace(
    lastImport,
    lastImport + '\nimport { useVisibleModules } from "@/hooks/useVisibleModules";'
  );
  console.log('Added import for useVisibleModules hook');
}

// 2. Remove inline MODULE_PLAN_MAP constant
const mapRegex = /const MODULE_PLAN_MAP[\s\S]*?\};\n/;
if (mapRegex.test(content)) {
  content = content.replace(mapRegex, '');
  console.log('Removed inline MODULE_PLAN_MAP');
}

// 3. Remove inline PLAN_LEVEL constant  
const levelRegex = /const PLAN_LEVEL[^;]*;\n/;
if (levelRegex.test(content)) {
  content = content.replace(levelRegex, '');
  console.log('Removed inline PLAN_LEVEL');
}

// 4. Remove inline useVisibleModules function
const funcRegex = /function useVisibleModules\(\)[\s\S]*?\n\}\n/;
if (funcRegex.test(content)) {
  content = content.replace(funcRegex, '');
  console.log('Removed inline useVisibleModules function');
}

fs.writeFileSync(file, content, 'utf-8');

// Verify
const final = fs.readFileSync(file, 'utf-8');
const hasImport = final.includes('hooks/useVisibleModules');
const hasInline = final.includes('function useVisibleModules');
console.log('');
console.log(hasImport ? 'Import: OK' : 'WARN: import not found');
console.log(hasInline ? 'WARN: inline function still exists' : 'Inline removed: OK');
console.log('');
console.log('Patch applied! Now run:');
console.log('  git add . && git commit -m "feat: use external useVisibleModules with member permissions" && git push');
