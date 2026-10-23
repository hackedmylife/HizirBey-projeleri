#Requires AutoHotkey v2.0.30 64-bit
#SingleInstance Ignore
#UseHook
#MaxThreadsPerHotkey 1
#Include src\Core.ahk
#Include src\Panel.ahk

; Local speech stays in this app. The remote bridge inserts only completed text.
; No credentials, audio recording, telemetry, registry changes or startup changes.
; Native Windows voice typing retains its own Microsoft network requirements.
global App := DikteApp()
if A_Args.Length && A_Args[1] = "--smoke"
    SetTimer(() => ExitApp(0), -800)

#HotIf App.ShouldCapture()
$#h::App.Toggle()
$^!h::App.Toggle()
#HotIf App.PanelHasFocus() && !App.paused
$^Enter::App.Finish()
#HotIf
