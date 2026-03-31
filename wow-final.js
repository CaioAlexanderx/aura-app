// wow-final.js
// Run from aura-app root: node wow-final.js

const fs = require('fs');
const p = require('path');
let total = 0;

// ── DIAGNOSTIC ──────────────────────────────────
console.log('=== DIAGNOSTIC ===');
console.log('CWD:', process.cwd());

// List what's in app/
try {
  const appDir = fs.readdirSync('app');
  console.log('app/ contents:', appDir.join(', '));
} catch(e) { console.log('app/ NOT FOUND'); }

// Find files robustly using path.join
const F = {
  layout:  p.join('app', '(tabs)', '_layout.tsx'),
  dash:    p.join('app', '(tabs)', 'index.tsx'),
  login:   p.join('app', '(auth)', 'login.tsx'),
  register:p.join('app', '(auth)', 'register.tsx'),
  onb:     p.join('app', '(tabs)', 'onboarding.tsx'),
  cfg:     p.join('app', '(tabs)', 'configuracoes.tsx'),
  folha:   p.join('app', '(tabs)', 'folha.tsx'),
  root:    p.join('app', '_layout.tsx'),
  empty:   p.join('components', 'EmptyState.tsx'),
  tour:    p.join('components', 'DemoTour.tsx'),
};

Object.entries(F).forEach(([k, f]) => {
  console.log(`  ${k}: ${fs.existsSync(f) ? 'OK (' + fs.readFileSync(f,'utf-8').length + ' chars)' : 'NOT FOUND'} [${f}]`);
});

// ── APPLY EFFECTS ───────────────────────────────

// DD-01/02/03/04 + W-04 + W-08: Global CSS
console.log('\n=== DD + W-04 + W-08: CSS global ===');
if (fs.existsSync(F.layout)) {
  let c = fs.readFileSync(F.layout, 'utf-8');
  if (c.includes('aura-wow-css')) {
    console.log('  SKIP: already applied');
  } else {
    const idx = c.lastIndexOf('document.head.appendChild');
    if (idx > -1) {
      const lineEnd = c.indexOf('\n', idx);
      const css = `\n    if (!document.getElementById("aura-wow-css")) { const wc = document.createElement("style"); wc.id = "aura-wow-css"; wc.textContent = "* { font-variant-numeric: tabular-nums; } a, button, [role=button] { cursor: pointer !important; } ::selection { background: rgba(124,58,237,0.3); color: inherit; } ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.25); border-radius: 3px; } ::-webkit-scrollbar-thumb:hover { background: rgba(124,58,237,0.4); } @keyframes auraStagger { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } } @keyframes auraBounce { 0% { transform: scale(1); } 40% { transform: scale(1.12); } 70% { transform: scale(0.95); } 100% { transform: scale(1); } }"; document.head.appendChild(wc); }`;
      c = c.slice(0, lineEnd) + css + c.slice(lineEnd);
      fs.writeFileSync(F.layout, c, 'utf-8');
      console.log('  OK: CSS global injected'); total += 6;
    } else { console.log('  FAIL: appendChild not found'); }
  }
}

// W-05: Sidebar active bar
console.log('\n=== W-05: Sidebar bar ===');
if (fs.existsSync(F.layout)) {
  let c = fs.readFileSync(F.layout, 'utf-8');
  if (c.includes('borderLeftWidth')) {
    console.log('  SKIP: already applied');
  } else {
    let replaced = false;
    c = c.replace(/a && \{ backgroundColor: C\.violetD \}/, (m) => {
      if (!replaced) { replaced = true; return 'a && { backgroundColor: C.violetD, borderLeftWidth: 3, borderLeftColor: C.violet }'; }
      return m;
    });
    if (replaced) { fs.writeFileSync(F.layout, c, 'utf-8'); console.log('  OK'); total++; }
    else { console.log('  SKIP: pattern not found'); }
  }
}

// W-01: Gradient animation login/register
console.log('\n=== W-01: Gradient animation ===');
[F.login, F.register].forEach(f => {
  if (!fs.existsSync(f)) { console.log('  SKIP: ' + f); return; }
  let c = fs.readFileSync(f, 'utf-8');
  if (c.includes('auraGrad')) { console.log('  SKIP: ' + f + ' done'); return; }
  const css = `\n// W-01\nif (typeof document !== "undefined" && !document.getElementById("aura-grad")) { const _g = document.createElement("style"); _g.id = "aura-grad"; _g.textContent = "@keyframes auraGrad{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}"; document.head.appendChild(_g); }\n`;
  const idx = c.indexOf('export default function');
  if (idx > -1) {
    c = c.slice(0, idx) + css + c.slice(idx);
    if (c.includes("background: `radial-gradient")) {
      c = c.replace("background: `radial-gradient", 'backgroundSize: "200% 200%", animation: "auraGrad 15s ease infinite", background: `radial-gradient');
    }
    fs.writeFileSync(f, c, 'utf-8');
    console.log('  OK: ' + f); total++;
  }
});

