// perf-dashboard.js
// Run from aura-app root: node perf-dashboard.js
// Updates dashboard to use dashboardApi.aggregate() instead of multiple calls

const fs = require('fs');
const p = require('path');

const dashPath = p.join('app', '(tabs)', 'index.tsx');
let c = fs.readFileSync(dashPath, 'utf-8');
let changes = 0;

// 1. Fix import: ensure dashboardApi is imported (remove companiesApi if unused here)
if (c.includes('import { dashboardApi, companiesApi }')) {
  c = c.replace('import { dashboardApi, companiesApi }', 'import { dashboardApi }');
  console.log('OK: Simplified import (removed unused companiesApi)');
  changes++;
} else if (!c.includes('dashboardApi')) {
  c = c.replace(
    'import { Colors }',
    'import { dashboardApi } from "@/services/api";\nimport { Colors }'
  );
  console.log('OK: Added dashboardApi import');
  changes++;
}

// 2. Replace the useQuery queryFn
// Find the current queryFn pattern and replace with aggregate
const patterns = [
  // Pattern A: Promise.allSettled
  /queryFn:\s*\(\)\s*=>\s*\(async\s*\(\)\s*=>\s*\{[\s\S]*?\}\)\(\)/,
  // Pattern B: dashboardApi.summary(company!.id, token!)
  /queryFn:\s*\(\)\s*=>\s*dashboardApi\.summary\(company!\.id,?\s*token!?\)/,
  // Pattern C: dashboardApi.summary(company!.id)
  /queryFn:\s*\(\)\s*=>\s*dashboardApi\.summary\(company!\.id\)/,
];

let replaced = false;
for (const pat of patterns) {
  if (pat.test(c)) {
    c = c.replace(pat, 'queryFn: () => dashboardApi.aggregate(company!.id)');
    console.log('OK: Replaced queryFn with dashboardApi.aggregate()');
    changes++;
    replaced = true;
    break;
  }
}

if (!replaced) {
  console.log('WARN: Could not find queryFn pattern to replace. Manual check needed.');
  // Show what's around useQuery
  const idx = c.indexOf('useQuery');
  if (idx > -1) {
    console.log('  Context around useQuery:', c.substring(idx, idx + 200));
  }
}

fs.writeFileSync(dashPath, c, 'utf-8');
console.log('\nTotal changes: ' + changes);
console.log('Run: git add -A && git commit -m "perf: dashboard uses aggregate endpoint" && git push');
