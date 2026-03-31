// fix-financeiro.js
// Run from aura-app root: node fix-financeiro.js

const fs = require('fs');
const p = require('path');

const f = p.join('app', '(tabs)', 'financeiro.tsx');
let c = fs.readFileSync(f, 'utf-8');

// Fix 1: Remove extra </View> in TabBar (line ~241)
c = c.replace(
  '    </ScrollView>\n    </View>\n  );\n}\nconst tb',
  '    </ScrollView>\n  );\n}\nconst tb'
);

// Fix 2: Add missing </View> closing tag for the outer wrapper in FinanceiroScreen
c = c.replace(
  '    </ScrollView>\n  );\n}\n\n// ── Shared Styles',
  '    </ScrollView>\n    </View>\n  );\n}\n\n// ── Shared Styles'
);

fs.writeFileSync(f, c, 'utf-8');
console.log('OK: Fixed JSX nesting in financeiro.tsx');
console.log('git add -A && git commit -m "fix: JSX nesting in financeiro" && git push');
