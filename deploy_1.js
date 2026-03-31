// deploy.js
// Run from aura-app root: node deploy.js
// Temporarily adds baseUrl for build, then restores app.json

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('\n=== AURA DEPLOY ===\n');

const appJsonPath = 'app.json';
const original = fs.readFileSync(appJsonPath, 'utf-8');

// 1. Temporarily inject baseUrl: "/app"
console.log('[1/5] Injecting baseUrl for deploy...');
const config = JSON.parse(original);
config.expo.experiments = config.expo.experiments || {};
config.expo.experiments.baseUrl = "/app";
fs.writeFileSync(appJsonPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');

// 2. Build
console.log('[2/5] Building web...');
try {
  execSync('npx expo export --platform web', { stdio: 'inherit' });
} catch (e) {
  fs.writeFileSync(appJsonPath, original, 'utf-8');
  console.log('ERROR: Build failed. app.json restored.');
  process.exit(1);
}

// 3. Restore app.json immediately
fs.writeFileSync(appJsonPath, original, 'utf-8');
console.log('[3/5] app.json restored (baseUrl removed)');

// 4. Verify
const distIndex = path.join('dist', 'index.html');
if (!fs.existsSync(distIndex)) {
  console.log('ERROR: dist/index.html not found');
  process.exit(1);
}
const sourceCheck = path.join('app', '(tabs)', '_layout.tsx');
if (!fs.existsSync(sourceCheck)) {
  console.log('CRITICAL: Source code overwritten!');
  console.log('Run: git checkout HEAD -- "app/(tabs)" "app/(auth)" "app/_layout.tsx"');
  process.exit(1);
}
console.log('[4/5] Build OK + source intact');

// 5. Copy to aura-site
const siteDir = path.join('..', 'aura-site');
const siteApp = path.join(siteDir, 'app');
if (!fs.existsSync(siteDir)) {
  console.log('ERROR: ../aura-site not found');
  process.exit(1);
}
if (fs.existsSync(siteApp)) {
  fs.rmSync(siteApp, { recursive: true, force: true });
}
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}
copyDir('dist', siteApp);

if (fs.existsSync(path.join(siteApp, 'index.html'))) {
  console.log('[5/5] Copied to ../aura-site/app/');
  console.log('\nDone! Run:');
  console.log('  cd ../aura-site');
  console.log('  git add -A && git commit -m "deploy: app demo" && git push origin main');
} else {
  console.log('ERROR: Copy failed');
}
