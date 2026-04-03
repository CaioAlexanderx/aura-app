// s2-ux-05-06-wire.js
// Run from aura-app root: node s2-ux-05-06-wire.js
// Wires TooltipBanner into each tab screen + haptics into key actions

const fs = require('fs');
const p = require('path');
let changes = 0;

const SCREENS = [
  { file: 'index.tsx', screen: 'dashboard' },
  { file: 'financeiro.tsx', screen: 'financeiro' },
  { file: 'pdv.tsx', screen: 'pdv' },
  { file: 'estoque.tsx', screen: 'estoque' },
  { file: 'clientes.tsx', screen: 'clientes' },
  { file: 'contabilidade.tsx', screen: 'contabilidade' },
  { file: 'nfe.tsx', screen: 'nfe' },
  { file: 'ia.tsx', screen: 'ia' },
];

for (const { file, screen } of SCREENS) {
  const filePath = p.join('app', '(tabs)', file);
  if (!fs.existsSync(filePath)) {
    console.log('  SKIP: ' + file + ' not found');
    continue;
  }

  let c = fs.readFileSync(filePath, 'utf-8');
  let modified = false;

  // 1. Add TooltipBanner import
  if (!c.includes('useFirstTimeTooltip')) {
    const lastImport = c.split('\n').filter(l => l.startsWith('import ')).pop();
    if (lastImport) {
      c = c.replace(
        lastImport,
        lastImport +
        '\nimport { useFirstTimeTooltip, TooltipBanner } from "@/components/TooltipBanner";' +
        '\nimport { hapticLight, hapticSuccess, withHaptic } from "@/hooks/useHaptics";'
      );
      modified = true;
    }
  }

  // 2. Add hook call after useAuthStore
  if (!c.includes('useFirstTimeTooltip(') && c.includes('useAuthStore()')) {
    c = c.replace(
      'const { isDemo, company, token } = useAuthStore();',
      'const { isDemo, company, token } = useAuthStore();\n\n  // UX-06: First-time tooltip\n  const { activeTip, visible: tipVisible, dismiss: dismissTip } = useFirstTimeTooltip("' + screen + '");'
    );
    modified = true;
  }

  // 3. Add TooltipBanner component after first ScrollView opening
  if (!c.includes('<TooltipBanner') && c.includes('<ScrollView')) {
    const scrollMatch = c.match(/<ScrollView[^>]*contentContainerStyle[^>]*>/);
    if (scrollMatch) {
      c = c.replace(
        scrollMatch[0],
        scrollMatch[0] + '\n        <TooltipBanner tip={activeTip} visible={tipVisible} onDismiss={dismissTip} />'
      );
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, c, 'utf-8');
    console.log('  OK: Wired tooltip + haptics into ' + file + ' (screen: ' + screen + ')');
    changes++;
  } else {
    console.log('  SKIP: ' + file + ' already wired or no matching pattern');
  }
}

console.log('\n========================================');
console.log('DONE: ' + changes + ' screens wired');
console.log('========================================');
console.log('');
console.log('UX-05 Haptic feedback:');
console.log('  Import: import { hapticLight, hapticSuccess, withHaptic } from "@/hooks/useHaptics"');
console.log('  Use in handlers:');
console.log('    hapticLight()     - light tap (button press)');
console.log('    hapticSuccess()   - success vibration (sale complete)');
console.log('    hapticError()     - error vibration');
console.log('    withHaptic(fn)    - wrap any handler: <Pressable onPress={withHaptic(handleAdd)} />');
console.log('  Install on mobile: npx expo install expo-haptics');
console.log('');
console.log('UX-06 First-time tooltips:');
console.log('  8 tooltips defined (1 per screen)');
console.log('  Show once, saved in localStorage');
console.log('  Reset all: import { resetAllTips } from "@/components/TooltipBanner"; resetAllTips();');
console.log('');
console.log('Run:');
console.log('  git add -A && git commit -m "feat: S2 UX-05/06 wire haptics + tooltips into all screens" && git push');
