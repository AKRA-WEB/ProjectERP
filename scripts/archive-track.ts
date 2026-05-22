import fs from 'fs/promises';
import path from 'path';

async function archiveTrack(trackId: string, rootDir: string): Promise<boolean> {
  const activeTrackPath = path.join(rootDir, 'conductor', 'tracks', trackId);
  const archiveTrackPath = path.join(rootDir, 'conductor', 'archive', 'tracks', trackId);
  const indexFilePath = path.join(rootDir, 'conductor', 'index.md');
  const verifiedTracksFilePath = path.join(rootDir, 'conductor', 'archive', 'verified_tracks.md');

  // 1. Read and parse plan.md inside the active track
  const planFilePath = path.join(activeTrackPath, 'plan.md');
  let planContent = '';
  try {
    planContent = await fs.readFile(planFilePath, 'utf8');
  } catch (err) {
    console.error(`⚠️ Warning: plan.md not found in tracks/${trackId}. Moving forward without plan metadata.`);
  }

  // Parse metadata from plan.md
  let title = trackId;
  let createdDate = new Date().toISOString().split('T')[0];
  let updatedDate = createdDate;

  if (planContent) {
    // Try to find first H1 header
    const titleMatch = planContent.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      title = titleMatch[1].trim();
      title = title.replace(/^Track:\s+\w+\s+[—\-]\s+/, '');
    }

    // Try parsing frontmatter
    const frontmatterMatch = planContent.match(/^---\r?\n([\s\S]+?)\r?\n---/);
    if (frontmatterMatch) {
      const yamlLines = frontmatterMatch[1].split('\n');
      for (const line of yamlLines) {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
          const k = key.trim().toLowerCase();
          const v = valueParts.join(':').trim().replace(/['"\[\]]/g, '');
          if (k === 'aliases') {
            title = v;
          } else if (k === 'updated') {
            updatedDate = v;
          }
        }
      }
    }
  }

  const todayStr = new Date().toISOString().split('T')[0];

  console.log(`📦 Archiving track "${trackId}" (${title})...`);

  // 2. Create destination directory and move files
  await fs.mkdir(path.dirname(archiveTrackPath), { recursive: true });
  
  // Clean target directory if it exists
  try {
    await fs.rm(archiveTrackPath, { recursive: true, force: true });
  } catch {}

  await fs.rename(activeTrackPath, archiveTrackPath);
  console.log(`🟢 Physically moved track folder to conductor/archive/tracks/${trackId}`);

  // 3. Update index.md
  try {
    let indexContent = await fs.readFile(indexFilePath, 'utf8');

    // Remove row from Active Now table
    const activeNowRegex = new RegExp(`^\\|\\s*${trackId}\\s*\\|[\\s\\S]*?\\r?\\n`, 'mi');
    indexContent = indexContent.replace(activeNowRegex, '');

    // Remove row from Rework Required table
    const reworkRegex = new RegExp(`^\\|\\s*${trackId}\\s*\\|[\\s\\S]*?\\r?\\n`, 'mi');
    indexContent = indexContent.replace(reworkRegex, '');

    // Update status, last updated, and links in All Tracks table
    const allTracksRowRegex = new RegExp(`(\\|\\s*\\[([^\\]]+)\\]\\(\\.\\/tracks\\/${trackId}\\/plan\\.md\\)\\s*\\|\\s*)([^|]+)(\\s*\\|\\s*([^|]+)\\s*\\|\\s*)([^|]+)(\\s*\\|)`, 'i');
    
    if (allTracksRowRegex.test(indexContent)) {
      indexContent = indexContent.replace(allTracksRowRegex, (match, prefix, linkText, statusCol, middlePart, createdCol, lastUpdatedCol, suffix) => {
        const newPrefix = `| [${linkText}](./archive/tracks/${trackId}/plan.md) | `;
        return `${newPrefix}Verified${middlePart}${todayStr} |`;
      });
      console.log(`🟢 Updated track details and archive link in All Tracks table of index.md`);
    } else {
      const allTracksTableMarker = '|-------|--------|---------|--------------|';
      const newRow = `| [${title}](./archive/tracks/${trackId}/plan.md) | Verified | ${updatedDate} | ${todayStr} |\n`;
      
      const insertIndex = indexContent.indexOf(allTracksTableMarker);
      if (insertIndex !== -1) {
        const insertPosition = insertIndex + allTracksTableMarker.length + 1;
        indexContent = indexContent.slice(0, insertPosition) + newRow + indexContent.slice(insertPosition);
        console.log(`🟢 Appended new row for "${trackId}" in All Tracks table of index.md`);
      } else {
        console.warn(`⚠️ Warning: Could not find All Tracks table in index.md to append the new row.`);
      }
    }

    await fs.writeFile(indexFilePath, indexContent, 'utf8');
  } catch (err) {
    console.error('❌ Error updating index.md:', err);
  }

  // 4. Update verified_tracks.md
  try {
    let verifiedContent = await fs.readFile(verifiedTracksFilePath, 'utf8');
    
    const recordExists = new RegExp(`\\.\\/tracks\\/${trackId}\\/plan\\.md`, 'i').test(verifiedContent);
    if (!recordExists) {
      const cleanTitle = title.replace(/[|]/g, '\\|');
      const newRecordRow = `| [${trackId} — ${cleanTitle}](./tracks/${trackId}/plan.md) | Verified | ${updatedDate} | ${todayStr} |\n`;
      verifiedContent = verifiedContent.trimEnd() + '\n' + newRecordRow;
      await fs.writeFile(verifiedTracksFilePath, verifiedContent, 'utf8');
      console.log(`🟢 Added archive record to verified_tracks.md`);
    } else {
      console.log(`ℹ️ Record for "${trackId}" already exists in verified_tracks.md`);
    }
  } catch (err) {
    console.error('❌ Error updating verified_tracks.md:', err);
  }

  console.log(`🎉 Track "${trackId}" archived successfully!`);
  return true;
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('❌ Error: Please specify a track ID or run with --sweep. Example: npx tsx scripts/archive-track.ts --sweep');
    process.exit(1);
  }

  const rootDir = process.cwd();

  if (arg === '--sweep' || arg === '--all') {
    console.log('🔍 Running automated archiving sweep...');
    const tracksDir = path.join(rootDir, 'conductor', 'tracks');
    
    let subdirs: string[] = [];
    try {
      subdirs = await fs.readdir(tracksDir);
    } catch {
      console.log('ℹ️ No active tracks directory found. Nothing to sweep.');
      return;
    }

    let archivedCount = 0;

    for (const subdir of subdirs) {
      const planFilePath = path.join(tracksDir, subdir, 'plan.md');
      try {
        const planContent = await fs.readFile(planFilePath, 'utf8');
        // Check if plan is marked Verified
        const isVerified = /status:\s*Verified/i.test(planContent);
        if (isVerified) {
          console.log(`✨ Found verified track "${subdir}" in active tracks.`);
          await archiveTrack(subdir, rootDir);
          archivedCount++;
        }
      } catch {}
    }

    if (archivedCount === 0) {
      console.log('✅ Sweep complete. No verified tracks found to archive.');
    } else {
      console.log(`✅ Sweep complete. Archived ${archivedCount} tracks.`);
    }
  } else {
    await archiveTrack(arg, rootDir);
  }
}

main().catch((err) => {
  console.error('💥 Uncaught error:', err);
  process.exit(1);
});
