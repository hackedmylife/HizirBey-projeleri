#Requires AutoHotkey v2.0.30 64-bit
#SingleInstance Off
#Include ..\src\Core.ahk
#Include ..\src\Panel.ahk

global Passed := 0
global Results := ""
global LogFile := A_Args.Length ? A_Args[1] : A_ScriptDir "\windows-test-results.txt"

Assert(condition, label) {
    global Passed, Results
    if !condition
        throw Error(label)
    Passed += 1
    Results .= "PASS " label "`n"
}

class RouteProbe extends DikteApp {
    starts := 0
    finishes := 0
    StartVoice() {
        this.starts += 1
        this.voiceRequested := true
    }
    Finish() {
        this.finishes += 1
        this.voiceRequested := false
    }
}

class NativeProbe extends DikteApp {
    requests := 0
    attempts := 0
    RequiresBridge() {
        return true
    }
    RequestBridge(arm := false, timeoutMs := 0) {
        this.attempts += 1
        return false
    }
    RequestNativeVoice() {
        this.requests += 1
    }
}

try {
    Assert(DikteCore.IsWorkspacesProcess("workspaces.exe"), "WorkSpaces process")
    Assert(DikteCore.IsWorkspacesProcess("WorkSpacesClient.EXE"), "WorkSpaces process case")
    Assert(!DikteCore.IsWorkspacesProcess("chrome.exe"), "Chrome hotkey left unchanged")
    Assert(!DikteCore.IsWorkspacesProcess("fake-workspaces.exe"), "No substring process match")
    Assert(!DikteCore.IsAllowedProcess("notepad.exe"), "Native Win+H outside WorkSpaces")
    Assert(DikteCore.IsAllowedProcess("notepad.exe", true), "Explicit local test mode")
    Assert(!DikteCore.IsAllowedProcess("", true), "Missing process rejected")
    Assert(DikteCore.ChatText("  İade işleminiz`r`nkontrol ediliyor.  ") = "İade işleminiz kontrol ediliyor.", "Turkish and one-paragraph paste")
    Assert(DikteCore.ChatText("`n `t") = "", "Blank text rejected")
    Assert(DikteCore.ChatText("Merhaba,  nasılsınız?") = "Merhaba,  nasılsınız?", "Punctuation and spacing preserved")
    Assert(!DikteCore.CanPaste("a", 0, 123, 0, 123), "Zero window rejected")
    Assert(!DikteCore.CanPaste("a", 50, 123, 51, 123), "Wrong foreground rejected")
    Assert(!DikteCore.CanPaste("a", 50, 123, 50, 124), "Reused window PID rejected")
    Assert(!DikteCore.CanPaste("  ", 50, 123, 50, 123), "Blank paste rejected")
    Assert(DikteCore.CanPaste("İşlem", 50, 123, 50, 123), "Exact target accepted")
    Assert(!DikteCore.IsSettled(950, 0, 0), "Minimum finalization interval")
    Assert(!DikteCore.IsSettled(1200, 0, 900), "Late word delays finalization")
    Assert(DikteCore.IsSettled(1800, 0, 900), "Quiet final text accepted")
    dock := DikteCore.DockBounds(0, 0, 1918, 878)
    Assert(dock.w = 930 && dock.h = 100, "Strip fits the marked 930-by-104 area")
    Assert(dock.x >= 520 && dock.x < 530 && dock.y >= 94 && dock.y < 100, "Strip aligns to marked search area")
    Assert(DikteCore.DockBounds(-1920, 0, 1920, 1080).x < 0, "Negative monitor coordinates preserved")
    ready := DikteCore.BridgeSignal("HB-DIKTE-2|READY|1234567890abcdef1234567890abcdef|armed")
    Assert(ready.kind = "READY" && ready.detail = "armed", "Bridge signal parsed")
    Assert(DikteCore.BridgeSignal("ordinary customer text").kind = "", "Plain text is not an acknowledgement")
    Assert(DikteCore.BridgeSignal("HB-DIKTE-2|READY|invalid|armed").kind = "", "Malformed session rejected")

    app := DikteApp(true)
    app.ShowPanel()
    Assert(WinExist("ahk_id " app.window.Hwnd), "Panel creates a native window")
    Assert(app.PanelHasFocus(), "Local edit panel receives focus")
    Assert(!app.testMode, "Broad hotkey capture disabled by default")
    Assert(app.delayMs = 1000, "One-second clipboard propagation default")
    Assert(!app.CaptureTarget(app.window.Hwnd), "Panel cannot target itself")
    A_Clipboard := "HB-DIKTE-2|READY|1234567890abcdef1234567890abcdef|armed"
    Assert(app.WaitBridge("READY", "1234567890abcdef1234567890abcdef", true), "Native bridge accepts matching session")
    A_Clipboard := "HB-DIKTE-2|READY|1234567890abcdef1234567890abcdef|prepared"
    Assert(!app.WaitBridge("READY", "1234567890abcdef1234567890abcdef", true), "Unarmed composer cannot receive final text")
    A_Clipboard := "HB-DIKTE-2|DONE|ffffffffffffffffffffffffffffffff|inserted"
    Assert(!app.WaitBridge("DONE", "1234567890abcdef1234567890abcdef"), "Other conversation session rejected")
    A_Clipboard := "no bridge response"
    Assert(!app.WaitBridge("DONE", "1234567890abcdef1234567890abcdef"), "Missing bridge acknowledgement times out")
    app.editor.Value := "Ödeme, çekim, şifre: ığüşöç İĞÜŞÖÇ."
    app.CopyOnly()
    Assert(A_Clipboard = app.editor.Value, "Real Unicode clipboard copy")

    ; Actual native edit + foreground + Ctrl+V integration; no microphone / provider.
    app.testMode := true
    receiver := Gui(, "Hizir Bey TEST RECEIVER")
    receiverEdit := receiver.AddEdit("w450 h100 Multi")
    receiver.Show()
    Assert(WinWaitActive("ahk_id " receiver.Hwnd,, 3), "Receiver is foreground")
    Assert(app.CaptureTarget(receiver.Hwnd), "Capture target HWND and PID")
    app.editor.Value := "Merhaba, işleminizi`r`nkontrol ediyorum."
    preserved := app.editor.Value
    app.delayMs := 500
    app.ShowPanel()
    app.Finish()
    Sleep(120)
    Assert(receiverEdit.Value = "Merhaba, işleminizi kontrol ediyorum.", "Real paste is exact and has no Enter")
    Assert(app.editor.Value = preserved, "Successful paste retains source draft")
    Assert(app.pasteIssued && !app.busy, "Paste completes and releases busy flag")
    Assert(A_Clipboard = DikteCore.ChatText(preserved), "Clipboard retained for remote sync")

    ; A user changing focus during the propagation wait must not receive the text.
    other := Gui(, "Hizir Bey OTHER WINDOW")
    otherEdit := other.AddEdit("w450 h100 Multi")
    app.ShowPanel()
    app.editor.Value := "YANLIŞ ALANA YAZILMAMALI"
    SetTimer(() => other.Show(), -1300)
    app.Finish()
    Sleep(100)
    Assert(otherEdit.Value = "", "Focus race: unrelated field stays empty")
    Assert(receiverEdit.Value = "Merhaba, işleminizi kontrol ediyorum.", "Focus race: no duplicate paste")
    Assert(app.editor.Value = "YANLIŞ ALANA YAZILMAMALI", "Focus race: draft survives")
    Assert(!app.busy, "Focus race releases busy state")

    receiver.Destroy()
    app.ShowPanel()
    app.editor.Value := "Pencere kapansa da taslak korunur."
    app.Finish()
    Assert(app.panelOpen && app.editor.Value != "", "Closed target preserves draft")
    Assert(A_Clipboard = app.editor.Value, "Closed target supports manual recovery")
    app.editor.Value := "  "
    A_Clipboard := "sentinel"
    app.Finish()
    Assert(A_Clipboard = "sentinel", "Blank draft does not overwrite clipboard")

    app.window.GetClientPos(,, &clientWidth, &clientHeight)
    app.editor.GetPos(&editX, &editY, &editW, &editH)
    app.transferButton.GetPos(&buttonX, &buttonY, &buttonW, &buttonH)
    app.footer.GetPos(&footerX, &footerY, &footerW, &footerH)
    Assert(buttonY + buttonH <= editY, "Compact editor and upper controls do not overlap")
    Assert(footerY + footerH <= clientHeight, "Footer stays inside client area")
    Assert(clientHeight = 100, "Native strip is 100 pixels high")
    for control in [app.transferButton, app.copyButton, app.hideButton, app.resumeButton, app.restoreButton, app.clearButton, app.editor, app.footer, app.dragHandle] {
        control.GetPos(&cx, &cy, &cw, &ch)
        Assert(cx >= 0 && cy >= 0 && cx + cw <= clientWidth && cy + ch <= clientHeight, "Compact control remains inside strip")
    }

    ; A real mouse driver exercises the explicit move handle, including native
    ; move-loop exit and settings persistence. No microphone is started in CI.
    configDir := A_Temp "\Hizir-Dikte-Position-Test-" A_TickCount
    configFile := configDir "\panel.ini"
    app.settingsPath := configFile
    app.ShowPanel()
    app.window.GetClientPos(&clientX, &clientY)
    app.dragHandle.GetPos(&gripX, &gripY, &gripW, &gripH)
    WinGetPos(&oldX, &oldY,,, "ahk_id " app.window.Hwnd)
    driver := A_ScriptDir "\drag-driver.ahk"
    command := Format('"{1}" /ErrorStdOut "{2}" {3} {4}', A_AhkPath, driver, Round(clientX + gripX + gripW / 2), Round(clientY + gripY + gripH / 2))
    Assert(RunWait(command,, "Hide") = 0, "Real mouse drag helper completed")
    Sleep(120)
    WinGetPos(&movedX, &movedY,,, "ahk_id " app.window.Hwnd)
    Assert(Abs(movedX - oldX - 60) <= 4 && Abs(movedY - oldY - 35) <= 4, "Visible grip moves native panel with mouse")
    Assert(app.customPosition && FileExist(configFile), "User movement saves position")
    Assert(Integer(IniRead(configFile, "Panel", "X")) = movedX, "Saved X matches actual window")
    Assert(Integer(IniRead(configFile, "Panel", "Y")) = movedY, "Saved Y matches actual window")
    restored := DikteApp(true, configFile)
    restored.ShowPanel()
    WinGetPos(&restoredX, &restoredY,,, "ahk_id " restored.window.Hwnd)
    Assert(Abs(restoredX - movedX) <= 2 && Abs(restoredY - movedY) <= 2, "New app instance restores moved position")
    restored.editor.Value := "Konum sıfırlansa da taslak korunur."
    restored.ResetPosition()
    Assert(!restored.customPosition && restored.editor.Value != "", "Position reset preserves draft")
    restored.Dispose()
    try DirDelete(configDir, true)

    fixture := Gui(, "Hizir Bey HOTKEY TARGET")
    fixture.AddEdit("w420 h90")
    fixture.Show()
    route := RouteProbe(true)
    route.testMode := true
    route.lastWorkspace := fixture.Hwnd
    route.ShowPanel()
    route.Toggle()
    Assert(route.starts = 1 && route.finishes = 0, "First Win+H in empty local panel starts dictation")
    Assert(route.target = fixture.Hwnd, "Panel start recovers external target")
    route.editor.Value := "Tamamlanan cümle."
    route.Toggle()
    Assert(route.finishes = 1 && route.starts = 1, "Second Win+H finishes current dictation")
    route.pasteIssued := true
    route.Toggle()
    Assert(route.starts = 2 && route.editor.Value = "", "Win+H from completed panel starts a fresh draft")
    Assert(route.lastText = "Tamamlanan cümle.", "Starting next dictation keeps prior text recoverable")
    route.target := 0, route.targetPid := 0, route.lastWorkspace := 0
    route.testMode := false, route.voiceRequested := false, route.pasteIssued := false
    route.Toggle()
    Assert(route.starts = 3, "Local panel start remains available without an external target")
    route.Dispose()

    native := NativeProbe(true)
    native.testMode := true
    Assert(native.CaptureTarget(fixture.Hwnd), "Native-start regression fixture bound")
    native.ShowPanel()
    native.StartVoice()
    Assert(native.attempts = 1 && native.requests = 1, "Missing bridge acknowledgement does not block native dictation request")
    Assert(native.voiceRequested && !native.busy, "Local dictation remains active after bridge failure")
    native.Dispose()
    fixture.Destroy()

    app.Dispose()
    other.Destroy()
    Results .= "`n" Passed " checks passed. WorkSpaces / Win+H audio requires a real Windows 11 session.`n"
    FileOpen(LogFile, "w", "UTF-8").Write(Results)
    ExitApp(0)
} catch Error as err {
    Results .= "FAIL " err.Message "`n" err.File ":" err.Line "`n" err.Stack "`n"
    FileOpen(LogFile, "w", "UTF-8").Write(Results)
    ExitApp(1)
}
