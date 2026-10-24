[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$Root,
    [ValidateSet('prepare','extract')][string]$Action = 'prepare',
    [string]$Reference = '', [string]$Mixture = '', [string]$Output = ''
)
$ErrorActionPreference = 'Stop'
$rootPath = [IO.Path]::GetFullPath($Root)
New-Item -ItemType Directory -Path $rootPath -Force | Out-Null
$done = Join-Path $rootPath 'done.txt'
Remove-Item -LiteralPath $done -Force -ErrorAction SilentlyContinue
$setupLog = Join-Path $rootPath 'setup.log'
$pythonDir = Join-Path $rootPath 'python'
$python = Join-Path $pythonDir 'python.exe'
function Set-Status([string]$Text) {
    [IO.File]::WriteAllText((Join-Path $rootPath 'status.txt'), $Text, [Text.UTF8Encoding]::new($false))
}
function Run-Python([string[]]$Arguments, [string]$Name) {
    # Separate native stderr redirection also works on Windows PowerShell 5.1.
    $quoted = @($Arguments | ForEach-Object { '"' + $_ + '"' })
    $stdout = Join-Path $rootPath ($Name + '.out.log')
    $stderr = Join-Path $rootPath ($Name + '.err.log')
    $p = Start-Process -FilePath $python -ArgumentList $quoted -NoNewWindow -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    if (-not $p.WaitForExit(900000)) { $p.Kill(); throw 'Python operation timed out' }
    return $p.ExitCode
}

try {
    if ($Action -eq 'prepare') {
        Set-Status 'CPU paketleri hazirlaniyor. Ilk indirme birkac yuz MB olabilir; lutfen bekle...'
        New-Item -ItemType Directory -Path $pythonDir -Force | Out-Null
        if (-not (Test-Path -LiteralPath $python)) {
            $archive = Join-Path $rootPath 'python.download.zip'
            Invoke-WebRequest -UseBasicParsing -Uri 'https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip' -OutFile $archive
            if ((Get-FileHash $archive -Algorithm SHA256).Hash -ne '009D6BF7E3B2DDCA3D784FA09F90FE54336D5B60F0E0F305C37F400BF83CFD3B') { throw 'Python archive hash mismatch' }
            Expand-Archive -LiteralPath $archive -DestinationPath $pythonDir -Force
            Remove-Item -LiteralPath $archive -Force
        }
        $site = Join-Path $pythonDir 'Lib/site-packages'
        New-Item -ItemType Directory -Path $site -Force | Out-Null
        [IO.File]::WriteAllText((Join-Path $pythonDir 'python311._pth'), "python311.zip`n.`nLib\site-packages`n..\engine`nimport site`n")
        if (-not (Test-Path (Join-Path $site 'pip/__init__.py'))) {
            $metadata = Invoke-RestMethod -Uri 'https://pypi.org/pypi/pip/24.3.1/json'
            $wheelInfo = $metadata.urls | Where-Object { $_.filename -eq 'pip-24.3.1-py3-none-any.whl' } | Select-Object -First 1
            if (-not $wheelInfo -or -not $wheelInfo.url.StartsWith('https://files.pythonhosted.org/')) { throw 'Unexpected pip wheel URL' }
            $wheel = Join-Path $rootPath 'pip.download.zip'
            Invoke-WebRequest -UseBasicParsing -Uri $wheelInfo.url -OutFile $wheel
            if ((Get-FileHash $wheel -Algorithm SHA256).Hash.ToLowerInvariant() -ne $wheelInfo.digests.sha256) { throw 'pip wheel hash mismatch' }
            Expand-Archive -LiteralPath $wheel -DestinationPath $site -Force
            Remove-Item -LiteralPath $wheel -Force
        }
        # CPU wheels only. No CUDA, GPU probing, global Python or PATH changes.
        $cpuCode = Run-Python -Arguments @('-m','pip','install','--disable-pip-version-check','--no-warn-script-location','--only-binary=:all:','torch==2.5.1+cpu','torchaudio==2.5.1+cpu','--index-url','https://download.pytorch.org/whl/cpu') -Name 'setup-torch'
        if ($cpuCode -ne 0) { throw 'CPU runtime install failed; see setup logs' }
        $audioCode = Run-Python -Arguments @('-m','pip','install','--disable-pip-version-check','--no-warn-script-location','--only-binary=:all:','numpy==1.26.4','scipy==1.13.1','librosa==0.10.2.post1','soundfile==0.12.1','webrtcvad-wheels==2.0.14','setuptools==75.6.0','numba==0.61.2') -Name 'setup-audio'
        if ($audioCode -ne 0) { throw 'Audio dependency install failed; see setup logs' }
    }
    if (-not (Test-Path -LiteralPath $python)) { throw 'Run Modeli hazirla first' }
    $worker = Join-Path $rootPath 'engine/worker.py'
    $workerArgs = @($worker, $Action, '--root', $rootPath)
    if ($Action -eq 'extract') { $workerArgs += @('--reference',$Reference,'--mixture',$Mixture,'--output',$Output) }
    $workerCode = Run-Python -Arguments $workerArgs -Name 'worker'
    if ($workerCode -ne 0) { throw 'Model operation failed; see worker logs and status.txt' }
    [IO.File]::WriteAllText($done, '0')
    exit 0
} catch {
    $detail = $_.Exception.Message
    # Keep the model's Turkish error when present, otherwise show the bootstrap error.
    $statusPath = Join-Path $rootPath 'status.txt'
    if (-not (Test-Path $statusPath) -or (Get-Content -LiteralPath $statusPath -Raw) -notmatch 'tamamlanamad') {
        Set-Status ('Islem tamamlanamadi: ' + $detail)
    }
    Add-Content -LiteralPath $setupLog -Value $detail
    [IO.File]::WriteAllText($done, '1')
    exit 1
}
