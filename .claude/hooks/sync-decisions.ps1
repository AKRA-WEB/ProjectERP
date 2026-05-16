# sync-decisions.ps1
# PostToolUse hook: when decisions.md written in conductor/tracks/<track>/
# auto-creates _notes/decisions/<track>.md for Obsidian Dataview

$stdinData = [Console]::In.ReadToEnd()
if (-not $stdinData) { exit 0 }

try {
    $toolInput = $stdinData | ConvertFrom-Json
} catch { exit 0 }

$filePath = $toolInput.file_path
if (-not $filePath) { exit 0 }

# Match conductor/tracks/<track>/decisions.md
if ($filePath -notmatch '[/\\]conductor[/\\]tracks[/\\]([^/\\]+)[/\\]decisions\.md') { exit 0 }

$track = $matches[1]
$date = Get-Date -Format 'yyyy-MM-dd'
$root = "C:\Users\AKRA-Panich-Front\OneDrive\Desktop\projectERP"
$obsidianDir = "$root\_notes\decisions"
$obsidianPath = "$obsidianDir\$track.md"

# Create _notes/decisions/ if missing
if (-not (Test-Path $obsidianDir)) {
    New-Item -ItemType Directory -Force $obsidianDir | Out-Null
}

# Only create if not exists (don't overwrite human edits)
if (-not (Test-Path $obsidianPath)) {
    $content = @"
---
date: $date
type: decision
track: $track
module:
status: open
---

# Decisions — $track

> Source: [[conductor/tracks/$track/decisions]]

## Summary

_Add summary of key decisions for this track._

## Decision Log

_Decisions are captured in the source file above. Key ones are summarized here._

"@
    Set-Content -Path $obsidianPath -Value $content -Encoding UTF8
}
