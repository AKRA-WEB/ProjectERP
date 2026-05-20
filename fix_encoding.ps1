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
  if (-not (Test-Path $file)) {
    Write-Host "  File not found!"
    continue
  }
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
