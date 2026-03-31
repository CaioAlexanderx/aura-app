// wiring.js
// Run from aura-app root: node wiring.js
// Wires W-02 count-up, W-03 sparklines, W-07 confetti, DD-05 tooltips, DD-06 favicon

const fs = require('fs');
const p = require('path');
let total = 0;

function patch(file, label, find, replace) {
  if (!fs.existsSync(file)) { console.log(`  SKIP: ${file} not found`); return false; }
  let c = fs.readFileSync(file, 'utf-8');
  if (!c.includes(find)) { console.log(`  SKIP: ${label} (pattern not found)`); return false; }
  c = c.replace(find, replace);
  fs.writeFileSync(file, c, 'utf-8');
  console.log(`  OK: ${label}`);
  total++;
  return true;
}

const dash = p.join('app', '(tabs)', 'index.tsx');
const onb = p.join('app', '(tabs)', 'onboarding.tsx');
const layout = p.join('app', '(tabs)', '_layout.tsx');

// ═══════════════════════════════════════════════════
// W-02: Wire count-up to hero card value
// ═══════════════════════════════════════════════════
console.log('\n=== W-02: Wire count-up to hero ===');

// The hero value currently shows: {fmt(d.net)}
// Change to: {fmt(useCountUp(d.net))}
patch(dash, 'Hero card count-up',
  '<Text style={s.hv}>{fmt(d.net)}</Text>',
  '<Text style={s.hv}>{fmt(useCountUp(d.net))}</Text>'
);

// ═══════════════════════════════════════════════════
// W-03: Wire sparklines into KPI cards
// ═══════════════════════════════════════════════════
console.log('\n=== W-03: Wire sparklines to KPIs ===');

// Add sparkline data to MOCK
patch(dash, 'Add sparkline data to MOCK',
  'dasAlert:{days:14,amount:76.90}',
  'dasAlert:{days:14,amount:76.90},sparkRevenue:[12400,13800,15200,14100,16800,17200,18420],sparkExpenses:[6200,6800,7100,6900,7400,7600,7840],sparkNet:[6200,7000,8100,7200,9400,9600,10580]'
);

// Add Sparkline to KPI component - inject after delta badge
// Current KPI has: {delta&&<View style=...
// Add sparkline slot to KPI props and render
patch(dash, 'Add sparkData prop to KPI',
  'function KPI({ic,iconColor,label,value,delta,deltaUp,large,onPress}',
  'function KPI({ic,iconColor,label,value,delta,deltaUp,large,onPress,sparkData,sparkColor}'
);

// Add sparkline render after delta badge  
patch(dash, 'Render sparkline in KPI',
  `{delta&&<View style={[k.db,{backgroundColor:deltaUp?Colors.greenD:Colors.redD}]}><Text style={[k.dt,{color:deltaUp?Colors.green:Colors.red}]}>{deltaUp?"+":"-"} {delta}</Text></View>}
  </HC>`,
  `{delta&&<View style={[k.db,{backgroundColor:deltaUp?Colors.greenD:Colors.redD}]}><Text style={[k.dt,{color:deltaUp?Colors.green:Colors.red}]}>{deltaUp?"+":"-"} {delta}</Text></View>}
    {sparkData && <Sparkline data={sparkData} color={sparkColor || Colors.violet3} />}
  </HC>`
);

// Wire sparkline data to the 3 main KPIs
patch(dash, 'Wire sparkline to Receita',
  `<KPI ic="dollar" iconColor={Colors.green} label="RECEITA DO MÊS" value={fmtK(d.revenue)} delta={\`\${d.revenueDelta}% vs anterior\`} deltaUp large onPress={()=>go("/financeiro")}/>`,
  `<KPI ic="dollar" iconColor={Colors.green} label="RECEITA DO MÊS" value={fmtK(d.revenue)} delta={\`\${d.revenueDelta}% vs anterior\`} deltaUp large onPress={()=>go("/financeiro")} sparkData={d.sparkRevenue} sparkColor={Colors.green}/>`
);

patch(dash, 'Wire sparkline to Despesas',
  `<KPI ic="trending_down" iconColor={Colors.red} label="DESPESAS" value={fmtK(d.expenses)} delta={\`\${d.expensesDelta}% vs anterior\`} deltaUp={false} onPress={()=>go("/financeiro")}/>`,
  `<KPI ic="trending_down" iconColor={Colors.red} label="DESPESAS" value={fmtK(d.expenses)} delta={\`\${d.expensesDelta}% vs anterior\`} deltaUp={false} onPress={()=>go("/financeiro")} sparkData={d.sparkExpenses} sparkColor={Colors.red}/>`
);

patch(dash, 'Wire sparkline to Lucro',
  `<KPI ic="trending_up" iconColor={Colors.green} label="LUCRO LÍQUIDO" value={fmtK(d.net)} delta={\`\${d.netDelta}% vs anterior\`} deltaUp large onPress={()=>go("/financeiro")}/>`,
  `<KPI ic="trending_up" iconColor={Colors.green} label="LUCRO LÍQUIDO" value={fmtK(d.net)} delta={\`\${d.netDelta}% vs anterior\`} deltaUp large onPress={()=>go("/financeiro")} sparkData={d.sparkNet} sparkColor={Colors.green}/>`
);

