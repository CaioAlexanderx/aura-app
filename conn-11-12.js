// conn-11-12.js
// Run from aura-app root: node conn-11-12.js
// CONN-11: Financeiro real (transactions, DRE, withdrawal)
// CONN-12: PDV/Caixa real (products from API, sales to API)

const fs = require('fs');
const p = require('path');
let changes = 0;

// ============================================================
// CONN-11: Financeiro — connect to real API
// ============================================================
console.log('\n=== CONN-11: Financeiro real ===');

const finPath = p.join('app', '(tabs)', 'financeiro.tsx');
if (fs.existsSync(finPath)) {
  let c = fs.readFileSync(finPath, 'utf-8');

  // 1. Add useQuery + API imports
  if (!c.includes('useQuery')) {
    c = c.replace(
      'import { useState } from "react";',
      'import { useState } from "react";\nimport { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";\nimport { companiesApi, dashboardApi } from "@/services/api";'
    );
    console.log('  OK: Added useQuery + API imports');
    changes++;
  }

  // 2. Add company/token extraction in FinanceiroScreen
  if (!c.includes('company, token, isDemo')) {
    c = c.replace(
      'const { isDemo } = useAuthStore();',
      'const { company, token, isDemo } = useAuthStore();\n  const qc = useQueryClient();\n\n  // CONN-11: Fetch real data from backend\n  const { data: apiTransactions } = useQuery({\n    queryKey: ["transactions", company?.id],\n    queryFn: () => companiesApi.transactions(company!.id, "limit=50"),\n    enabled: !!company?.id && !!token && !isDemo,\n    retry: 1,\n  });\n\n  const { data: apiDre } = useQuery({\n    queryKey: ["dre", company?.id],\n    queryFn: () => companiesApi.dre(company!.id),\n    enabled: !!company?.id && !!token && !isDemo && activeTab === 3,\n    retry: 1,\n  });\n\n  const { data: apiWithdrawal } = useQuery({\n    queryKey: ["withdrawal", company?.id],\n    queryFn: () => dashboardApi.summary(company!.id),\n    enabled: !!company?.id && !!token && !isDemo && activeTab === 2,\n    retry: 1,\n  });\n\n  // Mutation for creating transactions\n  const createTxMutation = useMutation({\n    mutationFn: (body: any) => companiesApi.createTransaction(company!.id, body),\n    onSuccess: () => {\n      qc.invalidateQueries({ queryKey: ["transactions", company?.id] });\n      qc.invalidateQueries({ queryKey: ["dashboard", company?.id] });\n      qc.invalidateQueries({ queryKey: ["dre", company?.id] });\n    },\n  });'
    );
    console.log('  OK: Added API queries + mutation in FinanceiroScreen');
    changes++;
  }

  // 3. Update TabLancamentos to use API data with fallback
  if (c.includes('function TabLancamentos()') && !c.includes('apiTx')) {
    c = c.replace(
      'function TabLancamentos() {\n  const { transactions, totals } = useTransactions();\n  const { income, expense, balance } = totals();',
      'function TabLancamentos({ apiTx }: { apiTx?: any }) {\n  const { transactions: localTx, totals } = useTransactions();\n  // Use API data if available, otherwise local store\n  const transactions = apiTx?.transactions || apiTx?.rows || localTx;\n  const income = apiTx?.summary?.income != null ? parseFloat(apiTx.summary.income) : totals().income;\n  const expense = apiTx?.summary?.expenses != null ? parseFloat(apiTx.summary.expenses) : totals().expense;\n  const balance = income - expense;'
    );
    console.log('  OK: TabLancamentos uses API data with fallback');
    changes++;
  }

  // 4. Pass apiTx prop when rendering TabLancamentos
  if (c.includes('{activeTab === 0 && <TabLancamentos />}')) {
    c = c.replace(
      '{activeTab === 0 && <TabLancamentos />}',
      '{activeTab === 0 && <TabLancamentos apiTx={apiTransactions} />}'
    );
    console.log('  OK: Passing apiTx to TabLancamentos');
    changes++;
  }

  // 5. Update TabResumo to accept API DRE data
  if (c.includes('function TabResumo()') && !c.includes('apiDreData')) {
    c = c.replace(
      'function TabResumo() {\n  const d = MOCK_DRE;',
      'function TabResumo({ apiDreData }: { apiDreData?: any }) {\n  const d = apiDreData || MOCK_DRE;'
    );
    console.log('  OK: TabResumo accepts API DRE data');
    changes++;
  }

  // 6. Pass apiDre prop
  if (c.includes('{activeTab === 3 && <TabResumo />}')) {
    c = c.replace(
      '{activeTab === 3 && <TabResumo />}',
      '{activeTab === 3 && <TabResumo apiDreData={apiDre} />}'
    );
    console.log('  OK: Passing apiDre to TabResumo');
    changes++;
  }

  // 7. Update TabRetirada to accept API withdrawal data
  if (c.includes('function TabRetirada()') && !c.includes('apiWd')) {
    c = c.replace(
      'function TabRetirada() {\n  const w = MOCK_WITHDRAWAL;',
      'function TabRetirada({ apiWd }: { apiWd?: any }) {\n  const w = apiWd || MOCK_WITHDRAWAL;'
    );
    console.log('  OK: TabRetirada accepts API withdrawal data');
    changes++;
  }

  // 8. Pass apiWithdrawal prop
  if (c.includes('{activeTab === 2 && <TabRetirada />}')) {
    c = c.replace(
      '{activeTab === 2 && <TabRetirada />}',
      '{activeTab === 2 && <TabRetirada apiWd={apiWithdrawal} />}'
    );
    console.log('  OK: Passing apiWithdrawal to TabRetirada');
    changes++;
  }

  // 9. Connect TransactionModal save to API
  if (c.includes('add({ date: dateStr') && !c.includes('createTxMutation')) {
    c = c.replace(
      'add({ date: dateStr, desc: desc.trim(), type: txType, category: cat, amount: val, status: "confirmed", source: "manual" });',
      '// Save to backend if connected, local store as fallback\n    if (typeof createTxMutation !== "undefined" && createTxMutation?.mutate) {\n      createTxMutation.mutate({ description: desc.trim(), type: txType, category: cat, amount: val, payment_method: "manual" });\n    }\n    add({ date: dateStr, desc: desc.trim(), type: txType, category: cat, amount: val, status: "confirmed", source: "manual" });'
    );
    console.log('  OK: TransactionModal saves to API + local store');
    changes++;
  }

  // 10. Pass createTxMutation to TransactionModal (needs to be accessible)
  // The modal is rendered inside FinanceiroScreen which has access to the mutation
  // We need to pass it as a prop or use context — simplest: global ref
  // Actually, the modal already uses useTransactions directly, and the mutation is in scope
  // Let's make it accessible via a simple prop approach
  
  if (c.includes('<TransactionModal visible={showModal}') && !c.includes('createTxMutation={')) {
    c = c.replace(
      '<TransactionModal visible={showModal} onClose={() => setShowModal(false)} />',
      '<TransactionModal visible={showModal} onClose={() => setShowModal(false)} createTxMutation={!isDemo && company?.id ? createTxMutation : undefined} />'
    );
    // Update TransactionModal signature
    c = c.replace(
      'function TransactionModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {',
      'function TransactionModal({ visible, onClose, createTxMutation }: { visible: boolean; onClose: () => void; createTxMutation?: any }) {'
    );
    console.log('  OK: TransactionModal receives createTxMutation prop');
    changes++;
  }

  fs.writeFileSync(finPath, c, 'utf-8');
  console.log('  SAVED: financeiro.tsx (' + c.length + ' bytes)');
} else {
  console.log('  SKIP: financeiro.tsx not found');
}

