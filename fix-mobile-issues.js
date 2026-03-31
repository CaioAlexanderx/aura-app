// fix-mobile-issues.js
// Run from aura-app root: node fix-mobile-issues.js
// Fixes: dashboard overflow, PDV empty, vendas R$, suporte alignment,
//        AgentBanner missing, login/register mobile

const fs = require('fs');
const p = require('path');
let total = 0;

// ═══════════════════════════════════════════════════
// 1. Dashboard - "Aura facilita" overflow + Vendas Hoje R$
// ═══════════════════════════════════════════════════
console.log('\n=== FIX 1: Dashboard overflow + Vendas R$ ===');

const dash = p.join('app', '(tabs)', 'index.tsx');
if (fs.existsSync(dash)) {
  let c = fs.readFileSync(dash, 'utf-8');

  // Fix "Aura facilita, voce resolve" badge - add flexShrink and smaller font
  if (c.includes('Aura facilita')) {
    // Make the obligation badges wrap better
    c = c.replace(
      /fontSize:\s*9,\s*fontWeight:\s*"600",\s*color:\s*Colors\.amber/g,
      'fontSize: 8, fontWeight: "600", color: Colors.amber'
    );
    // Also fix the card layout to wrap text
    console.log('  OK: Reduced badge font size');
    total++;
  }

  // Fix "Vendas Hoje" - change from count to R$ value
  // Find the mock data for sales count and change to monetary
  if (c.includes('"Vendas hoje"') || c.includes('"Vendas Hoje"')) {
    c = c.replace(/"Vendas hoje",\s*v:\s*"?\d+"?/i, '"Vendas hoje", v: "R$ 1.250"');
    c = c.replace(/"Vendas Hoje",\s*v:\s*"?\d+"?/i, '"Vendas hoje", v: "R$ 1.250"');
    console.log('  OK: Vendas Hoje shows R$ value');
    total++;
  } else {
    // Try alternate pattern
    const vendas = c.match(/vendas.*?hoje/i);
    if (vendas) console.log('  INFO: Found vendas pattern: ' + vendas[0]);
    else console.log('  WARN: Vendas hoje pattern not found');
  }

  fs.writeFileSync(dash, c, 'utf-8');
}

// ═══════════════════════════════════════════════════
// 2. PDV - fix empty state on mobile (content area)
// ═══════════════════════════════════════════════════
console.log('\n=== FIX 2: PDV mobile ===');

const pdv = p.join('app', '(tabs)', 'pdv.tsx');
if (fs.existsSync(pdv)) {
  let c = fs.readFileSync(pdv, 'utf-8');

  // The PDV uses a split layout: products left, cart right
  // On mobile this needs to stack or show products first
  if (c.includes('IS_WIDE ? { flexDirection: "row"')) {
    console.log('  SKIP: PDV already has responsive check');
  } else if (c.includes('flexDirection: "row"') && c.includes('Carrinho')) {
    // Find the main split layout and make it responsive
    // The PDV likely has a fixed width cart panel
    let changed = false;

    // Fix cart panel width on mobile
    if (c.includes('width: IS_WIDE ? 340')) {
      // Already responsive
      console.log('  SKIP: Cart width already responsive');
    } else if (c.includes('width: 340') || c.includes('width: 360')) {
      c = c.replace(/width:\s*(340|360),/, 'width: IS_WIDE ? $1 : "100%",');
      changed = true;
    }

    // Make the main PDV layout stack on mobile
    if (c.includes('pdvLayout: { flexDirection: "row"')) {
      c = c.replace(
        'pdvLayout: { flexDirection: "row"',
        'pdvLayout: { flexDirection: IS_WIDE ? "row" : "column"'
      );
      changed = true;
    } else {
      // Try inline style pattern
      const pdvSplit = c.indexOf('flexDirection: "row"');
      if (pdvSplit > -1) {
        // Check context around it
        const ctx = c.substring(Math.max(0, pdvSplit - 50), pdvSplit + 50);
        console.log('  INFO: PDV split context: ' + ctx.replace(/\n/g, ' ').substring(0, 80));
      }
    }

    if (changed) {
      fs.writeFileSync(pdv, c, 'utf-8');
      console.log('  OK: PDV layout stacks on mobile');
      total++;
    }
  } else {
    console.log('  INFO: PDV structure needs manual review');
  }
}

