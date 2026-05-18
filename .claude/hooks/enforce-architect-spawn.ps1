# enforce-architect-spawn.ps1
# UserPromptSubmit hook — fires before Claude responds to any user message.
# If prompt starts with "Architect:", injects mandatory Chen spawn reminder.

$stdinData = [Console]::In.ReadToEnd()
if (-not $stdinData) { exit 0 }

try {
    $hookInput = $stdinData | ConvertFrom-Json
} catch {
    exit 0
}

$prompt = $hookInput.prompt
if (-not $prompt) { exit 0 }

if ($prompt -match '(?i)^\s*Architect\s*:') {
    Write-Output @"
⚠️ ARCHITECT TRIGGER DETECTED — MANDATORY ACTION REQUIRED:

YOU MUST call the Agent tool with subagent_type="chen" RIGHT NOW.
Pass the FULL requirement text to Chen as the prompt.

DO NOT:
- Write plan.md yourself
- Analyze the requirement inline
- Ask clarifying questions before spawning Chen
- Output any plan content as chat text

Chen does the analysis. Chen writes the files to disk. You wait for Chen's result.
Failure to spawn Chen = task failure.
"@
}

exit 0
