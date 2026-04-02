// conn-13-15-16.js
// Run from aura-app root: node conn-13-15-16.js
// CONN-13: Estoque — use API products instead of INITIAL_PRODUCTS
// CONN-15: Clientes — use API customers instead of INIT
// CONN-16: Contabilidade — fetch obligations from API

const fs = require('fs');
const p = require('path');
let changes = 0;

// ============================================================
// CONN-13: Estoque — wire apiData into products state
// ============================================================
console.log('\n=== CONN-13: Estoque real ===');

const estPath = p.join('app', '(tabs)', 'estoque.tsx');
if (fs.existsSync(estPath)) {
  let c = fs.readFileSync(estPath, 'utf-8');

  // 1. Add useEffect import if missing
  if (c.includes('import { useState } from "react"') && !c.includes('useEffect')) {
    c = c.replace(
      'import { useState } from "react"',
      'import { useState, useEffect } from "react"'
    );
    console.log('  OK: Added useEffect import');
    changes++;
  }

  // 2. Replace the TODO block with useEffect that syncs API data
  if (c.includes('// TODO: replace INITIAL_PRODUCTS with apiData?.products when backend has data')) {
    c = c.replace(
      '// TODO: replace INITIAL_PRODUCTS with apiData?.products when backend has data',
      '// CONN-13: Sync API products into local state when data arrives\n  const apiProducts = (apiData?.products || apiData?.rows || apiData);\n  useEffect(() => {\n    if (apiProducts instanceof Array && apiProducts.length > 0) {\n      const mapped = apiProducts.map((p: any) => ({\n        id: p.id || p.product_id || String(Math.random()),\n        name: p.name || p.product_name || "Produto",\n        code: p.sku || p.code || "---",\n        barcode: p.barcode || p.ean || "",\n        category: p.category || "Produtos",\n        price: parseFloat(p.price || p.sale_price) || 0,\n        cost: parseFloat(p.cost || p.cost_price) || 0,\n        stock: parseInt(p.stock_quantity ?? p.stock) || 0,\n        minStock: parseInt(p.min_stock ?? p.minStock) || 0,\n        abc: (p.abc_class || p.abc || "C") as "A" | "B" | "C",\n        sold30d: parseInt(p.sold_30d ?? p.sold30d) || 0,\n        unit: p.unit || "un",\n        brand: p.brand || "",\n        notes: p.notes || "",\n      }));\n      setProducts(mapped);\n    }\n  }, [apiProducts instanceof Array ? apiProducts.length : 0]);'
    );
    console.log('  OK: Added useEffect to sync API products into state');
    changes++;
  }

  // 3. Add useMutation for creating products
  if (!c.includes('useMutation') && c.includes('companiesApi')) {
    c = c.replace(
      'import { useQuery } from "@tanstack/react-query";',
      'import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";'
    );
    console.log('  OK: Added useMutation + useQueryClient imports');
    changes++;
  }

  // 4. Add mutation + queryClient in component
  if (!c.includes('useQueryClient()') && c.includes('const { data: apiData }')) {
    c = c.replace(
      'const { data: apiData } = useQuery({',
      'const qc = useQueryClient();\n  const addProductMutation = useMutation({\n    mutationFn: (body: any) => companiesApi.createProduct ? companiesApi.createProduct(company!.id, body) : Promise.resolve(null),\n    onSuccess: () => qc.invalidateQueries({ queryKey: ["products", company?.id] }),\n  });\n  const { data: apiData } = useQuery({'
    );
    console.log('  OK: Added addProduct mutation');
    changes++;
  }

  // 5. Wire handleAddProduct to API
  if (c.includes('function handleAddProduct(product: Product)') && !c.includes('addProductMutation')) {
    c = c.replace(
      'function handleAddProduct(product: Product) {\n    setProducts(prev => [product, ...prev]);\n    setShowAddForm(false);\n  }',
      'function handleAddProduct(product: Product) {\n    // CONN-13: Save to backend if connected\n    if (company?.id && !isDemo) {\n      addProductMutation.mutate({\n        name: product.name, sku: product.code, barcode: product.barcode,\n        category: product.category, price: product.price, cost_price: product.cost,\n        stock_quantity: product.stock, min_stock: product.minStock, unit: product.unit,\n        brand: product.brand, notes: product.notes,\n      });\n    }\n    setProducts(prev => [product, ...prev]);\n    setShowAddForm(false);\n  }'
    );
    console.log('  OK: handleAddProduct wired to API');
    changes++;
  }

  // 6. Add createProduct to api.ts if not there
  // (We'll handle this separately after)

  fs.writeFileSync(estPath, c, 'utf-8');
  console.log('  SAVED: estoque.tsx (' + c.length + ' bytes)');
} else {
  console.log('  SKIP: estoque.tsx not found');
}

