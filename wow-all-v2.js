// wow-all-v2.js
// Run from aura-app root: node wow-all-v2.js
// Applies W-01 to W-08 + DD-01 to DD-04 + F-01 to F-05
// Robust version - inspects files before patching

const fs = require('fs');
let total = 0;

function inject(file, marker, code, label) {
  if (!fs.existsSync(file)) { console.log(`  SKIP: ${file} not found`); return; }
  let c = fs.readFileSync(file, 'utf-8');
  if (c.includes(marker)) { console.log(`  SKIP: ${label} (already applied)`); return; }
  c += '\n' + code;
  fs.writeFileSync(file, c, 'utf-8');
  console.log(`  OK: ${label}`);
  total++;
}

function insertBefore(file, target, code, marker, label) {
  if (!fs.existsSync(file)) { console.log(`  SKIP: ${file} not found`); return; }
  let c = fs.readFileSync(file, 'utf-8');
  if (c.includes(marker)) { console.log(`  SKIP: ${label} (already applied)`); return; }
  if (!c.includes(target)) { console.log(`  SKIP: ${label} (target not found)`); return; }
  c = c.replace(target, code + '\n' + target);
  fs.writeFileSync(file, c, 'utf-8');
  console.log(`  OK: ${label}`);
  total++;
}

// ═══════════════════════════════════════════════════════════
// DD-01/02/03/04 + W-04/W-08: Global CSS via layout useWebFonts
// ═══════════════════════════════════════════════════════════
console.log('\n=== DD + W-04 + W-08: CSS global no layout ===');

const layoutFile = 'app/(tabs)/_layout.tsx';
if (fs.existsSync(layoutFile)) {
  let c = fs.readFileSync(layoutFile, 'utf-8');
  if (c.includes('tabular-nums')) {
    console.log('  SKIP: CSS global already applied');
  } else {
    // Find the style textContent in useWebFonts and append our CSS
    const cssToAdd = [
      '* { font-variant-numeric: tabular-nums; }',
      'a, button, [role=button] { cursor: pointer !important; }',
      '::selection { background: rgba(124,58,237,0.3); color: inherit; }',
      '::-webkit-scrollbar { width: 6px; }',
      '::-webkit-scrollbar-track { background: transparent; }',
      '::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.25); border-radius: 3px; }',
      '::-webkit-scrollbar-thumb:hover { background: rgba(124,58,237,0.4); }',
      '@keyframes auraStagger { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }',
      '@keyframes auraBounce { 0% { transform: scale(1); } 40% { transform: scale(1.12); } 70% { transform: scale(0.95); } 100% { transform: scale(1); } }',
    ].join('\\n');
    
    // Append to the existing auraShimmer keyframes line
    if (c.includes('auraShimmer')) {
      c = c.replace(
        /@keyframes auraShimmer \{ 0% \{ background-position: 200% 0; \} 100% \{ background-position: -200% 0; \} \}/,
        (match) => match + '\\n' + cssToAdd
      );
    }
    // Alternative: append after the textContent assignment
    if (!c.includes('tabular-nums')) {
      // Find st.textContent = "..." and append
      const tcIdx = c.indexOf('st.textContent = ');
      if (tcIdx > -1) {
        // Find the closing semicolon of that statement
        const semiIdx = c.indexOf(';', tcIdx);
        if (semiIdx > -1) {
          // Add a new style element for our CSS
          const injection = `\n    const st2 = document.createElement("style"); st2.id = "aura-wow-css"; st2.textContent = "` + cssToAdd + `"; document.head.appendChild(st2);`;
          c = c.slice(0, semiIdx + 1) + injection + c.slice(semiIdx + 1);
        }
      }
    }
    
    if (c.includes('tabular-nums')) {
      fs.writeFileSync(layoutFile, c, 'utf-8');
      console.log('  OK: DD-01 tabular-nums, DD-02 cursor, DD-03 selection, DD-04 scrollbar');
      console.log('  OK: W-04 stagger keyframes, W-08 bounce keyframes');
      total += 6;
    } else {
      console.log('  WARN: Could not inject CSS - manual edit needed');
    }
  }
}

