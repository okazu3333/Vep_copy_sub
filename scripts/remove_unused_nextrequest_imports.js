const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TARGET_DIR = path.join(ROOT, 'app', 'api');

function listFiles(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listFiles(full));
    else if (ent.isFile() && (full.endsWith('.ts') || full.endsWith('.tsx'))) out.push(full);
  }
  return out;
}

function processFile(file) {
  let src = fs.readFileSync(file, 'utf8');
  // Count all occurrences of NextRequest
  const allMatches = src.match(/\bNextRequest\b/g) || [];
  if (allMatches.length === 0) return false;

  // Count import specifiers that include NextRequest from next/server
  const importSpecifierMatches = src.match(/import\s*\{[^}]*\bNextRequest\b[^}]*\}\s*from\s*['"]next\/server['"]/g) || [];
  // If all occurrences are only in import specifiers, it's unused
  if (allMatches.length !== importSpecifierMatches.length) return false;

  let changed = false;
  src = src.replace(/import\s*\{([^}]+)\}\s*from\s*['"]next\/server['"];?/g, (m, inner) => {
    if (!/\bNextRequest\b/.test(inner)) return m;
    const names = inner.split(',').map(s => s.trim()).filter(Boolean);
    const filtered = names.filter(n => n !== 'NextRequest');
    changed = true;
    if (filtered.length === 0) return '';
    return `import { ${filtered.join(', ')} } from 'next/server'`;
  });

  if (changed) fs.writeFileSync(file, src, 'utf8');
  return changed;
}

function main() {
  const files = listFiles(TARGET_DIR);
  let cnt = 0;
  for (const f of files) {
    try {
      if (processFile(f)) {
        cnt++;
        console.log('Updated:', path.relative(ROOT, f));
      }
    } catch (e) {
      console.error('Error:', f, e && e.message);
    }
  }
  console.log('Done. Files updated:', cnt);
}

if (require.main === module) main(); 