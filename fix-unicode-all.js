// fix-unicode-all.js
// Run from aura-app root: node fix-unicode-all.js
// Scans ALL .tsx/.ts files and converts Unicode escapes to real UTF-8 characters
// Should be run after ANY commit via GitHub MCP (push_files or create_or_update_file)

const fs = require('fs');
const path = require('path');

// All Unicode escapes that appear in Portuguese text
const ESCAPES = [
  // Composites (must come first)
  ['\\u00e7\\u00e3o', 'ção'],
  ['\\u00e7\\u00f5es', 'ções'],
  // Lowercase
  ['\\u00e0', 'à'],
  ['\\u00e1', 'á'],
  ['\\u00e2', 'â'],
  ['\\u00e3', 'ã'],
  ['\\u00e7', 'ç'],
  ['\\u00e9', 'é'],
  ['\\u00ea', 'ê'],
  ['\\u00ed', 'í'],
  ['\\u00f3', 'ó'],
  ['\\u00f4', 'ô'],
  ['\\u00f5', 'õ'],
  ['\\u00fa', 'ú'],
  // Uppercase
  ['\\u00c0', 'À'],
  ['\\u00c1', 'Á'],
  ['\\u00c2', 'Â'],
  ['\\u00c3', 'Ã'],
  ['\\u00c7', 'Ç'],
  ['\\u00c9', 'É'],
  ['\\u00ca', 'Ê'],
  ['\\u00cd', 'Í'],
  ['\\u00d3', 'Ó'],
  ['\\u00d4', 'Ô'],
  ['\\u00d5', 'Õ'],
  ['\\u00da', 'Ú'],
  // Symbols
  ['\\u00b7', '·'],
  ['\\u2715', '✕'],
  ['\\u2022', '•'],
];

// Directories to scan
const SCAN_DIRS = [
  path.join('app', '(tabs)'),
  path.join('app', '(auth)'),
  'app',
  'components',
  'constants',
  'stores',
  'services',
];

// Extensions to process
const EXTENSIONS = ['.tsx', '.ts', '.js'];

function scanDir(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Don't recurse into (tabs)/(auth) from app/ since we scan them separately
      if (dir === 'app' && (entry.name === '(tabs)' || entry.name === '(auth)')) continue;
      files.push(...scanDir(full));
    } else if (EXTENSIONS.some(ext => entry.name.endsWith(ext))) {
      files.push(full);
    }
  }
  return files;
}

console.log('\n=== FIX UNICODE ESCAPES ===\n');

let totalFixes = 0;
let filesFixed = 0;
const allFiles = [];
for (const dir of SCAN_DIRS) {
  allFiles.push(...scanDir(dir));
}

// Deduplicate
const uniqueFiles = [...new Set(allFiles)];
console.log(`Scanning ${uniqueFiles.length} files...\n`);

for (const file of uniqueFiles) {
  let c = fs.readFileSync(file, 'utf-8');
  const original = c;
  let fileFixes = 0;

  for (const [esc, real] of ESCAPES) {
    const count = c.split(esc).length - 1;
    if (count > 0) {
      c = c.split(esc).join(real);
      fileFixes += count;
    }
  }

  if (c !== original) {
    fs.writeFileSync(file, c, 'utf-8');
    console.log(`  OK: ${file} (${fileFixes} fixes)`);
    totalFixes += fileFixes;
    filesFixed++;
  }
}

if (totalFixes > 0) {
  console.log(`\n${totalFixes} escapes fixed in ${filesFixed} files`);
  
  // Verify no remaining escapes
  let remaining = 0;
  for (const file of uniqueFiles) {
    const c = fs.readFileSync(file, 'utf-8');
    const matches = c.match(/\\u00[a-f0-9]{2}/g) || [];
    if (matches.length > 0) {
      console.log(`  WARNING: ${file} still has: ${[...new Set(matches)].join(', ')}`);
      remaining += matches.length;
    }
  }
  if (remaining === 0) console.log('\nAll clean - no Unicode escapes remaining!');
} else {
  console.log('No Unicode escapes found - all files clean!');
}

console.log('\ngit add -A && git commit -m "fix: convert all Unicode escapes to UTF-8" && git push');
