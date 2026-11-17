# Windows PowerShell 5.1 / Windows 10 ve 11
[CmdletBinding()]
param([switch]$Elevated)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$script:LogFile = $null

function Write-Status {
    param([string]$Text, [ConsoleColor]$Color = 'Gray')
    Write-Host $Text -ForegroundColor $Color
    if ($script:LogFile) {
        Add-Content -LiteralPath $script:LogFile -Value ('[{0}] {1}' -f (Get-Date -Format 'HH:mm:ss'), $Text) -Encoding UTF8
    }
}

function Finish {
    param([int]$Code)
    Write-Host ''
    [void](Read-Host 'Pencereyi kapatmak için Enter')
    exit $Code
}

try {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    $isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        if ($Elevated) { throw 'Yönetici yetkisi alınamadı. BAT dosyasını yönetici olarak çalıştırın.' }
        Write-Host 'Kurulum için Windows yönetici izni isteniyor...' -ForegroundColor Green
        $shell = Join-Path $PSHOME 'powershell.exe'
        $arguments = '-NoLogo -NoProfile -ExecutionPolicy Bypass -File "{0}" -Elevated' -f $PSCommandPath
        $child = Start-Process -FilePath $shell -ArgumentList $arguments -Verb RunAs -Wait -PassThru
        exit $child.ExitCode
    }

    $source = Join-Path $PSScriptRoot 'Programlar'
    if (-not (Test-Path -LiteralPath $source -PathType Container)) {
        throw 'Programlar klasörü bulunamadı. Paketi bütün klasörleriyle çıkartın.'
    }
    $installers = @(Get-ChildItem -LiteralPath $source -File | Where-Object {
        $_.Extension -in @('.exe', '.msi')
    } | Sort-Object Name)

    Write-Host ''
    Write-Host '  HIZIR BEY | USB PROGRAM KURULUMU' -ForegroundColor Green
    Write-Host '  --------------------------------' -ForegroundColor DarkGreen
    Write-Host ''
    if ($installers.Count -eq 0) {
        Write-Host 'Kurulum dosyası bulunamadı.' -ForegroundColor Yellow
        Write-Host 'EXE / MSI kurulum dosyalarını Programlar klasörüne ekleyip tekrar çalıştırın.'
        Finish 0
    }

    $silent = @{}
    $configPath = Join-Path $PSScriptRoot 'Sessiz-Komutlar.json'
    if (Test-Path -LiteralPath $configPath -PathType Leaf) {
        $config = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($null -eq $config -or $config -isnot [pscustomobject]) {
            throw 'Sessiz-Komutlar.json bir JSON nesnesi olmalı. Varsayılan içerik: {}'
        }
        foreach ($property in $config.PSObject.Properties) {
            if ($property.Value -isnot [string] -or $property.Value -match '[\r\n\x00]') {
                throw ('Geçersiz sessiz kurulum komutu: {0}' -f $property.Name)
            }
            $silent[$property.Name] = $property.Value
        }
    }

    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
    $logRoot = Join-Path $env:LOCALAPPDATA ('HizirBey\USB-Kurulum\Kayitlar\{0}-{1}' -f $stamp, $PID)
    [void](New-Item -ItemType Directory -Path $logRoot -Force)
    $script:LogFile = Join-Path $logRoot 'Sonuc.txt'
    Write-Status ('Bulunan dosya: {0}' -f $installers.Count) Green
    Write-Status ('Kaynak: {0}' -f $source)
    Write-Status 'EXE dosyalarında komut tanımlı değilse normal kurulum ekranı açılır.'
    Write-Status 'Kurulum yeniden başlatmayı sorarsa tüm programlar bitene kadar erteleyin.'
    Write-Host ''
    $results = New-Object System.Collections.Generic.List[object]
    $restartNeeded = $false
    $index = 0

    foreach ($installer in $installers) {
        $index++
        Write-Status ('[{0}/{1}] {2}' -f $index, $installers.Count, $installer.Name) Cyan
        $isMsi = $installer.Extension -ieq '.msi'
        $mode = 'Normal EXE kurulumu'
        $code = $null
        $outcome = 'Hata'
        try {
            $startOptions = @{
                WorkingDirectory = $installer.DirectoryName
                Wait = $true
                PassThru = $true
                ErrorAction = 'Stop'
            }
            if ($isMsi) {
                $mode = 'Otomatik MSI kurulumu'
                $msiLog = Join-Path $logRoot ('MSI-{0:D3}.log' -f $index)
                $startOptions.FilePath = Join-Path $env:SystemRoot 'System32\msiexec.exe'
                $startOptions.ArgumentList = '/i "{0}" /passive /norestart REBOOT=ReallySuppress /L*v "{1}"' -f $installer.FullName, $msiLog
            } else {
                $startOptions.FilePath = $installer.FullName
                if ($silent.ContainsKey($installer.Name) -and -not [string]::IsNullOrWhiteSpace($silent[$installer.Name])) {
                    $mode = 'Tanımlı komutla EXE kurulumu'
                    $startOptions.ArgumentList = $silent[$installer.Name]
                }
            }
            Write-Status ('  {0}' -f $mode)
            $process = Start-Process @startOptions
            $code = $process.ExitCode
            if ($null -eq $code) { throw 'İşlem çıkış kodu alınamadı; kurulum sonucunu kontrol edin.' }
            if ($code -eq 0) {
                $outcome = 'İşlem tamamlandı (kod 0)'
                Write-Status ('  {0}' -f $outcome) Green
            } elseif ($code -in @(3010, 1641)) {
                $restartNeeded = $true
                $outcome = 'Tamamlandı; yeniden başlatma gerekiyor'
                Write-Status ('  {0} (kod {1})' -f $outcome, $code) Yellow
            } elseif ($code -eq 1602) {
                $outcome = 'İptal edildi'
                Write-Status '  Kurulum iptal edildi; sıradaki dosyaya geçiliyor.' Yellow
            } else {
                $outcome = 'Kontrol gerekiyor'
                Write-Status ('  Çıkış kodu: {0}. Kurulum sonucunu kontrol edin.' -f $code) Red
            }
        } catch {
            Write-Status ('  Hata: {0}' -f $_.Exception.Message) Red
        }
        $results.Add([pscustomobject]@{
            Dosya = $installer.Name
            Sonuc = $outcome
            Kod = $code
        })
        Write-Host ''
        if ($code -eq 1641) {
            Write-Status 'Kurucu yeniden başlatmayı başlattı; kalan dosyalar çalıştırılmadı.' Yellow
            break
        }
    }

    Write-Status 'KURULUM TURU TAMAMLANDI' Green
    $summary = $results | Format-Table -Property @('Dosya', 'Sonuc', 'Kod') -AutoSize | Out-String -Width 180
    Write-Host $summary
    Add-Content -LiteralPath $script:LogFile -Value $summary -Encoding UTF8
    Write-Status 'Kod 0, kurulum işleminin bildirdiği sonuçtur; programın açıldığını ayrıca kontrol edin.'
    if ($restartNeeded) { Write-Status 'Yeniden başlatma gerekiyor. Hazır olduğunuzda Windows üzerinden yeniden başlatın.' Yellow }
    Write-Status ('Kayıt dosyası: {0}' -f $script:LogFile)
    $problems = @($results | Where-Object { $_.Sonuc -in @('Hata', 'İptal edildi', 'Kontrol gerekiyor') })
    if ($problems.Count -gt 0) { Finish 1 }
    Finish 0
} catch {
    Write-Host ('HATA: {0}' -f $_.Exception.Message) -ForegroundColor Red
    Finish 1
}
