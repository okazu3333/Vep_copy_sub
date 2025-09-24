const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TARGET_DIR = path.join(ROOT, 'app', 'api');

function listFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else if (entry.isFile() && (full.endsWith('.ts') || full.endsWith('.tsx'))) out.push(full);
  }
  return out;
}

function removeIfUnused(src) {
  let changed = false;
  // Match: export async function NAME(param: NextRequest)
  const funcRegex = /export\s+async\s+function\s+([A-Za-z0-9_]+)\s*\(\s*([A-Za-z0-9_]+)\s*:\s*NextRequest\s*\)/g;
  let result;
  let lastIndex = 0;
  let newSrc = '';

  while ((result = funcRegex.exec(src)) !== null) {
    const [full, name, paramName] = result;
    const sigStart = result.index;
    // Find opening brace after signature
    const braceIdx = src.indexOf('{', funcRegex.lastIndex);
    if (braceIdx === -1) continue;

    // Balance braces to find end of function body
    let depth = 0;
    let i = braceIdx;
    while (i < src.length) {
      const ch = src[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) { i++; break; }
      }
      i++;
    }
    const bodyStart = braceIdx + 1;
    const bodyEnd = i - 1;
    if (bodyEnd <= bodyStart) continue;

    const body = src.slice(bodyStart, bodyEnd);
    const isUsed = new RegExp(`\\b${paramName}\\b`).test(body);

    // Append content before signature
    newSrc += src.slice(lastIndex, sigStart);
    if (!isUsed) {
      // Replace signature to remove param
      const sig = src.slice(sigStart, braceIdx);
      const replaced = sig.replace(/\(\s*[A-Za-z0-9_]+\s*:\s*NextRequest\s*\)/, '()');
      newSrc += replaced + src.slice(braceIdx, i);
      changed = true;
    } else {
      // Keep original
      newSrc += src.slice(sigStart, i);
    }
    lastIndex = i;
  }

  if (lastIndex === 0) return { src, changed };
  newSrc += src.slice(lastIndex);
  return { src: newSrc, changed };
}

function processFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  const { src: out, changed } = removeIfUnused(src);
  if (changed) fs.writeFileSync(file, out, 'utf8');
  return changed;
}

function main() {
  const files = listFiles(TARGET_DIR);
  let changedCount = 0;
  for (const f of files) {
    try {
      if (processFile(f)) {
        changedCount++;
        console.log('Updated:', path.relative(ROOT, f));
      }
    } catch (e) {
      console.error('Error:', f, e && e.message);
    }
  }
  console.log('Done. Files updated:', changedCount);
}

if (require.main === module) main(); 