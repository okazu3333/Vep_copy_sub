const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TARGET_DIR = path.join(ROOT, 'app', 'api');

const NAMES = ['result', 'createResult', 'dedupResult'];

function listFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else if (entry.isFile() && (full.endsWith('.ts') || full.endsWith('.tsx'))) out.push(full);
  }
  return out;
}

function prefixVarDecls(src, name) {
  let changed = false;
  // const name = ... | let name = ... | var name = ...
  const re = new RegExp(`\n(\s*)(const|let|var)\s+${name}(\s*=)`, 'g');
  src = src.replace(re, (m, indent, kind, eq) => {
    changed = true;
    return `\n${indent}${kind} _${name}${eq}`;
  });
  // Destructuring: const { name, ... } = ... → prefix inside destructuring to _name
  const reObj = new RegExp(`\{([^}]*?)\}`, 'g');
  src = src.replace(reObj, (block) => {
    // Only transform if it's a destructuring in a declaration line
    if (!/(const|let|var)\s*\{/.test(block)) return block;
    let inner = block;
    for (const n of [name]) {
      const reItem = new RegExp(`(^|[\s,{])${n}([\s,}=])`, 'g');
      inner = inner.replace(reItem, (mm, p1, p2) => `${p1}_${n}${p2}`);
    }
    return inner;
  });
  return { src, changed };
}

function processFile(file) {
  let src = fs.readFileSync(file, 'utf8');
  let changedAny = false;
  for (const n of NAMES) {
    const res = prefixVarDecls(src, n);
    if (res.changed) {
      src = res.src;
      changedAny = true;
    }
  }
  if (changedAny) fs.writeFileSync(file, src, 'utf8');
  return changedAny;
}

function main() {
  const files = listFiles(TARGET_DIR);
  let changed = 0;
  for (const f of files) {
    try {
      if (processFile(f)) {
        changed++;
        console.log('Updated:', path.relative(ROOT, f));
      }
    } catch (e) {
      console.error('Error:', f, e && e.message);
    }
  }
  console.log('Done. Files updated:', changed);
}

if (require.main === module) main(); 