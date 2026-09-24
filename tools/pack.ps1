# Aethelgrad Essentials - Addon Packager
# Builds clean, production-ready .mcpack files and compiles them into a single .mcaddon file in the workspace root.
# Uses System.IO.Compression.ZipFile instead of Compress-Archive to produce standard ZIP files
# that Minecraft's importer accepts (Compress-Archive creates ZIP64 which MC rejects).

Clear-Host
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "               AETHELGRAD ADDON PACKAGER                  " -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  This script will:" -ForegroundColor Gray
Write-Host "  1. Sync current Behavior and Resource Pack files." -ForegroundColor White
Write-Host "  2. Compile them into a clean .mcaddon archive." -ForegroundColor White
Write-Host "  3. Save AethelLib.mcaddon at the workspace root." -ForegroundColor White
Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  Press [ENTER] to execute packager | [Ctrl+C] to cancel" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Read-Host | Out-Null

Add-Type -Assembly "System.IO.Compression.FileSystem"

$PSScriptDir = $PSScriptRoot
if (!$PSScriptDir) { $PSScriptDir = (Get-Location).Path }
$ToolsDir    = if ($PSScriptDir -like "*tools*") { $PSScriptDir } else { Join-Path (Get-Item $PSScriptDir).FullName "tools" }
$ProjectRoot = (Get-Item $ToolsDir).Parent.FullName
$OutputDir   = Join-Path $ToolsDir "Output"
if (!(Test-Path $OutputDir)) { New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null }
$BuildDir    = Join-Path $ProjectRoot "build"
$OutFile     = Join-Path $OutputDir "AethelLib.mcaddon"

Write-Host "[Packager] Cleaning build workspace..." -ForegroundColor Blue
if (Test-Path $BuildDir) { Remove-Item -Path $BuildDir -Recurse -Force }
if (Test-Path $OutFile)  { Remove-Item -Path $OutFile -Force }
New-Item -ItemType Directory -Path $BuildDir -Force | Out-Null

$BP_Temp = Join-Path $BuildDir "AethelLib_BP"
$RP_Temp = Join-Path $BuildDir "AethelLib_RP"
New-Item -ItemType Directory -Path $BP_Temp -Force | Out-Null
New-Item -ItemType Directory -Path $RP_Temp -Force | Out-Null

# 1. Copy Behavior Pack assets
Write-Host "[Packager] Copying Behavior Pack assets..." -ForegroundColor Cyan
$BP_Files = @("manifest.json", "pack_icon.png", "scripts", "entities", "LICENSE", "ACL.md")
foreach ($Item in $BP_Files) {
    $Source = Join-Path $ProjectRoot $Item
    if (Test-Path $Source) {
        Copy-Item -Path $Source -Destination $BP_Temp -Recurse -Force
    }
}

# 2. Copy Resource Pack assets
Write-Host "[Packager] Copying Resource Pack assets..." -ForegroundColor Cyan
$RP_Source = Join-Path $ProjectRoot "AethelLib (RP)"
if (Test-Path $RP_Source) {
    Copy-Item -Path "$RP_Source\*" -Destination $RP_Temp -Recurse -Force
}

# Copy licenses to Resource Pack
$LicenseFiles = @("LICENSE", "ACL.md")
foreach ($License in $LicenseFiles) {
    $Source = Join-Path $ProjectRoot $License
    if (Test-Path $Source) {
        Copy-Item -Path $Source -Destination $RP_Temp -Force
    }
}

# 3. Create standalone .mcpack files in Output
Write-Host "[Packager] Compressing standalone Packs..." -ForegroundColor Cyan
$BP_Pack = Join-Path $OutputDir "AethelLib_BP.mcpack"
$RP_Pack = Join-Path $OutputDir "AethelLib_RP.mcpack"
if (Test-Path $BP_Pack) { Remove-Item -Path $BP_Pack -Force }
if (Test-Path $RP_Pack) { Remove-Item -Path $RP_Pack -Force }

[System.IO.Compression.ZipFile]::CreateFromDirectory($BP_Temp, $BP_Pack, [System.IO.Compression.CompressionLevel]::Optimal, $false)
[System.IO.Compression.ZipFile]::CreateFromDirectory($RP_Temp, $RP_Pack, [System.IO.Compression.CompressionLevel]::Optimal, $false)

# 4. Create final .mcaddon (direct folder tree for seamless 1-click import in Bedrock)
Write-Host "[Packager] Creating final unified AethelLib.mcaddon (direct folder tree)..." -ForegroundColor Green
$AddonStream = [System.IO.File]::Open($OutFile, [System.IO.FileMode]::Create)
$AddonZip    = [System.IO.Compression.ZipArchive]::new($AddonStream, [System.IO.Compression.ZipArchiveMode]::Create)

$PacksToBundle = @(
    @{ Folder = "AethelLib_BP"; Path = $BP_Temp },
    @{ Folder = "AethelLib_RP"; Path = $RP_Temp }
)

foreach ($Target in $PacksToBundle) {
    $Files = Get-ChildItem -Path $Target.Path -Recurse -File
    foreach ($File in $Files) {
        $RelativePath = $File.FullName.Substring($Target.Path.Length).TrimStart([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar).Replace("\", "/")
        $ZipEntryPath = "$($Target.Folder)/$RelativePath"
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($AddonZip, $File.FullName, $ZipEntryPath, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
}

$AddonZip.Dispose()
$AddonStream.Dispose()

# 5. Cleanup temp directory
Remove-Item -Path $BuildDir -Recurse -Force

Write-Host "[Packager] Build successful! Addon packaged at: $OutFile" -ForegroundColor Green

