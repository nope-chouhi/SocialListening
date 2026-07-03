import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const localesDir = path.join(__dirname, '../src/i18n/locales');
const locales = ['vi', 'en', 'th', 'ja', 'ko', 'zh'];

function extractKeys(node, prefix = '') {
  let keys = [];
  if (ts.isObjectLiteralExpression(node)) {
    node.properties.forEach(prop => {
      if (ts.isPropertyAssignment(prop)) {
        const keyName = prop.name.text || prop.name.escapedText;
        if (ts.isObjectLiteralExpression(prop.initializer)) {
          keys = keys.concat(extractKeys(prop.initializer, prefix + keyName + '.'));
        } else {
          keys.push(prefix + keyName);
        }
      }
    });
  }
  return keys;
}

const allKeys = {};

for (const l of locales) {
  const filePath = path.join(localesDir, `${l}.ts`);
  const code = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(`${l}.ts`, code, ts.ScriptTarget.Latest, true);
  
  let keys = [];
  const walk = (node) => {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
      keys = extractKeys(node.initializer);
    }
    ts.forEachChild(node, walk);
  };
  walk(sourceFile);
  
  if (keys.length === 0) {
    console.error(`Failed to parse keys from ${l}.ts.`);
    process.exit(1);
  }
  allKeys[l] = keys;
}

const reference = new Set(allKeys['vi']);
let hasError = false;

for (const l of locales) {
  if (l === 'vi') continue;
  const curr = new Set(allKeys[l]);
  const missing = [...reference].filter(x => !curr.has(x));
  const extra = [...curr].filter(x => !reference.has(x));
  
  if (missing.length > 0 || extra.length > 0) {
    hasError = true;
    console.log(`\n❌ Locale ${l} parity mismatch!`);
    if (missing.length > 0) {
      console.log(`   Missing keys (${missing.length}):`);
      missing.forEach(k => console.log(`     - ${k}`));
    }
    if (extra.length > 0) {
      console.log(`   Extra keys (${extra.length}):`);
      extra.forEach(k => console.log(`     - ${k}`));
    }
  } else {
    console.log(`✅ Locale ${l} is COMPLETE relative to vi`);
  }
}

if (hasError) {
  console.error('\nI18N Parity Check Failed: Key structures do not match across all locales.');
  process.exit(1);
} else {
  console.log('\nAll locales have identical key structures.');
}
