$ErrorActionPreference = 'Stop'
$AppName = 'DATAVOX'
$AppSource = Join-Path $PSScriptRoot 'app'
$SourceExe = Join-Path $AppSource 'DATAVOX.exe'
$InstallDir = Join-Path $env:LOCALAPPDATA 'Programs\DATAVOX'

Write-Host "`nDATAVOX Setup - Afrasiab Labs" -ForegroundColor Cyan
Write-Host 'Installing the prebuilt Windows application. No Visual Studio or build tools are needed.'

if ($env:OS -ne 'Windows_NT') { throw 'DATAVOX can only be installed on Windows 10/11.' }
if (-not (Test-Path $SourceExe)) {
    throw "The prebuilt DATAVOX.exe is missing. This is a source package, not the release installer. Upload the repository to GitHub, run the Windows Build workflow, then download its DATAVOX-Windows-Installer artifact."
}

# .NET Framework 4.8 runtime check only; never install developer/build tools.
$release = 0
try { $release = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full' -Name Release -ErrorAction Stop).Release } catch {}
if ($release -lt 528040) {
    Write-Host '.NET Framework 4.8 runtime is missing. Downloading the official Microsoft runtime...' -ForegroundColor Yellow
    $runtime = Join-Path $env:TEMP 'DATAVOX-NDP48.exe'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri 'https://go.microsoft.com/fwlink/?linkid=2088631' -OutFile $runtime -UseBasicParsing
    $p = Start-Process -FilePath $runtime -ArgumentList '/q /norestart' -Wait -PassThru
    if ($p.ExitCode -in @(3010,1641)) { Write-Host 'Restart Windows, then run Setup.bat again.' -ForegroundColor Yellow; exit 0 }
    if ($p.ExitCode -ne 0) { throw ".NET Framework runtime installation failed (exit code $($p.ExitCode))." }
}

Write-Host "Installing DATAVOX to $InstallDir ..." -ForegroundColor Yellow
if (Test-Path $InstallDir) { Remove-Item $InstallDir -Recurse -Force }
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
Copy-Item (Join-Path $AppSource '*') $InstallDir -Recurse -Force
$exe = Join-Path $InstallDir 'DATAVOX.exe'
if (-not (Test-Path $exe)) { throw 'DATAVOX.exe was not copied successfully.' }

$desktop = [Environment]::GetFolderPath('Desktop')
$shortcut = Join-Path $desktop 'DATAVOX.lnk'
$wsh = New-Object -ComObject WScript.Shell
$link = $wsh.CreateShortcut($shortcut)
$link.TargetPath = $exe
$link.WorkingDirectory = $InstallDir
$link.Description = 'DATAVOX - File Copy Utility by Afrasiab Labs'
$link.Save()

$uninstall = @'
$ErrorActionPreference = "SilentlyContinue"
$folder = Join-Path $env:LOCALAPPDATA "Programs\DATAVOX"
$shortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "DATAVOX.lnk"
Remove-Item $shortcut -Force
Remove-Item $folder -Recurse -Force
Write-Host "DATAVOX has been uninstalled."
'@
Set-Content -Path (Join-Path $InstallDir 'Uninstall-DATAVOX.ps1') -Value $uninstall -Encoding UTF8
Write-Host "`nDATAVOX installed successfully." -ForegroundColor Green
Write-Host 'A desktop shortcut has been created. Launching DATAVOX...'
Start-Process -FilePath $exe -WorkingDirectory $InstallDir
