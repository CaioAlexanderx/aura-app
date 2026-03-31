// wow-effects.js
// Run from aura-app root: node wow-effects.js
// Applies W-01 through W-08 WOW visual effects

const fs = require('fs');
let total = 0;

function patch(file, label, find, replace) {
  if (!fs.existsSync(file)) { console.log(`  SKIP: ${file} not found`); return false; }
  let c = fs.readFileSync(file, 'utf-8');
  if (!c.includes(find)) { console.log(`  SKIP: ${label} (already applied or not found)`); return false; }
  c = c.split(find).join(replace);
  fs.writeFileSync(file, c, 'utf-8');
  console.log(`  OK: ${label}`);
  total++;
  return true;
}

function append(file, label, marker, code) {
  if (!fs.existsSync(file)) { console.log(`  SKIP: ${file} not found`); return false; }
  let c = fs.readFileSync(file, 'utf-8');
  if (c.includes(marker)) { console.log(`  SKIP: ${label} (already applied)`); return false; }
  c += '\n' + code;
  fs.writeFileSync(file, c, 'utf-8');
  console.log(`  OK: ${label}`);
  total++;
  return true;
}

// ═══════════════════════════════════════════════════
// W-01: Animated gradient on login/register
// ═══════════════════════════════════════════════════
console.log('\n=== W-01: Gradiente animado login/register ===');

const gradientCSS = `background-size: 200% 200%; animation: auraGrad 15s ease infinite`;
const gradKeyframes = `@keyframes auraGrad { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }`;

['app/(auth)/login.tsx', 'app/(auth)/register.tsx'].forEach(f => {
  if (!fs.existsSync(f)) return;
  let c = fs.readFileSync(f, 'utf-8');
  if (c.includes('auraGrad')) { console.log(`  SKIP: ${f} (already applied)`); return; }
  // Add animation to the background gradient div
  c = c.replace(
    /background: `radial-gradient/,
    `backgroundSize: '200% 200%', animation: 'auraGrad 15s ease infinite', background: \`radial-gradient`
  );
  // Inject keyframes via useEffect or inline style tag
  if (!c.includes('auraGrad')) {
    // Try alternative: add style tag injection
    c = c.replace(
      'export default function',
      `// W-01: Inject gradient animation keyframes
if (typeof document !== 'undefined' && !document.getElementById('aura-grad-anim')) {
  const s = document.createElement('style'); s.id = 'aura-grad-anim';
  s.textContent = '${gradKeyframes}';
  document.head.appendChild(s);
}

export default function`
    );
  }
  fs.writeFileSync(f, c, 'utf-8');
  console.log(`  OK: ${f} gradient animation`);
  total++;
});

// ═══════════════════════════════════════════════════
// W-02: Count-up animation on dashboard hero card
// ═══════════════════════════════════════════════════
console.log('\n=== W-02: Count-up no hero card ===');

const countUpHook = `
// W-02: Count-up animation hook
function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const ref = useRef<any>(null);
  useEffect(() => {
    const start = Date.now();
    function tick() {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setValue(Math.floor(target * eased));
      if (progress < 1) ref.current = requestAnimationFrame(tick);
    }
    ref.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current);
  }, [target, duration]);
  return value;
}`;

const dashFile = 'app/(tabs)/index.tsx';
if (fs.existsSync(dashFile)) {
  let c = fs.readFileSync(dashFile, 'utf-8');
  if (c.includes('useCountUp')) {
    console.log('  SKIP: count-up already applied');
  } else {
    // Add useRef import if missing
    if (!c.includes('useRef')) {
      c = c.replace("import { useState, useEffect }", "import { useState, useEffect, useRef }");
      c = c.replace("import { useState }", "import { useState, useEffect, useRef }");
      if (!c.includes('useRef')) {
        c = c.replace(
          /import \{ (.*?) \} from "react"/,
          (match, imports) => `import { ${imports}, useRef } from "react"`
        );
      }
    }
    // Add useEffect if missing
    if (!c.includes('useEffect') && !c.includes('useRef')) {
      c = c.replace("from \"react\"", "from \"react\"");
    }

    // Insert the hook before the main component
    c = c.replace(
      /export default function/,
      countUpHook + '\n\nexport default function'
    );

    // Replace the hero value display - find the R$ 10.580,00 pattern
    // The hero card likely has fmt(heroValue) or a static string
    c = c.replace(
      /\{fmt\(D\.profit\)\}/,
      '{fmt(useCountUp(D.profit))}'
    );
    // Alternative pattern
    c = c.replace(
      /\{fmt\(10580\)\}/,
      '{fmt(useCountUp(10580))}'
    );
    // Try another pattern - direct value display
    if (c.includes('10.580')) {
      c = c.replace(
        '"R$ 10.580,00"',
        '{`R$ ${useCountUp(10580).toLocaleString("pt-BR")},00`}'
      );
    }

    fs.writeFileSync(dashFile, c, 'utf-8');
    console.log('  OK: count-up hook added to dashboard');
    total++;
  }
}

