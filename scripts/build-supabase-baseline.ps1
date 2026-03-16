param(
  [string]$MigrationsPath = "supabase/migrations",
  [string]$OutputPath = "supabase/baseline/20260316_baseline.sql",
  [string]$UpToVersion = "",
  [string]$OrderFromReadmePath = "README.md"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path -Path $MigrationsPath -PathType Container)) {
  throw "Migrations klasoru bulunamadi: $MigrationsPath"
}

$migrationFiles = Get-ChildItem -Path $MigrationsPath -File |
  Where-Object { $_.Name -match '^\d{8}_.+\.sql$' } |
  Sort-Object Name

$readmeOrder = @()
if (Test-Path -Path $OrderFromReadmePath -PathType Leaf) {
  $readmeOrder = @(Get-Content -Path $OrderFromReadmePath |
    ForEach-Object {
      if ($_ -match '^\s*-\s*`supabase/migrations/([^`]+\.sql)`') {
        $Matches[1]
      }
    } |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
}

$orderMap = @{}
for ($i = 0; $i -lt $readmeOrder.Count; $i++) {
  if (-not $orderMap.ContainsKey($readmeOrder[$i])) {
    $orderMap[$readmeOrder[$i]] = $i
  }
}

if ([string]::IsNullOrWhiteSpace($UpToVersion) -eq $false) {
  if ($UpToVersion -notmatch '^\d{8}$') {
    throw "UpToVersion 8 haneli tarih formatinda olmali (ornek: 20260316)."
  }

  $migrationFiles = $migrationFiles |
    Where-Object { $_.BaseName.Substring(0, 8) -le $UpToVersion }
}

if ($migrationFiles.Count -eq 0) {
  throw "Baseline icin migration dosyasi bulunamadi."
}

$migrationFiles = $migrationFiles | Sort-Object `
  @{ Expression = { [int]$_.BaseName.Substring(0, 8) } }, `
  @{ Expression = { if ($orderMap.ContainsKey($_.Name)) { 0 } else { 1 } } }, `
  @{ Expression = { if ($orderMap.ContainsKey($_.Name)) { $orderMap[$_.Name] } else { [int]::MaxValue } } }, `
  @{ Expression = { $_.Name } }

$outputDir = Split-Path -Parent $OutputPath
if ([string]::IsNullOrWhiteSpace($outputDir) -eq $false -and -not (Test-Path -Path $outputDir -PathType Container)) {
  New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$header = @(
  "-- AUTO-GENERATED BASELINE"
  "-- Generated at: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz")"
  "-- Source folder: $MigrationsPath"
  "-- Included migrations: $($migrationFiles.Count)"
  "-- NOTE: This file is for fresh environments."
  "-- Existing environments should continue with normal delta migrations."
  ""
)

Set-Content -Path $OutputPath -Value $header -Encoding utf8

foreach ($file in $migrationFiles) {
  Add-Content -Path $OutputPath -Value "-- ===================================================================" -Encoding utf8
  Add-Content -Path $OutputPath -Value "-- BEGIN: $($file.Name)" -Encoding utf8
  Add-Content -Path $OutputPath -Value "-- ===================================================================" -Encoding utf8
  Add-Content -Path $OutputPath -Value "" -Encoding utf8
  Get-Content -Path $file.FullName | Add-Content -Path $OutputPath -Encoding utf8
  Add-Content -Path $OutputPath -Value "" -Encoding utf8
  Add-Content -Path $OutputPath -Value "-- END: $($file.Name)" -Encoding utf8
  Add-Content -Path $OutputPath -Value "" -Encoding utf8
}

Write-Output "Baseline olusturuldu: $OutputPath"
Write-Output "Toplam migration sayisi: $($migrationFiles.Count)"
