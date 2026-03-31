// wow-force.js
// Run from aura-app root: node wow-force.js
// Forces all WOW + DD + Flow effects by reading actual file content

const fs = require('fs');
const path = require('path');
let total = 0;

function fileInfo(f) {
  if (!fs.existsSync(f)) return console.log(`  NOT FOUND: ${f}`);
  const c = fs.readFileSync(f, 'utf-8');
  console.log(`  EXISTS: ${f} (${c.length} chars)`);
  return c;
}

console.log('\n=== DIAGNOSTIC: Checking files ===');
const files = {
  layout: 'app/(tabs)/_layout.tsx',
  dash: 'app/(tabs)/index.tsx',
  login: 'app/(auth)/login.tsx',
  register: 'app/(auth)/register.tsx',
  onb: 'app/(tabs)/onboarding.tsx',
  empty: 'components/EmptyState.tsx',
  tour: 'components/DemoTour.tsx',
  cfg: 'app/(tabs)/configuracoes.tsx',
  folha: 'app/(tabs)/folha.tsx',
  root: 'app/_layout.tsx',
};
Object.entries(files).forEach(([k, f]) => fileInfo(f));

// ═══════════════════════════════════════════════════════════
// DD-01/02/03/04 + W-04 + W-08: Global CSS
// Approach: inject a standalone style element via the layout
// ═══════════════════════════════════════════════════════════
console.log('\n=== APPLYING: DD + W-04 + W-08 (CSS global) ===');
if (fs.existsSync(files.layout)) {
  let c = fs.readFileSync(files.layout, 'utf-8');
  if (c.includes('aura-wow-css')) {
    console.log('  SKIP: already applied');
  } else {
    // Find the useWebFonts function and add our style injection after fonts
    // Look for the appendChild(st) that adds the shimmer keyframe
    const insertPoint = c.lastIndexOf('document.head.appendChild(st);');
    if (insertPoint > -1) {
      const afterInsert = insertPoint + 'document.head.appendChild(st);'.length;
      const cssCode = `
    const wowCss = document.createElement("style"); wowCss.id = "aura-wow-css";
    wowCss.textContent = "* { font-variant-numeric: tabular-nums; } a, button, [role=button] { cursor: pointer !important; } ::selection { background: rgba(124,58,237,0.3); color: inherit; } ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.25); border-radius: 3px; } ::-webkit-scrollbar-thumb:hover { background: rgba(124,58,237,0.4); } @keyframes auraStagger { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } } @keyframes auraBounce { 0% { transform: scale(1); } 40% { transform: scale(1.12); } 70% { transform: scale(0.95); } 100% { transform: scale(1); } }";
    document.head.appendChild(wowCss);`;
      c = c.slice(0, afterInsert) + cssCode + c.slice(afterInsert);
      fs.writeFileSync(files.layout, c, 'utf-8');
      console.log('  OK: DD-01 tabular-nums, DD-02 cursor, DD-03 selection, DD-04 scrollbar, W-04 stagger, W-08 bounce');
      total += 6;
    } else {
      // Fallback: find any appendChild in useWebFonts
      const altPoint = c.indexOf('document.head.appendChild');
      if (altPoint > -1) {
        // Find the end of that line
        const lineEnd = c.indexOf('\n', altPoint);
        const cssCode = `\n    if (!document.getElementById("aura-wow-css")) { const wowCss = document.createElement("style"); wowCss.id = "aura-wow-css"; wowCss.textContent = "* { font-variant-numeric: tabular-nums; } a, button, [role=button] { cursor: pointer !important; } ::selection { background: rgba(124,58,237,0.3); color: inherit; } ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.25); border-radius: 3px; } ::-webkit-scrollbar-thumb:hover { background: rgba(124,58,237,0.4); } @keyframes auraStagger { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } } @keyframes auraBounce { 0% { transform: scale(1); } 40% { transform: scale(1.12); } 70% { transform: scale(0.95); } 100% { transform: scale(1); } }"; document.head.appendChild(wowCss); }`;
        c = c.slice(0, lineEnd) + cssCode + c.slice(lineEnd);
        fs.writeFileSync(files.layout, c, 'utf-8');
        console.log('  OK (fallback): CSS global injected');
        total += 6;
      } else {
        console.log('  FAIL: no appendChild found in layout');
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════
// W-05: Sidebar active bar
// ═══════════════════════════════════════════════════════════
console.log('\n=== APPLYING: W-05 (sidebar bar) ===');
if (fs.existsSync(files.layout)) {
  let c = fs.readFileSync(files.layout, 'utf-8');
  if (c.includes('borderLeftWidth')) {
    console.log('  SKIP: already applied');
  } else {
    // Find: a && { backgroundColor: C.violetD }
    // This could have different whitespace, so use regex
    const re = /a && \{ backgroundColor: C\.violetD \}/;
    if (re.test(c)) {
      // Replace only first occurrence (SI sidebar component)
      let replaced = false;
      c = c.replace(re, (m) => {
        if (!replaced) { replaced = true; return 'a && { backgroundColor: C.violetD, borderLeftWidth: 3, borderLeftColor: C.violet }'; }
        return m;
      });
      fs.writeFileSync(files.layout, c, 'utf-8');
      console.log('  OK: 3px violet left border on active sidebar item');
      total++;
    } else {
      console.log('  WARN: pattern not found, searching alternatives...');
      // Show what the active style looks like
      const idx = c.indexOf('violetD');
      if (idx > -1) console.log('  Context: ...' + c.substring(Math.max(0,idx-30), idx+40) + '...');
    }
  }
}

// ═══════════════════════════════════════════════════════════
// W-01: Animated gradient login/register
// ═══════════════════════════════════════════════════════════
console.log('\n=== APPLYING: W-01 (gradient animation) ===');
[files.login, files.register].forEach(f => {
  if (!fs.existsSync(f)) { console.log(`  SKIP: ${f} not found`); return; }
  let c = fs.readFileSync(f, 'utf-8');
  if (c.includes('auraGrad')) { console.log(`  SKIP: ${f} already applied`); return; }

  // Inject CSS at module level (before first export/function)
  const cssInjection = `\n// W-01: Gradient animation\nif (typeof document !== "undefined" && !document.getElementById("aura-grad")) {\n  const _sg = document.createElement("style"); _sg.id = "aura-grad";\n  _sg.textContent = "@keyframes auraGrad { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }";\n  document.head.appendChild(_sg);\n}\n`;

  // Find the export default function line
  const exportIdx = c.indexOf('export default function');
  if (exportIdx === -1) { console.log(`  FAIL: no export in ${f}`); return; }

  c = c.slice(0, exportIdx) + cssInjection + c.slice(exportIdx);

  // Add animation to the radial-gradient background
  const bgIdx = c.indexOf("background: `radial-gradient");
  if (bgIdx > -1) {
    c = c.slice(0, bgIdx) + 'backgroundSize: "200% 200%", animation: "auraGrad 15s ease infinite", ' + c.slice(bgIdx);
    console.log(`  OK: ${f} gradient + animation`);
    total++;
  } else {
    // Still save the CSS injection
    console.log(`  PARTIAL: CSS injected but gradient pattern not found in ${f}`);
    total++;
  }
  fs.writeFileSync(f, c, 'utf-8');
});

// ═══════════════════════════════════════════════════════════
// W-02: Count-up hook for dashboard
// ═══════════════════════════════════════════════════════════
console.log('\n=== APPLYING: W-02 (count-up) ===');
if (fs.existsSync(files.dash)) {
  let c = fs.readFileSync(files.dash, 'utf-8');
  if (c.includes('useCountUp')) {
    console.log('  SKIP: already applied');
  } else {
    // Ensure useRef is imported
    if (c.includes('{ useState }') && !c.includes('useRef')) {
      c = c.replace('{ useState }', '{ useState, useEffect, useRef }');
    } else if (c.includes('{ useState, useEffect }') && !c.includes('useRef')) {
      c = c.replace('{ useState, useEffect }', '{ useState, useEffect, useRef }');
    }

    const hookCode = `\n// W-02: Count-up animation hook\nfunction useCountUp(target, duration) {\n  duration = duration || 1200;\n  const [val, setVal] = React.useState ? React.useState(0) : useState(0);\n  const raf = typeof useRef !== "undefined" ? useRef(null) : { current: null };\n  if (typeof useEffect !== "undefined") useEffect(function() {\n    var t0 = Date.now();\n    function tick() {\n      var p = Math.min((Date.now() - t0) / duration, 1);\n      setVal(Math.floor(target * (1 - Math.pow(1 - p, 3))));\n      if (p < 1) raf.current = requestAnimationFrame(tick);\n    }\n    raf.current = requestAnimationFrame(tick);\n    return function() { cancelAnimationFrame(raf.current); };\n  }, [target]);\n  return val;\n}\n`;

    const exportIdx = c.indexOf('export default function');
    if (exportIdx > -1) {
      c = c.slice(0, exportIdx) + hookCode + c.slice(exportIdx);
      fs.writeFileSync(files.dash, c, 'utf-8');
      console.log('  OK: useCountUp hook added');
      total++;
    }
  }
}

// ═══════════════════════════════════════════════════════════
// W-03: Sparkline component
// ═══════════════════════════════════════════════════════════
console.log('\n=== APPLYING: W-03 (sparkline) ===');
if (fs.existsSync(files.dash)) {
  let c = fs.readFileSync(files.dash, 'utf-8');
  if (c.includes('Sparkline')) {
    console.log('  SKIP: already applied');
  } else {
    const sparkCode = `\n// W-03: Mini sparkline SVG\nfunction MiniSparkline({ data, color, w, h }) {\n  w = w || 60; h = h || 20;\n  if (Platform.OS !== "web" || !data || data.length < 2) return null;\n  var mx = Math.max.apply(null, data), mn = Math.min.apply(null, data), r = mx - mn || 1;\n  var pts = data.map(function(v, i) { return ((i / (data.length - 1)) * w) + "," + (h - ((v - mn) / r) * (h - 4) - 2); }).join(" ");\n  return React.createElement("div", { style: { width: w, height: h, marginTop: 4 }, dangerouslySetInnerHTML: { __html: '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '"><polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/></svg>' } });\n}\n`;

    const exportIdx = c.indexOf('export default function');
    if (exportIdx > -1) {
      c = c.slice(0, exportIdx) + sparkCode + c.slice(exportIdx);
      fs.writeFileSync(files.dash, c, 'utf-8');
      console.log('  OK: MiniSparkline component added');
      total++;
    }
  }
}

// ═══════════════════════════════════════════════════════════
// W-07: Confetti on onboarding
// ═══════════════════════════════════════════════════════════
console.log('\n=== APPLYING: W-07 (confetti) ===');
if (fs.existsSync(files.onb)) {
  let c = fs.readFileSync(files.onb, 'utf-8');
  if (c.includes('confettiFall')) {
    console.log('  SKIP: already applied');
  } else {
    const confettiCode = `\n// W-07: Confetti animation\nif (typeof document !== "undefined" && !document.getElementById("aura-confetti")) {\n  var _sc = document.createElement("style"); _sc.id = "aura-confetti";\n  _sc.textContent = "@keyframes confettiFall { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } }";\n  document.head.appendChild(_sc);\n}\n`;

    const exportIdx = c.indexOf('export default function');
    if (exportIdx > -1) {
      c = c.slice(0, exportIdx) + confettiCode + c.slice(exportIdx);
      fs.writeFileSync(files.onb, c, 'utf-8');
      console.log('  OK: confetti CSS keyframes injected');
      total++;
    }
  }
}

// ═══════════════════════════════════════════════════════════
// F-01: Splash screen CSS
// ═══════════════════════════════════════════════════════════
console.log('\n=== APPLYING: F-01 (splash CSS) ===');
if (fs.existsSync(files.root)) {
  let c = fs.readFileSync(files.root, 'utf-8');
  if (c.includes('aura-splash')) {
    console.log('  SKIP: already applied');
  } else {
    const splashCSS = `// F-01: Splash screen CSS\nif (typeof document !== "undefined" && !document.getElementById("aura-splash")) {\n  var _ssp = document.createElement("style"); _ssp.id = "aura-splash";\n  _ssp.textContent = "@keyframes splashFade{0%{opacity:1}80%{opacity:1}100%{opacity:0}} @keyframes splashLogo{0%{opacity:0;transform:scale(0.8)}30%{opacity:1;transform:scale(1.02)}50%,100%{opacity:1;transform:scale(1)}} @keyframes splashRing{0%{opacity:0;transform:scale(0.6)}40%{opacity:0.4;transform:scale(1)}100%{opacity:0.2;transform:scale(1.1)}}";\n  document.head.appendChild(_ssp);\n}\n\n`;
    c = splashCSS + c;
    fs.writeFileSync(files.root, c, 'utf-8');
    console.log('  OK: splash CSS keyframes added to root layout');
    total++;
  }
}

// ═══════════════════════════════════════════════════════════
// F-04: Profile completion bar
// ═══════════════════════════════════════════════════════════
console.log('\n=== APPLYING: F-04 (profile completion) ===');
if (fs.existsSync(files.cfg)) {
  let c = fs.readFileSync(files.cfg, 'utf-8');
  if (c.includes('ProfileCompletion')) {
    console.log('  SKIP: already applied');
  } else {
    const compCode = `\n// F-04: Profile completion bar\nfunction ProfileCompletion({ name, cnpj, email, phone, address, logo }) {\n  var fields = [\n    { l: "Nome", ok: !!name }, { l: "CNPJ", ok: !!cnpj }, { l: "E-mail", ok: !!email },\n    { l: "Telefone", ok: !!phone }, { l: "Endere\\u00e7o", ok: !!address }, { l: "Logo", ok: !!logo },\n  ];\n  var done = fields.filter(function(f){return f.ok}).length;\n  var pct = Math.round((done / fields.length) * 100);\n  var allDone = pct === 100;\n  return (\n    <View style={{ backgroundColor: allDone ? Colors.greenD : Colors.violetD, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: allDone ? Colors.green + "33" : Colors.border2, marginBottom: 24 }}>\n      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>\n        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>\n          <Icon name={allDone ? "check" : "star"} size={16} color={allDone ? Colors.green : Colors.violet3} />\n          <Text style={{ fontSize: 14, color: Colors.ink, fontWeight: "700" }}>{allDone ? "Perfil completo!" : "Complete seu perfil"}</Text>\n        </View>\n        <Text style={{ fontSize: 13, color: allDone ? Colors.green : Colors.violet3, fontWeight: "700" }}>{pct}%</Text>\n      </View>\n      <View style={{ height: 6, backgroundColor: Colors.bg4, borderRadius: 3, overflow: "hidden" }}>\n        <View style={{ height: 6, width: pct + "%", backgroundColor: allDone ? Colors.green : Colors.violet, borderRadius: 3 }} />\n      </View>\n      {!allDone && <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 }}>\n        {fields.filter(function(f){return !f.ok}).map(function(f){ return <View key={f.l} style={{ backgroundColor: Colors.bg4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}><Text style={{ fontSize: 10, color: Colors.ink3, fontWeight: "500" }}>Falta: {f.l}</Text></View>; })}\n      </View>}\n    </View>\n  );\n}\n`;

    const exportIdx = c.indexOf('export default function');
    if (exportIdx > -1) {
      c = c.slice(0, exportIdx) + compCode + c.slice(exportIdx);

      // Insert <ProfileCompletion> after <PageHeader>
      const phIdx = c.indexOf('<PageHeader');
      if (phIdx > -1) {
        const phEnd = c.indexOf('/>', phIdx);
        if (phEnd > -1) {
          const insertAt = phEnd + 2;
          c = c.slice(0, insertAt) + '\n      <ProfileCompletion name={companyName} cnpj={cnpj} email={email} phone={phone} address={address} logo={companyLogo || ""} />' + c.slice(insertAt);
        }
      }
      fs.writeFileSync(files.cfg, c, 'utf-8');
      console.log('  OK: ProfileCompletion bar added');
      total++;
    }
  }
}

// ═══════════════════════════════════════════════════════════
console.log(`\n========================================`);
console.log(`DONE: ${total} changes applied`);
console.log(`========================================`);
if (total > 0) {
  console.log(`\nRun:`);
  console.log(`  git add -A`);
  console.log(`  git commit -m "feat: WOW + DD + flow effects"`);
  console.log(`  git push origin main`);
  console.log(`  npx expo export --platform web`);
  console.log(`  cd ../aura-site && rm -rf app && cp -r ../aura-app/dist app`);
  console.log(`  git add -A && git commit -m "deploy: app com efeitos WOW" && git push origin main`);
} else {
  console.log(`\nNo changes needed - all effects already applied or files not found.`);
  console.log(`Check the diagnostic output above for details.`);
}
