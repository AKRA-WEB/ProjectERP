# obsidian-sync.ps1 — Master Obsidian sync hook
# Triggered PostToolUse on Write|Edit
# Dispatches to 4 handlers based on file_path

$stdinData = [Console]::In.ReadToEnd()
if (-not $stdinData) { exit 0 }
try { $toolInput = $stdinData | ConvertFrom-Json } catch { exit 0 }

$filePath = $toolInput.file_path
if (-not $filePath) { exit 0 }

$root = "C:\Users\AKRA-Panich-Front\OneDrive\Desktop\projectERP"
$today = Get-Date -Format 'yyyy-MM-dd'

# ── Handler 1: decisions.md → _notes/decisions/<track>.md ──────────────────
function Sync-Decisions {
    param($fp)
    if ($fp -notmatch '[/\\]conductor[/\\]tracks[/\\]([^/\\]+)[/\\]decisions\.md') { return }
    $track = $matches[1]
    $dir = "$root\_notes\decisions"
    $out = "$dir\$track.md"
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
    if (Test-Path $out) { return }  # never overwrite human edits
    @"
---
date: $today
type: decision
track: $track
module:
status: open
---

# Decisions — $track

> Source: [[conductor/tracks/$track/decisions]]

## Summary

_Key architectural decisions for this track._
"@ | Set-Content -Path $out -Encoding UTF8
}

# ── Handler 2: conductor/index.md edit → sync plan.md frontmatter status ───
function Sync-PlanStatus {
    param($fp)
    if ($fp -notmatch '[/\\]conductor[/\\]index\.md') { return }
    $indexPath = "$root\conductor\index.md"
    if (-not (Test-Path $indexPath)) { return }
    $lines = Get-Content $indexPath

    foreach ($line in $lines) {
        # Format: | [Name](./tracks/<folder>/plan.md) | Status | ... |
        if ($line -match '\./tracks/([^/]+)/plan\.md[^|]*\|\s*(Active|Completed|Verified|Rework Required|Planned)') {
            $track = $matches[1]
            $status = $matches[2].Trim()
            $planPath = "$root\conductor\tracks\$track\plan.md"
            if (-not (Test-Path $planPath)) { continue }
            $content = Get-Content $planPath -Raw
            # Only update if frontmatter exists and status differs
            if ($content -match '(?s)^---') {
                $newContent = $content -replace '(status:\s*)([^\r\n]+)', "status: $status"
                if ($newContent -ne $content) {
                    Set-Content -Path $planPath -Value $newContent -Encoding UTF8 -NoNewline
                }
            }
        }
        # Format: | track-folder | Status | ... | (Chen short format)
        elseif ($line -match '^\|\s*([a-z][a-z0-9-]+)\s*\|\s*(Active|Completed|Verified|Rework Required|Planned)') {
            $track = $matches[1].Trim()
            $status = $matches[2].Trim()
            $planPath = "$root\conductor\tracks\$track\plan.md"
            if (-not (Test-Path $planPath)) { continue }
            $content = Get-Content $planPath -Raw
            if ($content -match '(?s)^---') {
                $newContent = $content -replace '(status:\s*)([^\r\n]+)', "status: $status"
                if ($newContent -ne $content) {
                    Set-Content -Path $planPath -Value $newContent -Encoding UTF8 -NoNewline
                }
            }
        }
    }
}

# ── Handler 3: new plan.md written without frontmatter → add it ─────────────
function Ensure-PlanFrontmatter {
    param($fp)
    if ($fp -notmatch '[/\\]conductor[/\\]tracks[/\\]([^/\\]+)[/\\]plan\.md') { return }
    $track = $matches[1]
    $content = Get-Content $fp -Raw -ErrorAction SilentlyContinue
    if (-not $content) { return }
    if ($content -match '^---') { return }  # already has frontmatter

    $frontmatter = @"
---
track: $track
status: Active
owner: puka, paku
module: Core
updated: $today
---

"@
    Set-Content -Path $fp -Value ($frontmatter + $content) -Encoding UTF8 -NoNewline
}

