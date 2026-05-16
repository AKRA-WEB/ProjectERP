const fs = require('fs');

const importFiles = [
  'app/app/accounting/reports/ap-aging/page.tsx',
  'app/app/accounting/reports/ar-aging/page.tsx',
  'app/app/accounting/reports/balance-sheet/page.tsx',
  'app/app/accounting/reports/general-ledger/page.tsx',
  'app/app/accounting/reports/profit-loss/page.tsx',
  'app/app/accounting/reports/trial-balance/page.tsx',
  'app/app/claims/[id]/page.tsx',
  'app/app/customers/[id]/page.tsx',
  'app/app/hr/employees/[id]/page.tsx',
  'app/app/pos/members/page.tsx',
  'app/app/rma/[id]/page.tsx'
];

for (const f of importFiles) {
  if (fs.existsSync(f)) {
    let text = fs.readFileSync(f, 'utf8');
    if (text.includes('DirectionalTransition') && !text.includes('import { DirectionalTransition')) {
      // Find first import and insert after
      text = text.replace(/import.*?['"];?/, match => match + "\nimport { DirectionalTransition } from '@/components/ui/directional-transition';");
      fs.writeFileSync(f, text);
      console.log('Fixed import in', f);
    }
  }
}

const tagFiles = [
  'app/app/customers/page.tsx',
  'app/app/cycle-counts/page.tsx',
  'app/app/dashboard/page.tsx',
  'app/app/hr/employees/page.tsx',
  'app/app/inbound-orders/page.tsx',
  'app/app/inbound-orders/[id]/page.tsx',
  'app/app/menu/page.tsx',
  'app/app/picking/page.tsx',
  'app/app/picking/[id]/page.tsx',
  'app/app/pos/shifts/page.tsx',
  'app/app/products/page.tsx',
  'app/app/products/[id]/page.tsx',
  'app/app/purchase-orders/page.tsx',
  'app/app/purchase-orders/[id]/page.tsx',
  'app/app/purchase-requests/page.tsx',
  'app/app/shipments/page.tsx',
  'app/app/shipments/[id]/page.tsx',
  'app/app/transfers/page.tsx',
  'app/app/transfers/[id]/page.tsx',
  'app/app/vendors/[id]/page.tsx'
];

for (const f of tagFiles) {
  if (fs.existsSync(f)) {
    let text = fs.readFileSync(f, 'utf8');
    let modified = false;

    if (text.match(/}\s*<\/DirectionalTransition>/)) {
       text = text.replace(/}\s*<\/DirectionalTransition>/g, '}');
       modified = true;
    }

    if (text.match(/<\/DirectionalTransition>\s*<\/DirectionalTransition>/)) {
       text = text.replace(/<\/DirectionalTransition>\s*<\/DirectionalTransition>/g, '</DirectionalTransition>');
       modified = true;
    }

    if (text.includes('</DirectionalTransition>\n  );\n}\n      </div>\n    </div>\n  );\n}')) {
       text = text.replace('</DirectionalTransition>\n  );\n}\n      </div>\n    </div>\n  );\n}', '</DirectionalTransition>\n  );\n}');
       modified = true;
    }

    if (modified) {
      fs.writeFileSync(f, text);
      console.log('Fixed tags in', f);
    }
  }
}