// ═══════════════════════════════════════════════════
// 3. AgentBanner - verify injection in financeiro + clientes
// ═══════════════════════════════════════════════════
console.log('\n=== FIX 3: AgentBanner injection ===');

[
  { file: p.join('app', '(tabs)', 'financeiro.tsx'), name: 'Financeiro' },
  { file: p.join('app', '(tabs)', 'clientes.tsx'), name: 'CRM/Clientes' }
].forEach(({ file, name }) => {
  if (!fs.existsSync(file)) { console.log('  SKIP: ' + name + ' not found'); return; }
  let c = fs.readFileSync(file, 'utf-8');

  if (c.includes('AgentBanner')) {
    console.log('  OK: ' + name + ' has AgentBanner import');
    // Check if JSX is present
    if (c.includes('<AgentBanner')) {
      console.log('  OK: ' + name + ' has <AgentBanner> JSX');
    } else {
      console.log('  WARN: ' + name + ' imported but no JSX found');
    }
  } else {
    console.log('  MISSING: ' + name + ' needs AgentBanner');
    // Add import
    const lastImport = c.lastIndexOf('import ');
    const lineEnd = c.indexOf('\n', lastImport);
    const importLine = 'import { AgentBanner } from "@/components/AgentBanner";';
    c = c.slice(0, lineEnd + 1) + importLine + '\n' + c.slice(lineEnd + 1);

    // Add JSX after TabBar or PageHeader
    const tabBarIdx = c.indexOf('<TabBar');
    const pageHeaderIdx = c.indexOf('<PageHeader');
    const insertAfter = tabBarIdx > -1 ? tabBarIdx : pageHeaderIdx;

    if (insertAfter > -1) {
      const insertLineEnd = c.indexOf('\n', insertAfter);
      const insight = name === 'Financeiro'
        ? '      <AgentBanner agent="Financeiro" insight={{ title: "2 cobran\\u00e7as em atraso", desc: "Jo\\u00e3o Santos (R$ 1.240) e Carlos Lima (R$ 430) com pagamento atrasado.", actionLabel: "Enviar cobran\\u00e7a", action: "cobrar", priority: "high", icon: "alert" }} />'
        : '      <AgentBanner agent="CRM" insight={{ title: "5 anivers\\u00e1rios esta semana", desc: "Maria Silva (02/04), Pedro Costa (03/04), Ana Oliveira (05/04) e mais 2.", actionLabel: "Enviar parab\\u00e9ns", action: "aniversario", priority: "medium", icon: "users" }} />';
      c = c.slice(0, insertLineEnd + 1) + insight + '\n' + c.slice(insertLineEnd + 1);
      fs.writeFileSync(c, file);
      console.log('  OK: ' + name + ' AgentBanner injected');
      total++;
    }
  }
});

// ═══════════════════════════════════════════════════
// 4. Login/Register - fix mobile layout
// ═══════════════════════════════════════════════════
console.log('\n=== FIX 4: Login/Register mobile ===');

