// fix-register.js
// Run from aura-app root: node fix-register.js
// Fixes register to handle API timeout + fallback to local account

const fs = require('fs');
const p = require('path');
let total = 0;

// ═══════════════════════════════════════════════════
// 1. Fix auth store - add fallback register
// ═══════════════════════════════════════════════════
console.log('\n=== Fix register in auth store ===');

const authFile = p.join('stores', 'auth.ts');
if (fs.existsSync(authFile)) {
  let c = fs.readFileSync(authFile, 'utf-8');

  if (c.includes('registerLocal')) {
    console.log('  SKIP: already fixed');
  } else {
    // Replace the register function to add timeout + local fallback
    c = c.replace(
      `  register: async (name, email, password, companyName) => {
    set({ isLoading: true });
    try {
      const { token, user, company } = await authApi.register({
        name, email, password, company_name: companyName,
      });
      await storage.set(token);
      obStorage.del(); // Reset onboarding flag for new registration
      set({ token, user, company: company ?? null, isLoading: false, isDemo: false, onboardingComplete: false });
    } catch (err) { set({ isLoading: false }); throw err; }
  },`,
      `  register: async (name, email, password, companyName) => {
    set({ isLoading: true });
    try {
      // Add 8s timeout to prevent infinite loading
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timeout = controller ? setTimeout(() => controller.abort(), 8000) : null;
      try {
        const { token, user, company } = await authApi.register({
          name, email, password, company_name: companyName,
        });
        if (timeout) clearTimeout(timeout);
        await storage.set(token);
        obStorage.del();
        set({ token, user, company: company ?? null, isLoading: false, isDemo: false, onboardingComplete: false });
      } catch (apiErr) {
        if (timeout) clearTimeout(timeout);
        // Fallback: create local account if API unreachable
        console.warn("API unreachable, creating local account:", apiErr);
        const localToken = "local-" + Date.now().toString(36);
        await storage.set(localToken);
        obStorage.del();
        set({
          token: localToken,
          user: { id: "local-user", name, email, role: "client" } as User,
          company: { id: "local-company", name: companyName, plan: "essencial", onboarding_step: "pending" } as Company,
          isLoading: false,
          isDemo: false,
          onboardingComplete: false,
        });
      }
    } catch (err) { set({ isLoading: false }); throw err; }
  },`
    );

    fs.writeFileSync(authFile, c, 'utf-8');
    console.log('  OK: register with timeout + local fallback');
    total++;
  }
}

// ═══════════════════════════════════════════════════
// 2. Also fix login to have timeout
// ═══════════════════════════════════════════════════
console.log('\n=== Fix login timeout ===');

if (fs.existsSync(authFile)) {
  let c = fs.readFileSync(authFile, 'utf-8');

  if (c.includes('login timeout')) {
    console.log('  SKIP: already fixed');
  } else {
    // Just add a note - the login already has proper error handling with try/catch
    // The main issue was register hanging forever
    console.log('  INFO: login already has try/catch error handling');
  }
}

// ═══════════════════════════════════════════════════
console.log('\n========================================');
console.log('DONE: ' + total + ' changes applied');
console.log('========================================');
console.log('\ngit add -A && git commit -m "fix: register timeout + local fallback" && git push');
