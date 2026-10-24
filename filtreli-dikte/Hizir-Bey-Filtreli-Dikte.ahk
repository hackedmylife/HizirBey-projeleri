;@Ahk2Exe-SetName Hızır Bey Filtreli Dikte
;@Ahk2Exe-SetDescription CPU ses profili filtresiyle yerel Windows diktesi
;@Ahk2Exe-SetVersion 0.1.0.0
;@Ahk2Exe-SetCompanyName Hızır Bey
;@Ahk2Exe-SetMainIcon assets\hizirbey.ico
;@Ahk2Exe-AddResource licenses\AutoHotkey-GPL.txt, LICENSE
;@Ahk2Exe-AddResource licenses\GPL-3.0.txt, LICENSE_APP
#Requires AutoHotkey v2.0.30 64-bit
#SingleInstance Ignore
#UseHook
#Include src\Assets.ahk
#Include src\Core.ahk
#Include src\Theme.ahk
#Include src\Panel.ahk
#Include src\Process.ahk
#Include src\Filter.ahk

global FilterAppMutex := DllCall("CreateMutexW", "Ptr", 0, "Int", 1, "WStr", "Local\HizirBeyFiltreliDikte0.1.0", "Ptr")
if A_LastError = 183
    ExitApp(0)
try {
    global App := FilteredDikteApp()
} catch Error as err {
    FileAppend("Startup failed: " err.Message " · " err.File ":" err.Line "`n", "**", "UTF-8")
    if !A_Args.Length
        MsgBox("Uygulama açılamadı: " err.Message, "Filtreli Dikte")
    ExitApp(1)
}
if A_Args.Length && A_Args[1] = "--smoke"
    SetTimer(() => App.Quit(), -900)

#HotIf IsSet(App) && App.ShouldCapture()
$#h::App.Toggle()
$^!h::App.Toggle()
#HotIf IsSet(App) && App.ShouldCopy()
$^c::App.CopyOnly()
#HotIf
