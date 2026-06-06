import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const root = process.cwd();

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function exists(relativePath: string): boolean {
  return fs.existsSync(path.join(root, relativePath));
}

function fail(message: string): never {
  console.error(`agent-closeout: ${message}`);
  process.exit(1);
}

const tracked = git(['ls-files']).split(/\r?\n/).filter(Boolean);

const forbiddenTracked = tracked.filter((file) => {
  return (
    file === 'lint-output.txt' ||
    file === 'lint_hr_output.txt' ||
    file.includes('lint-output-full.txt') ||
    file.startsWith('scratch/') ||
    file.startsWith('data/') ||
    file.startsWith('HH-Project manager/') ||
    file.startsWith('.antigravitycli/') ||
    file.startsWith('.superpowers/') ||
    file === '.claude/settings.local.json'
  );
});

if (forbiddenTracked.length > 0) {
  fail(`tracked local/generated files remain:\n${forbiddenTracked.join('\n')}`);
}

const changed = git(['status', '--porcelain'])
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => line.slice(3));

const touchedCodeOrSchema = changed.some((file) =>
  /^(app|components|hooks|lib|migrations|types|middleware\.ts|auth\.ts|auth\.config\.ts|next\.config\.ts|package\.json|package-lock\.json)/.test(file)
);

if (touchedCodeOrSchema) {
  const touchedKnowledge = changed.some((file) =>
    /^(_notes\/02_Agent_Memory\/current-state\.md|_notes\/02_Agent_Memory\/pitfalls\.md|_notes\/00_Project_Map\/modules\/|docs\/SCHEMA\.md|conductor\/tracks\/|conductor\/index\.md|docs\/skills\/)/.test(file)
  );

  if (!touchedKnowledge) {
    fail('code/schema changed but no conductor, schema, or Obsidian memory file changed');
  }
}

const requiredPaths = [
  'docs/skills/universal_agent_rules.md',
  'docs/skills/agent-principles.md',
  'docs/skills/qa_audit_rules.md',
  'docs/AI_WORKFLOW_GUIDE.md',
  'docs/SCHEMA.md',
  '_notes/02_Agent_Memory/current-state.md',
  '_notes/02_Agent_Memory/pitfalls.md',
  'conductor/index.md',
];

for (const requiredPath of requiredPaths) {
  if (!exists(requiredPath)) {
    fail(`required agent/Obsidian path is missing: ${requiredPath}`);
  }
}

console.log('agent-closeout: cleanup and knowledge checks passed');
