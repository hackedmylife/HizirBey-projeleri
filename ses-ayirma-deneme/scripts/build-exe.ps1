# Reproducible inputs: official compiler archive and bundled AHK v2 runtime.
[CmdletBinding()]
param([string]$OutputDirectory = (Join-Path $PSScriptRoot '../../paketler'))
$ErrorActionPreference = 'Stop'
$project = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$destination = [IO.Path]::GetFullPath($OutputDirectory)
$build = Join-Path ([IO.Path]::GetTempPath()) ('HizirBey-CPU-Build-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $build, $destination -Force | Out-Null
try {
    $archive = Join-Path $build 'Ahk2Exe.zip'
    $url = 'https://github.com/AutoHotkey/Ahk2Exe/releases/download/Ahk2Exe1.1.37.02a2/Ahk2Exe1.1.37.02a2.zip'
    Invoke-WebRequest -Uri $url -OutFile $archive
    if ((Get-FileHash $archive -Algorithm SHA256).Hash -ne 'C29B8C3A5124850D79FC9E66E2CA79677C377D7F31631AD3022BA159C5D9E3BE') {
        throw 'Official compiler archive SHA-256 mismatch'
    }
    Expand-Archive -LiteralPath $archive -DestinationPath $build
    $compiler = (Get-ChildItem $build -Recurse -Filter Ahk2Exe.exe | Select-Object -First 1).FullName
    if (-not $compiler -or (Get-FileHash $compiler -Algorithm SHA256).Hash -ne 'E54A599B19BAA5C1688849BBAE7A9CF049EEFCCD4F704C67941B40DA13A625B2') {
        throw 'Official compiler EXE SHA-256 mismatch'
    }
    $runtimeZip = Join-Path $build 'AutoHotkey.zip'
    Invoke-WebRequest -Uri 'https://github.com/AutoHotkey/AutoHotkey/releases/download/v2.0.30/AutoHotkey_2.0.30.zip' -OutFile $runtimeZip
    if ((Get-FileHash $runtimeZip -Algorithm SHA256).Hash -ne '1E0ECE7ECB2D5646E55758150472677996A57F9DB5C83D2996D8B47B9E2F31A4') { throw 'Runtime archive hash mismatch' }
    Expand-Archive -LiteralPath $runtimeZip -DestinationPath (Join-Path $build 'runtime')
    $runtime = Join-Path $build 'runtime/AutoHotkey64.exe'
    if ((Get-FileHash $runtime -Algorithm SHA256).Hash -ne '2EAB99848EBC07F8AB0CC448BF69AF8C700B2FC7FCD1FF8794DF743DCC58DA51') {
        throw 'Official AutoHotkey runtime SHA-256 mismatch'
    }
    $output = Join-Path $destination 'Hizir-Bey-CPU-Ses-Testi-0.1.0.exe'
    $source = Join-Path $project 'Hizir-Bey-CPU-Ses-Testi.ahk'
    $arguments = @('/in', ('"' + $source + '"'), '/out', ('"' + $output + '"'), '/base', ('"' + $runtime + '"'), '/compress', '0', '/silent', 'verbose')
    $process = Start-Process -FilePath $compiler -ArgumentList $arguments -WorkingDirectory $project -PassThru -RedirectStandardOutput (Join-Path $build 'stdout.txt') -RedirectStandardError (Join-Path $build 'stderr.txt')
    if (-not $process.WaitForExit(60000)) { $process.Kill(); throw 'Compiler timeout' }
    Get-Content (Join-Path $build 'stdout.txt'), (Join-Path $build 'stderr.txt') -ErrorAction SilentlyContinue
    if ($process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $output)) { throw 'Compiler failed' }
    $hash = (Get-FileHash $output -Algorithm SHA256).Hash.ToLowerInvariant()
    [IO.File]::WriteAllText(($output + '.sha256'), ($hash + '  ' + [IO.Path]::GetFileName($output) + "`n"))
    Write-Output "EXE_SHA256 $hash"
    Write-Output "EXE_SIZE $((Get-Item $output).Length)"
} finally {
    Remove-Item -LiteralPath $build -Recurse -Force -ErrorAction SilentlyContinue
}
