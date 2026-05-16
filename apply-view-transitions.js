const fs = require('fs');
const path = require('path');

const filesToProcess = [
  'app/app/sales-quotations/page.tsx',
  'app/app/sales-quotations/[id]/page.tsx',
  'app/app/sales-orders/page.tsx',
  'app/app/sales-orders/[id]/page.tsx',
  'app/app/sales-invoices/page.tsx',
  'app/app/sales-invoices/[id]/page.tsx',
  'app/app/sales-returns/page.tsx',
  'app/app/sales-returns/[id]/page.tsx',
  'app/app/claims/page.tsx',
  'app/app/claims/[id]/page.tsx',
  'app/app/rma/page.tsx',
  'app/app/rma/[id]/page.tsx',
  'app/app/ap/page.tsx',
  'app/app/ap/[id]/page.tsx',
  'app/app/accounting/journal-entries/page.tsx',
  'app/app/accounting/journal-entries/[id]/page.tsx',
  'app/app/accounting/chart-of-accounts/page.tsx',
  'app/app/accounting/chart-of-accounts/[id]/page.tsx',
  'app/app/accounting/fiscal-periods/page.tsx',
  'app/app/accounting/reports/ap-aging/page.tsx',
  'app/app/accounting/reports/ar-aging/page.tsx',
  'app/app/accounting/reports/balance-sheet/page.tsx',
  'app/app/accounting/reports/general-ledger/page.tsx',
  'app/app/accounting/reports/profit-loss/page.tsx',
  'app/app/accounting/reports/trial-balance/page.tsx',
  'app/app/pos/page.tsx',
  'app/app/pos/sessions/page.tsx',
  'app/app/pos/sessions/[id]/page.tsx',
  'app/app/pos/shifts/page.tsx',
  'app/app/pos/members/page.tsx',
  'app/app/ap/payments/page.tsx',
  'app/app/ap/payments/[id]/page.tsx',
  'app/app/ap/aging/page.tsx'
];

filesToProcess.forEach(file => {
  const fullPath = path.resolve('C:/Users/AKRA-Panich-Front/OneDrive/Desktop/projectERP', file);
  if (!fs.existsSync(fullPath)) {
    console.log('Skipping ' + file);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let originalContent = content;

  // 1. Add import
  if (!content.includes('DirectionalTransition')) {
    content = content.replace(/(import Link from 'next\/link';)/, "$1\nimport { DirectionalTransition } from '@/components/ui/directional-transition';");
  }

  // 2. Wrap return
  if (content.includes('return (') && !content.includes('<DirectionalTransition>')) {
    content = content.replace(/return \(\s*(<div[^>]*>)/, "return (\n    <DirectionalTransition>\n    $1");
    content = content.replace(/<\/div>\s*\);\s*}/, "</div>\n    </DirectionalTransition>\n  );\n}");
  }

  // 3. Forward Link (List views to details)
  if (!file.includes('[id]')) {
    content = content.replace(/<Link href=\{`(.*?)\`\}>/g, "<Link href={`$1`} transitionTypes={['nav-forward']}>");
  }

  // 4. Back Link (Detail views)
  if (file.includes('[id]')) {
    content = content.replace(/<Link href="(.*?)" className="text-stone-400 hover:text-stone-600">←<\/Link>/g, "<Link href=\"$1\" className=\"text-stone-400 hover:text-stone-600\" transitionTypes={['nav-back']}>←</Link>");
  }

  if (content !== originalContent) {
    fs.writeFileSync(fullPath, content);
    console.log('Updated ' + file);
  }
});