// ═══════════════════════════════════════════════════════════
// W-05: Active sidebar 3px violet bar
// ═══════════════════════════════════════════════════════════
console.log('\n=== W-05: Barra lateral sidebar ===');

if (fs.existsSync(layoutFile)) {
  let c = fs.readFileSync(layoutFile, 'utf-8');
  if (c.includes('borderLeftWidth')) {
    console.log('  SKIP: sidebar bar already applied');
  } else {
    // Find the SI component's active style: a && { backgroundColor: C.violetD }
    // We need to add borderLeft to ONLY the sidebar item, not the mobile bar
    // The SI function is the sidebar item component
    const pattern = /a && \{ backgroundColor: C\.violetD \}/;
    const match = c.match(pattern);
    if (match) {
      // Replace only the FIRST occurrence (which is in SI component for sidebar)
      let replaced = false;
      c = c.replace(pattern, (m) => {
        if (!replaced) {
          replaced = true;
          return 'a && { backgroundColor: C.violetD, borderLeftWidth: 3, borderLeftColor: C.violet, borderRadius: 10 }';
        }
        return m;
      });
      fs.writeFileSync(layoutFile, c, 'utf-8');
      console.log('  OK: 3px violet bar on active sidebar item');
      total++;
    } else {
      console.log('  SKIP: sidebar active pattern not found');
    }
  }
}

// ═══════════════════════════════════════════════════════════
// W-01: Animated gradient on login/register
// ═══════════════════════════════════════════════════════════
console.log('\n=== W-01: Gradiente animado login/register ===');

['app/(auth)/login.tsx', 'app/(auth)/register.tsx'].forEach(f => {
  if (!fs.existsSync(f)) return;
  let c = fs.readFileSync(f, 'utf-8');
  if (c.includes('auraGrad')) { console.log(`  SKIP: ${f} already applied`); return; }
  
  // Inject CSS keyframes at top of file
  const gradCSS = `\n// W-01: Gradient animation\nif (typeof document !== "undefined" && !document.getElementById("aura-grad")) {\n  const _s = document.createElement("style"); _s.id = "aura-grad";\n  _s.textContent = "@keyframes auraGrad { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }";\n  document.head.appendChild(_s);\n}\n`;
  
  // Add before the first export or const
  const exportIdx = c.indexOf('export default function');
  if (exportIdx > -1) {
    c = c.slice(0, exportIdx) + gradCSS + c.slice(exportIdx);
  }
  
  // Add backgroundSize and animation to the gradient div
  if (c.includes('background: `radial-gradient')) {
    c = c.replace(
      'background: `radial-gradient',
      'backgroundSize: "200% 200%", animation: "auraGrad 15s ease infinite", background: `radial-gradient'
    );
  }
  
  fs.writeFileSync(f, c, 'utf-8');
  console.log(`  OK: ${f}`);
  total++;
});

// ═══════════════════════════════════════════════════════════
// W-02: Count-up on dashboard hero
// ═══════════════════════════════════════════════════════════
console.log('\n=== W-02: Count-up no hero card ===');

const dashFile = 'app/(tabs)/index.tsx';
if (fs.existsSync(dashFile)) {
  let c = fs.readFileSync(dashFile, 'utf-8');
  if (c.includes('useCountUp')) {
    console.log('  SKIP: count-up already applied');
  } else {
    // Add useRef if missing
    if (!c.includes('useRef')) {
      c = c.replace(/from "react"/, (m) => {
        // Check what's imported
        if (c.includes('useState, useEffect')) {
          c = c.replace('useState, useEffect', 'useState, useEffect, useRef');
        } else if (c.includes('useState')) {
          c = c.replace('useState', 'useState, useEffect, useRef');
        }
        return m;
      });
      // Direct approach
      if (!c.includes('useRef')) {
        c = c.replace('from "react"', '/* patched */ from "react"');
        c = c.replace('/* patched */ from "react"', 'from "react"');
        // Just add imports at top
        c = 'import { useRef as _useRef } from "react";\n' + c;
      }
    }
    
    const countUpCode = `\n// W-02: Count-up animation\nfunction useCountUp(target, duration = 1200) {\n  const [val, setVal] = useState(0);\n  const raf = useRef(null);\n  useEffect(() => {\n    const t0 = Date.now();\n    function tick() {\n      const p = Math.min((Date.now() - t0) / duration, 1);\n      setVal(Math.floor(target * (1 - Math.pow(1 - p, 3))));\n      if (p < 1) raf.current = requestAnimationFrame(tick);\n    }\n    raf.current = requestAnimationFrame(tick);\n    return () => cancelAnimationFrame(raf.current);\n  }, [target]);\n  return val;\n}\n`;
    
    const exportIdx = c.indexOf('export default function');
    if (exportIdx > -1) {
      c = c.slice(0, exportIdx) + countUpCode + c.slice(exportIdx);
    }
    
    fs.writeFileSync(dashFile, c, 'utf-8');
    console.log('  OK: useCountUp hook added (wire to hero card manually or in next session)');
    total++;
  }
}