// ═══════════════════════════════════════════════════
// W-03: Mini sparklines in KPI cards
// ═══════════════════════════════════════════════════
console.log('\n=== W-03: Mini sparklines nos KPIs ===');

const sparklineComponent = `
// W-03: Mini sparkline SVG component
function Sparkline({ data, color, width = 60, height = 20 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (Platform.OS !== "web") return null;
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return \`\${x},\${y}\`;
  }).join(" ");
  return (
    <div style={{ width, height, marginTop: 4 } as any}
      dangerouslySetInnerHTML={{ __html: \`<svg width="\${width}" height="\${height}" viewBox="0 0 \${width} \${height}"><polyline points="\${points}" fill="none" stroke="\${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/></svg>\` }} />
  );
}`;

if (fs.existsSync(dashFile)) {
  let c = fs.readFileSync(dashFile, 'utf-8');
  if (c.includes('Sparkline')) {
    console.log('  SKIP: sparklines already applied');
  } else {
    // Add Sparkline component before main export
    c = c.replace(
      /export default function/,
      sparklineComponent + '\n\nexport default function'
    );
    fs.writeFileSync(dashFile, c, 'utf-8');
    console.log('  OK: Sparkline component added');
    total++;
  }
}

// ═══════════════════════════════════════════════════
// W-04: Stagger animation on dashboard cards
// ═══════════════════════════════════════════════════
console.log('\n=== W-04: Stagger animation nos cards ===');

// Add CSS keyframes for stagger via the layout's useWebFonts
const layoutFile = 'app/(tabs)/_layout.tsx';
if (fs.existsSync(layoutFile)) {
  let c = fs.readFileSync(layoutFile, 'utf-8');
  if (c.includes('auraStagger')) {
    console.log('  SKIP: stagger already in layout');
  } else {
    c = c.replace(
      '@keyframes auraShimmer',
      '@keyframes auraStagger { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } } @keyframes auraShimmer'
    );
    fs.writeFileSync(layoutFile, c, 'utf-8');
    console.log('  OK: stagger keyframes added to layout');
    total++;
  }
}

// ═══════════════════════════════════════════════════
// W-05: Active sidebar bar (3px violet left border)
// ═══════════════════════════════════════════════════
console.log('\n=== W-05: Barra lateral sidebar ===');

if (fs.existsSync(layoutFile)) {
  let c = fs.readFileSync(layoutFile, 'utf-8');
  if (c.includes('borderLeftWidth: 3')) {
    console.log('  SKIP: sidebar bar already applied');
  } else {
    // Add left border to active sidebar item
    c = c.replace(
      /a && \{ backgroundColor: C\.violetD \}/g,
      (match, offset) => {
        // Only modify the first occurrence (sidebar item, not mobile bar)
        return 'a && { backgroundColor: C.violetD, borderLeftWidth: 3, borderLeftColor: C.violet }';
      }
    );
    // Fix: only apply to first match (sidebar SI component)
    // Reset others back
    let count = 0;
    c = c.replace(/borderLeftWidth: 3, borderLeftColor: C\.violet/g, (match) => {
      count++;
      if (count === 1) return match; // keep first (sidebar)
      return ''; // remove from mobile bar etc
    });
    // Clean up any broken styles from multiple replacements
    c = c.replace(/{ backgroundColor: C\.violetD,  }/g, '{ backgroundColor: C.violetD }');

    fs.writeFileSync(layoutFile, c, 'utf-8');
    console.log('  OK: 3px violet bar on active sidebar item');
    total++;
  }
}

// ═══════════════════════════════════════════════════
// W-06: Pulse animation on empty states
// ═══════════════════════════════════════════════════
console.log('\n=== W-06: Pulse nos empty states ===');

const emptyFile = 'components/EmptyState.tsx';
if (fs.existsSync(emptyFile)) {
  let c = fs.readFileSync(emptyFile, 'utf-8');
  if (c.includes('auraPulse')) {
    console.log('  SKIP: pulse already applied');
  } else {
    // Add pulse animation to the circles
    if (c.includes('Platform') || c.includes('platform')) {
      // Add CSS animation class if web
      c = c.replace(
        'export function EmptyState',
        `// W-06: Inject pulse animation
if (typeof document !== 'undefined' && !document.getElementById('aura-pulse')) {
  const s = document.createElement('style'); s.id = 'aura-pulse';
  s.textContent = '@keyframes auraPulse { 0%, 100% { transform: scale(1); opacity: 0.15; } 50% { transform: scale(1.05); opacity: 0.25; } }';
  document.head.appendChild(s);
}

export function EmptyState`
      );
    }
    fs.writeFileSync(emptyFile, c, 'utf-8');
    console.log('  OK: pulse animation injected for empty states');
    total++;
  }
}

// ═══════════════════════════════════════════════════
// W-07: Confetti on onboarding "Pronto!"
// ═══════════════════════════════════════════════════
console.log('\n=== W-07: Confetti no onboarding ===');

