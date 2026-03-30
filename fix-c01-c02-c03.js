// fix-c01-c02-c03.js
// Run from aura-app root: node fix-c01-c02-c03.js
// Applies C-01 (dashboard docs), C-02 (BackButton), C-03 (tab naming)

const fs = require('fs');
let totalChanges = 0;

function fix(file, replacements) {
  if (!fs.existsSync(file)) { console.log(`SKIP: ${file} not found`); return; }
  let content = fs.readFileSync(file, 'utf-8');
  let fileChanges = 0;
  for (const [label, old, replacement] of replacements) {
    if (content.includes(old)) {
      content = content.replace(old, replacement);
      console.log(`  OK: ${label}`);
      fileChanges++;
    } else {
      console.log(`  SKIP: ${label} (already applied or not found)`);
    }
  }
  if (fileChanges > 0) {
    fs.writeFileSync(file, content, 'utf-8');
    totalChanges += fileChanges;
  }
  return fileChanges;
}

// ── C-03: Tab naming ──────────────────────────────
console.log('\n=== C-03: Tab naming (folha.tsx) ===');
fix('app/(tabs)/folha.tsx', [
  ['Tab "Calcular folha" -> "Resumo mensal"', '"Calcular folha"', '"Resumo mensal"'],
]);

// ── C-02: BackButton in folha ──────────────────────
console.log('\n=== C-02: BackButton + toast (folha.tsx) ===');
fix('app/(tabs)/folha.tsx', [
  ['Add BackButton + toast imports',
    'import { useAuthStore } from "@/stores/auth";',
    'import { useAuthStore } from "@/stores/auth";\nimport { BackButton } from "@/components/BackButton";\nimport { toast } from "@/components/Toast";'],
  ['Replace inline Voltar with BackButton',
    '<Pressable onPress={onBack} style={{marginBottom:16}}><Text style={{fontSize:13,color:Colors.violet3,fontWeight:"600"}}>Voltar</Text></Pressable>',
    '<BackButton onPress={onBack} />'],
  ['Alert.alert -> toast.success',
    'Alert.alert("Holerite enviado","Enviado via "+via+" para "+emp.name);',
    'toast.success("Holerite enviado via "+via+" para "+emp.name);'],
  ['Remove Alert from imports',
    'import { View, Text, ScrollView, StyleSheet, Pressable, Platform, Alert }',
    'import { View, Text, ScrollView, StyleSheet, Pressable, Platform }'],
]);

// ── C-01: Dashboard architecture comment ────────────
console.log('\n=== C-01: Dashboard component docs (index.tsx) ===');
fix('app/(tabs)/index.tsx', [
  ['Add architecture comment',
    'import { Icon } from "@/components/Icon";',
    'import { Icon } from "@/components/Icon";\n// Dashboard uses specialized inline components (KPI, QA, SR, OR)\n// Intentionally NOT shared — they have dashboard-specific features\n// (highlight mode, delta badges, icon bg colors, hover effects)\n// Shared components: Icon, DemoTour'],
]);

console.log(`\n=== DONE: ${totalChanges} total changes ===`);
console.log('Run:');
console.log('  git add -A');
console.log('  git commit -m "fix: C-01 dashboard docs + C-02 BackButton + C-03 tab naming"');
console.log('  git push origin main');