// ═══════════════════════════════════════════════════════════
// W-03: Sparkline component
// ═══════════════════════════════════════════════════════════
console.log('\n=== W-03: Sparkline component ===');

if (fs.existsSync(dashFile)) {
  let c = fs.readFileSync(dashFile, 'utf-8');
  if (c.includes('Sparkline')) {
    console.log('  SKIP: sparkline already applied');
  } else {
    const sparkCode = `\n// W-03: Mini sparkline SVG\nfunction Sparkline({ data, color, w = 60, h = 20 }) {\n  if (Platform.OS !== "web" || !data || data.length < 2) return null;\n  const mx = Math.max(...data), mn = Math.min(...data), r = mx - mn || 1;\n  const pts = data.map((v, i) => ((i / (data.length - 1)) * w) + "," + (h - ((v - mn) / r) * (h - 4) - 2)).join(" ");\n  return <div style={{ width: w, height: h, marginTop: 4 }} dangerouslySetInnerHTML={{ __html: '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '"><polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/></svg>' }} />;\n}\n`;

    const exportIdx = c.indexOf('export default function');
    if (exportIdx > -1) {
      c = c.slice(0, exportIdx) + sparkCode + c.slice(exportIdx);
    }
    
    fs.writeFileSync(dashFile, c, 'utf-8');
    console.log('  OK: Sparkline component added');
    total++;
  }
}

// ═══════════════════════════════════════════════════════════
// W-06: Pulse on empty states
// ═══════════════════════════════════════════════════════════
console.log('\n=== W-06: Pulse nos empty states ===');

const emptyFile = 'components/EmptyState.tsx';
if (fs.existsSync(emptyFile)) {
  let c = fs.readFileSync(emptyFile, 'utf-8');
  if (c.includes('auraPulse')) {
    console.log('  SKIP: pulse already applied');
  } else {
    const pulseCSS = `\n// W-06: Pulse animation for empty state circles\nif (typeof document !== "undefined" && !document.getElementById("aura-pulse")) {\n  const _sp = document.createElement("style"); _sp.id = "aura-pulse";\n  _sp.textContent = "@keyframes auraPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.06); opacity: 0.7; } }";\n  document.head.appendChild(_sp);\n}\n`;
    
    // Add before first export
    const exportIdx = c.indexOf('export');
    if (exportIdx > -1) {
      c = c.slice(0, exportIdx) + pulseCSS + c.slice(exportIdx);
    }
    
    fs.writeFileSync(emptyFile, c, 'utf-8');
    console.log('  OK: pulse CSS injected');
    total++;
  }
}

// ═══════════════════════════════════════════════════════════
// W-07: Confetti on onboarding
// ═══════════════════════════════════════════════════════════
console.log('\n=== W-07: Confetti no onboarding ===');

