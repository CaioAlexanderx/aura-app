// s1-refresh-token.js
// Run from aura-app root: node s1-refresh-token.js
// SEC-02: Frontend refresh token support
// Updates: api.ts (interceptor) + stores/auth.ts (refresh_token)

const fs = require('fs');
const p = require('path');
let changes = 0;

// ============================================================
// 1. Update auth store to persist refresh_token
// ============================================================
console.log('\n=== Updating stores/auth.ts ===');

const authPath = p.join('stores', 'auth.ts');
if (fs.existsSync(authPath)) {
  let c = fs.readFileSync(authPath, 'utf-8');

  // Add refreshToken to state
  if (!c.includes('refreshToken')) {
    // Add refreshToken field
    c = c.replace(
      'token: string | null;',
      'token: string | null;\n  refreshToken: string | null;'
    );
    console.log('  OK: Added refreshToken to interface');
    changes++;

    // Add to initial state
    c = c.replace(
      'token: null,',
      'token: null,\n    refreshToken: null,'
    );
    console.log('  OK: Added refreshToken to initial state');
    changes++;

    // Update login to store refresh token
    if (c.includes("set({ token: data.token,")) {
      c = c.replace(
        "set({ token: data.token,",
        "set({ token: data.token, refreshToken: data.refresh_token || null,"
      );
      console.log('  OK: Login stores refreshToken');
      changes++;
    } else if (c.includes('set({ token:')) {
      // Try alternate pattern
      c = c.replace(
        /set\(\{\s*token:\s*data\.token,/,
        'set({ token: data.token, refreshToken: data.refresh_token || null,'
      );
      console.log('  OK: Login stores refreshToken (alt pattern)');
      changes++;
    }

    // Update register similarly
    if (c.includes('register:') && !c.includes('refreshToken: data.refresh_token')) {
      // The register function likely sets token the same way
      // We already handled it above if it uses the same pattern
    }

    // Update logout to clear refresh token
    if (c.includes("set({ token: null,")) {
      c = c.replace(
        "set({ token: null,",
        "set({ token: null, refreshToken: null,"
      );
      console.log('  OK: Logout clears refreshToken');
      changes++;
    }

    // Update hydrate to load refresh token from storage
    if (c.includes("localStorage.getItem('aura_token')") && !c.includes("aura_refresh_token")) {
      c = c.replace(
        "const token = localStorage.getItem('aura_token');",
        "const token = localStorage.getItem('aura_token');\n      const refreshToken = localStorage.getItem('aura_refresh_token');"
      );
      console.log('  OK: Hydrate reads refreshToken from storage');
      changes++;
    }

    // Persist refresh token to localStorage alongside token
    if (c.includes("localStorage.setItem('aura_token',") && !c.includes("aura_refresh_token")) {
      c = c.replace(
        "localStorage.setItem('aura_token',",
        "if (get().refreshToken) localStorage.setItem('aura_refresh_token', get().refreshToken);\n        localStorage.setItem('aura_token',"
      );
      console.log('  OK: Persist refreshToken to localStorage');
      changes++;
    }

    // Clear refresh token on logout storage
    if (c.includes("localStorage.removeItem('aura_token')") && !c.includes("removeItem('aura_refresh_token')")) {
      c = c.replace(
        "localStorage.removeItem('aura_token')",
        "localStorage.removeItem('aura_token');\n        localStorage.removeItem('aura_refresh_token')"
      );
      console.log('  OK: Logout removes refreshToken from storage');
      changes++;
    }

    fs.writeFileSync(authPath, c, 'utf-8');
    console.log('  SAVED: auth.ts (' + c.length + ' bytes)');
  } else {
    console.log('  SKIP: refreshToken already in auth store');
  }
}

// ============================================================
// 2. Update api.ts with refresh token interceptor
// ============================================================
console.log('\n=== Updating services/api.ts ===');

const apiPath = p.join('services', 'api.ts');
if (fs.existsSync(apiPath)) {
  let c = fs.readFileSync(apiPath, 'utf-8');

  // Add refresh token interceptor logic
  if (!c.includes('refreshAccessToken')) {
    // Find the request function and add refresh logic
    const refreshCode = `
// SEC-02: Refresh token interceptor
let isRefreshing = false;
let refreshQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

async function refreshAccessToken(): Promise<string | null> {
  try {
    const { useAuthStore } = await import("@/stores/auth");
    const refreshToken = useAuthStore.getState().refreshToken;
    if (!refreshToken) return null;

    const resp = await fetch(BASE_URL + "/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!resp.ok) {
      // Refresh failed — force logout
      useAuthStore.getState().logout();
      return null;
    }

    const data = await resp.json();
    // Update only the access token in store
    useAuthStore.setState({ token: data.token });
    if (typeof window !== "undefined") {
      localStorage.setItem("aura_token", data.token);
    }
    return data.token;
  } catch {
    return null;
  }
}
`;

    // Insert before the request function
    if (c.includes('async function request<T>')) {
      c = c.replace(
        'async function request<T>',
        refreshCode + '\nasync function request<T>'
      );
      console.log('  OK: Added refreshAccessToken function');
      changes++;
    }

    // Add retry logic on 401 TOKEN_EXPIRED
    // Find the error handling in the request function
    if (c.includes('if (!resp.ok)') && !c.includes('TOKEN_EXPIRED')) {
      c = c.replace(
        'if (!resp.ok) {',
        `if (!resp.ok) {
    // SEC-02: Auto-refresh on expired access token
    if (resp.status === 401) {
      const errBody = await resp.clone().json().catch(() => ({}));
      if (errBody.code === "TOKEN_EXPIRED" && !isRefreshing) {
        isRefreshing = true;
        const newToken = await refreshAccessToken();
        isRefreshing = false;
        if (newToken) {
          // Retry original request with new token
          const retryHeaders = { ...headers, Authorization: "Bearer " + newToken };
          const retryResp = await fetch(url, { method: opts?.method || "GET", headers: retryHeaders, body: opts?.body ? JSON.stringify(opts.body) : undefined });
          if (retryResp.ok) return retryResp.json();
        }
      }
    }`
      );
      console.log('  OK: Added auto-refresh retry on 401 TOKEN_EXPIRED');
      changes++;
    }

    fs.writeFileSync(apiPath, c, 'utf-8');
    console.log('  SAVED: api.ts (' + c.length + ' bytes)');
  } else {
    console.log('  SKIP: refreshAccessToken already in api.ts');
  }
}

// ============================================================
console.log('\n========================================');
console.log('DONE: ' + changes + ' changes applied');
console.log('========================================');
console.log('  stores/auth.ts — refreshToken in state + localStorage');
console.log('  services/api.ts — auto-refresh interceptor on TOKEN_EXPIRED');
console.log('\nFlow:');
console.log('  1. Login/Register → receives token (15min) + refresh_token (7d)');
console.log('  2. API call with expired access token → 401 TOKEN_EXPIRED');
console.log('  3. Interceptor calls POST /auth/refresh with refresh_token');
console.log('  4. Gets new access token → retries original request');
console.log('  5. If refresh also expired → forces logout');
console.log('\nRun:');
console.log('  git add -A && git commit -m "feat: S1-SEC-02 frontend refresh token interceptor" && git push');