# ── Handler 4: skill file append → changelog + GEMINI.md auto-sync ──────────
function Sync-SkillUpdate {
    param($fp, $newContent)
    if ($fp -notmatch '[/\\]docs[/\\]skills[/\\]([^/\\]+)\.md') { return }
    if (-not $newContent) { return }

    $skillName = $matches[1]
    $changelogPath = "$root\_notes\skill-changelog.md"
    $geminiPath = "$root\GEMINI.md"

    # Find new traps
    $trapMatches = [regex]::Matches($newContent, '## ❌ Trap — ([^\r\n]+)')
    foreach ($m in $trapMatches) {
        $name = $m.Groups[1].Value.Trim()
        # Log to changelog
        $entry = "| $today | ❌ Trap | $name | $skillName |"
        Add-Content -Path $changelogPath -Value $entry -Encoding UTF8

        # Check duplicate — same trap name appearing more than once across all skill files
        $allSkills = Get-ChildItem "$root\docs\skills\*.md" | Get-Content -Raw
        $count = ([regex]::Matches(($allSkills -join "`n"), [regex]::Escape("Trap — $name"))).Count
        if ($count -gt 1) {
            Add-Content -Path $changelogPath -Value "| $today | ⚠️ DUPLICATE | $name | appears $count times — update agent rules |" -Encoding UTF8
        }

        # Auto-sync to GEMINI.md Critical Build Traps — cap at 8 traps (rolling window)
        $gemini = Get-Content $geminiPath -Raw -ErrorAction SilentlyContinue
        if ($gemini -and $gemini -notmatch [regex]::Escape($name)) {
            # Add new trap at top of Critical Build Traps section
            $insert = "`n**❌ $name** — see ``docs/skills/$skillName``"
            $gemini = $gemini -replace '(## Critical Build Traps[^\r\n]*\r?\n)', "`$1$insert`n"

            # Enforce cap: keep only latest 8 trap lines
            $trapPattern = '\*\*❌ [^\*]+\*\* — see `[^`]+`'
            $trapLines = [regex]::Matches($gemini, $trapPattern) | ForEach-Object { $_.Value }
            if ($trapLines.Count -gt 8) {
                # Remove oldest (last) trap entry
                $oldest = $trapLines[-1]
                $gemini = $gemini -replace ("`n" + [regex]::Escape($oldest)), ''
                Add-Content -Path $changelogPath -Value "| $today | 🗑️ EVICTED | $oldest | GEMINI.md cap=8 reached |" -Encoding UTF8
            }

            Set-Content -Path $geminiPath -Value $gemini -Encoding UTF8 -NoNewline
        }
    }

    # Find new patterns
    $patternMatches = [regex]::Matches($newContent, '## ✅ Pattern — ([^\r\n]+)')
    foreach ($m in $patternMatches) {
        $name = $m.Groups[1].Value.Trim()
        $entry = "| $today | ✅ Pattern | $name | $skillName |"
        Add-Content -Path $changelogPath -Value $entry -Encoding UTF8
    }

    # Size check — warn when skill file exceeds 200 lines
    $lineCount = (Get-Content "$root\docs\skills\$skillName.md" -ErrorAction SilentlyContinue).Count
    if ($lineCount -gt 200) {
        $warn = "| $today | ⚠️ PRUNE | $skillName.md | $lineCount lines — consolidate old traps |"
        Add-Content -Path $changelogPath -Value $warn -Encoding UTF8
    }
}

# ── Dispatch ────────────────────────────────────────────────────────────────
Sync-Decisions    $filePath
Sync-PlanStatus   $filePath
Ensure-PlanFrontmatter $filePath

# Handler 4 needs new_string (Edit) or content (Write)
$newContent = if ($toolInput.new_string) { $toolInput.new_string } else { $toolInput.content }
Sync-SkillUpdate $filePath $newContent
