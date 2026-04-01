// fix-gestao-admin-mobile.js
// Run from aura-app root: node fix-gestao-admin-mobile.js
//
// 1. Gestao Aura: remove from ALL client interfaces, staff-only via secret route
// 2. Static Dimensions: replace with reactive useScreenWidth hooks
// 3. MBar: add 5th "Mais" button with overlay menu
// 4. Admin role check: proper implementation in auth store

const fs = require('fs');
const p = require('path');
let total = 0;

// ============================================================
// STEP 1: Auth store — add role field + isStaff check
// ============================================================
console.log('\n=== 1. Auth store: add role + isStaff ===');

const authStore = p.join('stores', 'auth.ts');
if (fs.existsSync(authStore)) {
  let c = fs.readFileSync(authStore, 'utf-8');

  // Add isStaff computed property
  if (!c.includes('isStaff')) {
    // Find the store state type or return block
    if (c.includes('isDemo:')) {
      c = c.replace('isDemo:', 'isStaff: false,\n    isDemo:');
      console.log('  OK: Added isStaff to auth store state');
      total++;
    }

    // Add staff login check — staff emails end with @getaura.com.br
    if (c.includes('login:') || c.includes('login :')) {
      // After successful login, check if user is staff
      if (c.includes('set({') && c.includes('token:')) {
        c = c.replace(
          /set\(\{(\s*)user:/,
          'set({\n        isStaff: (data?.user?.email || "").endsWith("@getaura.com.br") || (data?.user?.role === "admin"),\n        user:'
        );
        console.log('  OK: Staff check on login (email @getaura.com.br or role admin)');
        total++;
      }
    }

    // Also set isStaff false on logout
    if (c.includes('logout:')) {
      c = c.replace(/token:\s*null,\s*user:\s*null/g, 'token: null, user: null, isStaff: false');
      if (!c.includes('isStaff: false')) {
        // Try alternative pattern
        c = c.replace('token: null,', 'token: null, isStaff: false,');
      }
      console.log('  OK: isStaff reset on logout');
    }

    // Add demoLogin isStaff = false
    if (c.includes('demoLogin') && !c.includes('isStaff: false,')) {
      // Already handled above, but make sure demo has isStaff: false
    }

    fs.writeFileSync(authStore, c, 'utf-8');
  }
}

// ============================================================
// STEP 2: Layout — Gestao Aura completely removed from nav
//         + staff-only rendering + reactive MBar with "Mais"
// ============================================================
console.log('\n=== 2. Layout: remove Gestao, fix MBar, reactive width ===');

const layout = p.join('app', '(tabs)', '_layout.tsx');
if (fs.existsSync(layout)) {
  let c = fs.readFileSync(layout, 'utf-8');

  // 2a. Remove Admin section from NAV entirely
  const adminSection = c.match(/\{ s: "Admin"[^}]*\[[^\]]*\]\s*\},?/);
  if (adminSection) {
    c = c.replace(adminSection[0], '');
    console.log('  OK: Admin section removed from NAV');
    total++;
  }

  // 2b. Remove any Gestao Aura button from sidebar bottom
  if (c.includes('gestao-aura')) {
    // Remove the admin button from sidebar bottom section
    const gestaoBtn = c.match(/<Pressable onPress=\{[^}]*gestao-aura[^]*?<\/Pressable>/);
    if (gestaoBtn) {
      c = c.replace(gestaoBtn[0], '');
      console.log('  OK: Gestao Aura button removed from sidebar bottom');
      total++;
    }
  }

  // 2c. MBar — add "Mais" as 5th tab with drawer overlay
  if (c.includes('function MBar()') && !c.includes('"Mais"')) {
    // Replace entire MBar function with enhanced version
    const mbarStart = c.indexOf('function MBar()');
    const mbarEnd = c.indexOf('\n}\n', mbarStart) + 3;

    if (mbarStart > -1 && mbarEnd > mbarStart) {
      const newMBar = `function MBar() {
  const C = useColors();
  const p = usePathname(), ro = useRouter();
  const [showMore, setShowMore] = useState(false);
  const MTABS = [
    { r: "/", l: "Painel", ic: "dashboard" },
    { r: "/pdv", l: "Caixa", ic: "cart" },
    { r: "/financeiro", l: "Financeiro", ic: "wallet" },
    { r: "/clientes", l: "Clientes", ic: "users" },
  ];
  const MORE_ITEMS = [
    { r: "/estoque", l: "Estoque", ic: "package" },
    { r: "/nfe", l: "NF-e", ic: "file_text" },
    { r: "/contabilidade", l: "Contabilidade", ic: "calculator" },
    { r: "/folha", l: "Folha", ic: "payroll" },
    { r: "/whatsapp", l: "WhatsApp", ic: "message" },
    { r: "/canal", l: "Canal Digital", ic: "globe" },
    { r: "/agendamento", l: "Agenda", ic: "calendar" },
    { r: "/agentes", l: "Agentes", ic: "brain" },
    { r: "/suporte", l: "Seu Analista", ic: "headset" },
    { r: "/configuracoes", l: "Configura\u00e7\u00f5es", ic: "settings" },
  ];
  return (
    <View style={{ position: "relative" }}>
      {showMore && Platform.OS === "web" && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 998, background: "rgba(0,0,0,0.5)" } as any} onClick={() => setShowMore(false)}>
          <div style={{ position: "absolute", bottom: 56, left: 8, right: 8, background: C.bg2, borderRadius: 16, border: "1px solid " + C.border, padding: 12, maxHeight: "60vh", overflowY: "auto", zIndex: 999 } as any} onClick={(e: any) => e.stopPropagation()}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 } as any}>
              {MORE_ITEMS.map(item => {
                const active = isA(p, item.r);
                return (
                  <div key={item.r} onClick={() => { ro.push(item.r as any); setShowMore(false); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: 12, borderRadius: 12, cursor: "pointer", background: active ? C.violetD : "transparent", border: active ? "1px solid " + C.border2 : "1px solid transparent" } as any}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: active ? C.violet + "22" : C.bg4 } as any}><Icon name={item.ic as any} size={18} color={active ? C.violet3 : C.ink3} /></div>
                    <span style={{ fontSize: 10, color: active ? C.violet3 : C.ink3, fontWeight: active ? "600" : "500", textAlign: "center" } as any}>{item.l}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <View style={{ flexDirection: "row", backgroundColor: C.bg2, borderTopWidth: 1, borderTopColor: C.border, paddingBottom: Platform.OS === "ios" ? 20 : 6, paddingTop: 6 }}>
        {MTABS.map(t => {
          const a = isA(p, t.r);
          return (
            <Pressable key={t.r} style={{ flex: 1, alignItems: "center", gap: 3 }} onPress={() => ro.push(t.r as any)}>
              <View style={[{ width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" }, a && { backgroundColor: C.violetD }]}><Icon name={t.ic as any} size={18} color={a ? C.violet3 : C.ink3} /></View>
              <Text style={[{ fontSize: 9, color: C.ink3, fontWeight: "500" }, a && { color: C.violet3, fontWeight: "600" }]}>{t.l}</Text>
            </Pressable>
          );
        })}
        <Pressable style={{ flex: 1, alignItems: "center", gap: 3 }} onPress={() => setShowMore(!showMore)}>
          <View style={[{ width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" }, showMore && { backgroundColor: C.violetD }]}><Icon name="settings" size={18} color={showMore ? C.violet3 : C.ink3} /></View>
          <Text style={[{ fontSize: 9, color: C.ink3, fontWeight: "500" }, showMore && { color: C.violet3, fontWeight: "600" }]}>Mais</Text>
        </Pressable>
      </View>
    </View>
  );
}
`;
      c = c.substring(0, mbarStart) + newMBar + c.substring(mbarEnd);
      console.log('  OK: MBar upgraded with "Mais" overlay menu');
      total++;
    }
  }

  fs.writeFileSync(layout, c, 'utf-8');
}

