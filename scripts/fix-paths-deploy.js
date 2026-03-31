// fix-paths-deploy.js
// Run from aura-app root AFTER "npx expo export --platform web"
// Rewrites ALL absolute paths to relative in dist/
// Fixes: index.html + all JS bundles (dynamic chunk imports)

const fs = require('fs');
const path = require('path');

const distDir = path.join(process.cwd(), 'dist');

if (!fs.existsSync(distDir)) {
  console.log('ERROR: dist/ not found. Run "npx expo export --platform web" first.');
  process.exit(1);
}

let totalFiles = 0;

// Fix index.html
const indexFile = path.join(distDir, 'index.html');
if (fs.existsSync(indexFile)) {
  let html = fs.readFileSync(indexFile, 'utf-8');
  const orig = html;
  html = html.replace(/src="\/_expo\//g, 'src="./_expo/');
  html = html.replace(/href="\/_expo\//g, 'href="./_expo/');
  html = html.replace(/src="\/assets\//g, 'src="./assets/');
  html = html.replace(/href="\/assets\//g, 'href="./assets/');
  if (html !== orig) {
    fs.writeFileSync(indexFile, html, 'utf-8');
    console.log('OK: index.html - paths fixed');
    totalFiles++;
  }
}

// Fix all JS files recursively
function fixFiles(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      fixFiles(fullPath);
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.css')) {
      let content = fs.readFileSync(fullPath, 'utf-8');
      const orig = content;

      // Fix chunk import paths
      content = content.replace(/"\/_expo\//g, '"./_expo/');
      content = content.replace(/'\/_expo\//g, "'./_expo/");
      content = content.replace(/"\/assets\//g, '"./assets/');
      content = content.replace(/'\/assets\//g, "'./assets/");

      // Fix publicPath = "/"
      content = content.replace(/\.p\s*=\s*"\/"/g, '.p="./"');
      content = content.replace(/\.p\s*=\s*'\/'/g, ".p='./'");

      // Fix CSS url()
      content = content.replace(/url\(\/_expo\//g, 'url(./_expo/');
      content = content.replace(/url\(\/assets\//g, 'url(./assets/');

      if (content !== orig) {
        fs.writeFileSync(fullPath, content, 'utf-8');
        console.log('OK: ' + path.relative(distDir, fullPath));
        totalFiles++;
      }
    }
  }
}

fixFiles(path.join(distDir, '_expo'));

console.log('\nDone: ' + totalFiles + ' files fixed');
console.log('\nNext:');
console.log('  cd ../aura-site');
console.log('  rm -rf app');
console.log('  cp -r ../aura-app/dist app');
console.log('  git add -A && git commit -m "deploy: fix all asset paths" && git push origin main');
