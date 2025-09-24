const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TARGET_DIR = path.join(ROOT, 'app', 'api');

function listFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFiles(full));
    } else if (entry.isFile() && (full.endsWith('.ts') || full.endsWith('.tsx'))) {
      out.push(full);
    }
  }
  return out;
}

function findAllIndices(str, sub) {
  const idxs = [];
  let idx = 0;
  while (true) {
    idx = str.indexOf(sub, idx);
    if (idx === -1) break;
    idxs.push(idx);
    idx += sub.length;
  }
  return idxs;
}

function prefixUnusedRequestInFile(filePath) {
  let src = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Scan for function declarations with (request: NextRequest)
  // Rough regex to find function start
  const funcRegex = /export\s+async\s+function\s+[A-Za-z0-9_]+\s*\(\s*request\s*:\s*NextRequest\s*\)/g;
  let match;
  const edits = [];
  while ((match = funcRegex.exec(src)) !== null) {
    const startIdx = match.index;
    // Find the opening brace '{' after the signature
    const braceIdx = src.indexOf('{', funcRegex.lastIndex);
    if (braceIdx === -1) continue;

    // Balance braces to find function end
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
    const used = /\brequest\b/.test(body);
    if (!used) {
      // Safe to rename the param in the signature to _request
      const before = src.slice(0, match.index);
      const sig = src.slice(match.index, braceIdx);
      const after = src.slice(braceIdx);
      const newSig = sig.replace(/\(\s*request\s*:\s*NextRequest\s*\)/, '(_request: NextRequest)');
      if (newSig !== sig) {
        src = before + newSig + after;
        changed = true;
        // Adjust regex lastIndex because src length may have changed but we will rescan fresh below
      }
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, src, 'utf8');
  }
  return changed;
}

function main() {
  const files = listFiles(TARGET_DIR);
  let changedCount = 0;
  for (const f of files) {
    try {
      if (prefixUnusedRequestInFile(f)) {
        changedCount++;
        console.log(`Updated: ${path.relative(ROOT, f)}`);
      }
    } catch (e) {
      console.error(`Skip (error): ${f}: ${e && e.message}`);
    }
  }
  console.log(`Done. Files updated: ${changedCount}`);
}

if (require.main === module) {
  main();
} 