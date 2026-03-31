// fix-paths-deploy.js
// Run from aura-app root AFTER "npx expo export --platform web"
// Rewrites absolute paths (/_expo/...) to relative (./...) in dist/index.html
// Safe: only touches dist/, never touches source code

const fs = require('fs');
const path = require('path');

const distDir = path.join(process.cwd(), 'dist');
const indexFile = path.join(distDir, 'index.html');

if (!fs.existsSync(indexFile)) {
  console.log('ERROR: dist/index.html not found.');
  console.log('Run "npx expo export --platform web" first.');
  process.exit(1);
}

let html = fs.readFileSync(indexFile, 'utf-8');
const original = html;

// Replace absolute paths with relative
// /_expo/... → ./_expo/...
html = html.replace(/src="\/_expo\//g, 'src="./_expo/');
html = html.replace(/href="\/_expo\//g, 'href="./_expo/');

// /assets/... → ./assets/...
html = html.replace(/src="\/assets\//g, 'src="./assets/');
html = html.replace(/href="\/assets\//g, 'href="./assets/');

// /favicon... → ./favicon...
html = html.replace(/href="\/favicon/g, 'href="./favicon');

if (html !== original) {
  fs.writeFileSync(indexFile, html, 'utf-8');
  const changes = (original.length - original.replace(/"\/_expo\//g, '').length) / '"/_expo/'.length;
  console.log('OK: Paths rewritten to relative in dist/index.html');
  console.log('  /_expo/... → ./_expo/...');
  console.log('  /assets/... → ./assets/...');
} else {
  console.log('No changes needed - paths already relative.');
}

console.log('\nNext steps:');
console.log('  cd ../aura-site');
console.log('  rm -rf app');
console.log('  cp -r ../aura-app/dist app');
console.log('  git add -A && git commit -m "deploy: app demo" && git push origin main');
