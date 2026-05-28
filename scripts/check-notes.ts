import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Helper to find all markdown files recursively in a directory
async function getMarkdownFiles(dir: string, fileList: string[] = []): Promise<string[]> {
  try {
    const files = await fs.readdir(dir, { withFileTypes: true });
    for (const file of files) {
      const resPath = path.join(dir, file.name);
      // Skip hidden directories, node_modules, .next, .obsidian, and git
      if (file.isDirectory()) {
        if (
          file.name.startsWith('.') ||
          file.name === 'node_modules' ||
          file.name === '.next' ||
          file.name === '.obsidian' ||
          file.name === 'archive'
        ) {
          continue;
        }
        await getMarkdownFiles(resPath, fileList);
      } else if (file.isFile() && file.name.endsWith('.md')) {
        fileList.push(resPath);
      }
    }
  } catch (err) {
    // Ignore read errors
  }
  return fileList;
}

// Convert file:/// URL or relative path to absolute file path
function resolveLinkPath(link: string, currentFileDir: string, rootDir: string): string | null {
  if (link.startsWith('http://') || link.startsWith('https://') || link.startsWith('mailto:') || link.startsWith('#')) {
    return null; // Skip external links and page anchors
  }

  // Handle absolute file:/// links
  if (link.startsWith('file:///')) {
    let cleanLink = link.substring(8); // Remove file:///
    // On Windows, the path might start with C:/dev/... or /C:/dev/...
    if (cleanLink.startsWith('/')) {
      cleanLink = cleanLink.substring(1);
    }
    // Convert slashes and decode URI components (e.g., %20)
    try {
      const decoded = decodeURIComponent(cleanLink).replace(/\//g, path.sep);
      // Strip anchor tags if present in the link (e.g., file.md#L12-30)
      const anchorIndex = decoded.indexOf('#');
      return anchorIndex !== -1 ? decoded.substring(0, anchorIndex) : decoded;
    } catch {
      return null;
    }
  }

  // Handle relative links
  try {
    const decoded = decodeURIComponent(link).replace(/\//g, path.sep);
    const anchorIndex = decoded.indexOf('#');
    const cleanLink = anchorIndex !== -1 ? decoded.substring(0, anchorIndex) : decoded;
    return path.resolve(currentFileDir, cleanLink);
  } catch {
    return null;
  }
}

async function verifyApiRoutes(rootDir: string): Promise<boolean> {
  console.log('\n🔍 Checking API routes vs documentation...');
  const apiDir = path.join(rootDir, 'app', 'api');
  const currentStatePath = path.join(rootDir, '_notes', '02_Agent_Memory', 'current-state.md');
  const modulesDir = path.join(rootDir, '_notes', '00_Project_Map', 'modules');

  // 1. Get all actual API routes from filesystem
  const actualRoutes: string[] = [];
  async function scanApiDir(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const resPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await scanApiDir(resPath);
      } else if (entry.name === 'route.ts' || entry.name === 'route.js') {
        const relativePath = path.relative(apiDir, dir).replace(/\\/g, '/');
        actualRoutes.push(relativePath);
      }
    }
  }

  try {
    if (existsSync(apiDir)) {
      await scanApiDir(apiDir);
    }
  } catch (err) {
    console.error('❌ Error scanning API directory:', err);
    return false;
  }

  // 2. Read current-state.md and all module files
  let allDocContent = '';
  try {
    if (existsSync(currentStatePath)) {
      allDocContent += await fs.readFile(currentStatePath, 'utf8');
    }
    if (existsSync(modulesDir)) {
      const moduleFiles = await fs.readdir(modulesDir);
      for (const file of moduleFiles) {
        if (file.endsWith('.md')) {
          allDocContent += await fs.readFile(path.join(modulesDir, file), 'utf8');
        }
      }
    }
  } catch (err) {
    console.error('❌ Error reading documentation files:', err);
    return false;
  }

  // 3. Check if each actual route is mentioned in any doc
  let missingDocsCount = 0;
  // Create a version of docs with all non-alphanumeric chars replaced with spaces for token search
  const docTokens = allDocContent.toLowerCase().replace(/[^a-z0-9]/g, ' ');
  const docLines = allDocContent.toLowerCase().split('\n');

  for (const route of actualRoutes) {
    const routeLower = route.toLowerCase();
    const routeParts = routeLower.split('/');
    
    // 1. Precise match (e.g. "api/grn/[id]")
    // 2. Placeholder match (e.g. "api/grn/:id")
    const placeholderRoute = routeLower.replace(/\[([^\]]+)\]/g, ':$1');

    let found = false;
    if (allDocContent.toLowerCase().includes(routeLower) || 
        allDocContent.toLowerCase().includes(placeholderRoute)) {
      found = true;
    } else {
      // Check if all parts of the route are at least present in the doc tokens
      // (This helps find cases where routes are documented in tables or lists)
      const allPartsPresent = routeParts.every(part => {
        if (part.startsWith('[') && part.endsWith(']')) return true; // skip dynamic parts
        if (part.length < 3) return true; // skip short segments like "id"
        return docTokens.includes(part);
      });

      if (allPartsPresent) {
        // Double check with a line-by-line partial match
        for (const line of docLines) {
          if (routeParts.every(part => {
            const cleanPart = part.replace(/\[|\]/g, '');
            return cleanPart.length < 2 || line.includes(cleanPart);
          })) {
            found = true;
            break;
          }
        }
      }
    }

    if (!found) {
      console.warn(`⚠️ Warning: API route "/api/${route}" might be undocumented.`);
      missingDocsCount++;
    }
  }

  if (missingDocsCount > 0) {
    console.log(`💡 Suggestion: Document the ${missingDocsCount} API route(s) above in current-state.md or a module file.`);
  }

  return true; 
}