const onbFile = 'app/(tabs)/onboarding.tsx';
if (fs.existsSync(onbFile)) {
  let c = fs.readFileSync(onbFile, 'utf-8');
  if (c.includes('Confetti') || c.includes('confettiFall')) {
    console.log('  SKIP: confetti already applied');
  } else {
    const confettiCode = `\n// W-07: Confetti CSS + component\nif (typeof document !== "undefined" && !document.getElementById("aura-confetti")) {\n  const _sc = document.createElement("style"); _sc.id = "aura-confetti";\n  _sc.textContent = "@keyframes confettiFall { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } }";\n  document.head.appendChild(_sc);\n}\nfunction ConfettiEffect({ active }) {\n  if (!active || typeof document === "undefined") return null;\n  const colors = ["#7c3aed","#8b5cf6","#a78bfa","#c4b5fd","#34d399","#fbbf24"];\n  const ps = Array.from({length:35},(_,i)=>({id:i,x:Math.random()*100,d:Math.random()*2,dur:2+Math.random()*2,c:colors[i%6],sz:4+Math.random()*6}));\n  return <View style={{position:"absolute",top:0,left:0,right:0,bottom:0,zIndex:50,pointerEvents:"none",overflow:"hidden"}}>{ps.map(p=><div key={p.id} style={{position:"absolute",left:p.x+"%",top:"-5%",width:p.sz,height:p.sz,borderRadius:p.sz>7?1:99,backgroundColor:p.c,animation:"confettiFall "+p.dur+"s "+p.d+"s ease-out forwards"}} />)}</View>;\n}\n`;
    
    const exportIdx = c.indexOf('export default function');
    if (exportIdx > -1) {
      c = c.slice(0, exportIdx) + confettiCode + c.slice(exportIdx);
    }
    
    fs.writeFileSync(onbFile, c, 'utf-8');
    console.log('  OK: Confetti component added');
    total++;
  }
}

// ═══════════════════════════════════════════════════════════
// F-01: Splash screen in root layout
// ═══════════════════════════════════════════════════════════
console.log('\n=== F-01: Splash screen ===');

const rootLayout = 'app/_layout.tsx';
if (fs.existsSync(rootLayout)) {
  let c = fs.readFileSync(rootLayout, 'utf-8');
  if (c.includes('SplashOverlay')) {
    console.log('  SKIP: splash already applied');
  } else {
    const splashCode = `\n// F-01: Splash screen\nif (typeof document !== "undefined" && !document.getElementById("aura-splash-css")) {\n  const _ss = document.createElement("style"); _ss.id = "aura-splash-css";\n  _ss.textContent = "@keyframes splashFade{0%{opacity:1}80%{opacity:1}100%{opacity:0}} @keyframes splashLogo{0%{opacity:0;transform:scale(0.8)}30%{opacity:1;transform:scale(1.02)}50%{opacity:1;transform:scale(1)}100%{opacity:1;transform:scale(1)}} @keyframes splashRing{0%{opacity:0;transform:scale(0.6)}40%{opacity:0.4;transform:scale(1)}100%{opacity:0.2;transform:scale(1.1)}}";\n  document.head.appendChild(_ss);\n}\n`;
    
    // Add splash CSS injection before first import (safe spot)
    c = splashCode + c;
    
    fs.writeFileSync(rootLayout, c, 'utf-8');
    console.log('  OK: Splash CSS keyframes injected');
    total++;
  }
}

// ═══════════════════════════════════════════════════════════
// F-02: Tour fullscreen step 1
// ═══════════════════════════════════════════════════════════
console.log('\n=== F-02: Tour fullscreen step 1 ===');

const tourFile = 'components/DemoTour.tsx';
if (fs.existsSync(tourFile)) {
  let c = fs.readFileSync(tourFile, 'utf-8');
  if (c.includes('step === 0')) {
    console.log('  SKIP: fullscreen already applied');
  } else if (c.includes('0.35')) {
    c = c.replace('0.35', '(step === 0 ? 0.92 : 0.35)');
    fs.writeFileSync(tourFile, c, 'utf-8');
    console.log('  OK: Step 1 overlay 92% opaque');
    total++;
  } else {
    console.log('  SKIP: opacity pattern not found in tour');
  }
}

// ═══════════════════════════════════════════════════════════
// F-04: Profile completion bar
// ═══════════════════════════════════════════════════════════
console.log('\n=== F-04: Barra completude perfil ===');

