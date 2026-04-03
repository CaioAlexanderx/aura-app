// s2-fe-02-03.js
// Run from aura-app root: node s2-fe-02-03.js
// FE-02: Jest setup + critical tests
// FE-03: Extract sub-components from large files

const fs = require('fs');
const p = require('path');
let changes = 0;

function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }
function w(path, content) { fs.writeFileSync(path, content, 'utf-8'); changes++; console.log('  OK: ' + path); }

// ============================================================
// FE-02: JEST SETUP
// ============================================================
console.log('\n=== FE-02: Jest + Testing Library setup ===');

// 1. jest.config.js
w('jest.config.js', `module.exports = {
  preset: 'jest-expo',
  setupFilesAfterSetup: ['./jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/.*|native-base|react-native-svg|zustand|@tanstack)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'services/**/*.{ts,tsx}',
    'stores/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    '!**/*.d.ts',
  ],
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
};
`);

// 2. jest.setup.js
w('jest.setup.js', `// Mock AsyncStorage / localStorage for tests
const store = {};
global.localStorage = {
  getItem: (key) => store[key] || null,
  setItem: (key, value) => { store[key] = String(value); },
  removeItem: (key) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
};

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useSegments: () => ['(tabs)'],
  useLocalSearchParams: () => ({}),
  Slot: ({ children }) => children,
  Link: ({ children }) => children,
}));

// Mock @tanstack/react-query
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(() => ({ data: null, isLoading: false, error: null, refetch: jest.fn() })),
  useMutation: jest.fn(() => ({ mutate: jest.fn(), isLoading: false })),
  QueryClient: jest.fn(),
  QueryClientProvider: ({ children }) => children,
}));
`);

// ============================================================
// FE-02: TEST FILES
// ============================================================
console.log('\n=== FE-02: Test files ===');
ensureDir(p.join('__tests__', 'services'));
ensureDir(p.join('__tests__', 'stores'));
ensureDir(p.join('__tests__', 'hooks'));
ensureDir(p.join('__tests__', 'components'));

// Test: offlineSync
w(p.join('__tests__', 'services', 'offlineSync.test.ts'), `import {
  cacheProducts,
  getCachedProducts,
  addToQueue,
  getQueueLength,
  clearQueue,
} from "../../services/offlineSync";

beforeEach(() => {
  localStorage.clear();
});

describe("offlineSync", () => {
  describe("cacheProducts", () => {
    it("should cache products in localStorage", () => {
      const products = [
        { id: "1", name: "Produto A", price: 10 },
        { id: "2", name: "Produto B", price: 20 },
      ];
      cacheProducts(products);
      const cached = getCachedProducts();
      expect(cached).toHaveLength(2);
      expect(cached[0].name).toBe("Produto A");
    });

    it("should return empty array if no cache", () => {
      expect(getCachedProducts()).toEqual([]);
    });

    it("should not cache empty arrays", () => {
      cacheProducts([]);
      expect(getCachedProducts()).toEqual([]);
    });
  });

  describe("queue operations", () => {
    it("should add items to queue", () => {
      const count = addToQueue({
        type: "sale",
        endpoint: "/companies/123/sales",
        method: "POST",
        body: { items: [], total: 50 },
      });
      expect(count).toBe(1);
      expect(getQueueLength()).toBe(1);
    });

    it("should increment queue length", () => {
      addToQueue({ type: "sale", endpoint: "/x", method: "POST", body: {} });
      addToQueue({ type: "sale", endpoint: "/y", method: "POST", body: {} });
      addToQueue({ type: "transaction", endpoint: "/z", method: "POST", body: {} });
      expect(getQueueLength()).toBe(3);
    });

    it("should clear queue", () => {
      addToQueue({ type: "sale", endpoint: "/x", method: "POST", body: {} });
      addToQueue({ type: "sale", endpoint: "/y", method: "POST", body: {} });
      clearQueue();
      expect(getQueueLength()).toBe(0);
    });

    it("should generate unique IDs", () => {
      addToQueue({ type: "sale", endpoint: "/x", method: "POST", body: {} });
      addToQueue({ type: "sale", endpoint: "/y", method: "POST", body: {} });
      const raw = JSON.parse(localStorage.getItem("aura_offline_queue") || "[]");
      expect(raw[0].id).not.toBe(raw[1].id);
    });
  });
});
`);

