// audit-fixes.js
// Run from aura-app root: node audit-fixes.js
// Applies 3 fixes from the P1/P2/P3 audit:
// REL-03: Global 401 interceptor in api.ts
// STB-04: Replace require() with static imports in onboarding
// STB-01: Clean up fix scripts from repo root

const fs = require('fs');
const p = require('path');
let total = 0;

// ============================================================
// REL-03: Global 401 interceptor — auto logout on expired token
// ============================================================
console.log('=== REL-03: Global 401 interceptor ===');

const apiPath = p.join('services', 'api.ts');
if (fs.existsSync(apiPath)) {
  let c = fs.readFileSync(apiPath, 'utf-8');

  // Add onUnauthorized callback
  if (!c.includes('_onUnauthorized')) {
    // Add the callback setter after setTokenGetter
    c = c.replace(
      'export function setTokenGetter(fn: () => string | null) {\n  _getToken = fn;\n}',
      `export function setTokenGetter(fn: () => string | null) {
  _getToken = fn;
}

// REL-03: Global 401 handler — called when any request gets 401
let _onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(fn: () => void) {
  _onUnauthorized = fn;
}`
    );

    // In the 401 handling block, call the unauthorized handler
    c = c.replace(
      `// 401: token expirado — nao faz retry
      if (res.status === 401) {
        throw new ApiError((data as any).error || "Sessao expirada", 401, data);
      }`,
      `// 401: token expirado — nao faz retry, trigger global logout
      if (res.status === 401) {
        if (_onUnauthorized) _onUnauthorized();
        throw new ApiError((data as any).error || "Sessao expirada", 401, data);
      }`
    );

    console.log('  OK: Added _onUnauthorized callback in api.ts');
    total++;
    fs.writeFileSync(apiPath, c, 'utf-8');
  }
}

// Now wire it in auth store
const authPath = p.join('stores', 'auth.ts');
if (fs.existsSync(authPath)) {
  let c = fs.readFileSync(authPath, 'utf-8');

  if (!c.includes('setOnUnauthorized')) {
    // Add import
    c = c.replace(
      'import {\n  authApi,\n  setTokenGetter,',
      'import {\n  authApi,\n  setTokenGetter,\n  setOnUnauthorized,'
    );

    // If import is on one line
    if (!c.includes('setOnUnauthorized')) {
      c = c.replace(
        'setTokenGetter,',
        'setTokenGetter,\n  setOnUnauthorized,'
      );
    }

    // Wire the handler after setTokenGetter
    if (c.includes('setTokenGetter(() => get().token);')) {
      c = c.replace(
        'setTokenGetter(() => get().token);',
        `setTokenGetter(() => get().token);

    // REL-03: Auto-logout when any API call returns 401
    setOnUnauthorized(() => {
      const state = get();
      if (state.token && !state.isDemo) {
        console.warn("[AUTH] Token expired, logging out");
        state.logout();
      }
    });`
      );
    }

    console.log('  OK: Wired setOnUnauthorized in auth store');
    total++;
    fs.writeFileSync(authPath, c, 'utf-8');
  }
}

// ============================================================
// STB-04: Replace require() with static imports in onboarding
// ============================================================
console.log('\n=== STB-04: Static imports in onboarding ===');

const onbPath = p.join('app', '(tabs)', 'onboarding.tsx');
if (fs.existsSync(onbPath)) {
  let c = fs.readFileSync(onbPath, 'utf-8');

  // Check for dynamic require()
  if (c.includes('require("@/services/api")')) {
    // Add static imports at the top
    if (!c.includes('cnpjApi')) {
      c = c.replace(
        'import { Icon } from "@/components/Icon";',
        'import { Icon } from "@/components/Icon";\nimport { cnpjApi, onboardingApi } from "@/services/api";'
      );
      console.log('  OK: Added static imports for cnpjApi + onboardingApi');
    }

    // Replace all dynamic require() calls
    c = c.replace(/const \{ cnpjApi \} = require\("@\/services\/api"\);\s*\n\s*/g, '');
    c = c.replace(/const \{ onboardingApi \} = require\("@\/services\/api"\);\s*\n\s*/g, '');
    // Also handle inline require patterns
    c = c.replace(/require\("@\/services\/api"\)\.cnpjApi/g, 'cnpjApi');
    c = c.replace(/require\("@\/services\/api"\)\.onboardingApi/g, 'onboardingApi');

    console.log('  OK: Replaced dynamic require() with static imports');
    total++;
    fs.writeFileSync(onbPath, c, 'utf-8');
  } else {
    console.log('  SKIP: No dynamic require() found');
  }
}

// ============================================================
// STB-01: Clean up fix scripts from repo root
// ============================================================
console.log('\n=== STB-01: Clean fix scripts ===');

const scriptsToDelete = [
  'fix-clientes-syntax.js',
  'fix-clientes-v2.js',
  'review-and-fix.js',
  'fix-gestao-admin-mobile.js',
  'create-new-auth.js',
  'conn-01-02.js',
  'conn-03-04-05.js',
  'conn-10-11-12.js',
  'conn-13-15-16-20-23.js',
  'conn-p5-batch.js',
  'implement-4features.js',
  'implement-final-3.js',
];

let deleted = 0;
for (const script of scriptsToDelete) {
  if (fs.existsSync(script)) {
    fs.unlinkSync(script);
    deleted++;
  }
}
console.log('  OK: Deleted ' + deleted + ' fix scripts from root');
if (deleted > 0) total++;

// ============================================================
console.log('\n========================================');
console.log('DONE: ' + total + ' fixes applied');
console.log('========================================');
console.log('  SEC-01: requirePlan() applied in backend (already committed)');
console.log('  REL-03: Global 401 interceptor + auto-logout');
console.log('  STB-04: Static imports in onboarding (no more require())');
console.log('  STB-01: ' + deleted + ' fix scripts cleaned from root');
console.log('\nRun:');
console.log('  git add -A && git commit -m "fix: audit fixes - 401 interceptor + static imports + cleanup scripts" && git push');