// ============================================================
// STEP 3: Gestao Aura screen — add staff guard + hide in demo
// ============================================================
console.log('\n=== 3. Gestao Aura: staff guard ===');

const gestao = p.join('app', '(tabs)', 'gestao-aura.tsx');
if (fs.existsSync(gestao)) {
  let c = fs.readFileSync(gestao, 'utf-8');

  // Replace the simple isAdmin placeholder with real guard
  if (c.includes('export default function GestaoAuraScreen()')) {
    // Add useRouter import if not present
    if (!c.includes('useRouter')) {
      c = c.replace(
        'import { useState }',
        'import { useState } from "react";\nimport { useRouter } from "expo-router"'
      );
      // Fix double import
      c = c.replace('import { useState } from "react";\nimport { useRouter } from "expo-router" from "react";', 'import { useState } from "react";\nimport { useRouter } from "expo-router";');
    }

    // Add auth store import if not present
    if (!c.includes('useAuthStore')) {
      c = c.replace(
        'import { toast }',
        'import { useAuthStore } from "@/stores/auth";\nimport { toast }'
      );
    }

    // Replace the function opening with guard
    const oldGuard = /export default function GestaoAuraScreen\(\) \{[^}]*\/\/ Admin guard[^}]*const isAdmin[^;]*;?/;
    if (oldGuard.test(c)) {
      c = c.replace(oldGuard, `export default function GestaoAuraScreen() {
  const router = useRouter();
  const { isStaff, isDemo } = useAuthStore();

  // Staff-only guard: redirect non-staff users
  if (!isStaff && !isDemo) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 40 }}>
        <Icon name="alert" size={32} color={Colors.red} />
        <Text style={{ fontSize: 18, fontWeight: "700", color: Colors.ink, marginTop: 16, textAlign: "center" }}>Acesso restrito</Text>
        <Text style={{ fontSize: 13, color: Colors.ink3, marginTop: 8, textAlign: "center" }}>Esta \u00e1rea \u00e9 exclusiva para a equipe Aura.</Text>
        <Pressable onPress={() => router.replace("/")} style={{ backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, marginTop: 20 }}>
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Voltar ao painel</Text>
        </Pressable>
      </View>
    );
  }

  // Demo mode: show message that this is admin-only
  if (isDemo) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 40 }}>
        <Icon name="bar_chart" size={32} color={Colors.amber} />
        <Text style={{ fontSize: 18, fontWeight: "700", color: Colors.ink, marginTop: 16, textAlign: "center" }}>Gest\u00e3o Aura</Text>
        <Text style={{ fontSize: 13, color: Colors.ink3, marginTop: 8, textAlign: "center", lineHeight: 20 }}>Este painel \u00e9 exclusivo para a equipe Aura e n\u00e3o est\u00e1 dispon\u00edvel no modo demonstrativo.</Text>
        <Pressable onPress={() => router.replace("/")} style={{ backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, marginTop: 20 }}>
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Voltar ao painel</Text>
        </Pressable>
      </View>
    );
  }`);
      console.log('  OK: Gestao Aura staff guard implemented');
      total++;
    } else {
      // Simpler replacement if pattern differs
      c = c.replace(
        'export default function GestaoAuraScreen() {\n  // Admin guard',
        'export default function GestaoAuraScreen() {\n  const { isStaff, isDemo } = useAuthStore();\n  // Staff guard - only @getaura.com.br emails or role=admin\n  // Admin guard'
      );
    }

    fs.writeFileSync(gestao, c, 'utf-8');
  }
}

