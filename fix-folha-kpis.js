// fix-folha-kpis.js
// Run from aura-app root: node fix-folha-kpis.js
// Fix: Folha KPIs (Ativos, Folha Bruta, FGTS) losing format on mobile

const fs = require('fs');
const p = require('path');

const folha = p.join('app', '(tabs)', 'folha.tsx');
if (!fs.existsSync(folha)) { console.log('ERROR: folha.tsx not found'); process.exit(1); }

let c = fs.readFileSync(folha, 'utf-8');
let changes = 0;

// 1. Fix KPI row - add flexWrap and adjust minWidth
if (c.includes('kpis:{flexDirection:"row",gap:10,marginBottom:20}')) {
  c = c.replace(
    'kpis:{flexDirection:"row",gap:10,marginBottom:20}',
    'kpis:{flexDirection:"row",flexWrap:"wrap",gap:10,marginBottom:20}'
  );
  changes++;
  console.log('OK: KPI row flexWrap added');
}

// 2. Fix individual KPI card - add minWidth for mobile
if (c.includes('kpi:{flex:1,backgroundColor:Colors.bg3,borderRadius:14,padding:16,borderWidth:1,borderColor:Colors.border,alignItems:"center",gap:6}')) {
  c = c.replace(
    'kpi:{flex:1,backgroundColor:Colors.bg3,borderRadius:14,padding:16,borderWidth:1,borderColor:Colors.border,alignItems:"center",gap:6}',
    'kpi:{flex:1,minWidth:IS_WIDE?120:"30%",backgroundColor:Colors.bg3,borderRadius:14,padding:IS_WIDE?16:12,borderWidth:1,borderColor:Colors.border,alignItems:"center",gap:4}'
  );
  changes++;
  console.log('OK: KPI card minWidth + mobile padding');
}

// 3. Fix KPI value font size for mobile
if (c.includes('kv:{fontSize:18,fontWeight:"700",color:Colors.ink}')) {
  c = c.replace(
    'kv:{fontSize:18,fontWeight:"700",color:Colors.ink}',
    'kv:{fontSize:IS_WIDE?18:14,fontWeight:"700",color:Colors.ink}'
  );
  changes++;
  console.log('OK: KPI value font responsive');
}

// 4. Fix the summary grid in Resumo tab too
if (c.includes('sg:{flexDirection:"row",flexWrap:"wrap",gap:12,marginBottom:16}')) {
  console.log('OK: Summary grid already wraps');
} else if (c.includes('sg:{flexDirection:"row"')) {
  c = c.replace(
    'sg:{flexDirection:"row",gap:12,marginBottom:16}',
    'sg:{flexDirection:"row",flexWrap:"wrap",gap:12,marginBottom:16}'
  );
  changes++;
  console.log('OK: Summary grid wrap added');
}

// 5. Fix summary item width for mobile
if (c.includes('si:{width:IS_WIDE?"30%":"46%"')) {
  console.log('OK: Summary items already responsive');
} else if (c.includes('si:{width:"30%"')) {
  c = c.replace('si:{width:"30%"', 'si:{width:IS_WIDE?"30%":"46%"');
  changes++;
}

// 6. Fix the cost row (custo total) to wrap on mobile
if (c.includes('cr:{flexDirection:"row"') && !c.includes('cr:{flexDirection:"row",flexWrap')) {
  c = c.replace(
    'cr:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"',
    'cr:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8'
  );
  changes++;
  console.log('OK: Cost row wrap added');
}

fs.writeFileSync(folha, c, 'utf-8');
console.log('\nDONE: ' + changes + ' fixes applied');
console.log('git add -A && git commit -m "fix: folha KPIs mobile responsive" && git push');