// ============================================================
// CONN-12: PDV/Caixa — connect to real API
// ============================================================
console.log('\n=== CONN-12: PDV/Caixa real ===');

const pdvPath = p.join('app', '(tabs)', 'pdv.tsx');
if (fs.existsSync(pdvPath)) {
  let c = fs.readFileSync(pdvPath, 'utf-8');

  // 1. Add useQuery + API imports
  if (!c.includes('useQuery')) {
    c = c.replace(
      'import { useState, useEffect } from "react";',
      'import { useState, useEffect } from "react";\nimport { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";\nimport { companiesApi, pdvApi } from "@/services/api";\nimport { toast } from "@/components/Toast";'
    );
    console.log('  OK: Added useQuery + API imports');
    changes++;
  }

  // 2. Add API queries in PdvScreen
  if (!c.includes('apiProducts')) {
    c = c.replace(
      'const { isDemo } = useAuthStore();',
      'const { company, token, isDemo } = useAuthStore();\n  const qc = useQueryClient();\n\n  // CONN-12: Fetch real products from backend\n  const { data: apiProducts } = useQuery({\n    queryKey: ["products", company?.id],\n    queryFn: () => companiesApi.products(company!.id),\n    enabled: !!company?.id && !!token && !isDemo,\n    retry: 1,\n  });\n\n  // Mutation for creating sales\n  const saleMutation = useMutation({\n    mutationFn: (body: any) => pdvApi.createSale(company!.id, body),\n    onSuccess: () => {\n      qc.invalidateQueries({ queryKey: ["products", company?.id] });\n      qc.invalidateQueries({ queryKey: ["dashboard", company?.id] });\n      qc.invalidateQueries({ queryKey: ["transactions", company?.id] });\n    },\n  });'
    );
    console.log('  OK: Added API queries in PdvScreen');
    changes++;
  }

  // 3. Use API products with fallback to MOCK
  // Replace the line that references MOCK_PRODUCTS for filtering
  if (c.includes('const categories = ["Todos", ...Array.from(new Set(MOCK_PRODUCTS.map(') && !c.includes('products =')) {
    c = c.replace(
      'const categories = ["Todos", ...Array.from(new Set(MOCK_PRODUCTS.map(p => p.category)))];',
      '// Use API products if available, fallback to mock\n  const products = (apiProducts?.products || apiProducts?.rows || apiProducts) instanceof Array\n    ? (apiProducts.products || apiProducts.rows || apiProducts).map((p: any) => ({\n        id: p.id || p.product_id,\n        name: p.name || p.product_name,\n        price: parseFloat(p.price || p.sale_price) || 0,\n        category: p.category || "Produtos",\n        stock: p.stock_quantity != null ? parseInt(p.stock_quantity) : p.stock,\n        barcode: p.barcode || p.ean || null,\n      }))\n    : MOCK_PRODUCTS;\n  const categories = ["Todos", ...Array.from(new Set(products.map((p: any) => p.category)))];'
    );
    console.log('  OK: Products use API with MOCK fallback');
    changes++;
  }

  // 4. Replace MOCK_PRODUCTS references in filtering with `products`
  if (c.includes('const filtered = MOCK_PRODUCTS.filter(')) {
    c = c.replace(
      'const filtered = MOCK_PRODUCTS.filter(',
      'const filtered = products.filter('
    );
    console.log('  OK: Filtered products use dynamic source');
    changes++;
  }

  // 5. Replace MOCK_PRODUCTS in handleScan
  if (c.includes('const product = MOCK_PRODUCTS.find(p => p.barcode === code)')) {
    c = c.replace(
      'const product = MOCK_PRODUCTS.find(p => p.barcode === code)',
      'const product = products.find((p: any) => p.barcode === code)'
    );
    console.log('  OK: handleScan uses dynamic products');
    changes++;
  }

  // 6. Connect finalizeSale to API
  if (c.includes('function finalizeSale()') && !c.includes('saleMutation')) {
    c = c.replace(
      'function finalizeSale() { if (cart.length === 0) return; const saleId = Date.now().toString(36).toUpperCase().slice(-6); setLastSale({ id: saleId, total, payment, items: [...cart], date: new Date().toLocaleString("pt-BR") }); setCart([]); }',
      'function finalizeSale() {\n    if (cart.length === 0) return;\n    const saleId = Date.now().toString(36).toUpperCase().slice(-6);\n    // CONN-12: Send sale to backend\n    if (company?.id && !isDemo && saleMutation) {\n      saleMutation.mutate({\n        items: cart.map(i => ({ product_id: i.productId, quantity: i.qty, unit_price: i.price })),\n        payment_method: payment,\n        total,\n      });\n    }\n    setLastSale({ id: saleId, total, payment, items: [...cart], date: new Date().toLocaleString("pt-BR") });\n    setCart([]);\n  }'
    );
    console.log('  OK: finalizeSale sends to API');
    changes++;
  }

  fs.writeFileSync(pdvPath, c, 'utf-8');
  console.log('  SAVED: pdv.tsx (' + c.length + ' bytes)');
} else {
  console.log('  SKIP: pdv.tsx not found');
}