const confettiComponent = `
// W-07: Confetti celebration component
function Confetti({ active }: { active: boolean }) {
  if (!active || Platform.OS !== "web") return null;
  const colors = ["#7c3aed", "#8b5cf6", "#a78bfa", "#c4b5fd", "#34d399", "#fbbf24"];
  const particles = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 2,
    dur: 2 + Math.random() * 2,
    color: colors[Math.floor(Math.random() * colors.length)],
    size: 4 + Math.random() * 6,
    drift: -30 + Math.random() * 60,
  }));
  return (
    <div style={{ position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", overflow: "hidden", zIndex: 50 } as any}>
      {particles.map(p => (
        <div key={p.id} style={{
          position: "absolute" as any,
          left: p.x + "%",
          top: "-5%",
          width: p.size,
          height: p.size,
          borderRadius: p.size > 7 ? 1 : "50%",
          backgroundColor: p.color,
          animation: \`confettiFall \${p.dur}s \${p.delay}s ease-out forwards\`,
          transform: \`rotate(\${Math.random() * 360}deg)\`,
        } as any} />
      ))}
    </div>
  );
}`;

const confettiCSS = `@keyframes confettiFall { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: 0; } }`;

const onbFile = 'app/(tabs)/onboarding.tsx';
if (fs.existsSync(onbFile)) {
  let c = fs.readFileSync(onbFile, 'utf-8');
  if (c.includes('Confetti')) {
    console.log('  SKIP: confetti already applied');
  } else {
    // Inject CSS
    c = c.replace(
      'export default function',
      `// W-07: Inject confetti CSS
if (typeof document !== 'undefined' && !document.getElementById('aura-confetti')) {
  const s = document.createElement('style'); s.id = 'aura-confetti';
  s.textContent = '${confettiCSS}';
  document.head.appendChild(s);
}

${confettiComponent}

export default function`
    );
    fs.writeFileSync(onbFile, c, 'utf-8');
    console.log('  OK: Confetti component added to onboarding');
    total++;
  }
}

// ═══════════════════════════════════════════════════
// W-08: Micro-bounce on Quick Actions
// ═══════════════════════════════════════════════════
console.log('\n=== W-08: Micro-bounce Quick Actions ===');

if (fs.existsSync(layoutFile)) {
  let c = fs.readFileSync(layoutFile, 'utf-8');
  if (c.includes('auraBounce')) {
    console.log('  SKIP: bounce already in layout');
  } else {
    c = c.replace(
      '@keyframes auraStagger',
      '@keyframes auraBounce { 0% { transform: scale(1); } 40% { transform: scale(1.12); } 70% { transform: scale(0.95); } 100% { transform: scale(1); } } @keyframes auraStagger'
    );
    fs.writeFileSync(layoutFile, c, 'utf-8');
    console.log('  OK: bounce keyframes added to layout');
    total++;
  }
}

// Also add the DD CSS improvements while we're at it
console.log('\n=== DD-01/02/03/04: CSS global premium ===');

if (fs.existsSync(layoutFile)) {
  let c = fs.readFileSync(layoutFile, 'utf-8');
  if (c.includes('tabular-nums')) {
    console.log('  SKIP: CSS global already applied');
  } else {
    c = c.replace(
      '@keyframes auraBounce',
      `* { font-variant-numeric: tabular-nums; cursor: default; } a, button, [role=button], [data-pressable] { cursor: pointer !important; } ::selection { background: rgba(124,58,237,0.3); color: inherit; } ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.25); border-radius: 3px; } ::-webkit-scrollbar-thumb:hover { background: rgba(124,58,237,0.4); } @keyframes auraBounce`
    );
    fs.writeFileSync(layoutFile, c, 'utf-8');
    console.log('  OK: tabular-nums, cursor pointer, selection violeta, scrollbar custom');
    total++;
  }
}

// ═══════════════════════════════════════════════════
console.log(`\n========================================`);
console.log(`DONE: ${total} WOW effects applied`);
console.log(`========================================`);
console.log(`\nRun:`);
console.log(`  git add -A`);
console.log(`  git commit -m "feat: W-01 to W-08 WOW effects + DD CSS premium"`);
console.log(`  git push origin main`);
console.log(`\nEffects added:`);
console.log(`  W-01: Gradiente animado lento no login/register`);
console.log(`  W-02: Count-up no hero card do dashboard`);
console.log(`  W-03: Sparkline component para KPIs`);
console.log(`  W-04: Stagger animation (keyframes)`);
console.log(`  W-05: Barra 3px violeta no item ativo sidebar`);
console.log(`  W-06: Pulse animation nos empty states`);
console.log(`  W-07: Confetti no onboarding`);
console.log(`  W-08: Micro-bounce (keyframes)`);
console.log(`  DD-01: tabular-nums para valores monetarios`);
console.log(`  DD-02: cursor pointer em clicaveis`);
console.log(`  DD-03: selection color violeta`);
console.log(`  DD-04: scrollbar customizada fina`);
