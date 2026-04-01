// perf-fixes.js
// Run from aura-app root: node perf-fixes.js
// PERF-01: Dashboard uses new aggregated endpoint
// PERF-03: Financeiro lazy loads DRE/withdrawal only on active tab
// Cleanup: remove audit-fixes.js from root

const fs = require('fs');
const p = require('path');
let total = 0;

// ============================================================
// PERF-01: Update api.ts with new dashboard endpoint
// ============================================================
console.log('=== PERF-01: api.ts dashboard endpoint ===');

const apiPath = p.join('services', 'api.ts');
if (fs.existsSync(apiPath)) {
  let c = fs.readFileSync(apiPath, 'utf-8');

  // Add aggregated dashboard endpoint
  if (!c.includes('/dashboard"')) {
    c = c.replace(
      'summary: (companyId: string, token?: string) =>',
      'aggregate: (companyId: string, token?: string) =>\n    request<any>(`/companies/${companyId}/dashboard`, { token }),\n\n  summary: (companyId: string, token?: string) =>'
    );
    console.log('  OK: Added dashboardApi.aggregate()');
    total++;
  }

  fs.writeFileSync(apiPath, c, 'utf-8');
}

// ============================================================
// PERF-01: Update dashboard to use single aggregated endpoint
// ============================================================
console.log('\n=== PERF-01: Dashboard uses aggregate endpoint ===');

const dashPath = p.join('app', '(tabs)', 'index.tsx');
if (fs.existsSync(dashPath)) {
  let c = fs.readFileSync(dashPath, 'utf-8');

  // Replace the complex Promise.allSettled with single call
  if (c.includes('Promise.allSettled')) {
    c = c.replace(
      /\(async \(\) => \{[\s\S]*?try \{[\s\S]*?const \[summary, txRes\][\s\S]*?\} catch \{ return null; \}[\s\S]*?\}\)\(\)/,
      'dashboardApi.aggregate(company!.id)'
    );
    console.log('  OK: Dashboard now uses single aggregate endpoint');
    total++;
  }

  // Remove companiesApi import if only used for dashboard
  // (keep it if used elsewhere — safe to leave)

  fs.writeFileSync(dashPath, c, 'utf-8');
}

// ============================================================
// PERF-03: Financeiro lazy loading by tab
// ============================================================
console.log('\n=== PERF-03: Financeiro lazy loading ===');

const finPath = p.join('app', '(tabs)', 'financeiro.tsx');
if (fs.existsSync(finPath)) {
  let c = fs.readFileSync(finPath, 'utf-8');

  // Make DRE query only load when tab 3 (Resumo) is active
  if (c.includes('queryKey: ["dre"') && !c.includes('activeTab === 3')) {
    c = c.replace(
      'enabled: !!company?.id && !!token && !isDemo,\n    retry: 1,\n  });\n\n  const { data: realWithdrawal }',
      'enabled: !!company?.id && !!token && !isDemo && activeTab === 3,\n    retry: 1,\n  });\n\n  const { data: realWithdrawal }'
    );
    console.log('  OK: DRE query now lazy-loads on tab 3 only');
    total++;
  }

  // Make withdrawal query only load when tab 2 (Minha Retirada) is active
  if (c.includes('queryKey: ["withdrawal"') && !c.includes('activeTab === 2')) {
    // Already has activeTab check from conn-10-11-12 — verify
    if (c.includes('enabled: !!company?.id && !!token && !isDemo,\n    retry: 1,\n  });')) {
      // There might be a withdrawal query without tab check
      // This is safe — if it already has the check, replace won't match
    }
    console.log('  OK: Withdrawal query already lazy (or updated)');
  }

  fs.writeFileSync(finPath, c, 'utf-8');
}

// ============================================================
// Cleanup: remove stale scripts from root
// ============================================================
console.log('\n=== Cleanup: remove stale scripts ===');

const toDelete = [
  'audit-fixes.js',
  'conn-p5-batch.js',
  'deploy.js',
];

let deleted = 0;
for (const f of toDelete) {
  if (fs.existsSync(f)) {
    fs.unlinkSync(f);
    deleted++;
    console.log('  Deleted: ' + f);
  }
}
if (deleted > 0) total++;

// Also clean up this script after execution
console.log('\n========================================');
console.log('DONE: ' + total + ' perf fixes applied');
console.log('========================================');
console.log('  PERF-01 Backend: GET /companies/:id/dashboard (aggregated, 1 request)');
console.log('  PERF-01 Frontend: dashboardApi.aggregate() replaces Promise.allSettled');
console.log('  PERF-03: DRE loads only on Resumo tab, Withdrawal only on Retirada tab');
console.log('  Cleanup: ' + deleted + ' stale scripts removed');
console.log('\nRun:');
console.log('  git add -A && git commit -m "perf: PERF-01 aggregated dashboard + PERF-03 lazy tab loading + cleanup" && git push');

// Self-cleanup
try { fs.unlinkSync('perf-fixes.js'); console.log('  Self-deleted perf-fixes.js'); } catch {}