// ============================================================
// CONN-15: Clientes — wire apiCustomers into cust state
// ============================================================
console.log('\n=== CONN-15: Clientes real ===');

const cliPath = p.join('app', '(tabs)', 'clientes.tsx');
if (fs.existsSync(cliPath)) {
  let c = fs.readFileSync(cliPath, 'utf-8');

  // 1. Add useEffect import
  if (c.includes('import { useState } from "react"') && !c.includes('useEffect')) {
    c = c.replace(
      'import { useState } from "react"',
      'import { useState, useEffect } from "react"'
    );
    console.log('  OK: Added useEffect import');
    changes++;
  }

  // 2. Add useMutation imports
  if (!c.includes('useMutation') && c.includes('useQuery')) {
    c = c.replace(
      'import { useQuery } from "@tanstack/react-query";',
      'import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";'
    );
    console.log('  OK: Added useMutation + useQueryClient imports');
    changes++;
  }

  // 3. Replace TODO with useEffect sync + mutation
  if (c.includes('// TODO: replace INIT with apiCustomers?.customers when backend has data')) {
    c = c.replace(
      '// TODO: replace INIT with apiCustomers?.customers when backend has data',
      '// CONN-15: Sync API customers into local state\n  const qc = useQueryClient();\n  const apiCustArr = (apiCustomers?.customers || apiCustomers?.rows || apiCustomers);\n  useEffect(() => {\n    if (apiCustArr instanceof Array && apiCustArr.length > 0) {\n      const mapped = apiCustArr.map((c: any) => ({\n        id: c.id || c.customer_id || String(Math.random()),\n        name: c.name || c.customer_name || "Cliente",\n        email: c.email || "",\n        phone: c.phone || "",\n        instagram: c.instagram || c.instagram_handle || "",\n        birthday: c.birthday || c.birth_date || "",\n        lastPurchase: c.last_purchase ? new Date(c.last_purchase).toLocaleDateString("pt-BR") : "---",\n        totalSpent: parseFloat(c.total_spent ?? c.totalSpent ?? c.ltv) || 0,\n        visits: parseInt(c.visit_count ?? c.visits) || 0,\n        firstVisit: c.first_visit ? new Date(c.first_visit).toLocaleDateString("pt-BR") : c.created_at ? new Date(c.created_at).toLocaleDateString("pt-BR") : "---",\n        notes: c.notes || "",\n        rating: c.rating != null ? parseInt(c.rating) : null,\n      }));\n      sCust(mapped);\n    }\n  }, [apiCustArr instanceof Array ? apiCustArr.length : 0]);\n\n  const addCustomerMutation = useMutation({\n    mutationFn: (body: any) => companiesApi.createCustomer ? companiesApi.createCustomer(company!.id, body) : Promise.resolve(null),\n    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers", company?.id] }),\n  });'
    );
    console.log('  OK: Added useEffect to sync API customers + mutation');
    changes++;
  }

  // 4. Wire addC to call API
  if (c.includes('function addC(c:Cust){sCust(p=>[c,...p]);sAdd(false);}') && !c.includes('addCustomerMutation')) {
    c = c.replace(
      'function addC(c:Cust){sCust(p=>[c,...p]);sAdd(false);}',
      'function addC(c:Cust){\n    // CONN-15: Save to backend if connected\n    if (company?.id && !isDemo) {\n      addCustomerMutation.mutate({ name: c.name, email: c.email, phone: c.phone, instagram: c.instagram, birthday: c.birthday, notes: c.notes });\n    }\n    sCust(p=>[c,...p]);sAdd(false);\n  }'
    );
    console.log('  OK: addC wired to API');
    changes++;
  }

  fs.writeFileSync(cliPath, c, 'utf-8');
  console.log('  SAVED: clientes.tsx (' + c.length + ' bytes)');
} else {
  console.log('  SKIP: clientes.tsx not found');
}