// W-02: Count-up hook
console.log('\n=== W-02: Count-up ===');
if (fs.existsSync(F.dash)) {
  let c = fs.readFileSync(F.dash, 'utf-8');
  if (c.includes('useCountUp')) { console.log('  SKIP: done'); }
  else {
    if (!c.includes('useRef')) {
      if (c.includes('useState, useEffect')) c = c.replace('useState, useEffect', 'useState, useEffect, useRef');
      else if (c.includes('{ useState }')) c = c.replace('{ useState }', '{ useState, useEffect, useRef }');
    }
    const hook = `\n// W-02: Count-up\nfunction useCountUp(target, dur) { dur = dur || 1200; const [v, sv] = useState(0); const r = useRef(null); useEffect(function(){ var t0 = Date.now(); function tick(){ var p = Math.min((Date.now()-t0)/dur,1); sv(Math.floor(target*(1-Math.pow(1-p,3)))); if(p<1) r.current=requestAnimationFrame(tick); } r.current=requestAnimationFrame(tick); return function(){cancelAnimationFrame(r.current)}; },[target]); return v; }\n`;
    const idx = c.indexOf('export default function');
    if (idx > -1) { c = c.slice(0,idx) + hook + c.slice(idx); fs.writeFileSync(F.dash, c, 'utf-8'); console.log('  OK'); total++; }
  }
}

// W-03: Sparkline
console.log('\n=== W-03: Sparkline ===');
if (fs.existsSync(F.dash)) {
  let c = fs.readFileSync(F.dash, 'utf-8');
  if (c.includes('Sparkline')) { console.log('  SKIP: done'); }
  else {
    const spark = `\n// W-03: Sparkline\nfunction Sparkline({ data, color, w, h }) { w=w||60; h=h||20; if(Platform.OS!=="web"||!data||data.length<2) return null; var mx=Math.max.apply(null,data),mn=Math.min.apply(null,data),r=mx-mn||1; var pts=data.map(function(v,i){return((i/(data.length-1))*w)+","+(h-((v-mn)/r)*(h-4)-2)}).join(" "); return <div style={{width:w,height:h,marginTop:4}} dangerouslySetInnerHTML={{__html:'<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'"><polyline points="'+pts+'" fill="none" stroke="'+color+'" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/></svg>'}} />; }\n`;
    const idx = c.indexOf('export default function');
    if (idx > -1) { c = c.slice(0,idx) + spark + c.slice(idx); fs.writeFileSync(F.dash, c, 'utf-8'); console.log('  OK'); total++; }
  }
}

// W-06: Pulse
console.log('\n=== W-06: Pulse ===');
if (fs.existsSync(F.empty)) {
  let c = fs.readFileSync(F.empty, 'utf-8');
  if (c.includes('auraPulse')) { console.log('  SKIP: done'); }
  else {
    const pulse = `\n// W-06\nif (typeof document !== "undefined" && !document.getElementById("aura-pulse")) { const _p = document.createElement("style"); _p.id = "aura-pulse"; _p.textContent = "@keyframes auraPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.06);opacity:0.7}}"; document.head.appendChild(_p); }\n`;
    const idx = c.indexOf('export');
    if (idx > -1) { c = c.slice(0,idx) + pulse + c.slice(idx); fs.writeFileSync(F.empty, c, 'utf-8'); console.log('  OK'); total++; }
  }
}

// W-07: Confetti
console.log('\n=== W-07: Confetti ===');
if (fs.existsSync(F.onb)) {
  let c = fs.readFileSync(F.onb, 'utf-8');
  if (c.includes('confettiFall')) { console.log('  SKIP: done'); }
  else {
    const conf = `\n// W-07\nif (typeof document !== "undefined" && !document.getElementById("aura-confetti")) { const _c = document.createElement("style"); _c.id = "aura-confetti"; _c.textContent = "@keyframes confettiFall{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}"; document.head.appendChild(_c); }\n`;
    const idx = c.indexOf('export default function');
    if (idx > -1) { c = c.slice(0,idx) + conf + c.slice(idx); fs.writeFileSync(F.onb, c, 'utf-8'); console.log('  OK'); total++; }
  }
}

