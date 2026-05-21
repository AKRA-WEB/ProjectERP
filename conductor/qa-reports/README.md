# QA Reports

Billy writes one file per track after each audit.

## Convention

```
conductor/qa-reports/<track-name>.md
```

## Status values (frontmatter)

| status | Meaning |
|--------|---------|
| `draft` | Billy finished — awaiting validator |
| `validated` | Chen or another AI confirmed findings |
| `rework-planned` | rework-plan.md written |
| `closed` | rework done, track archived |

## Reviewing a report (non-Chen AI)

1. Read `conductor/qa-reports/<track>.md`
2. Read `conductor/tracks/<track>/plan.md` to verify Billy's evidence
3. For each finding: confirm file:line exists and matches quoted code
4. Reclassify Must Fix / Should Fix / Suggestion if needed
5. Update frontmatter `status: validated`, add `validated_by:` field
6. If rework needed, write `conductor/tracks/<track>/rework-plan.md`