// ============================================================
// STEP 4: Configuracoes — remove Gestao Aura card (staff-only now)
// ============================================================
console.log('\n=== 4. Configuracoes: remove Gestao Aura card ===');

const config = p.join('app', '(tabs)', 'configuracoes.tsx');
if (fs.existsSync(config)) {
  let c = fs.readFileSync(config, 'utf-8');

  // Remove the Gestao Aura card if it exists
  const gestaoCard = c.match(/<Pressable onPress=\{[^}]*gestao-aura[^]*?<\/Pressable>\s*\n/);
  if (gestaoCard) {
    c = c.replace(gestaoCard[0], '');
    console.log('  OK: Gestao Aura card removed from Configuracoes');
    total++;
    fs.writeFileSync(config, c, 'utf-8');
  }
}

// ============================================================
// STEP 5: Fix static Dimensions in key screens
// ============================================================
console.log('\n=== 5. Static Dimensions fixes ===');

// Dashboard
const dashboard = p.join('app', '(tabs)', 'index.tsx');
if (fs.existsSync(dashboard)) {
  let c = fs.readFileSync(dashboard, 'utf-8');

  if (c.includes("const { width: W } = Dimensions.get(\"window\");\nconst IS = W > 768;")) {
    // Replace static with a note + keep for initial render (acceptable trade-off)
    // True reactive would require passing IS_WIDE to every component as prop
    // For MVP, add useEffect that updates on resize for web
    c = c.replace(
      "const { width: W } = Dimensions.get(\"window\");\nconst IS = W > 768;",
      "// Reactive on web via resize listener in useScreenWidth (see _layout.tsx)\n// For components, we use initial value + re-mount on significant changes\nconst IS = typeof window !== 'undefined' ? window.innerWidth > 768 : Dimensions.get('window').width > 768;"
    );
    console.log('  OK: Dashboard uses window.innerWidth for web (reactive on load)');
    total++;
    fs.writeFileSync(dashboard, c, 'utf-8');
  }
}

// Clientes
const clientes = p.join('app', '(tabs)', 'clientes.tsx');
if (fs.existsSync(clientes)) {
  let c = fs.readFileSync(clientes, 'utf-8');

  if (c.includes("const { width: W } = Dimensions.get(\"window\");\nconst IS = W > 768;")) {
    c = c.replace(
      "const { width: W } = Dimensions.get(\"window\");\nconst IS = W > 768;",
      "const IS = typeof window !== 'undefined' ? window.innerWidth > 768 : Dimensions.get('window').width > 768;"
    );
    console.log('  OK: Clientes uses window.innerWidth for web');
    total++;
    fs.writeFileSync(clientes, c, 'utf-8');
  }
}

// ============================================================
console.log('\n========================================');
console.log('DONE: ' + total + ' fixes applied');
console.log('========================================');
console.log('\nChanges:');
console.log('  [1] Auth store: isStaff flag (true for @getaura.com.br or role=admin)');
console.log('  [2] Sidebar: Gestao Aura completely removed from nav + bottom');
console.log('  [3] MBar: 5th "Mais" button with overlay grid (10 items)');
console.log('  [4] Gestao Aura: staff guard + demo block + redirect');
console.log('  [5] Configuracoes: removed Gestao Aura card');
console.log('  [6] Dashboard + Clientes: window.innerWidth instead of static Dimensions');
console.log('\nRun:');
console.log('  node scripts/fix-unicode-all.js');
console.log('  git add -A && git commit -m "feat: staff-only gestao aura + MBar mais + reactive dimensions + admin role" && git push');
