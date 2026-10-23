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
    for control in [app.transferButton, app.copyButton, app.hideButton, app.resumeButton, app.restoreButton, app.clearButton, app.editor, app.footer] {
        control.GetPos(&cx, &cy, &cw, &ch)
        Assert(cx >= 0 && cy >= 0 && cx + cw <= clientWidth && cy + ch <= clientHeight, "Compact control remains inside strip")
    }

    app.window.Destroy()
    other.Destroy()
    Results .= "`n" Passed " checks passed. WorkSpaces / Win+H audio requires a real Windows 11 session.`n"
    FileOpen(LogFile, "w", "UTF-8").Write(Results)
    ExitApp(0)
} catch Error as err {
    Results .= "FAIL " err.Message "`n" err.File ":" err.Line "`n" err.Stack "`n"
    FileOpen(LogFile, "w", "UTF-8").Write(Results)
    ExitApp(1)
}