// F-01: Splash CSS
console.log('\n=== F-01: Splash ===');
if (fs.existsSync(F.root)) {
  let c = fs.readFileSync(F.root, 'utf-8');
  if (c.includes('aura-splash')) { console.log('  SKIP: done'); }
  else {
    const splash = `// F-01\nif (typeof document !== "undefined" && !document.getElementById("aura-splash")) { const _s = document.createElement("style"); _s.id = "aura-splash"; _s.textContent = "@keyframes splashFade{0%{opacity:1}80%{opacity:1}100%{opacity:0}} @keyframes splashLogo{0%{opacity:0;transform:scale(0.8)}30%{opacity:1;transform:scale(1.02)}50%,100%{opacity:1;transform:scale(1)}} @keyframes splashRing{0%{opacity:0;transform:scale(0.6)}40%{opacity:0.4;transform:scale(1)}100%{opacity:0.2;transform:scale(1.1)}}"; document.head.appendChild(_s); }\n\n`;
    c = splash + c;
    fs.writeFileSync(F.root, c, 'utf-8'); console.log('  OK'); total++;
  }
}

// F-02: Tour fullscreen
console.log('\n=== F-02: Tour fullscreen ===');
if (fs.existsSync(F.tour)) {
  let c = fs.readFileSync(F.tour, 'utf-8');
  if (c.includes('step === 0')) { console.log('  SKIP: done'); }
  else if (c.includes('0.35')) {
    c = c.replace('0.35', '(step === 0 ? 0.92 : 0.35)');
    fs.writeFileSync(F.tour, c, 'utf-8'); console.log('  OK'); total++;
  } else { console.log('  SKIP: pattern not found'); }
}

// F-04: Profile completion
console.log('\n=== F-04: Profile completion ===');
if (fs.existsSync(F.cfg)) {
  let c = fs.readFileSync(F.cfg, 'utf-8');
  if (c.includes('ProfileCompletion')) { console.log('  SKIP: done'); }
  else {
    const comp = `\n// F-04\nfunction ProfileCompletion({ name, cnpj, email, phone, address, logo }) {\n  var fields = [{l:"Nome",ok:!!name},{l:"CNPJ",ok:!!cnpj},{l:"E-mail",ok:!!email},{l:"Telefone",ok:!!phone},{l:"Endere\\u00e7o",ok:!!address},{l:"Logo",ok:!!logo}];\n  var done = fields.filter(function(f){return f.ok}).length, pct = Math.round((done/fields.length)*100), allDone = pct===100;\n  return (\n    <View style={{backgroundColor:allDone?Colors.greenD:Colors.violetD,borderRadius:16,padding:20,borderWidth:1,borderColor:allDone?Colors.green+"33":Colors.border2,marginBottom:24}}>\n      <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>\n        <View style={{flexDirection:"row",alignItems:"center",gap:8}}>\n          <Icon name={allDone?"check":"star"} size={16} color={allDone?Colors.green:Colors.violet3} />\n          <Text style={{fontSize:14,color:Colors.ink,fontWeight:"700"}}>{allDone?"Perfil completo!":"Complete seu perfil"}</Text>\n        </View>\n        <Text style={{fontSize:13,color:allDone?Colors.green:Colors.violet3,fontWeight:"700"}}>{pct}%</Text>\n      </View>\n      <View style={{height:6,backgroundColor:Colors.bg4,borderRadius:3,overflow:"hidden"}}>\n        <View style={{height:6,width:pct+"%",backgroundColor:allDone?Colors.green:Colors.violet,borderRadius:3}} />\n      </View>\n      {!allDone && <View style={{flexDirection:"row",flexWrap:"wrap",gap:6,marginTop:12}}>\n        {fields.filter(function(f){return !f.ok}).map(function(f){return <View key={f.l} style={{backgroundColor:Colors.bg4,borderRadius:6,paddingHorizontal:8,paddingVertical:4}}><Text style={{fontSize:10,color:Colors.ink3,fontWeight:"500"}}>Falta: {f.l}</Text></View>})}\n      </View>}\n    </View>\n  );\n}\n`;
    const idx = c.indexOf('export default function');
    if (idx > -1) {
      c = c.slice(0,idx) + comp + c.slice(idx);
      // Insert after PageHeader
      const phIdx = c.indexOf('<PageHeader');
      if (phIdx > -1) {
        const phEnd = c.indexOf('/>', phIdx);
        if (phEnd > -1) {
          const insertAt = phEnd + 2;
          c = c.slice(0,insertAt) + '\n      <ProfileCompletion name={companyName} cnpj={cnpj} email={email} phone={phone} address={address} logo={companyLogo||""} />' + c.slice(insertAt);
        }
      }
      fs.writeFileSync(F.cfg, c, 'utf-8'); console.log('  OK'); total++;
    }
  }
}

console.log(`\n========================================`);
console.log(`DONE: ${total} changes applied`);
console.log(`========================================`);
if (total > 0) {
  console.log(`\nRun:`);
  console.log(`  git add -A`);
  console.log(`  git commit -m "feat: WOW + DD + flow effects"`);
  console.log(`  git push origin main`);
}
