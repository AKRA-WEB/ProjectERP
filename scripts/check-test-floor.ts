import fs from 'fs';
import path from 'path';

const MIN_TEST_FILES = 5;
const MIN_TEST_CASES = 25;
const ROOT_DIR = process.cwd();
const SEARCH_DIRS = ['app', 'components', 'lib', '__tests__'];
const TEST_FILE_RE = /\.(test|spec)\.[cm]?[jt]sx?$/;
const TEST_CASE_RE = /\b(?:it|test)\s*\(/g;

function collectFiles(dir: string, files: string[] = []): string[] {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue;
      collectFiles(fullPath, files);
    } else if (TEST_FILE_RE.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

const testFiles = SEARCH_DIRS.flatMap((dir) => collectFiles(path.join(ROOT_DIR, dir)));
const testCaseCount = testFiles.reduce((count, file) => {
  const source = fs.readFileSync(file, 'utf8');
  return count + (source.match(TEST_CASE_RE)?.length ?? 0);
}, 0);

if (testFiles.length < MIN_TEST_FILES || testCaseCount < MIN_TEST_CASES) {
  console.error(
    `Test floor failed: found ${testFiles.length} test file(s) and ${testCaseCount} test case(s). ` +
      `Minimum required: ${MIN_TEST_FILES} files and ${MIN_TEST_CASES} cases.`
  );
  process.exit(1);
}

console.log(`Test floor passed: ${testFiles.length} test file(s), ${testCaseCount} test case(s).`);
