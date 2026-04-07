/**
 * Angular 21 defaults @Component to standalone unless standalone: false.
 * NgModule-declared components must opt out — add standalone: false when missing.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../src');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

for (const file of walk(root)) {
  let s = fs.readFileSync(file, 'utf8');
  const newS = s.replace(/@Component\(\{/g, (match, offset) => {
    const rest = s.slice(offset + match.length, offset + match.length + 600);
    if (/\bstandalone\s*:/.test(rest)) return match;
    return '@Component({ standalone: false,';
  });
  if (newS !== s) {
    fs.writeFileSync(file, newS);
    console.log('patched', path.relative(root, file));
  }
}
