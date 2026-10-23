#Requires AutoHotkey v2.0.30 64-bit
#SingleInstance Off
#NoTrayIcon
if !A_Args.Length
    ExitApp(2)
SendLevel(1)
switch A_Args[1] {
    case "copy": SendEvent("^c")
    case "toggle": SendEvent("#h")
    case "click":
        CoordMode("Mouse", "Screen")
        MouseGetPos(&oldX, &oldY)
        MouseClick("Left", Integer(A_Args[2]), Integer(A_Args[3]))
        MouseMove(oldX, oldY, 0)
    default: ExitApp(2)
}
Sleep(100)
ExitApp(0)
