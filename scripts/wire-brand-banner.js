// Wire BrandBanner into Dashboard (index.tsx) and PDV (pdv.tsx)
// Run: cd ~/aura-app && node scripts/wire-brand-banner.js
const fs = require('fs');
const path = require('path');

// 1. Dashboard — add import + place after header
const dashPath = path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx');
let dash = fs.readFileSync(dashPath, 'utf8');

if (!dash.includes('BrandBanner')) {
  // Add import
  dash = dash.replace(
    'import { ProfileBanner } from "@/components/ProfileBanner";',
    'import { ProfileBanner } from "@/components/ProfileBanner";\nimport { BrandBanner } from "@/components/BrandBanner";'
  );
  // Place BrandBanner right before ProfileBanner
  dash = dash.replace(
    '<ProfileBanner />',
    '<BrandBanner />\n        <ProfileBanner />'
  );
  fs.writeFileSync(dashPath, dash, 'utf8');
  console.log('  index.tsx: BrandBanner wired');
} else {
  console.log('  index.tsx: already has BrandBanner');
}

// 2. PDV — add import + place at top of cart panel area
const pdvPath = path.join(__dirname, '..', 'app', '(tabs)', 'pdv.tsx');
let pdv = fs.readFileSync(pdvPath, 'utf8');

if (!pdv.includes('BrandBanner')) {
  // Find a good import line to add after
  if (pdv.includes('import { AgentBanner }')) {
    pdv = pdv.replace(
      'import { AgentBanner }',
      'import { BrandBanner } from "@/components/BrandBanner";\nimport { AgentBanner }'
    );
  } else if (pdv.includes('import { toast }')) {
    pdv = pdv.replace(
      'import { toast }',
      'import { BrandBanner } from "@/components/BrandBanner";\nimport { toast }'
    );
  } else {
    // Fallback: add at the top of imports
    pdv = 'import { BrandBanner } from "@/components/BrandBanner";\n' + pdv;
  }

  // Place BrandBanner after ScreenHeader
  if (pdv.includes('<AgentBanner context="pdv"')) {
    pdv = pdv.replace(
      '<AgentBanner context="pdv"',
      '<BrandBanner compact />\n        <AgentBanner context="pdv"'
    );
  } else if (pdv.includes('ScreenHeader')) {
    // After the first ScreenHeader closing tag
    pdv = pdv.replace(
      /(<ScreenHeader[^/]*\/>)/,
      '$1\n        <BrandBanner compact />'
    );
  }

  fs.writeFileSync(pdvPath, pdv, 'utf8');
  console.log('  pdv.tsx: BrandBanner compact wired');
} else {
  console.log('  pdv.tsx: already has BrandBanner');
}

console.log('\nDone! Run:\n  git add . && git commit -m "feat: wire BrandBanner into Dashboard + PDV" && git push');
