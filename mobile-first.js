// mobile-first.js
// Run from aura-app root: node mobile-first.js
// FE-MR-01: Mobile-first responsive review

const fs = require('fs');
const p = require('path');
let total = 0;

// ═══════════════════════════════════════════════════
// 1. Fix Layout - detect screen width on web for mobile vs desktop
// ═══════════════════════════════════════════════════
console.log('\n=== FIX 1: Layout mobile detection ===');

const layout = p.join('app', '(tabs)', '_layout.tsx');
if (fs.existsSync(layout)) {
  let c = fs.readFileSync(layout, 'utf-8');

  // Add useScreenWidth hook for responsive web detection
  if (!c.includes('useScreenWidth')) {
    const hookCode = `
function useScreenWidth() {
  const [width, setWidth] = useState(Platform.OS === "web" ? (typeof window !== "undefined" ? window.innerWidth : 1024) : 375);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return width;
}
`;
    c = c.replace('function isA(', hookCode + 'function isA(');
    console.log('  OK: useScreenWidth hook added');
    total++;
  }

  // In TabsLayout, use screen width instead of Platform.OS to decide layout
  if (c.includes('const w = Platform.OS === "web";') && !c.includes('isDesktop')) {
    c = c.replace(
      'const w = Platform.OS === "web";',
      'const screenW = useScreenWidth();\n  const w = Platform.OS === "web";\n  const isDesktop = w && screenW > 768;'
    );

    // Fix onboarding web check
    c = c.replace(
      'if (w && token && !onboardingComplete) return (\n    <div style={{ display: "flex", flexDirection: "row", height: "100vh", width: "100%", background: C.bg, position: "relative" } as any}>\n      <div key={themeKey} style={{ flex: 1, minHeight: "100%", background: grad, overflow: "auto", position: "relative" } as any}>\n        <ToastContainer />\n        <OnboardingScreen />\n      </div>\n    </div>\n  );',
      'if (w && token && !onboardingComplete) return (\n    <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100%", background: grad, position: "relative", overflow: "auto" } as any}>\n      <ToastContainer />\n      <OnboardingScreen />\n    </div>\n  );'
    );

    // Main web layout - use isDesktop for sidebar decision
    c = c.replace(
      'if (w) return (\n    <div style={{ display: "flex", flexDirection: "row", height: "100vh", width: "100%", background: C.bg, position: "relative" } as any}>\n      <Sidebar />\n      <div key={themeKey} style={{ flex: 1, minHeight: "100%", background: grad, overflow: "auto", position: "relative" } as any}>\n        <ToastContainer />\n        <PageTransition><Slot /></PageTransition>\n      </div>\n    </div>\n  );',
      'if (w && isDesktop) return (\n    <div style={{ display: "flex", flexDirection: "row", height: "100vh", width: "100%", background: C.bg, position: "relative" } as any}>\n      <Sidebar />\n      <div key={themeKey} style={{ flex: 1, minHeight: "100%", background: grad, overflow: "auto", position: "relative" } as any}>\n        <ToastContainer />\n        <PageTransition><Slot /></PageTransition>\n      </div>\n    </div>\n  );\n\n  if (w && !isDesktop) return (\n    <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100%", background: grad, position: "relative" } as any}>\n      <div key={themeKey} style={{ flex: 1, overflow: "auto", position: "relative" } as any}>\n        <ToastContainer />\n        <PageTransition><Slot /></PageTransition>\n      </div>\n      <MBar />\n    </div>\n  );'
    );

    fs.writeFileSync(layout, c, 'utf-8');
    console.log('  OK: Layout now detects screen width - mobile web gets MBar');
    total++;
  }

  // Add mobile items to MORE_ITEMS
  let c2 = fs.readFileSync(layout, 'utf-8');
  if (c2.includes('MORE_ITEMS') && !c2.includes('{ r: "/whatsapp"')) {
    c2 = c2.replace(
      '{ r: "/configuracoes"',
      '{ r: "/whatsapp", l: "WhatsApp", ic: "star" },\n  { r: "/canal", l: "Canal Digital", ic: "bar_chart" },\n  { r: "/agentes", l: "Agentes", ic: "star" },\n  { r: "/suporte", l: "Seu Analista", ic: "star" },\n  { r: "/configuracoes"'
    );
    fs.writeFileSync(layout, c2, 'utf-8');
    console.log('  OK: Added mobile nav items (WhatsApp, Canal, Agentes, Suporte)');
    total++;
  } else {
    // Check if whatsapp is already in MORE_ITEMS
    if (c2.includes('MORE_ITEMS') && c2.indexOf('/whatsapp') > c2.indexOf('MORE_ITEMS')) {
      console.log('  SKIP: Mobile nav items already present');
    }
  }
}