// ============================================================
// CONN-16: Contabilidade — fetch obligations from API
// ============================================================
console.log('\n=== CONN-16: Contabilidade real ===');

const contPath = p.join('app', '(tabs)', 'contabilidade.tsx');
if (fs.existsSync(contPath)) {
  let c = fs.readFileSync(contPath, 'utf-8');

  // 1. Add useAuthStore import if not accessing company
  if (!c.includes('useAuthStore')) {
    c = c.replace(
      'import { AgentBanner } from "@/components/AgentBanner";',
      'import { AgentBanner } from "@/components/AgentBanner";\nimport { useAuthStore } from "@/stores/auth";'
    );
    console.log('  OK: Added useAuthStore import');
    changes++;
  }

  // 2. Add API query in ContabilidadeScreen
  if (c.includes('export default function ContabilidadeScreen()') && !c.includes('apiObligations')) {
    c = c.replace(
      'export default function ContabilidadeScreen() {\n  const [tab, sTab] = useState(0);',
      'export default function ContabilidadeScreen() {\n  const { company, token, isDemo } = useAuthStore();\n\n  // CONN-16: Fetch real obligations from backend\n  const { data: apiObligations } = useQuery({\n    queryKey: ["obligations", company?.id],\n    queryFn: () => companiesApi.obligations(company!.id),\n    enabled: !!company?.id && !!token && !isDemo,\n    retry: 1,\n    staleTime: 60000,\n  });\n\n  // Map API obligations to screen format, fallback to OBLS mock\n  const obligations: Obl[] = (() => {\n    const apiArr = apiObligations?.obligations || apiObligations?.rows || apiObligations;\n    if (apiArr instanceof Array && apiArr.length > 0) {\n      return apiArr.map((o: any, i: number) => ({\n        id: o.id || String(i + 1),\n        name: o.name || o.obligation_name || "Obrigacao",\n        icon: o.icon || (o.name || "").charAt(0).toUpperCase() || "#",\n        due: o.due_date ? new Date(o.due_date).toLocaleDateString("pt-BR") : o.due || "---",\n        dl: o.days_left ?? (o.due_date ? Math.max(0, Math.ceil((new Date(o.due_date).getTime() - Date.now()) / 864e5)) : 0),\n        amt: o.estimated_amount != null ? parseFloat(o.estimated_amount) : o.amt ?? null,\n        status: (o.status === "completed" ? "done" : o.status === "in_progress" ? "progress" : o.status === "future" ? "future" : "pending") as Obl["status"],\n        cat: o.category || o.cat || "aura_resolve",\n        desc: o.description || o.desc || "",\n        steps: o.steps instanceof Array ? o.steps : (o.guide_steps instanceof Array ? o.guide_steps : []),\n      }));\n    }\n    return OBLS;\n  })();\n\n  const [tab, sTab] = useState(0);'
    );
    console.log('  OK: Added API query + mapping for obligations');
    changes++;
  }

  // 3. Replace OBLS references in HeroRing and checkpoints with `obligations`
  // HeroRing uses OBLS directly inside the component, so we need to pass it as prop
  // or move it inside the main component. Since it's complex, let's just make OBLS dynamic.
  
  // Replace the checkpoint grid to use `obligations` instead of `OBLS`
  if (c.includes('{OBLS.map(o => <View key={o.id}')) {
    c = c.replace(
      '{OBLS.map(o => <View key={o.id}',
      '{obligations.map(o => <View key={o.id}'
    );
    console.log('  OK: Checkpoint grid uses API obligations');
    changes++;
  }

  // Replace Guide list to use obligations
  if (c.includes('{tab === 1 && <GList obls={OBLS}')) {
    c = c.replace(
      '{tab === 1 && <GList obls={OBLS}',
      '{tab === 1 && <GList obls={obligations}'
    );
    console.log('  OK: Guide list uses API obligations');
    changes++;
  }

  // Replace HeroRing to accept obligations prop
  if (c.includes('function HeroRing()') && !c.includes('function HeroRing({ obls }')) {
    c = c.replace(
      'function HeroRing() {\n  const total = OBLS.length;\n  const done = OBLS.filter(o => o.status === "done").length;\n  const pending = OBLS.filter(o => o.status === "progress" || o.status === "pending").length;\n  const nextDue = OBLS.filter(o => o.dl > 0).sort((a, b) => a.dl - b.dl)[0];',
      'function HeroRing({ obls }: { obls?: Obl[] }) {\n  const data = obls || OBLS;\n  const total = data.length;\n  const done = data.filter(o => o.status === "done").length;\n  const pending = data.filter(o => o.status === "progress" || o.status === "pending").length;\n  const nextDue = data.filter(o => o.dl > 0).sort((a, b) => a.dl - b.dl)[0];'
    );
    console.log('  OK: HeroRing accepts obls prop');
    changes++;
  }

  // Pass obligations to HeroRing
  if (c.includes('<HeroRing />')) {
    c = c.replace('<HeroRing />', '<HeroRing obls={obligations} />');
    console.log('  OK: HeroRing receives obligations');
    changes++;
  }

  // Replace guide view to find from obligations instead of OBLS
  if (c.includes('const sel = gid ? OBLS.find(')) {
    c = c.replace(
      'const sel = gid ? OBLS.find(o => o.id === gid) : null;',
      'const sel = gid ? obligations.find(o => o.id === gid) : null;'
    );
    console.log('  OK: Guide selection uses obligations');
    changes++;
  }

  fs.writeFileSync(contPath, c, 'utf-8');
  console.log('  SAVED: contabilidade.tsx (' + c.length + ' bytes)');
} else {
  console.log('  SKIP: contabilidade.tsx not found');
}