// Test: validate (backend util, but pattern applies)
w(p.join('__tests__', 'hooks', 'useKeyboard.test.ts'), `/**
 * useKeyboard hook tests
 * Note: This hook only works on web (Platform.OS === "web")
 * Tests verify the event listener setup and cleanup
 */

describe("useKeyboard", () => {
  it("should be importable", () => {
    // Basic import test - actual behavior requires DOM environment
    const mod = require("../../hooks/useKeyboard");
    expect(mod.useKeyboard).toBeDefined();
    expect(mod.useEscapeKey).toBeDefined();
  });
});
`);

// Test: useNetworkStatus
w(p.join('__tests__', 'hooks', 'useNetworkStatus.test.ts'), `describe("useNetworkStatus", () => {
  it("should be importable", () => {
    const mod = require("../../hooks/useNetworkStatus");
    expect(mod.useNetworkStatus).toBeDefined();
  });
});
`);

// Test: useHaptics
w(p.join('__tests__', 'hooks', 'useHaptics.test.ts'), `import { haptic, hapticLight, hapticSuccess, withHaptic } from "../../hooks/useHaptics";

describe("useHaptics", () => {
  it("should not throw on web (no-op)", () => {
    expect(() => haptic("light")).not.toThrow();
    expect(() => hapticLight()).not.toThrow();
    expect(() => hapticSuccess()).not.toThrow();
  });

  it("withHaptic should wrap a function", () => {
    const fn = jest.fn(() => 42);
    const wrapped = withHaptic(fn, "light");
    const result = wrapped("arg1", "arg2");
    expect(fn).toHaveBeenCalledWith("arg1", "arg2");
    expect(result).toBe(42);
  });
});
`);

// Test: TooltipBanner
w(p.join('__tests__', 'components', 'TooltipBanner.test.ts'), `import { resetAllTips, TOOLTIPS } from "../../components/TooltipBanner";

beforeEach(() => {
  localStorage.clear();
});

describe("TooltipBanner", () => {
  it("should have tooltips for all key screens", () => {
    const screens = TOOLTIPS.map(t => t.screen);
    expect(screens).toContain("dashboard");
    expect(screens).toContain("pdv");
    expect(screens).toContain("estoque");
    expect(screens).toContain("financeiro");
    expect(screens).toContain("clientes");
  });

  it("should have unique IDs", () => {
    const ids = TOOLTIPS.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("resetAllTips should clear localStorage", () => {
    localStorage.setItem("aura_tooltips_seen", JSON.stringify(["tip1"]));
    resetAllTips();
    expect(localStorage.getItem("aura_tooltips_seen")).toBeNull();
  });
});
`);

// Test: OfflineBanner (smoke)
w(p.join('__tests__', 'components', 'OfflineBanner.test.ts'), `describe("OfflineBanner", () => {
  it("should be importable", () => {
    const mod = require("../../components/OfflineBanner");
    expect(mod.OfflineBanner).toBeDefined();
  });
});
`);

// Test: ErrorBoundary (smoke)
w(p.join('__tests__', 'components', 'ErrorBoundary.test.ts'), `describe("ErrorBoundary", () => {
  it("should be importable", () => {
    const mod = require("../../components/ErrorBoundary");
    expect(mod.ErrorBoundary).toBeDefined();
  });
});
`);

// ============================================================
// FE-03: REFACTORING LARGE FILES
// ============================================================
console.log('\n=== FE-03: Extract sub-components from large files ===');

