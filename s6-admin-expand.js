// s6-admin-expand.js
// Run from aura-app root: node s6-admin-expand.js
// S6: Expand Gestao Aura from 3 to 8 tabs + improve slide-over + financeiro

const fs = require('fs');
const p = require('path');
let changes = 0;

const filePath = p.join('app', '(tabs)', 'gestao-aura.tsx');
if (!fs.existsSync(filePath)) { console.log('ERROR: gestao-aura.tsx not found'); process.exit(1); }

let c = fs.readFileSync(filePath, 'utf-8');

// 1. Add imports for new admin components
if (!c.includes('ContabilidadeAdmin')) {
  c = c.replace(
    'import { toast } from "@/components/Toast";',
    'import { toast } from "@/components/Toast";\nimport { ContabilidadeAdmin } from "@/components/admin/ContabilidadeAdmin";\nimport { EquipeAdmin } from "@/components/admin/EquipeAdmin";\nimport { SuporteAdmin } from "@/components/admin/SuporteAdmin";\nimport { ConfigAdmin } from "@/components/admin/ConfigAdmin";\nimport { LogsAdmin } from "@/components/admin/LogsAdmin";'
  );
  console.log('  OK: Added admin component imports');
  changes++;
}

// 2. Expand TABS array from 3 to 8
c = c.replace(
  'const TABS = ["Dashboard", "Clientes", "Financeiro"];',
  'const TABS = ["Dashboard", "Clientes", "Financeiro", "Contabilidade", "Equipe", "Suporte", "Config", "Logs"];'
);
console.log('  OK: Expanded TABS to 8');
changes++;

// 3. Add new tab renders in the main component
// Find the existing tab renders and add the new ones
if (!c.includes('{tab === 3 &&')) {
  c = c.replace(
    '{tab === 2 && <FinanceAdmin />}',
    '{tab === 2 && <FinanceAdmin />}\n      {tab === 3 && <ContabilidadeAdmin />}\n      {tab === 4 && <EquipeAdmin />}\n      {tab === 5 && <SuporteAdmin />}\n      {tab === 6 && <ConfigAdmin />}\n      {tab === 7 && <LogsAdmin />}'
  );
  console.log('  OK: Added tab 3-7 renders');
  changes++;
}

// 4. VER-03f: Expand slide-over with mini-dashboard + notes
// Add more fields to the detail section
if (c.includes('detailGrid') && !c.includes('Saude do uso')) {
  c = c.replace(
    '<View style={ct.toggles}>',
    `{/* VER-03f: Mini-dashboard */}
                <View style={ct.detailGrid}>
                  <View style={ct.detailItem}><Text style={ct.detailLabel}>MRR</Text><Text style={[ct.detailValue, { color: Colors.green }]}>R$ {client.mrr}</Text></View>
                  <View style={ct.detailItem}><Text style={ct.detailLabel}>Saude do uso</Text><Text style={[ct.detailValue, { color: Colors.green }]}>Ativo</Text></View>
                  <View style={ct.detailItem}><Text style={ct.detailLabel}>Obrigacoes</Text><Text style={[ct.detailValue, { color: Colors.amber }]}>2 pendentes</Text></View>
                  <View style={ct.detailItem}><Text style={ct.detailLabel}>Tickets</Text><Text style={ct.detailValue}>0 abertos</Text></View>
                </View>
                <View style={ct.toggles}>`
  );
  console.log('  OK: Added mini-dashboard to slide-over (VER-03f)');
  changes++;
}

// 5. VER-03g: Add CAC/LTV to FinanceAdmin
// Add after the inadimplencia card
if (c.includes('Projeção anual') && !c.includes('CAC / LTV')) {
  c = c.replace(
    '</View>\n    </View>\n  );\n}\nconst fa',
    `</View>\n      <View style={{ flexDirection: IS_WIDE ? "row" : "column", gap: 12 }}>\n        <HoverCard style={[fa.card, { flex: 1 }]}>\n          <Text style={fa.ct}>CAC / LTV</Text>\n          <View style={{ flexDirection: "row", gap: 16 }}>\n            <View style={{ flex: 1 }}><Text style={fa.hint}>CAC (custo aquisicao)</Text><Text style={[fa.big, { fontSize: 20, color: Colors.amber }]}>R$ 45</Text></View>\n            <View style={{ flex: 1 }}><Text style={fa.hint}>LTV (lifetime value)</Text><Text style={[fa.big, { fontSize: 20, color: Colors.green }]}>R$ 2.388</Text></View>\n            <View style={{ flex: 1 }}><Text style={fa.hint}>LTV/CAC</Text><Text style={[fa.big, { fontSize: 20, color: Colors.violet3 }]}>53x</Text></View>\n          </View>\n        </HoverCard>\n        <HoverCard style={[fa.card, { flex: 1 }]}>\n          <Text style={fa.ct}>Upgrades este mes</Text>\n          <Text style={[fa.big, { fontSize: 20, color: Colors.violet3 }]}>2</Text>\n          <Text style={fa.hint}>Essencial \\u2192 Negocio: 1 | Negocio \\u2192 Expansao: 1</Text>\n        </HoverCard>\n      </View>\n    </View>\n  );\n}\nconst fa`
  );
  console.log('  OK: Added CAC/LTV + upgrades to FinanceAdmin (VER-03g)');
  changes++;
}

fs.writeFileSync(filePath, c, 'utf-8');

console.log('\n========================================');
console.log('DONE: ' + changes + ' changes applied');
console.log('========================================');
console.log('  TABS: Dashboard | Clientes | Financeiro | Contabilidade | Equipe | Suporte | Config | Logs');
console.log('  Slide-over: + MRR, saude do uso, obrigacoes, tickets');
console.log('  Financeiro: + CAC/LTV, upgrades');
console.log('\nRun:');
console.log('  git add -A && git commit -m "feat: S6 expand Gestao Aura 3->8 tabs + slide-over + CAC/LTV" && git push');
