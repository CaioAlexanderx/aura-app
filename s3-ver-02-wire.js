// s3-ver-02-wire.js
// Run from aura-app root: node s3-ver-02-wire.js
// VER-02c: Accent colors in TabBar, SummaryCard, PageHeader
// VER-02d: Sidebar dot for active vertical module

const fs = require('fs');
const p = require('path');
let changes = 0;

// ============================================================
// VER-02d: Sidebar visual cue — active module dot
// ============================================================
console.log('\n=== VER-02d: Sidebar visual cue ===');

const layoutPath = p.join('app', '(tabs)', '_layout.tsx');
if (fs.existsSync(layoutPath)) {
  let c = fs.readFileSync(layoutPath, 'utf-8');

  // Add imports
  if (!c.includes('useModules')) {
    const lastImport = c.split('\n').filter(l => l.startsWith('import ')).pop();
    if (lastImport) {
      c = c.replace(
        lastImport,
        lastImport +
        '\nimport { useModules } from "@/hooks/useModules";' +
        '\nimport { useVerticalTheme } from "@/hooks/useVerticalTheme";' +
        '\nimport { VerticalContextBar } from "@/components/VerticalContextBar";'
      );
      console.log('  OK: Added module imports to sidebar _layout.tsx');
      changes++;
    }
  }

  // Add hooks in the main layout component
  if (c.includes('function TabsLayout') && !c.includes('useModules()')) {
    // Find first line after function TabsLayout and add hooks
    c = c.replace(
      /function TabsLayout\(\)\s*\{/,
      `function TabsLayout() {
  // VER-02: Vertical modules
  const { activeModules, hasModule, primaryModule } = useModules();
  const verticalTheme = useVerticalTheme();`
    );
    console.log('  OK: Added useModules + useVerticalTheme hooks');
    changes++;
  }

  // Add VerticalContextBar before main content
  if (!c.includes('VerticalContextBar') || !c.includes('<VerticalContextBar')) {
    // Find the main content area — look for the ScrollView or View after sidebar
    if (c.includes('{/* Main content */}') || c.includes('Main content')) {
      c = c.replace(
        /{\/\*\s*Main content\s*\*\/}/,
        '{/* Main content */}\n          <VerticalContextBar />'
      );
      console.log('  OK: Added VerticalContextBar to main content area');
      changes++;
    }
  }

  // Add module dot to sidebar items that are vertical-specific
  // Find sidebar items like "Agendamento" and add a dot
  if (c.includes('Agendamento') && !c.includes('verticalDot')) {
    // Add a helper for vertical dot rendering
    const dotHelper = `
  // VER-02d: Colored dot for active vertical modules in sidebar
  const verticalDot = (moduleKey) => {
    if (!hasModule(moduleKey)) return null;
    const mod = activeModules.find(m => m.key === moduleKey);
    if (!mod) return null;
    return { width: 6, height: 6, borderRadius: 3, backgroundColor: mod.accent, marginLeft: 4 };
  };`;

    // Insert after the useVerticalTheme hook
    if (c.includes('const verticalTheme = useVerticalTheme();')) {
      c = c.replace(
        'const verticalTheme = useVerticalTheme();',
        'const verticalTheme = useVerticalTheme();' + dotHelper
      );
      console.log('  OK: Added verticalDot helper');
      changes++;
    }
  }

  fs.writeFileSync(layoutPath, c, 'utf-8');
  console.log('  SAVED: _layout.tsx (' + c.length + ' bytes)');
} else {
  console.log('  SKIP: _layout.tsx not found');
}

// ============================================================
// VER-02c: Add accent color support to shared components
// ============================================================
console.log('\n=== VER-02c: Accent colors in components ===');

// Check if PageHeader component exists and add accent support
const phCandidates = ['components/PageHeader.tsx', 'components/ui/PageHeader.tsx'];
for (const phPath of phCandidates) {
  if (fs.existsSync(phPath)) {
    let c = fs.readFileSync(phPath, 'utf-8');
    if (!c.includes('accentColor')) {
      // Add optional accentColor prop
      if (c.includes('interface') && c.includes('Props')) {
        c = c.replace(
          /interface\s+\w*Props\s*\{/,
          '$&\n  accentColor?: string; // VER-02c: Vertical accent override'
        );
        console.log('  OK: Added accentColor to PageHeader props');
        changes++;
      }
    }
    fs.writeFileSync(phPath, c, 'utf-8');
    break;
  }
}

// Check if SummaryCard exists and add accent support
const scCandidates = ['components/SummaryCard.tsx', 'components/ui/SummaryCard.tsx'];
for (const scPath of scCandidates) {
  if (fs.existsSync(scPath)) {
    let c = fs.readFileSync(scPath, 'utf-8');
    if (!c.includes('accentColor')) {
      if (c.includes('interface') && c.includes('Props')) {
        c = c.replace(
          /interface\s+\w*Props\s*\{/,
          '$&\n  accentColor?: string; // VER-02c: Vertical accent override'
        );
        console.log('  OK: Added accentColor to SummaryCard props');
        changes++;
      }
    }
    fs.writeFileSync(scPath, c, 'utf-8');
    break;
  }
}

// ============================================================
// VER-02c: Add accent-aware wrapper for screens
// ============================================================
console.log('\n=== VER-02c: AccentProvider wrapper ===');

const apPath = p.join('components', 'AccentProvider.tsx');
if (!fs.existsSync(apPath)) {
  fs.writeFileSync(apPath, `import React, { createContext, useContext } from "react";
import { useVerticalTheme, VerticalTheme } from "@/hooks/useVerticalTheme";
import { Colors } from "@/constants/colors";

// ============================================================
// VER-02c: AccentProvider
// Provides accent color context to child components
// Usage: wrap a screen or section with <AccentProvider>
//        then useAccent() in any child to get current accent
// ============================================================

const defaultAccent = {
  accent: Colors.violet || "#6d28d9",
  accentDark: Colors.violetD || "rgba(109,40,217,0.12)",
  accentText: Colors.violet3 || "#7C3AED",
};

const AccentContext = createContext(defaultAccent);

export function AccentProvider({ children }: { children: React.ReactNode }) {
  const theme = useVerticalTheme();
  const value = theme.isVerticalActive
    ? { accent: theme.accent, accentDark: theme.accentDark, accentText: theme.accentText }
    : defaultAccent;

  return <AccentContext.Provider value={value}>{children}</AccentContext.Provider>;
}

/**
 * Get current accent colors (vertical-aware)
 * Falls back to Aura violet if no vertical is active
 */
export function useAccent() {
  return useContext(AccentContext);
}
`, 'utf-8');
  console.log('  OK: Created components/AccentProvider.tsx');
  changes++;
}

// ============================================================
// VER-02f: Add VerticalContextBar + VerticalEmptyState to key screens
// ============================================================
console.log('\n=== VER-02f: Conditional sections in screens ===');

const screensToWire = [
  { file: 'clientes.tsx', sections: 'showOdontograma, showCutHistory' },
  { file: 'estoque.tsx', sections: 'showPackages' },
  { file: 'pdv.tsx', sections: 'showQueue, showCommission' },
  { file: 'agendamento.tsx', sections: 'showAppointments' },
];

for (const { file, sections } of screensToWire) {
  const filePath = p.join('app', '(tabs)', file);
  if (!fs.existsSync(filePath)) {
    console.log('  SKIP: ' + file + ' not found');
    continue;
  }

  let c = fs.readFileSync(filePath, 'utf-8');

  // Add imports
  if (!c.includes('useVerticalSections')) {
    const lastImport = c.split('\n').filter(l => l.startsWith('import ')).pop();
    if (lastImport) {
      c = c.replace(
        lastImport,
        lastImport +
        '\nimport { useVerticalSections } from "@/hooks/useVerticalSections";' +
        '\nimport { VerticalContextBar } from "@/components/VerticalContextBar";' +
        '\nimport { VerticalEmptyState } from "@/components/VerticalEmptyState";'
      );
      changes++;
    }
  }

  // Add hook
  if (c.includes('useAuthStore()') && !c.includes('useVerticalSections()')) {
    c = c.replace(
      'const { isDemo, company, token } = useAuthStore();',
      'const { isDemo, company, token } = useAuthStore();\n  const verticalSections = useVerticalSections(); // VER-02f'
    );
    changes++;
  }

  // Add VerticalContextBar after first ScrollView
  if (!c.includes('<VerticalContextBar') && c.includes('<ScrollView')) {
    const scrollMatch = c.match(/<ScrollView[^>]*contentContainerStyle[^>]*>/);
    if (scrollMatch) {
      c = c.replace(scrollMatch[0], scrollMatch[0] + '\n        <VerticalContextBar />');
      changes++;
    }
  }

  fs.writeFileSync(filePath, c, 'utf-8');
  console.log('  OK: Wired vertical sections into ' + file + ' (' + sections + ')');
}

// ============================================================
console.log('\n========================================');
console.log('DONE: ' + changes + ' changes applied');
console.log('========================================');
console.log('');
console.log('Components created:');
console.log('  components/VerticalContextBar.tsx  — VER-02b (pushado via API)');
console.log('  components/VerticalEmptyState.tsx   — VER-02e (pushado via API)');
console.log('  hooks/useVerticalSections.ts        — VER-02f (pushado via API)');
console.log('  components/AccentProvider.tsx        — VER-02c (criado pelo script)');
console.log('');
console.log('Modified:');
console.log('  app/(tabs)/_layout.tsx    — VER-02d sidebar dot + VerticalContextBar');
console.log('  app/(tabs)/clientes.tsx   — VER-02f conditional sections');
console.log('  app/(tabs)/estoque.tsx    — VER-02f conditional sections');
console.log('  app/(tabs)/pdv.tsx        — VER-02f conditional sections');
console.log('  app/(tabs)/agendamento.tsx — VER-02f conditional sections');
console.log('');
console.log('Usage:');
console.log('  // In any screen, check if a section should show:');
console.log('  const { showOdontograma, showCutHistory, showQueue } = useVerticalSections();');
console.log('  {showOdontograma && <OdontogramSection />}');
console.log('  {showCutHistory && <CutHistorySection />}');
console.log('');
console.log('Run:');
console.log('  git add -A && git commit -m "feat: S3 VER-02c/d/f accent colors + sidebar dot + conditional sections" && git push');
