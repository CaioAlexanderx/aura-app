// Wire comparative charts into TabResumo.tsx
// Run: cd ~/aura-app && node scripts/wire-charts.js
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'components', 'screens', 'financeiro', 'TabResumo.tsx');
let code = fs.readFileSync(file, 'utf8');

if (code.includes('FinancialCharts')) {
  console.log('Charts already wired');
  process.exit(0);
}

// 1. Add import
code = code.replace(
  'import { fmt } from "./types";',
  'import { fmt } from "./types";\nimport { EmployeeDonut, EmployeeMonthlyChart, RevenueTrendLine } from "./FinancialCharts";'
);

// 2. Add RevenueTrendLine after MonthlyChart
code = code.replace(
  '<MonthlyChart data={d.monthly} />',
  '<MonthlyChart data={d.monthly} />\n      <RevenueTrendLine monthly={d.monthly} />'
);

// 3. Add EmployeeDonut after EmployeeRanking
code = code.replace(
  '<EmployeeRanking employees={d.employees} />',
  '<EmployeeRanking employees={d.employees} />\n      <EmployeeDonut employees={d.employees} />\n      <EmployeeMonthlyChart data={d.employeeMonthly} employees={d.employees.map((e: any) => e.name)} />'
);

fs.writeFileSync(file, code, 'utf8');
console.log('TabResumo.tsx: wired 3 comparative charts');
console.log('  - RevenueTrendLine (after monthly bars)');
console.log('  - EmployeeDonut (after ranking)');
console.log('  - EmployeeMonthlyChart (after donut)');
