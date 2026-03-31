// fix-4bugs.js
// Run from aura-app root: node fix-4bugs.js
// FE-BUG-02: Dashboard Unicode
// FE-BUG-03: Login/Register mobile
// FE-BUG-04: Onboarding Unicode
// FE-BUG-05: Folha historico formatacao

const fs = require('fs');
const p = require('path');
let total = 0;

// ═══════════════════════════════════════════════════
// BUG-02 + BUG-04: Fix Unicode escapes in ALL files
// ═══════════════════════════════════════════════════
console.log('\n=== BUG-02 + BUG-04: Unicode fix ===');

// The fix-unicode-all.js handles this, but let's run it inline
const escapeMap = {
  '\\u00e0': '\u00e0', '\\u00e1': '\u00e1', '\\u00e2': '\u00e2', '\\u00e3': '\u00e3',
  '\\u00e7': '\u00e7', '\\u00e8': '\u00e8', '\\u00e9': '\u00e9', '\\u00ea': '\u00ea',
  '\\u00ed': '\u00ed', '\\u00f3': '\u00f3', '\\u00f4': '\u00f4', '\\u00f5': '\u00f5',
  '\\u00fa': '\u00fa', '\\u00fc': '\u00fc',
  '\\u00c0': '\u00c0', '\\u00c1': '\u00c1', '\\u00c2': '\u00c2', '\\u00c3': '\u00c3',
  '\\u00c7': '\u00c7', '\\u00c9': '\u00c9', '\\u00ca': '\u00ca', '\\u00cd': '\u00cd',
  '\\u00d3': '\u00d3', '\\u00d5': '\u00d5', '\\u00da': '\u00da',
  '\\u00aa': '\u00aa', '\\u00ba': '\u00ba', '\\u00b7': '\u00b7',
};

function fixUnicode(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = p.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
      fixUnicode(full);
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
      let c = fs.readFileSync(full, 'utf-8');
      let changed = false;
      for (const [esc, char] of Object.entries(escapeMap)) {
        if (c.includes(esc)) {
          c = c.split(esc).join(char);
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(full, c, 'utf-8');
        console.log('  FIXED: ' + full);
        total++;
      }
    }
  }
}

fixUnicode(p.join('app'));
fixUnicode(p.join('components'));
fixUnicode(p.join('constants'));
fixUnicode(p.join('stores'));

// ═══════════════════════════════════════════════════
// BUG-03: Login/Register mobile layout
// ═══════════════════════════════════════════════════
console.log('\n=== BUG-03: Login/Register mobile ===');

[p.join('app', '(auth)', 'login.tsx'), p.join('app', '(auth)', 'register.tsx')].forEach(file => {
  if (!fs.existsSync(file)) { console.log('  SKIP: ' + file); return; }
  let c = fs.readFileSync(file, 'utf-8');
  const name = p.basename(file);
  let changed = false;

  // Add width detection if missing
  if (!c.includes('innerWidth') && !c.includes('isWideScreen')) {
    // Find isWeb declaration
    const isWebMatch = c.match(/const isWeb\s*=\s*Platform\.OS\s*===\s*"web"\s*;?/);
    if (isWebMatch) {
      const replacement = isWebMatch[0] + '\n  const isWideScreen = isWeb && typeof window !== "undefined" && window.innerWidth > 768;';
      c = c.replace(isWebMatch[0], replacement);
      changed = true;
      console.log('  OK: ' + name + ' - added isWideScreen');
    }
  }

  // Replace the two-panel conditional to use isWideScreen
  // Pattern: isWeb ? ( <div flexDirection: "row" ... two panels ) : ( single panel )
  // We need to change isWeb to isWideScreen for the layout decision
  if (c.includes('isWideScreen') || changed) {
    // Find all instances where isWeb controls the two-panel layout
    // The pattern is: isWeb ? ( followed by flexDirection: "row"
    const twoPanel = /isWeb\s*\?\s*\(\s*\n?\s*<div\s+style=\{\{\s*display:\s*"flex",\s*flexDirection:\s*"row"/g;
    if (twoPanel.test(c)) {
      c = c.replace(twoPanel, 'isWideScreen ? (\n    <div style={{ display: "flex", flexDirection: "row"');
      changed = true;
      console.log('  OK: ' + name + ' - two-panel uses isWideScreen');
    }
  }

  // Make logo smaller on mobile
  if (c.includes('width: 320')) {
    c = c.replace(/width: 320/g, 'width: typeof window !== "undefined" && window.innerWidth <= 768 ? 220 : 320');
    changed = true;
    console.log('  OK: ' + name + ' - logo responsive');
  }

  if (changed) {
    fs.writeFileSync(file, c, 'utf-8');
    total++;
  }
});

// ═══════════════════════════════════════════════════
// BUG-05: Folha historico formatting
// ═══════════════════════════════════════════════════
console.log('\n=== BUG-05: Folha historico ===');

const folha = p.join('app', '(tabs)', 'folha.tsx');
if (fs.existsSync(folha)) {
  let c = fs.readFileSync(folha, 'utf-8');
  let changed = false;

  // Fix the history row - make it stack on mobile
  // Current: row with left (check + info) and right (total + liquido)
  // Problem: on narrow screens, right side content flows into left
  
  // Fix the row style to wrap
  if (c.includes('hs=StyleSheet.create({row:{flexDirection:"row"')) {
    c = c.replace(
      'hs=StyleSheet.create({row:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",backgroundColor:Colors.bg3,borderRadius:14,padding:16,borderWidth:1,borderColor:Colors.border,marginBottom:8}',
      'hs=StyleSheet.create({row:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",backgroundColor:Colors.bg3,borderRadius:14,padding:16,borderWidth:1,borderColor:Colors.border,marginBottom:8,flexWrap:"wrap",gap:8}'
    );
    changed = true;
    console.log('  OK: Row flexWrap added');
  }

  // Fix the right side to have proper spacing and not collapse
  if (c.includes('right:{alignItems:"flex-end",gap:2}')) {
    c = c.replace(
      'right:{alignItems:"flex-end",gap:2}',
      'right:{alignItems:"flex-end",gap:4,flexShrink:0}'
    );
    changed = true;
    console.log('  OK: Right side flexShrink + gap');
  }

  // Fix the left info to have flex:1
  if (c.includes('inf:{gap:2}') && !c.includes('inf:{flex:1')) {
    c = c.replace('inf:{gap:2}', 'inf:{flex:1,gap:2}');
    changed = true;
    console.log('  OK: Left info flex:1');
  }

  // Make the meta text (date) and liquid on separate lines clearly
  if (c.includes('{h.employees} funcionarios - pago em {h.paidAt}')) {
    c = c.replace(
      '<Text style={hs.me}>{h.employees} funcionarios - pago em {h.paidAt}</Text>',
      '<Text style={hs.me}>{h.employees} funcion\u00e1rios \u00b7 pago em {h.paidAt}</Text>'
    );
    changed = true;
    console.log('  OK: Meta text separator fixed');
  }

  if (changed) {
    fs.writeFileSync(folha, c, 'utf-8');
    total++;
  }
}

// ═══════════════════════════════════════════════════
console.log('\n========================================');
console.log('DONE: ' + total + ' fixes applied');
console.log('========================================');
console.log('\nRun:');
console.log('  git add -A && git commit -m "fix: BUG-02 Unicode + BUG-03 auth mobile + BUG-04 onboarding + BUG-05 folha"');
console.log('  git push origin main');
