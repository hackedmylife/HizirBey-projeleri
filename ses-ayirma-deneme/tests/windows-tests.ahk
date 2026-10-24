#Requires AutoHotkey v2.0.30 64-bit
#SingleInstance Off
CoordMode("Mouse", "Screen")
global Passed := 0, Report := "", AppPid := 0
global ExePath := A_Args[1], ResultPath := A_Args[2]
Assert(value, label) {
    global Passed, Report
    if !value
        throw Error(label)
    Passed += 1
    Report .= "PASS " label "`n"
}
try {
    testDir := A_Temp "\CPU Ses Türkçe " A_TickCount
    DirCreate(testDir)
    standalone := testDir "\Ses Testi.exe"
    FileCopy(ExePath, standalone)
    Run('"' standalone '"', testDir,, &AppPid)
    window := WinWait("Hızır Bey · CPU Ses Testi 0.1.0 ahk_pid " AppPid,, 5)
    Assert(window != 0, "Isolated EXE opens from Unicode path")
    Assert(FileGetVersion(standalone) = "0.1.0.0", "File version matches")
    buttons := [], prepareHwnd := 0
    for control in WinGetControlsHwnd("ahk_id " window) {
        if WinGetClass("ahk_id " control) = "Button" {
            buttons.Push(control)
            Assert((ControlGetStyle(control) & 0xF) = 0xB, "Native button uses custom drawing")
            if ControlGetText(control) = "Modeli hazırla"
                prepareHwnd := control
        }
    }
    Assert(buttons.Length = 10 && prepareHwnd != 0, "All recording and comparison actions are visible")
    SplitPath(ResultPath,, &resultDirectory)
    preview := resultDirectory "\cpu-preview.png"
    capture := Format('powershell.exe -NoProfile -ExecutionPolicy Bypass -File "{1}" -WindowHandle {2} -Output "{3}"', A_ScriptDir "\capture.ps1", window, preview)
    Assert(RunWait(capture,, "Hide") = 0 && FileExist(preview), "Native test interface renders")
    ; Before setup, Extract must show an actionable status without spawning work.
    for control in buttons
        if ControlGetText(control) = "Ayır ve ölç"
            ControlClick(control)
    Sleep(150)
    found := false
    for control in WinGetControlsHwnd("ahk_id " window)
        if InStr(ControlGetText(control), "Önce Modeli")
            found := true
    Assert(found, "Extract without prepared engine gives a clear instruction")
    root := EnvGet("LOCALAPPDATA") "\HizirBey\CpuSesTesti\0.1.0"
    Assert(FileExist(root "\engine\worker.py") && FileExist(root "\bootstrap.ps1"), "Embedded engine and bootstrap are installed")
    Assert(FileExist(root "\NOTICE.txt") && FileExist(root "\licenses\Resemblyzer-APACHE.txt"), "Source notices and license are available")
    ; Start an owned preparation process, then close the actual title-bar X.
    ControlClick(prepareHwnd)
    Sleep(650)
    children := []
    service := ComObjGet("winmgmts:")
    for process in service.ExecQuery("SELECT ProcessId FROM Win32_Process WHERE ParentProcessId=" AppPid)
        children.Push(Integer(process.ProcessId))
    Assert(children.Length >= 1, "Preparation starts an owned worker process")
    WinActivate("ahk_id " window)
    WinGetPos(&x, &y, &width,, "ahk_id " window)
    MouseClick("Left", x + width - 22, y + 14)
    ProcessWaitClose(AppPid, 5)
    Assert(!ProcessExist(AppPid), "Title-bar X completely exits the app")
    for pid in children {
        ProcessWaitClose(pid, 5)
        Assert(!ProcessExist(pid), "X also terminates the owned preparation process")
    }
    Run('"' standalone '"', testDir,, &AppPid)
    reopened := WinWait("Hızır Bey · CPU Ses Testi 0.1.0 ahk_pid " AppPid,, 5)
    Assert(reopened != 0, "Application can reopen immediately after X")
    WinClose("ahk_id " reopened)
    ProcessWaitClose(AppPid, 4)
    Assert(!ProcessExist(AppPid), "Native close exits the reopened application")
    Run('"' standalone '" --smoke', testDir,, &AppPid)
    ProcessWaitClose(AppPid, 5)
    Assert(!ProcessExist(AppPid), "Compiled smoke entry opens and exits")
    DirDelete(testDir, true)
    Report .= "`n" Passed " native Windows checks passed. Real microphone and room sound are not automated.`n"
    FileOpen(ResultPath, "w", "UTF-8").Write(Report)
    ExitApp(0)
} catch Error as err {
    if AppPid && WinExist("ahk_pid " AppPid) {
        for diagnostic in WinGetControlsHwnd("ahk_pid " AppPid)
            Report .= "CONTROL " ControlGetText(diagnostic) "`n"
    }
    Report .= "FAIL " err.Message "`n" err.File ":" err.Line "`n" err.Stack
    FileOpen(ResultPath, "w", "UTF-8").Write(Report)
    if AppPid && ProcessExist(AppPid)
        try WinClose("ahk_pid " AppPid)
    ExitApp(1)
}
