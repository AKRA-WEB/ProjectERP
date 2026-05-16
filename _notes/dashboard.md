---
title: BUYMORE ERP — Project Dashboard
---

# BUYMORE ERP — Project Dashboard

## Active / Rework Required

```dataview
TABLE status, owner, module, updated
FROM "conductor/tracks"
WHERE file.name = "plan"
AND (status = "Active" OR status = "Rework Required")
SORT updated DESC
```

## Verified Tracks

```dataview
TABLE owner, module, updated
FROM "conductor/tracks"
WHERE file.name = "plan"
AND status = "Verified"
SORT updated DESC
```

## All Tracks by Module

```dataview
TABLE status, owner, updated
FROM "conductor/tracks"
WHERE file.name = "plan"
SORT module ASC, updated DESC
```

## Track Count by Status

```dataview
TABLE rows.file.name AS tracks, length(rows) AS count
FROM "conductor/tracks"
WHERE file.name = "plan"
GROUP BY status
SORT count DESC
```