[p.join('app', '(auth)', 'login.tsx'), p.join('app', '(auth)', 'register.tsx')].forEach(file => {
  if (!fs.existsSync(file)) return;
  let c = fs.readFileSync(file, 'utf-8');
  const name = p.basename(file);
  let changed = false;

  // The auth screens use isWeb to decide layout
  // Problem: on web mobile, isWeb is true but screen is narrow
  // Need to add width check

  // Add screen width detection if not present
  if (!c.includes('useScreenWidth') && !c.includes('innerWidth')) {
    // Add a simple width check
    if (c.includes('const isWeb = Platform.OS === "web";') || c.includes('const isWeb=Platform.OS==="web"')) {
      // Add window width check after isWeb
      c = c.replace(
        /const isWeb\s*=\s*Platform\.OS\s*===\s*"web";?/,
        'const isWeb = Platform.OS === "web";\n  const [screenW, setScreenW] = useState(isWeb && typeof window !== "undefined" ? window.innerWidth : 1024);\n  const isWideScreen = isWeb && screenW > 768;'
      );

      // Add resize listener in useEffect
      if (!c.includes('addEventListener("resize"')) {
        // Find existing useEffect or add one
        const effectIdx = c.indexOf('useEffect(');
        if (effectIdx > -1) {
          // Add resize handler to existing effect or after it
          const effectEnd = c.indexOf('}, []);', effectIdx);
          if (effectEnd > -1) {
            c = c.slice(0, effectEnd + 7) + '\n  useEffect(() => { if (!isWeb || typeof window === "undefined") return; const h = () => setScreenW(window.innerWidth); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);' + c.slice(effectEnd + 7);
          }
        }
      }

      // Replace layout checks: use isWideScreen instead of isWeb for layout decisions
      // The two-panel layout should only show on wide screens
      c = c.replace(/isWeb\s*\?\s*\(\s*\n?\s*<div\s+style=\{\{\s*display:\s*"flex",\s*flexDirection:\s*"row"/g,
        'isWideScreen ? (\n    <div style={{ display: "flex", flexDirection: "row"');

      // Add useState import if needed
      if (c.includes('import { useEffect }') && !c.includes('useState')) {
        c = c.replace('import { useEffect }', 'import { useState, useEffect }');
      }
      if (!c.includes('useState') && c.includes('import {')) {
        // Add useState to first react import
        c = c.replace(/import \{([^}]+)\} from "react"/, (match, imports) => {
          if (!imports.includes('useState')) {
            return `import {${imports}, useState } from "react"`;
          }
          return match;
        });
      }

      changed = true;
      console.log('  OK: ' + name + ' - added width detection for mobile');
    }
  }

  // Make the logo smaller on mobile
  if (c.includes('width: 320, height: "auto"')) {
    c = c.replace(/width: 320, height: "auto"/g, 'width: screenW > 768 ? 320 : 200, height: "auto"');
    changed = true;
    console.log('  OK: ' + name + ' - logo scales on mobile');
  }

  if (changed) {
    fs.writeFileSync(file, c, 'utf-8');
    total++;
  }
});

// ═══════════════════════════════════════════════════
// 5. Suporte - verify hero alignment fix applied
// ═══════════════════════════════════════════════════
console.log('\n=== FIX 5: Suporte alignment verify ===');

const suporte = p.join('app', '(tabs)', 'suporte.tsx');
if (fs.existsSync(suporte)) {
  let c = fs.readFileSync(suporte, 'utf-8');
  if (c.includes('IS_WIDE ? "row" : "column"')) {
    console.log('  OK: Suporte already has responsive hero');
  } else if (c.includes('heroStats: { flexDirection: "row"')) {
    c = c.replace(
      'heroStats: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 0 }',
      'heroStats: { flexDirection: IS_WIDE ? "row" : "column", alignItems: "center", marginTop: 8, gap: IS_WIDE ? 0 : 12 }'
    );
    c = c.replace(
      'heroStatDivider: { width: 1, height: 32, backgroundColor: Colors.border }',
      'heroStatDivider: { width: IS_WIDE ? 1 : "60%", height: IS_WIDE ? 32 : 1, backgroundColor: Colors.border }'
    );
    fs.writeFileSync(suporte, c, 'utf-8');
    console.log('  OK: Suporte hero alignment fixed');
    total++;
  }
}

// ═══════════════════════════════════════════════════
console.log('\n========================================');
console.log('DONE: ' + total + ' fixes applied');
console.log('========================================');
console.log('\nRun:');
console.log('  node scripts/fix-unicode-all.js');
console.log('  git add -A && git commit -m "fix: mobile issues - dash overflow, PDV, auth, agentbanner"');
console.log('  git push origin main');