async function verifyMigrations(rootDir: string): Promise<boolean> {
  console.log('🔍 Checking database migrations vs current-state.md...');
  const migrationsDir = path.join(rootDir, 'migrations');
  const currentStatePath = path.join(rootDir, '_notes', '02_Agent_Memory', 'current-state.md');

  // 1. Find the highest migration number from the migrations directory
  let migrationFiles: string[] = [];
  try {
    migrationFiles = await fs.readdir(migrationsDir);
  } catch (err) {
    console.error('❌ Error reading migrations directory:', err);
    return false;
  }

  const sqlFiles = migrationFiles.filter(f => f.endsWith('.sql'));
  let maxMigrationNum = 0;
  let maxMigrationFile = '';

  for (const file of sqlFiles) {
    const match = file.match(/^(\d+)_/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxMigrationNum) {
        maxMigrationNum = num;
        maxMigrationFile = file;
      }
    }
  }

  const formattedMaxNum = String(maxMigrationNum).padStart(3, '0');
  console.log(`📦 Max Migration file found: ${maxMigrationFile} (Number: ${formattedMaxNum})`);

  // 2. Read current-state.md and extract its migration number
  let currentStateContent = '';
  try {
    currentStateContent = await fs.readFile(currentStatePath, 'utf8');
  } catch (err) {
    console.error('❌ Error reading current-state.md:', err);
    return false;
  }

  // Extract from: "Migration Numbers (latest: 072)"
  const latestMatch = currentStateContent.match(/latest:\s*(\d+)/i);
  let latestNumFromState = '';
  if (latestMatch) {
    latestNumFromState = latestMatch[1].padStart(3, '0');
  }

  // Extract from: "Latest: 072_grn_reversal.sql"
  const fileMatch = currentStateContent.match(/Latest:\s*`?(\d+)_/i);
  let fileNumFromState = '';
  if (fileMatch) {
    fileNumFromState = fileMatch[1].padStart(3, '0');
  }

  console.log(`📝 Memory check: latest state number = "${latestNumFromState}", file state number = "${fileNumFromState}"`);

  if (!latestNumFromState || !fileNumFromState) {
    console.error('❌ Error: Could not parse migration numbers from current-state.md!');
    return false;
  }

  if (latestNumFromState !== formattedMaxNum || fileNumFromState !== formattedMaxNum) {
    console.error('\n🚨 MIGRATION SYNC ERROR 🚨');
    console.error(`- Migrations dir has: #${formattedMaxNum} (${maxMigrationFile})`);
    console.error(`- current-state.md lists 'latest: ${latestNumFromState}' and 'Latest: ${fileNumFromState}_*'`);
    console.error('👉 Please update current-state.md to match the latest migration version.\n');
    return false;
  }

  console.log('✅ Migration numbers are in perfect sync!');
  return true;
}

