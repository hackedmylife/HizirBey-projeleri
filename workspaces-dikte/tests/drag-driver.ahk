#Requires AutoHotkey v2.0.30 64-bit
#SingleInstance Off
#NoTrayIcon
CoordMode("Mouse", "Screen")
SendMode("Event")
MouseGetPos(&originalX, &originalY)
try {
    x := Integer(A_Args[1]), y := Integer(A_Args[2])
    MouseMove(x, y, 0)
    Sleep(150)
    SendEvent("{LButton down}")
    Sleep(150)
    MouseMove(x + 60, y + 35, 4)
    Sleep(200)
    SendEvent("{LButton up}")
    Sleep(150)
} finally {
    SendEvent("{LButton up}")
    MouseMove(originalX, originalY, 0)
}
ExitApp(0)
