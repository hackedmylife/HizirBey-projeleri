$ErrorActionPreference = 'Stop'
$key = 'HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.hizirbey.fastkeys'
if (Test-Path $key) { Remove-Item -Path $key -Recurse -Force }
Write-Host 'Chrome FastKeys baglantisi kaldirildi. FastKeys dosyasi ve asistan anahtari degistirilmedi.'
