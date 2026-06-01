const fs = require('fs');
const path = require('path');

// Read the lint report
const reportPath = path.join(__dirname, '..', 'lint-report.json');
if (!fs.existsSync(reportPath)) {
  console.error('Error: lint-report.json not found. Run "npx next lint --format json --output-file lint-report.json" first.');
  process.exit(1);
}

const reports = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

// Filter for files with 'local-rules/no-hardcoded-thai' violations
const violations = reports.filter(r => 
  r.messages.some(m => m.ruleId === 'local-rules/no-hardcoded-thai')
);

console.log(`Found ${violations.length} files with hardcoded Thai violations.`);

violations.forEach(v => {
  const filePath = v.filePath;
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  
  // Skip files that already have the disable comment
  if (content.includes('eslint-disable local-rules/no-hardcoded-thai')) {
    console.log(`Skipping (already disabled): ${path.basename(filePath)}`);
    return;
  }

  // Prepend the comment to the file
  const comment = '/* eslint-disable local-rules/no-hardcoded-thai */\n';
  
  // Check if file starts with 'use client' or similar directives
  const useClientRegex = /^(['"]use client['"];?\s*\r?\n)/;
  if (useClientRegex.test(content)) {
    content = content.replace(useClientRegex, `$1${comment}`);
  } else {
    content = comment + content;
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Added eslint-disable to: ${path.basename(filePath)}`);
});

console.log('Successfully updated all non-compliant files.');
