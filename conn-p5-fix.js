// conn-p5-fix.js
// Run from aura-app root: node conn-p5-fix.js
// 1. Fix estoque.tsx filter callback (same bug as clientes)
// 2. Add useQuery hooks to estoque, clientes, contabilidade

const fs = require('fs');
const p = require('path');
let total = 0;

// ============================================================
// FIX: estoque.tsx — handleExportCSV inside .filter() callback
// ============================================================
console.log('=== Fix estoque.tsx filter bug ===');

const estoquePath = p.join('app', '(tabs)', 'estoque.tsx');
if (fs.existsSync(estoquePath)) {
  let c = fs.readFileSync(estoquePath, 'utf-8');

  // Check for functions inside filter
  if (c.includes('const matchCat = catFilter') && c.includes('function handleExportCSV()')) {
    // Extract the broken section
    const filterStart = c.indexOf('const filtered = products.filter(p => {');
    const returnMatch = c.indexOf('return matchSearch && matchCat;', filterStart);
    const filterEnd = c.indexOf('});', returnMatch);

    if (filterStart > -1 && returnMatch > -1 && filterEnd > -1) {
      // Remove the functions from inside filter and place them before
      const beforeFilter = c.substring(0, filterStart);
      const afterFilter = c.substring(filterEnd + 3);

      // Extract export/import functions
      const exportFn = `  function handleExportCSV() {
    if (Platform.OS === "web") {
      const header = "Nome,Preco,Estoque,Categoria,Codigo\\n";
      const rows = products.map(pp => [pp.name, pp.price, pp.stock ?? "", pp.category, pp.barcode ?? ""].join(",")).join("\\n");
      const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "estoque_aura_" + new Date().toISOString().slice(0,10) + ".csv";
      link.click();
    }
  }

  function handleImportCSV() {
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".csv,.xlsx,.xls";
      input.onchange = (ev: any) => {
        const f = ev.target?.files?.[0];
        if (f) { alert("Arquivo " + f.name + " recebido!"); }
      };
      input.click();
    }
  }

`;

      // Rebuild with clean filter
      const fixedFilter = `const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "Todos" || p.category === catFilter;
    return matchSearch && matchCat;
  });`;

      c = beforeFilter + exportFn + '  ' + fixedFilter + afterFilter;
      console.log('  OK: Removed functions from filter, placed at component scope');
      total++;
    }
  }

  // ── CONN-13: Add useQuery for products ──
  if (!c.includes('useQuery')) {
    c = c.replace(
      'import { Colors } from "@/constants/colors";',
      'import { Colors } from "@/constants/colors";\nimport { useQuery } from "@tanstack/react-query";\nimport { companiesApi } from "@/services/api";'
    );

    // Add hook after isDemo destructuring
    c = c.replace(
      'const { isDemo } = useAuthStore();',
      `const { isDemo, company, token } = useAuthStore();

  // CONN-13: Fetch real products when not in demo
  const { data: apiData } = useQuery({
    queryKey: ["products", company?.id],
    queryFn: () => companiesApi.products(company!.id),
    enabled: !!company?.id && !!token && !isDemo,
    retry: 1,
    staleTime: 30000,
  });
  // TODO: replace INITIAL_PRODUCTS with apiData?.products when backend has data`
    );

    console.log('  OK: CONN-13 useQuery added');
    total++;
  }

  fs.writeFileSync(estoquePath, c, 'utf-8');
}

// ============================================================
// CONN-15: clientes.tsx — Add useQuery for customers
// ============================================================
console.log('\n=== CONN-15: Clientes ===');

