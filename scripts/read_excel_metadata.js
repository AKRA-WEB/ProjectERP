const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const importsDir = path.resolve(__dirname, '../data/imports');

function analyzeFile(fileName) {
  const filePath = path.join(importsDir, fileName);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${fileName}`);
    return;
  }
  const wb = XLSX.readFile(filePath);
  console.log(`=========================================`);
  console.log(`File: ${fileName}`);
  console.log(`Sheets: ${wb.SheetNames.join(', ')}`);
  
  wb.SheetNames.forEach(sheetName => {
    const ws = wb.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1 });
    console.log(`Sheet: ${sheetName}`);
    console.log(`Total Rows: ${raw.length}`);
    if (raw.length > 0) {
      console.log(`Header Row:`, raw[0]);
      console.log(`First 3 data rows:`);
      for (let i = 1; i <= Math.min(3, raw.length - 1); i++) {
        console.log(`Row ${i}:`, raw[i]);
      }
    }
  });
}

const files = ['Vendor.xlsx', 'all_product.xlsx', 'export_product_all_17_05_2026.xlsx'];
files.forEach(analyzeFile);