// ============================================================
// Update api.ts to add createProduct and createCustomer methods
// ============================================================
console.log('\n=== Updating api.ts ===');

const apiPath = p.join('services', 'api.ts');
if (fs.existsSync(apiPath)) {
  let c = fs.readFileSync(apiPath, 'utf-8');

  // Add createProduct to companiesApi
  if (!c.includes('createProduct')) {
    c = c.replace(
      'products: (companyId: string) => request<any>(`/companies/${companyId}/products`),',
      'products: (companyId: string) => request<any>(`/companies/${companyId}/products`),\n  createProduct: (companyId: string, body: any) =>\n    request<any>(`/companies/${companyId}/products`, { method: "POST", body }),'
    );
    console.log('  OK: Added createProduct to companiesApi');
    changes++;
  }

  // Add createCustomer to companiesApi
  if (!c.includes('createCustomer')) {
    c = c.replace(
      'customers: (companyId: string) => request<any>(`/companies/${companyId}/customers`),',
      'customers: (companyId: string) => request<any>(`/companies/${companyId}/customers`),\n  createCustomer: (companyId: string, body: any) =>\n    request<any>(`/companies/${companyId}/customers`, { method: "POST", body }),'
    );
    console.log('  OK: Added createCustomer to companiesApi');
    changes++;
  }

  fs.writeFileSync(apiPath, c, 'utf-8');
  console.log('  SAVED: api.ts (' + c.length + ' bytes)');
}

// ============================================================
console.log('\n========================================');
console.log('DONE: ' + changes + ' changes applied');
console.log('========================================');
console.log('  CONN-13: Estoque       — useEffect syncs API products, addProduct mutation');
console.log('  CONN-15: Clientes      — useEffect syncs API customers, addCustomer mutation');
console.log('  CONN-16: Contabilidade — useQuery obligations, HeroRing+Grid+Guide all dynamic');
console.log('  api.ts                 — createProduct + createCustomer methods added');
console.log('\nPattern for all 3:');
console.log('  - API data → useEffect → setState (merges into existing UI)');
console.log('  - Write ops → useMutation → invalidates queries');
console.log('  - Demo mode / no data → falls back to mock arrays');
console.log('\nRun:');
console.log('  git add -A && git commit -m "feat: CONN-13+15+16 - Estoque+Clientes+Contabilidade connected to real backend API" && git push');
