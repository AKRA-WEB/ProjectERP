---
track: encoding-fix
status: Completed
aliases: ["Thai Text Double-Encoding Fix"]
owner: puka
module: Core
updated: 2026-05-10
---

# Track: Thai Text Double-Encoding Fix

**Status:** Completed  
**Created:** 2026-05-10  
**Priority:** CRITICAL — Thai text is garbled/unreadable in 12 UI files

---

## Root Cause Analysis

Gemini CLI saved 12 `.tsx` files with **UTF-8 BOM** + **double-encoded Thai text**.

The garbling chain:
1. Original Thai char (e.g., ค = U+0E04) → correct UTF-8 bytes: `E0 B8 84`
2. Those bytes were **misread as TIS-620**: `E0`→เ, `B8`→ธ, `84`→(U+0084 control)
3. Those 3 Unicode chars were **re-encoded as UTF-8**: `E0 B9 80 E0 B8 98 C2 84`
4. Written to file → each Thai char is now **3 characters / 9 bytes** instead of 1 char / 3 bytes

**Evidence (hex dump of "คำขอซื้อ" in purchase-requests/page.tsx):**
```
Should be: E0 B8 84  E0 B8 B3  E0 B8 82  E0 B8 AD  E0 B8 8B  E0 B8 B7  E0 B9 89  E0 B8 AD
Actual:    E0 B9 80 E0 B8 98 C2 84  E0 B9 80 E0 B8 98 E0 B8 93  E0 B9 80 E0 B8 98 C2 82  ...
```

**All 12 affected files** (all have UTF-8 BOM, all created by Gemini):
```
app/app/claims/page.tsx
app/app/cycle-counts/page.tsx
app/app/grn/page.tsx
app/app/inbound-orders/page.tsx
app/app/inventory/page.tsx
app/app/inventory/ledger/page.tsx
app/app/products/page.tsx
app/app/purchase-orders/page.tsx
app/app/purchase-requests/page.tsx
app/app/rma/page.tsx
app/app/transfers/page.tsx
app/app/vendors/page.tsx
```

---

## Reversal Algorithm

For each garbled triplet (c1, c2, c3) where c1 = เ (U+0E40):
- c1 → always byte `0xE0` (all Thai UTF-8 sequences start with E0)
- c2 → ธ (U+0E18) → byte `0xB8`; or น (U+0E19) → byte `0xB9`
- c3 → if Thai (U+0E01-U+0E5B): byte = `codepoint - 0x0E00 + 0xA0`
       → if C1 control (U+0080-U+009F): byte = `codepoint` (same)
       → if NBSP (U+00A0): byte = `0xA0`

Reconstruct bytes [0xE0, c2_byte, c3_byte] → decode as UTF-8 → original Thai char.

ASCII and non-garbled characters pass through unchanged.

---

## Tasks

### Task 1 — Run the decoding script on all 12 files

Execute the following PowerShell script from the project root:

```powershell
$files = @(
  'app/app/claims/page.tsx',
  'app/app/cycle-counts/page.tsx',
  'app/app/grn/page.tsx',
  'app/app/inbound-orders/page.tsx',
  'app/app/inventory/page.tsx',
  'app/app/inventory/ledger/page.tsx',
  'app/app/products/page.tsx',
  'app/app/purchase-orders/page.tsx',
  'app/app/purchase-requests/page.tsx',
  'app/app/rma/page.tsx',
  'app/app/transfers/page.tsx',
  'app/app/vendors/page.tsx'
)

function Reverse-DoubleEncoding {
  param([string]$text)

  $result = New-Object System.Text.StringBuilder
  $i = 0
  while ($i -lt $text.Length) {
    $c1 = [int][char]$text[$i]

    # Garbled triplet always starts with เ (U+0E40)
    if ($c1 -eq 0x0E40 -and ($i + 2) -lt $text.Length) {
      $c2 = [int][char]$text[$i + 1]
      $c3 = [int][char]$text[$i + 2]

      # c2 must be ธ (0x0E18) or น (0x0E19)
      if ($c2 -eq 0x0E18 -or $c2 -eq 0x0E19) {
        $b1 = 0xE0
        $b2 = if ($c2 -eq 0x0E18) { 0xB8 } else { 0xB9 }

        # Decode c3 to original byte
        if ($c3 -ge 0x0E01 -and $c3 -le 0x0E5B) {
          $b3 = $c3 - 0x0E00 + 0xA0
        } elseif ($c3 -ge 0x0080 -and $c3 -le 0x009F) {
          $b3 = $c3
        } elseif ($c3 -eq 0x00A0) {
          $b3 = 0xA0
        } else {
          # Not a recognizable pattern — output original chars
          $null = $result.Append([char]$c1)
          $i++
          continue
        }

        $bytes = [byte[]]@($b1, $b2, $b3)
        $decoded = [System.Text.Encoding]::UTF8.GetString($bytes)
        $null = $result.Append($decoded)
        $i += 3
        continue
      }
    }

    # Pass through everything else
    $null = $result.Append([char]$c1)
    $i++
  }
  return $result.ToString()
}

foreach ($file in $files) {
  Write-Host "Processing: $file"
  $rawBytes = [System.IO.File]::ReadAllBytes($file)

  # Strip UTF-8 BOM if present
  $startIdx = 0
  if ($rawBytes.Length -ge 3 -and $rawBytes[0] -eq 0xEF -and $rawBytes[1] -eq 0xBB -and $rawBytes[2] -eq 0xBF) {
    $startIdx = 3
  }

  $bodyBytes = $rawBytes[$startIdx..($rawBytes.Length - 1)]
  $text = [System.Text.Encoding]::UTF8.GetString($bodyBytes)

  $fixed = Reverse-DoubleEncoding -text $text

  # Write back as UTF-8 without BOM
  $outBytes = [System.Text.Encoding]::UTF8.GetBytes($fixed)
  [System.IO.File]::WriteAllBytes($file, $outBytes)
  Write-Host "  Done. Original size: $($rawBytes.Length) bytes, Fixed size: $($outBytes.Length) bytes"
}

Write-Host "All files fixed!"
```

---

### Task 2 — Verify one file manually

After running the script, check `app/app/purchase-requests/page.tsx`:
- Open the file and confirm the Thai text reads: `คำขอซื้อ / Purchase Requests`
- Confirm the file no longer has BOM
- Confirm the file size is smaller (garbled text was ~3x bloated)

---

### Task 3 — Run build to confirm no regressions

```bash
npm run build
```

Build must still pass cleanly (only warnings allowed, no type errors).

---

## Acceptance Criteria

- [x] Root cause identified (double TIS-620 re-encoding by Gemini)
- [ ] All 12 BOM files have Thai text restored to correct UTF-8
- [ ] No UTF-8 BOM in any of the 12 files
- [ ] File sizes reduced (garbled text was ~3x bloated)  
- [ ] Browser renders Thai text correctly (ใบขอซื้อ, not เธเธณเธเธญ...)
- [ ] `npm run build` passes cleanly after fix

---
## Execution Logs
- [[execution-summary]]