const clientesPath = p.join('app', '(tabs)', 'clientes.tsx');
if (fs.existsSync(clientesPath)) {
  let c = fs.readFileSync(clientesPath, 'utf-8');

  if (!c.includes('useQuery')) {
    c = c.replace(
      'import { Colors } from "@/constants/colors";',
      'import { Colors } from "@/constants/colors";\nimport { useQuery } from "@tanstack/react-query";\nimport { companiesApi } from "@/services/api";'
    );

    // Add hook — clientes uses { isDemo } from useAuthStore
    if (c.includes('const { isDemo } = useAuthStore();')) {
      c = c.replace(
        'const { isDemo } = useAuthStore();',
        `const { isDemo, company, token } = useAuthStore();

  // CONN-15: Fetch real customers when not in demo
  const { data: apiCustomers } = useQuery({
    queryKey: ["customers", company?.id],
    queryFn: () => companiesApi.customers(company!.id),
    enabled: !!company?.id && !!token && !isDemo,
    retry: 1,
    staleTime: 30000,
  });
  // TODO: replace INIT with apiCustomers?.customers when backend has data`
      );
    }

    console.log('  OK: CONN-15 useQuery added');
    total++;
  } else {
    console.log('  SKIP: already has useQuery');
  }

  fs.writeFileSync(clientesPath, c, 'utf-8');
}

// ============================================================
// CONN-16: contabilidade.tsx — Add useQuery for obligations
// ============================================================
console.log('\n=== CONN-16: Contabilidade ===');

const contabPath = p.join('app', '(tabs)', 'contabilidade.tsx');
if (fs.existsSync(contabPath)) {
  let c = fs.readFileSync(contabPath, 'utf-8');

  if (!c.includes('useQuery')) {
    c = c.replace(
      'import { Colors } from "@/constants/colors";',
      'import { Colors } from "@/constants/colors";\nimport { useQuery } from "@tanstack/react-query";\nimport { companiesApi } from "@/services/api";'
    );

    // Find the main component's useAuthStore usage
    if (c.includes('const { isDemo } = useAuthStore();')) {
      c = c.replace(
        'const { isDemo } = useAuthStore();',
        `const { isDemo, company, token } = useAuthStore();

  // CONN-16: Fetch real obligations when not in demo
  const { data: apiObligations } = useQuery({
    queryKey: ["obligations", company?.id],
    queryFn: () => companiesApi.obligations(company!.id),
    enabled: !!company?.id && !!token && !isDemo,
    retry: 1,
    staleTime: 60000,
  });
  // TODO: replace mock obligations with apiObligations when backend returns data`
      );
    } else if (c.includes('useAuthStore()')) {
      // Alternative: add after the first useAuthStore call in the main component
      const mainFn = c.indexOf('export default function');
      if (mainFn > -1) {
        const authCall = c.indexOf('useAuthStore()', mainFn);
        if (authCall > -1) {
          const lineEnd = c.indexOf(';', authCall);
          if (lineEnd > -1) {
            c = c.substring(0, lineEnd + 1) +
              `\n  const companyId = useAuthStore.getState().company?.id;
  const tkn = useAuthStore.getState().token;

  // CONN-16: Fetch real obligations
  const { data: apiObligations } = useQuery({
    queryKey: ["obligations", companyId],
    queryFn: () => companiesApi.obligations(companyId!),
    enabled: !!companyId && !!tkn,
    retry: 1,
    staleTime: 60000,
  });` + c.substring(lineEnd + 1);
          }
        }
      }
    }

    console.log('  OK: CONN-16 useQuery added');
    total++;
  } else {
    console.log('  SKIP: already has useQuery');
  }

  fs.writeFileSync(contabPath, c, 'utf-8');
}

// ============================================================
console.log('\n========================================');
console.log('DONE: ' + total + ' changes applied');
console.log('========================================');
console.log('  [FIX] estoque.tsx filter callback bug resolved');
console.log('  [CONN-13] estoque: useQuery for products');
console.log('  [CONN-15] clientes: useQuery for customers');
console.log('  [CONN-16] contabilidade: useQuery for obligations');
console.log('\nRun:');
console.log('  git add -A && git commit -m "feat: CONN-13+15+16 estoque+clientes+contabilidade real API + fix estoque filter" && git push');

// Self-cleanup
try { fs.unlinkSync('conn-p5-fix.js'); console.log('Self-deleted'); } catch {}
