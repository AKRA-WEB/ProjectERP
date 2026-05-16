---
date: {{date:YYYY-MM-DD}}
week: {{date:YYYY-[W]WW}}
type: weekly
---

# Weekly Review — {{date:YYYY-[W]WW}}

## Tracks Completed This Week

```dataview
TABLE status, module, updated
FROM "conductor/tracks"
WHERE file.name = "plan"
AND (status = "Completed" OR status = "Verified")
AND updated >= date(this.date) - dur(7 days)
SORT updated DESC
```

## Still Active / Rework

```dataview
TABLE status, owner, module
FROM "conductor/tracks"
WHERE file.name = "plan"
AND (status = "Active" OR status = "Rework Required")
```

---

## Done This Week
- 

## Decisions Made
- 

## Bugs / Traps Found
- 

## Next Week Focus
- [ ] 
- [ ] 
- [ ] 

## Blockers
- 
