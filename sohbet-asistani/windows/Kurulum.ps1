$ErrorActionPreference = 'Stop'
try {
    Write-Host 'Hizir Bey - FastKeys baglantisi kurulumu' -ForegroundColor Yellow
    $extensionId = (Read-Host 'Chrome eklenti ayarlarindaki kimligi yapistirin').Trim()
    if ($extensionId -notmatch '^[a-p]{32}$') { throw 'Eklenti kimligi 32 harf olmali. Chrome asistan ayarlarindan kopyalayin.' }
    Add-Type -AssemblyName System.Windows.Forms
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Filter = 'FastKeys (*.fdb)|*.fdb'
    $dialog.Title = 'FastKeys tarafindan kullanilan asil dosyayi secin'
    if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { throw 'Dosya secilmedi; kurulum yapilmadi.' }
    $dataFile = $dialog.FileName
    $dialog.Dispose()
    $installRoot = Join-Path $env:LOCALAPPDATA 'HizirBeySohbetAsistani'
    New-Item -ItemType Directory -Force -Path $installRoot | Out-Null
    $staging = Join-Path $installRoot 'FastKeysHost.next.exe'
    if (Test-Path $staging) { Remove-Item -LiteralPath $staging -Force }
    Add-Type -Path (Join-Path $PSScriptRoot 'NativeHost.cs') -ReferencedAssemblies 'System.Web.Extensions' -OutputAssembly $staging -OutputType ConsoleApplication
    $exe = Join-Path $installRoot 'FastKeysHost.exe'
    Move-Item -LiteralPath $staging -Destination $exe -Force
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText((Join-Path $installRoot 'config.json'), (@{file=$dataFile} | ConvertTo-Json), $utf8)
    $manifest = @{name='com.hizirbey.fastkeys'; description='Hizir Bey FastKeys read-only bridge'; path=$exe; type='stdio'; allowed_origins=@("chrome-extension://$extensionId/")}
    $manifestPath = Join-Path $installRoot 'host.json'
    [System.IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json), $utf8)
    $key = 'HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.hizirbey.fastkeys'
    New-Item -Path $key -Force | Out-Null
    Set-Item -Path $key -Value $manifestPath
    Write-Host 'Kurulum tamamlandi. Asistan ayarlarindan baglantiyi kontrol edin ve otomatik takibi acin.' -ForegroundColor Green
} catch {
    Write-Host ('Kurulum tamamlanamadi: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host 'FastKeys dosyaniz degistirilmedi. Asistanin dosya ice aktarma secenegi kullanilabilir.'
    exit 1
}
