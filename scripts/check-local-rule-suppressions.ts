import fs from 'fs';
import path from 'path';

const ROOT_DIR = process.cwd();
const SEARCH_DIRS = ['app', 'components', 'lib'];
const BASELINE_SUPPRESSION_COUNT = 115;
const SUPPRESSION_RE = /eslint-disable(?:-next-line)?\s+local-rules\//g;
const SOURCE_RE = /\.[cm]?[jt]sx?$/;

function collectFiles(dir: string, files: string[] = []): string[] {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue;
      collectFiles(fullPath, files);
    } else if (SOURCE_RE.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

const matches = SEARCH_DIRS
  .flatMap((dir) => collectFiles(path.join(ROOT_DIR, dir)))
  .flatMap((file) => {
    const source = fs.readFileSync(file, 'utf8');
    return Array.from(source.matchAll(SUPPRESSION_RE)).map((match) => ({
      file,
      index: match.index ?? 0,
    }));
  });

if (matches.length > BASELINE_SUPPRESSION_COUNT) {
  console.error(
    `local-rules suppression gate failed: found ${matches.length}, baseline is ${BASELINE_SUPPRESSION_COUNT}.`
  );
  for (const match of matches.slice(BASELINE_SUPPRESSION_COUNT)) {
    console.error(`New or excess suppression near ${path.relative(ROOT_DIR, match.file)}:${match.index}`);
  }
  process.exit(1);
}

console.log(
  `local-rules suppression gate passed: ${matches.length}/${BASELINE_SUPPRESSION_COUNT} baseline suppressions.`
);