// Strip markdown code blocks so we don't scan code examples or template strings
function stripCodeBlocks(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, '') // Remove multi-line code blocks
    .replace(/`[^`\r\n]+`/g, '');    // Remove inline code spans
}

async function verifyMarkdownLinks(rootDir: string, autoFix: boolean): Promise<boolean> {
  console.log('\n🔍 Scanning Markdown files for broken links...');
  const searchDirs = [
    path.join(rootDir, '_notes'),
    path.join(rootDir, 'conductor'),
    path.join(rootDir, 'docs')
  ];

  let mdFiles: string[] = [];
  for (const dir of searchDirs) {
    await getMarkdownFiles(dir, mdFiles);
  }

  console.log(`📄 Found ${mdFiles.length} markdown files to scan.`);

  let brokenLinksCount = 0;
  let fixedLinksCount = 0;

  for (const file of mdFiles) {
    let fileContent = await fs.readFile(file, 'utf8');
    const relativeFilePath = path.relative(rootDir, file);
    const fileDir = path.dirname(file);

    // Strip code blocks to avoid false positives on templates
    const cleanContent = stripCodeBlocks(fileContent);

    // Markdown link regex: [text](url)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    let fileModified = false;
    let newFileContent = fileContent;

    while ((match = linkRegex.exec(cleanContent)) !== null) {
      const linkText = match[1];
      const linkUrl = match[2].trim();

      const resolvedPath = resolveLinkPath(linkUrl, fileDir, rootDir);
      if (resolvedPath) {
        if (!existsSync(resolvedPath)) {
          // If the link is in conductor/index.md and points to tracks/..., check if it was archived
          let isFixed = false;
          if (autoFix && (relativeFilePath === 'conductor\\index.md' || relativeFilePath === 'conductor/index.md') && linkUrl.startsWith('tracks/')) {
            const archivedRelativeLink = linkUrl.replace('tracks/', 'archive/tracks/');
            const archivedResolvedPath = resolveLinkPath(archivedRelativeLink, fileDir, rootDir);
            
            if (archivedResolvedPath && existsSync(archivedResolvedPath)) {
              // Replace occurrences in the original content
              const targetStr = `](${linkUrl})`;
              const replacementStr = `](${archivedRelativeLink})`;
              if (newFileContent.includes(targetStr)) {
                newFileContent = newFileContent.replace(targetStr, replacementStr);
                fileModified = true;
                fixedLinksCount++;
                isFixed = true;
                console.log(`✨ Automatically fixed broken link in [conductor/index.md]: "${linkUrl}" ➔ "${archivedRelativeLink}"`);
              }
            }
          }

          if (!isFixed) {
            console.error(`❌ Broken link in [${relativeFilePath}]: "${linkText}" -> "${linkUrl}"`);
            console.error(`   Expected path: ${resolvedPath}`);
            brokenLinksCount++;
          }
        }
      }
    }

    if (fileModified) {
      await fs.writeFile(file, newFileContent, 'utf8');
    }
  }

  if (fixedLinksCount > 0) {
    console.log(`\n💚 Successfully fixed ${fixedLinksCount} broken link(s) in conductor/index.md!`);
  }

  if (brokenLinksCount > 0) {
    console.error(`\n🚨 Broken Links Found: ${brokenLinksCount} 🚨`);
    console.error('👉 Please check and correct the broken link paths listed above.\n');
    return false;
  }

  console.log('✅ All markdown links are valid!');
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const autoFix = args.includes('--fix');
  const rootDir = process.cwd();

  console.log('✨ Starting Obsidian Vault & Workspace Consistency Check ✨');
  if (autoFix) {
    console.log('🔧 Auto-fix mode is ENABLED.');
  }

  const migrationsOk = await verifyMigrations(rootDir);
  const apiOk = await verifyApiRoutes(rootDir);
  const linksOk = await verifyMarkdownLinks(rootDir, autoFix);

  if (!migrationsOk || !apiOk || !linksOk) {
    console.error('💥 Verification FAILED. Please correct errors listed above.');
    process.exit(1);
  }

  console.log('\n🎉 Perfect consistency! All Obsidian notes and database states are aligned.');
  process.exit(0);
}

main().catch((err) => {
  console.error('💥 Uncaught error in verification script:', err);
  process.exit(1);
});
