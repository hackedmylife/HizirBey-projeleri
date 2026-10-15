#Requires AutoHotkey v2.0
#SingleInstance Force
#MaxThreadsPerHotkey 1

; Chrome must retain Alt+H for the extension's toggle-dictation command.
; Only remap Win+H while Chrome is in the foreground. No clipboard, audio,
; API key, registry change, startup installation or network access is used.
#HotIf WinActive("ahk_exe chrome.exe")
#h:: {
    target := WinExist("A")
    KeyWait "h"
    KeyWait "LWin"
    KeyWait "RWin"
    if WinActive("ahk_id " target)
        Send "!h"
}
#HotIf
