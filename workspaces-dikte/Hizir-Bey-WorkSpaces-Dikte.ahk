;@Ahk2Exe-SetName Hızır Bey Yerel Dikte
;@Ahk2Exe-SetDescription Hızır Bey Yerel Dikte
;@Ahk2Exe-SetVersion 0.4.1.0
;@Ahk2Exe-SetCompanyName Hızır Bey
;@Ahk2Exe-SetMainIcon assets\hizirbey.ico
;@Ahk2Exe-AddResource vendor\license.txt, LICENSE
;@Ahk2Exe-SetLegalCopyright GPL-2.0-or-later | github.com/hackedmylife/HizirBey-projeleri
#Requires AutoHotkey v2.0.30 64-bit
#SingleInstance Ignore
#UseHook
#MaxThreadsPerHotkey 1
#Include src\Assets.ahk
#Include src\Core.ahk
#Include src\Theme.ahk
#Include src\Panel.ahk

; Speech stays in this local edit box. Copy happens only on user request.
; No credentials, audio recording, telemetry, registry changes or startup changes.
; Native Windows voice typing retains its own Microsoft network requirements.
global App := DikteApp()
if A_Args.Length && A_Args[1] = "--smoke"
    SetTimer(() => ExitApp(0), -800)

#HotIf IsSet(App) && App.ShouldCapture()
$#h::App.Toggle()
$^!h::App.Toggle()
#HotIf IsSet(App) && App.ShouldCopy()
$^c::App.CopyOnly()
#HotIf