// ═══════════════════════════════════════════════════
// 2. Fix helpers.ts - make IS_WIDE reactive
// ═══════════════════════════════════════════════════
console.log('\n=== FIX 2: helpers.ts note ===');
console.log('  INFO: IS_WIDE is static (evaluated once at import). Individual screens');
console.log('        should use their own width checks for truly responsive behavior.');
console.log('        The layout fix (useScreenWidth) handles the critical sidebar/MBar switch.');

// ═══════════════════════════════════════════════════
// 3. Fix Suporte - hero card responsive
// ═══════════════════════════════════════════════════
console.log('\n=== FIX 3: Suporte mobile ===');

const suporte = p.join('app', '(tabs)', 'suporte.tsx');
if (fs.existsSync(suporte)) {
  let c = fs.readFileSync(suporte, 'utf-8');
  if (c.includes('heroStats: { flexDirection: "row"') && !c.includes('IS_WIDE ? "row"')) {
    c = c.replace(
      'heroStats: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 0 }',
      'heroStats: { flexDirection: IS_WIDE ? "row" : "column", alignItems: "center", marginTop: 8, gap: IS_WIDE ? 0 : 12 }'
    );
    c = c.replace(
      'heroStatDivider: { width: 1, height: 32, backgroundColor: Colors.border }',
      'heroStatDivider: { width: IS_WIDE ? 1 : "60%", height: IS_WIDE ? 32 : 1, backgroundColor: Colors.border }'
    );
    fs.writeFileSync(suporte, c, 'utf-8');
    console.log('  OK: Suporte hero stats stack on mobile');
    total++;
  } else {
    console.log('  SKIP: already responsive or pattern not found');
  }
}

// ═══════════════════════════════════════════════════
// 4. Fix WhatsApp - campaign stats wrap
// ═══════════════════════════════════════════════════
console.log('\n=== FIX 4: WhatsApp mobile ===');

const whats = p.join('app', '(tabs)', 'whatsapp.tsx');
if (fs.existsSync(whats)) {
  let c = fs.readFileSync(whats, 'utf-8');
  if (c.includes('campStats: { flexDirection: "row", gap: 16 }')) {
    c = c.replace(
      'campStats: { flexDirection: "row", gap: 16 }',
      'campStats: { flexDirection: "row", gap: IS_WIDE ? 16 : 8, flexWrap: "wrap" }'
    );
    fs.writeFileSync(whats, c, 'utf-8');
    console.log('  OK: WhatsApp campaign stats wrap');
    total++;
  } else {
    console.log('  SKIP: pattern not found');
  }
}

// ═══════════════════════════════════════════════════
// 5. Fix Canal Digital - color dots + nav wrap
// ═══════════════════════════════════════════════════
console.log('\n=== FIX 5: Canal Digital mobile ===');

const canal = p.join('app', '(tabs)', 'canal.tsx');
if (fs.existsSync(canal)) {
  let c = fs.readFileSync(canal, 'utf-8');
  let changed = false;
  if (c.includes('colorDot: { width: 32, height: 32, borderRadius: 16 }')) {
    c = c.replace(
      'colorDot: { width: 32, height: 32, borderRadius: 16 }',
      'colorDot: { width: IS_WIDE ? 32 : 28, height: IS_WIDE ? 32 : 28, borderRadius: IS_WIDE ? 16 : 14 }'
    );
    changed = true;
  }
  if (c.includes('previewNav: { flexDirection: "row", gap: 16 }')) {
    c = c.replace(
      'previewNav: { flexDirection: "row", gap: 16 }',
      'previewNav: { flexDirection: "row", gap: IS_WIDE ? 16 : 8, flexWrap: "wrap" }'
    );
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(canal, c, 'utf-8');
    console.log('  OK: Canal Digital responsive');
    total++;
  } else {
    console.log('  SKIP: patterns not found');
  }
}

// ═══════════════════════════════════════════════════
// 6. Fix Agentes - activity time column
// ═══════════════════════════════════════════════════
console.log('\n=== FIX 6: Agentes mobile ===');

const agentes = p.join('app', '(tabs)', 'agentes.tsx');
if (fs.existsSync(agentes)) {
  let c = fs.readFileSync(agentes, 'utf-8');
  if (c.includes('actTime: { fontSize: 10, color: Colors.ink3, minWidth: 80, textAlign: "right" }')) {
    c = c.replace(
      'actTime: { fontSize: 10, color: Colors.ink3, minWidth: 80, textAlign: "right" }',
      'actTime: { fontSize: 10, color: Colors.ink3, minWidth: IS_WIDE ? 80 : 60, textAlign: "right" }'
    );
    fs.writeFileSync(agentes, c, 'utf-8');
    console.log('  OK: Agentes activity time responsive');
    total++;
  }
}

// ═══════════════════════════════════════════════════
console.log('\n========================================');
console.log('DONE: ' + total + ' mobile fixes applied');
console.log('========================================');
console.log('\nRun:');
console.log('  node scripts/fix-unicode-all.js');
console.log('  git add -A && git commit -m "feat: FE-MR-01 mobile-first responsive"');
console.log('  git push origin main');
