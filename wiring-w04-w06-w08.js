// wiring-w04-w06-w08.js
// Run from aura-app root: node wiring-w04-w06-w08.js

const fs = require('fs');
const p = require('path');
let total = 0;

const dash = p.join('app', '(tabs)', 'index.tsx');
const empty = p.join('components', 'EmptyState.tsx');

// ═══════════════════════════════════════════════════
// W-04: Stagger animation on KPI cards
// Add index-based animation delay to each KPI card
// ═══════════════════════════════════════════════════
console.log('\n=== W-04: Stagger animation nos KPI cards ===');

if (fs.existsSync(dash)) {
  let c = fs.readFileSync(dash, 'utf-8');
  
  if (c.includes('animationDelay')) {
    console.log('  SKIP: stagger already wired');
  } else {
    // 1. Add idx prop to KPI component
    c = c.replace(
      'function KPI({ic,iconColor,label,value,delta,deltaUp,large,onPress,sparkData,sparkColor}:{ic:string;iconColor:string;label:string;value:string;delta?:string;deltaUp?:boolean;large?:boolean;onPress?:()=>void})',
      'function KPI({ic,iconColor,label,value,delta,deltaUp,large,onPress,sparkData,sparkColor,idx}:{ic:string;iconColor:string;label:string;value:string;delta?:string;deltaUp?:boolean;large?:boolean;onPress?:()=>void;idx?:number})'
    );
    
    // 2. Apply animation to HC wrapper in KPI
    c = c.replace(
      '  return <HC style={[k.card,large&&k.large]} highlight={large} onPress={onPress}>',
      '  return <HC style={[k.card,large&&k.large,Platform.OS==="web"&&{animation:"auraStagger 0.5s ease-out both",animationDelay:(idx||0)*0.08+"s"}as any]} highlight={large} onPress={onPress}>'
    );
    
    // 3. Add idx to each KPI render call
    let kpiIdx = 0;
    c = c.replace(/<KPI ic="/g, () => {
      const result = `<KPI idx={${kpiIdx}} ic="`;
      kpiIdx++;
      return result;
    });
    
    fs.writeFileSync(dash, c, 'utf-8');
    console.log('  OK: KPI cards now stagger with 80ms delay each');
    total++;
  }
}

// ═══════════════════════════════════════════════════
// W-08: Micro-bounce on Quick Actions hover
// ═══════════════════════════════════════════════════
console.log('\n=== W-08: Micro-bounce nos Quick Actions ===');

if (fs.existsSync(dash)) {
  let c = fs.readFileSync(dash, 'utf-8');
  
  if (c.includes('auraBounce')) {
    console.log('  SKIP: bounce already wired');
  } else {
    // Add bounce animation to QA icon wrapper on hover
    // Current: h&&{backgroundColor:iconColor+"18",borderColor:iconColor+"55",transform:[{scale:1.1},{translateY:-2}]}
    // Replace with bounce animation
    c = c.replace(
      'h&&{backgroundColor:iconColor+"18",borderColor:iconColor+"55",transform:[{scale:1.1},{translateY:-2}]},w&&{transition:"all 0.2s ease"}as any]',
      'h&&{backgroundColor:iconColor+"18",borderColor:iconColor+"55",animation:"auraBounce 0.4s ease"},w&&{transition:"all 0.2s ease"}as any]'
    );
    
    fs.writeFileSync(dash, c, 'utf-8');
    console.log('  OK: Quick Action icons bounce on hover');
    total++;
  }
}

// ═══════════════════════════════════════════════════
// W-06: Pulse animation on empty state circles
// ═══════════════════════════════════════════════════
console.log('\n=== W-06: Pulse nos empty state circles ===');

if (fs.existsSync(empty)) {
  let c = fs.readFileSync(empty, 'utf-8');
  
  if (c.includes('auraPulse') && c.includes('animation')) {
    console.log('  SKIP: pulse already wired to circles');
  } else if (c.includes('auraPulse')) {
    // CSS is injected but not applied to the circles
    // Add animation to circleOuter style
    c = c.replace(
      'circleOuter: {\n    width: 88,\n    height: 88,\n    borderRadius: 44,\n    backgroundColor: Colors.violetD,\n    alignItems: "center",\n    justifyContent: "center",\n    borderWidth: 1,\n    borderColor: Colors.border2,\n  }',
      'circleOuter: {\n    width: 88,\n    height: 88,\n    borderRadius: 44,\n    backgroundColor: Colors.violetD,\n    alignItems: "center",\n    justifyContent: "center",\n    borderWidth: 1,\n    borderColor: Colors.border2,\n    ...(Platform.OS === "web" ? { animation: "auraPulse 3s ease-in-out infinite" } : {}),\n  }'
    );
    
    if (c.includes('animation: "auraPulse')) {
      fs.writeFileSync(empty, c, 'utf-8');
      console.log('  OK: Outer circle now pulses (3s loop)');
      total++;
    } else {
      console.log('  WARN: Could not wire pulse to circleOuter style');
    }
  } else {
    console.log('  SKIP: pulse CSS not found');
  }
}

// ═══════════════════════════════════════════════════
console.log(`\n========================================`);
console.log(`DONE: ${total} wirings applied`);
console.log(`========================================`);
if (total > 0) {
  console.log(`\nRun:`);
  console.log(`  git add -A`);
  console.log(`  git commit -m "feat: wire W-04 stagger + W-06 pulse + W-08 bounce"`);
  console.log(`  git push origin main`);
}