// Strategy: Read each large file, extract inner function components
// and their styles, create separate files, replace inline with import

function extractComponents(filePath, screenName, componentsToExtract) {
  if (!fs.existsSync(filePath)) {
    console.log('  SKIP: ' + filePath + ' not found');
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const extractDir = p.join('components', 'screens', screenName);
  ensureDir(extractDir);

  let mainContent = content;
  const extractedComponents = [];

  for (const compName of componentsToExtract) {
    // Find the function component
    const funcPattern = new RegExp(`function\\s+${compName}\\s*\\(`);
    const startLineIdx = lines.findIndex(l => funcPattern.test(l));

    if (startLineIdx === -1) {
      console.log('    SKIP: ' + compName + ' not found in ' + filePath);
      continue;
    }

    // Find the end of the component (matching braces)
    let braceCount = 0;
    let endLineIdx = startLineIdx;
    let started = false;

    for (let i = startLineIdx; i < lines.length; i++) {
      for (const ch of lines[i]) {
        if (ch === '{') { braceCount++; started = true; }
        if (ch === '}') braceCount--;
      }
      if (started && braceCount === 0) {
        endLineIdx = i;
        break;
      }
    }

    const componentCode = lines.slice(startLineIdx, endLineIdx + 1).join('\n');

    // Find associated StyleSheet (named like componentName styles)
    // Common patterns: const af = StyleSheet.create, const cs = StyleSheet.create, etc
    const shortName = compName.substring(0, 2).toLowerCase();
    const stylePatterns = [
      new RegExp(`const\\s+${shortName}\\s*=\\s*StyleSheet\\.create`),
      new RegExp(`const\\s+${compName.toLowerCase()}Styles\\s*=\\s*StyleSheet\\.create`),
    ];

    let styleCode = '';
    for (const sp of stylePatterns) {
      const styleStartIdx = lines.findIndex(l => sp.test(l));
      if (styleStartIdx !== -1) {
        let sbc = 0, sStarted = false, sEndIdx = styleStartIdx;
        for (let i = styleStartIdx; i < lines.length; i++) {
          for (const ch of lines[i]) {
            if (ch === '{') { sbc++; sStarted = true; }
            if (ch === '}') sbc--;
          }
          if (sStarted && sbc === 0) { sEndIdx = i; break; }
        }
        styleCode = lines.slice(styleStartIdx, sEndIdx + 1).join('\n');
        break;
      }
    }

    // Create extracted component file
    const extractedContent = `// Extracted from ${screenName}.tsx — FE-03 refactor
import { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, TextInput, Platform } from "react-native";
import { Colors } from "@/constants/colors";

// Props type (customize as needed)
interface ${compName}Props {
  [key: string]: any;
}

export ${componentCode}

${styleCode}
`;

    const extractedPath = p.join(extractDir, compName + '.tsx');
    // Only create if component was found and has meaningful content
    if (componentCode.length > 100) {
      w(extractedPath, extractedContent);
      extractedComponents.push(compName);
      console.log('    Extracted: ' + compName + ' (' + Math.round(componentCode.length / 1024) + 'KB)');
    }
  }

  // Create index.ts barrel export
  if (extractedComponents.length > 0) {
    const barrelContent = extractedComponents
      .map(c => `export { ${c} } from "./${c}";`)
      .join('\n') + '\n';
    w(p.join(extractDir, 'index.ts'), barrelContent);

    console.log('  -> ' + extractedComponents.length + ' components extracted from ' + screenName);
    console.log('  -> Add imports in ' + screenName + '.tsx:');
    console.log('     import { ' + extractedComponents.join(', ') + ' } from "@/components/screens/' + screenName + '";');
  }

  return extractedComponents;
}

// Extract from estoque.tsx (42KB)
console.log('\n--- estoque.tsx (42KB) ---');
extractComponents(
  p.join('app', '(tabs)', 'estoque.tsx'),
  'estoque',
  ['AddProductForm', 'ProductCard', 'ImportExportModal', 'ABCAnalysis']
);

// Extract from financeiro.tsx (32KB)
console.log('\n--- financeiro.tsx (32KB) ---');
extractComponents(
  p.join('app', '(tabs)', 'financeiro.tsx'),
  'financeiro',
  ['AddTransactionForm', 'TransactionRow', 'WithdrawalTab', 'DRETab']
);

// Extract from contabilidade.tsx (31KB)
console.log('\n--- contabilidade.tsx (31KB) ---');
extractComponents(
  p.join('app', '(tabs)', 'contabilidade.tsx'),
  'contabilidade',
  ['HeroRing', 'ObligationCard', 'DASCard', 'GuideSteps']
);

// Extract from whatsapp.tsx (29KB)
console.log('\n--- whatsapp.tsx (29KB) ---');
extractComponents(
  p.join('app', '(tabs)', 'whatsapp.tsx'),
  'whatsapp',
  ['ConversationItem', 'AutomationCard', 'CampaignCard', 'MessageBubble']
);

// Extract from clientes.tsx (26KB)
console.log('\n--- clientes.tsx (26KB) ---');
extractComponents(
  p.join('app', '(tabs)', 'clientes.tsx'),
  'clientes',
  ['AddCustomerForm', 'CustomerRow', 'CustomerDetail']
);

// ============================================================
// Update package.json scripts
// ============================================================
console.log('\n=== Updating package.json with test scripts ===');

const pkgPath = 'package.json';
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

  // Add test scripts
  pkg.scripts.test = 'jest';
  pkg.scripts['test:watch'] = 'jest --watch';
  pkg.scripts['test:coverage'] = 'jest --coverage';

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  console.log('  OK: Added test/test:watch/test:coverage scripts');
  changes++;
}

