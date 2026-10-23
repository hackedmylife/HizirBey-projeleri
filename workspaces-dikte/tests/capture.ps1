param([long]$WindowHandle, [string]$Output)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class DikteCapture {
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }
    [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hwnd, out RECT rect);
    [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdc, uint flags);
}
'@
$rect = New-Object DikteCapture+RECT
if (-not [DikteCapture]::GetClientRect([IntPtr]$WindowHandle, [ref]$rect)) { throw 'Cannot read preview bounds' }
$bitmap = New-Object System.Drawing.Bitmap($rect.Right, $rect.Bottom)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$hdc = $graphics.GetHdc()
try {
    if (-not [DikteCapture]::PrintWindow([IntPtr]$WindowHandle, $hdc, 3)) { throw 'Cannot render native preview' }
} finally { $graphics.ReleaseHdc($hdc) }
try {
    $bitmap.Save($Output, [System.Drawing.Imaging.ImageFormat]::Png)
    [IO.File]::WriteAllText($Output + '.b64', 'HB_PREVIEW:' + [Convert]::ToBase64String([IO.File]::ReadAllBytes($Output)))
} finally { $graphics.Dispose(); $bitmap.Dispose() }