// ═══════════════════════════════════════════════════
// W-07: Wire confetti to onboarding step 5
// ═══════════════════════════════════════════════════
console.log('\n=== W-07: Wire confetti to onboarding ===');

// Add ConfettiEffect component before export
if (fs.existsSync(onb)) {
  let c = fs.readFileSync(onb, 'utf-8');
  if (c.includes('ConfettiEffect')) {
    console.log('  SKIP: ConfettiEffect already exists');
  } else {
    // Add component before export
    const confComp = `
// W-07: Confetti celebration component
function ConfettiEffect() {
  if (Platform.OS !== "web") return null;
  const colors = ["#7c3aed","#8b5cf6","#a78bfa","#c4b5fd","#34d399","#fbbf24"];
  const ps = Array.from({length:35},(_,i)=>({id:i,x:Math.random()*100,d:Math.random()*2,dur:2+Math.random()*2,c:colors[i%6],sz:4+Math.random()*6}));
  return (
    <View style={{position:"absolute",top:0,left:0,right:0,bottom:0,zIndex:50,overflow:"hidden"}} pointerEvents="none">
      {ps.map(pp=><div key={pp.id} style={{position:"absolute",left:pp.x+"%",top:"-5%",width:pp.sz,height:pp.sz,borderRadius:pp.sz>7?1:99,backgroundColor:pp.c,animation:"confettiFall "+pp.dur+"s "+pp.d+"s ease-out forwards"}} />)}
    </View>
  );
}
`;
    c = c.replace('export default function OnboardingScreen', confComp + '\nexport default function OnboardingScreen');
    
    // Add <ConfettiEffect /> to step 4 (the "Pronto!" step)
    c = c.replace(
      '{step === 4 && (\n        <SC>',
      '{step === 4 && (\n        <SC>\n          <ConfettiEffect />'
    );
    
    fs.writeFileSync(onb, c, 'utf-8');
    console.log('  OK: ConfettiEffect component + rendering in step 5');
    total++;
  }
}

// ═══════════════════════════════════════════════════
// DD-05: Sidebar tooltips
// ═══════════════════════════════════════════════════
console.log('\n=== DD-05: Sidebar tooltips ===');

if (fs.existsSync(layout)) {
  let c = fs.readFileSync(layout, 'utf-8');
  if (c.includes('title=')) {
    console.log('  SKIP: tooltips already applied');
  } else {
    // Add title attribute to sidebar items for native tooltip on hover
    // The SI component renders <Pressable> - add a web-only title
    // Find: <Text style={[{ fontSize: 13, color: C.ink3
    // The label is already in the component, we add title to the Pressable
    c = c.replace(
      'onHoverOut={() => sH(false)}\n      style={[{ flexDirection: "row"',
      'onHoverOut={() => sH(false)}\n      {...(Platform.OS === "web" ? { title: l } : {})}\n      style={[{ flexDirection: "row"'
    );
    if (c.includes('title: l')) {
      fs.writeFileSync(layout, c, 'utf-8');
      console.log('  OK: Native tooltips on sidebar items');
      total++;
    } else {
      console.log('  SKIP: SI pattern not matched');
    }
  }
}

// ═══════════════════════════════════════════════════
// DD-06: Favicon integration
// ═══════════════════════════════════════════════════
console.log('\n=== DD-06: Favicon ===');

if (fs.existsSync(layout)) {
  let c = fs.readFileSync(layout, 'utf-8');
  if (c.includes('aura-favicon')) {
    console.log('  SKIP: favicon already applied');
  } else {
    // Inject favicon link in useWebFonts
    const faviconCode = `\n    if (!document.getElementById("aura-favicon")) { const fav = document.createElement("link"); fav.id = "aura-favicon"; fav.rel = "icon"; fav.type = "image/svg+xml"; fav.href = "https://cdn.jsdelivr.net/gh/CaioAlexanderx/aura-app@main/assets/favicon.svg"; document.head.appendChild(fav); const fav2 = document.createElement("link"); fav2.rel = "icon"; fav2.type = "image/jpeg"; fav2.href = "https://cdn.jsdelivr.net/gh/CaioAlexanderx/aura-app@main/assets/Aura.jpeg"; document.head.appendChild(fav2); }`;
    
    // Find the last appendChild in useWebFonts and add after it
    const marker = 'document.head.appendChild(st);';
    if (c.includes(marker)) {
      const idx = c.indexOf(marker) + marker.length;
      c = c.slice(0, idx) + faviconCode + c.slice(idx);
      fs.writeFileSync(layout, c, 'utf-8');
      console.log('  OK: Favicon SVG + JPEG fallback injected');
      total++;
    } else {
      console.log('  SKIP: appendChild(st) not found');
    }
  }
}

// ═══════════════════════════════════════════════════
console.log(`\n========================================`);
console.log(`DONE: ${total} wirings applied`);
console.log(`========================================`);
if (total > 0) {
  console.log(`\nRun:`);
  console.log(`  git add -A`);
  console.log(`  git commit -m "feat: wire W-02 count-up + W-03 sparklines + W-07 confetti + DD-05 tooltips + DD-06 favicon"`);
  console.log(`  git push origin main`);
  console.log(`  node deploy.js`);
  console.log(`  cd ../aura-site && git add -A && git commit -m "deploy: WOW wiring" && git push origin main`);
}
