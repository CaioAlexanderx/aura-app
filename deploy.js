// deploy.js
// Run from aura-app root: node deploy.js
// Builds, then copies dist/ to ../aura-site/app/

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('\n=== AURA DEPLOY ===\n');

// 1. Build
console.log('[1/4] Building web...');
execSync('npx expo export --platform web', { stdio: 'inherit' });

// 2. Verify dist
const distIndex = path.join('dist', 'index.html');
if (!fs.existsSync(distIndex)) {
  console.log('ERROR: dist/index.html not found');
  process.exit(1);
}
console.log('[2/4] Build OK');

// 3. Verify source code is intact
const sourceCheck = path.join('app', '(tabs)', '_layout.tsx');
if (!fs.existsSync(sourceCheck)) {
  console.log('CRITICAL: Source code in app/ was overwritten by build!');
  console.log('Run: git checkout HEAD -- "app/(tabs)" "app/(auth)" "app/_layout.tsx"');
  process.exit(1);
}
console.log('[3/4] Source code intact');

// 4. Copy to aura-site
const siteDir = path.join('..', 'aura-site');
const siteApp = path.join(siteDir, 'app');
if (!fs.existsSync(siteDir)) {
  console.log('ERROR: ../aura-site not found');
  process.exit(1);
}

// Remove old app/
if (fs.existsSync(siteApp)) {
  fs.rmSync(siteApp, { recursive: true, force: true });
}

// Copy dist/ -> ../aura-site/app/
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}
copyDir('dist', siteApp);

// Verify
if (fs.existsSync(path.join(siteApp, 'index.html'))) {
  console.log('[4/4] Copied to ../aura-site/app/');
  console.log('\nDone! Now run:');
  console.log('  cd ../aura-site');
  console.log('  git add -A && git commit -m "deploy: app demo" && git push origin main');
} else {
  console.log('ERROR: Copy failed');
}