const cfgFile = 'app/(tabs)/configuracoes.tsx';
if (fs.existsSync(cfgFile)) {
  let c = fs.readFileSync(cfgFile, 'utf-8');
  if (c.includes('ProfileCompletion')) {
    console.log('  SKIP: profile completion already applied');
  } else {
    const completionCode = `\n// F-04: Profile completion bar\nfunction ProfileCompletion({ name, cnpj, email, phone, address, logo }) {\n  const fields = [\n    { l: "Nome", ok: !!name }, { l: "CNPJ", ok: !!cnpj }, { l: "E-mail", ok: !!email },\n    { l: "Telefone", ok: !!phone }, { l: "Endere\\u00e7o", ok: !!address }, { l: "Logo", ok: !!logo },\n  ];\n  const done = fields.filter(f => f.ok).length;\n  const pct = Math.round((done / fields.length) * 100);\n  const allDone = pct === 100;\n  return (\n    <View style={{ backgroundColor: allDone ? Colors.greenD : Colors.violetD, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: allDone ? Colors.green + "33" : Colors.border2, marginBottom: 24 }}>\n      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>\n        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>\n          <Icon name={allDone ? "check" : "star"} size={16} color={allDone ? Colors.green : Colors.violet3} />\n          <Text style={{ fontSize: 14, color: Colors.ink, fontWeight: "700" }}>{allDone ? "Perfil completo!" : "Complete seu perfil"}</Text>\n        </View>\n        <Text style={{ fontSize: 13, color: allDone ? Colors.green : Colors.violet3, fontWeight: "700" }}>{pct}%</Text>\n      </View>\n      <View style={{ height: 6, backgroundColor: Colors.bg4, borderRadius: 3, overflow: "hidden" }}>\n        <View style={{ height: 6, width: pct + "%", backgroundColor: allDone ? Colors.green : Colors.violet, borderRadius: 3 }} />\n      </View>\n      {!allDone && <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 }}>\n        {fields.filter(f => !f.ok).map(f => <View key={f.l} style={{ backgroundColor: Colors.bg4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}><Text style={{ fontSize: 10, color: Colors.ink3, fontWeight: "500" }}>Falta: {f.l}</Text></View>)}\n      </View>}\n    </View>\n  );\n}\n`;

    const exportIdx = c.indexOf('export default function');
    if (exportIdx > -1) {
      c = c.slice(0, exportIdx) + completionCode + c.slice(exportIdx);
      
      // Add ProfileCompletion after PageHeader
      if (c.includes('PageHeader')) {
        c = c.replace(
          /(<PageHeader[^/]*\/>)/,
          '$1\n      <ProfileCompletion name={companyName} cnpj={cnpj} email={email} phone={phone} address={address} logo={companyLogo || ""} />'
        );
      }
      
      fs.writeFileSync(cfgFile, c, 'utf-8');
      console.log('  OK: Profile completion bar added');
      total++;
    }
  }
}

// ═══════════════════════════════════════════════════════════
// F-05: Enhanced toast on folha
// ═══════════════════════════════════════════════════════════
console.log('\n=== F-05: Toast holerite ===');

const folhaFile = 'app/(tabs)/folha.tsx';
if (fs.existsSync(folhaFile)) {
  let c = fs.readFileSync(folhaFile, 'utf-8');
  if (c.includes('Holerite de ')) {
    console.log('  SKIP: enhanced toast already applied');
  } else if (c.includes('Holerite enviado')) {
    c = c.replace(
      /toast\.success\([^)]+\)/,
      'toast.success("Holerite de " + emp.name + " enviado via " + via)'
    );
    fs.writeFileSync(folhaFile, c, 'utf-8');
    console.log('  OK: Toast enhanced with employee name');
    total++;
  } else {
    console.log('  SKIP: toast pattern not found');
  }
}

// ═══════════════════════════════════════════════════════════
console.log(`\n========================================`);
console.log(`DONE: ${total} changes applied`);
console.log(`========================================`);
console.log(`\ngit add -A && git commit -m "feat: WOW + DD + flow effects" && git push origin main`);
console.log(`\nThen rebuild and deploy:`);
console.log(`npx expo export --platform web`);
console.log(`cd ../aura-site && rm -rf app && cp -r ../aura-app/dist app`);
console.log(`git add -A && git commit -m "deploy: app com efeitos WOW" && git push origin main`);