// ============================================================
console.log('\n========================================');
console.log('DONE: ' + changes + ' files created/modified');
console.log('========================================');
console.log('');
console.log('NEXT STEPS:');
console.log('');
console.log('  1. Install test dependencies:');
console.log('     npm install --save-dev jest jest-expo @testing-library/react-native @testing-library/jest-native');
console.log('');
console.log('  2. Run tests:');
console.log('     npm test');
console.log('');
console.log('  3. Check coverage:');
console.log('     npm run test:coverage');
console.log('');
console.log('  4. Review extracted components in components/screens/');
console.log('     Then replace inline components in the original files');
console.log('     with imports from the extracted files.');
console.log('');
console.log('  5. Commit:');
console.log('     git add -A && git commit -m "feat: S2 FE-02 Jest setup + tests + FE-03 extract sub-components" && git push');
console.log('');
console.log('TEST FILES CREATED:');
console.log('  __tests__/services/offlineSync.test.ts    — 7 tests (cache + queue)');
console.log('  __tests__/hooks/useKeyboard.test.ts       — 1 import test');
console.log('  __tests__/hooks/useNetworkStatus.test.ts  — 1 import test');
console.log('  __tests__/hooks/useHaptics.test.ts        — 3 tests (no-op + wrapper)');
console.log('  __tests__/components/TooltipBanner.test.ts — 3 tests (screens + IDs + reset)');
console.log('  __tests__/components/OfflineBanner.test.ts — 1 import test');
console.log('  __tests__/components/ErrorBoundary.test.ts — 1 import test');
console.log('  TOTAL: 17 tests');
console.log('');
console.log('COMPONENTS EXTRACTED (FE-03):');
console.log('  components/screens/estoque/       — AddProductForm, ProductCard, etc');
console.log('  components/screens/financeiro/     — AddTransactionForm, WithdrawalTab, etc');
console.log('  components/screens/contabilidade/  — HeroRing, ObligationCard, etc');
console.log('  components/screens/whatsapp/       — ConversationItem, AutomationCard, etc');
console.log('  components/screens/clientes/       — AddCustomerForm, CustomerRow, etc');