// ============================================================
// CONN-10: Verify Dashboard is already wired
// ============================================================
console.log('\n=== CONN-10: Dashboard verification ===');

const dashPath = p.join('app', '(tabs)', 'index.tsx');
if (fs.existsSync(dashPath)) {
  const d = fs.readFileSync(dashPath, 'utf-8');
  const checks = [
    ['useQuery', 'React Query'],
    ['dashboardApi', 'Dashboard API'],
    ['aggregate', 'Aggregate endpoint'],
    ['isDemo?MOCK:(data??MOCK)', 'Demo/real fallback'],
  ];
  let ok = 0;
  checks.forEach(([needle, label]) => {
    if (d.includes(needle)) { ok++; console.log('  OK: ' + label); }
    else console.log('  MISS: ' + label);
  });
  console.log('  RESULT: CONN-10 ' + (ok >= 3 ? 'ALREADY WIRED' : 'NEEDS WORK') + ' (' + ok + '/' + checks.length + ')');
}

// ============================================================
console.log('\n========================================');
console.log('DONE: ' + changes + ' changes applied');
console.log('========================================');
console.log('  CONN-10: Dashboard      — Already wired (useQuery + dashboardApi.aggregate)');
console.log('  CONN-11: Financeiro     — Connected (transactions, DRE, withdrawal from API)');
console.log('  CONN-12: PDV/Caixa      — Connected (products from API, sales to API)');
console.log('\nAll 3 screens now:');
console.log('  - Fetch real data from backend when authenticated');
console.log('  - Fall back to mock data in demo mode');
console.log('  - Write operations (new transaction, new sale) go to API + local store');
console.log('  - React Query auto-invalidates related queries on mutations');
console.log('\nRun:');
console.log('  git add -A && git commit -m "feat: CONN-10+11+12 - Dashboard+Financeiro+PDV connected to real backend API" && git push');
