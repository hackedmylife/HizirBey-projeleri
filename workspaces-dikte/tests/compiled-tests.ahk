#Requires AutoHotkey v2.0.30 64-bit
#SingleInstance Off
global Checks := 0, Report := "", ChildPid := 0
global Exe := A_Args[1], Log := A_Args[2]
global TestDir := A_Temp "\Dikte Tek EXE Türkçe " A_TickCount

Assert(value, label) {
    global Checks, Report
    if !value
        throw Error(label)
    Checks += 1
    Report .= "PASS " label "`n"
}

Drive(action, x := 0, y := 0) {
    command := Format('"{1}" /ErrorStdOut "{2}" {3} {4} {5}', A_AhkPath, A_ScriptDir "\keys-driver.ahk", action, Round(x), Round(y))
    if RunWait(command,, "Hide") != 0
        throw Error("Input driver failed: " action)
    Sleep(120)
}

AssetFolders(pid) {
    found := []
    Loop Files A_Temp "\HizirBey-Dikte-" pid "-*", "D"
        found.Push(A_LoopFileFullPath)
    return found
}

try {
    DirCreate(TestDir)
    standalone := TestDir "\Hızır Bey Dikte.exe"
    FileCopy(Exe, standalone)
    count := 0
    Loop Files TestDir "\*", "FD"
        count += 1
    Assert(count = 1, "Isolated Unicode and space directory contains only one EXE")
    Assert(FileGetVersion(standalone) = "0.4.1.0", "Compiled file has correct version metadata")
    Run('"' standalone '"', TestDir,, &ChildPid)
    window := WinWait("Hızır Bey · Yerel Dikte 0.4.1 ahk_pid " ChildPid,, 5)
    Assert(window != 0, "Standalone EXE opens without source, runtime or external assets")
    Assert(WinGetProcessPath("ahk_id " window) = standalone, "Window belongs to the standalone EXE process")
    WinGetClientPos(,,, &height, "ahk_id " window)
    Assert(height = 100, "Compiled panel retains compact height")
    edit := 0, copy := 0, close := 0, logo := 0
    for control in WinGetControlsHwnd("ahk_id " window) {
        className := WinGetClass("ahk_id " control)
        text := ControlGetText(control)
        if className = "Edit"
            edit := control
        if text = "Kopyala"
            copy := control
        if text = "Kapat"
            close := control
        if className = "Static" && (ControlGetStyle(control) & 0x1F) = 0xE
            logo := control
    }
    Assert(edit && copy && close, "Compiled app exposes editor, copy and X controls")
    Assert(logo && SendMessage(0x173, 0, 0, logo), "Embedded logo loads as a native bitmap")
    folders := AssetFolders(ChildPid)
    Assert(folders.Length = 1, "Embedded assets extract into a unique process directory")
    Assert(FileExist(folders[1] "\logo.png") && FileExist(folders[1] "\hizirbey.ico"), "Only packaged brand assets are available at runtime")
    ControlSetText("yardımcı olabilir miyim", edit)
    WinActivate("ahk_id " window)
    ControlFocus(edit)
    A_Clipboard := ""
    Drive("copy")
    Assert(A_Clipboard == "Yardımcı olabilir miyim?", "Compiled Ctrl+C copies full draft with Turkish punctuation")
    Assert(ControlGetText(edit) == "yardımcı olabilir miyim", "Compiled copy preserves the editor draft")
    ControlSetText("işleminizi kontrol ediyorum", edit)
    WinGetClientPos(&wx, &wy,,, "ahk_id " window)
    ControlGetPos(&x, &y, &w, &h, copy)
    Drive("click", wx + x + w / 2, wy + y + h / 2)
    Assert(A_Clipboard == "İşleminizi kontrol ediyorum.", "Compiled copy button uses the same punctuation")
    Run('"' standalone '"', TestDir,, &duplicatePid)
    ProcessWaitClose(duplicatePid, 4)
    Assert(!ProcessExist(duplicatePid) && ProcessExist(ChildPid), "Second launch keeps one instance without replacing the draft")
    Assert(ControlGetText(edit) == "işleminizi kontrol ediyorum", "Ignored second launch preserves existing text")
    WinActivate("ahk_id " window)
    WinGetClientPos(&wx, &wy,,, "ahk_id " window)
    ControlGetPos(&x, &y, &w, &h, close)
    Drive("click", wx + x + w / 2, wy + y + h / 2)
    ProcessWaitClose(ChildPid, 4)
    Assert(!ProcessExist(ChildPid) && !WinExist("ahk_id " window), "Compiled X exits the entire process and window")
    Assert(!DirExist(folders[1]), "X cleans up the process asset directory")
    Run('"' standalone '"', TestDir,, &ChildPid)
    reopened := WinWait("Hızır Bey · Yerel Dikte 0.4.1 ahk_pid " ChildPid,, 5)
    Assert(reopened != 0, "Standalone EXE can reopen immediately after X")
    folders := AssetFolders(ChildPid)
    Assert(folders.Length = 1, "Reopened process has its own fresh assets")
    WinClose("ahk_id " reopened)
    ProcessWaitClose(ChildPid, 4)
    Assert(!ProcessExist(ChildPid), "Compiled native close exits the whole process")
    Assert(!DirExist(folders[1]), "Native close also removes temporary assets")
    Run('"' standalone '" --smoke', TestDir,, &ChildPid)
    ProcessWaitClose(ChildPid, 5)
    Assert(!ProcessExist(ChildPid), "Compiled smoke entry starts and exits normally")
    Assert(AssetFolders(ChildPid).Length = 0, "Automatic exit cleans up temporary assets")
    Report .= "`n" Checks " standalone EXE checks passed. Microphone recognition is not automated.`n"
    FileOpen(Log, "w", "UTF-8").Write(Report)
    DirDelete(TestDir, true)
    ExitApp(0)
} catch Error as err {
    Report .= "FAIL " err.Message "`n" err.File ":" err.Line "`n" err.Stack
    FileOpen(Log, "w", "UTF-8").Write(Report)
    if ChildPid && ProcessExist(ChildPid)
        try ProcessClose(ChildPid)
    try DirDelete(TestDir, true)
    ExitApp(1)
}
