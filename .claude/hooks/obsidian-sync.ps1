# obsidian-sync.ps1 - Master Obsidian sync hook
# Triggered PostToolUse on Write|Edit
# Dispatches to 4 handlers based on file_path

$stdinData = [Console]::In.ReadToEnd()
if (-not $stdinData) { exit 0 }
try { $toolInput = $stdinData | ConvertFrom-Json } catch { exit 0 }

$filePath = $toolInput.file_path
if (-not $filePath) { exit 0 }

# FIXED: use actual project root (was wrong OneDrive path before)
$root = "C:\dev\projectERP"
$today = Get-Date -Format 'yyyy-MM-dd'

# Helper: write UTF-8 without BOM to avoid encoding mismatch with Claude edits
function Write-Utf8NoBom {
    param([string]$Path, [string]$Content)
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

# Handler 1: decisions.md -> _notes/decisions/<track>.md
function Sync-Decisions {
    param($fp)
    if ($fp -notmatch '[/\\]conductor[/\\]tracks[/\\]([^/\\]+)[/\\]decisions\.md') { return }
    $track = $matches[1]
    $dir = "$root\_notes\decisions"
    $out = "$dir\$track.md"
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
    if (Test-Path $out) { return }
    $content = "---`ndate: $today`ntype: decision`ntrack: $track`nmodule:`nstatus: open`n---`n`n# Decisions - $track`n"
    Write-Utf8NoBom -Path $out -Content $content
}

# Handler 2: conductor/index.md edit -> sync plan.md frontmatter status
# FIXED: Guard against race condition - skip plan.md if modified within 10s (Claude mid-edit)
function Sync-PlanStatus {
    param($fp)
    if ($fp -notmatch '[/\\]conductor[/\\]index\.md') { return }
    $indexPath = "$root\conductor\index.md"
    if (-not (Test-Path $indexPath)) { return }
    $lines = Get-Content $indexPath

    foreach ($line in $lines) {
        $track = $null
        $status = $null

        if ($line -match '\./tracks/([^/]+)/plan\.md[^|]*\|\s*(Active|Completed|Verified|Rework Required|Planned)') {
            $track = $matches[1]
            $status = $matches[2].Trim()
        }
        elseif ($line -match '^\|\s*([a-z][a-z0-9-]+)\s*\|\s*(Active|Completed|Verified|Rework Required|Planned)') {
            $track = $matches[1].Trim()
            $status = $matches[2].Trim()
        }

        if (-not $track -or -not $status) { continue }

        $planPath = "$root\conductor\tracks\$track\plan.md"
        if (-not (Test-Path $planPath)) { continue }

        # FIXED: Skip if plan.md was touched within the last 10 seconds
        # Prevents overwriting a file Claude is still editing
        $lastWrite = (Get-Item $planPath).LastWriteTime
        $ageSeconds = ((Get-Date) - $lastWrite).TotalSeconds
        if ($ageSeconds -lt 10) { continue }

        $content = Get-Content $planPath -Raw
        if ($content -match '(?s)^---') {
            $newContent = $content -replace '(status:\s*)([^\r\n]+)', "status: $status"
            if ($newContent -ne $content) {
                Write-Utf8NoBom -Path $planPath -Content $newContent
            }
        }
    }
}

# Handler 3: new plan.md without frontmatter -> inject it
function Ensure-PlanFrontmatter {
    param($fp)
    if ($fp -notmatch '[/\\]conductor[/\\]tracks[/\\]([^/\\]+)[/\\]plan\.md') { return }
    $track = $matches[1]
    $content = Get-Content $fp -Raw -ErrorAction SilentlyContinue
    if (-not $content) { return }
    if ($content -match '^---') { return }
    $frontmatter = "---`ntrack: $track`nstatus: Active`nowner: puka, paku`nmodule: Core`nupdated: $today`n---`n`n"
    Write-Utf8NoBom -Path $fp -Content ($frontmatter + $content)
}

# Handler 4: skill file update -> changelog entry (no emoji in PS strings)
function Sync-SkillUpdate {
    param($fp, $newContent)
    if ($fp -notmatch '[/\\]docs[/\\]skills[/\\]([^/\\]+)\.md') { return }
    if (-not $newContent) { return }

    $skillName = $matches[1]
    $changelogPath = "$root\_notes\skill-changelog.md"
    $geminiPath = "$root\GEMINI.md"

    # Find new traps (match ASCII header pattern)
    $trapMatches = [regex]::Matches($newContent, '##\s+[xX!]\s+Trap\s+[-]+\s+([^\r\n]+)')
    foreach ($m in $trapMatches) {
        $name = $m.Groups[1].Value.Trim()
        $entry = "| $today | TRAP | $name | $skillName |"
        Add-Content -Path $changelogPath -Value $entry -Encoding UTF8

        $allSkills = Get-ChildItem "$root\docs\skills\*.md" -ErrorAction SilentlyContinue | Get-Content -Raw
        if ($allSkills) {
            $count = ([regex]::Matches(($allSkills -join "`n"), [regex]::Escape($name))).Count
            if ($count -gt 1) {
                Add-Content -Path $changelogPath -Value "| $today | DUPLICATE | $name | appears $count times |" -Encoding UTF8
            }
        }

        # Auto-sync to GEMINI.md (cap at 8 traps)
        $gemini = Get-Content $geminiPath -Raw -ErrorAction SilentlyContinue
        if ($gemini -and $gemini -notmatch [regex]::Escape($name)) {
            $insert = "`n**$name** - see docs/skills/$skillName"
            $gemini = $gemini -replace '(## Critical Build Traps[^\r\n]*\r?\n)', "`$1$insert`n"

            $trapPattern = '\*\*[^\*]+\*\* - see docs/skills/[^\r\n]+'
            $trapLines = [regex]::Matches($gemini, $trapPattern) | ForEach-Object { $_.Value }
            if ($trapLines.Count -gt 8) {
                $oldest = $trapLines[-1]
                $gemini = $gemini -replace ("`n" + [regex]::Escape($oldest)), ''
                Add-Content -Path $changelogPath -Value "| $today | EVICTED | $oldest | cap=8 |" -Encoding UTF8
            }

            Write-Utf8NoBom -Path $geminiPath -Content $gemini
        }
    }

    # Find new patterns
    $patternMatches = [regex]::Matches($newContent, '##\s+[+oO]\s+Pattern\s+[-]+\s+([^\r\n]+)')
    foreach ($m in $patternMatches) {
        $name = $m.Groups[1].Value.Trim()
        Add-Content -Path $changelogPath -Value "| $today | PATTERN | $name | $skillName |" -Encoding UTF8
    }

    # Size check
    $lineCount = (Get-Content "$root\docs\skills\$skillName.md" -ErrorAction SilentlyContinue).Count
    if ($lineCount -gt 200) {
        Add-Content -Path $changelogPath -Value "| $today | PRUNE | $skillName.md | $lineCount lines - consolidate |" -Encoding UTF8
    }
}

# Dispatch
Sync-Decisions         $filePath
Sync-PlanStatus        $filePath
Ensure-PlanFrontmatter $filePath

$newContent = if ($toolInput.new_string) { $toolInput.new_string } else { $toolInput.content }
Sync-SkillUpdate $filePath $newContent
