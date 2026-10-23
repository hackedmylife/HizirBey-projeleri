#Requires AutoHotkey v2.0.30 64-bit
global Passed := 0
global Results := ""
global LogFile := A_Args.Length ? A_Args[1] : A_ScriptDir "\windows-test-results.txt"
; Include the actual shipping entry point so its Win+H / Ctrl+C bindings are
; exercised too. Only native microphone requests are replaced by counters.
SetTimer(RunSuite, -100)
#Include ..\Hizir-Bey-WorkSpaces-Dikte.ahk

class NativeProbe extends DikteApp {
    starts := 0
    stops := 0
    RequestNativeVoice() {
        this.starts += 1
    }
    RequestNativeStop() {
        this.stops += 1
    }
}

Assert(condition, label) {
    global Passed, Results
    if !condition
        throw Error(label)
    Passed += 1
    Results .= "PASS " label "`n"
}

Drive(action, x := 0, y := 0) {
    driver := A_ScriptDir "\keys-driver.ahk"
    command := Format('"{1}" /ErrorStdOut "{2}" {3} {4} {5}', A_AhkPath, driver, action, Round(x), Round(y))
    if RunWait(command,, "Hide") != 0
        throw Error("Keyboard / mouse driver failed: " action)
    Sleep(120)
}

ClickButton(app, button) {
    app.window.GetClientPos(&originX, &originY)
    button.GetPos(&x, &y, &w, &h)
    Drive("click", originX + x + w / 2, originY + y + h / 2)
}

RunSuite() {
    global App, Results, Passed, LogFile
    if !IsSet(App) {
        SetTimer(RunSuite, -100)
        return
    }
    try {
        App.Dispose()
        App := NativeProbe(true)
        Assert(DikteCore.IsWorkspacesProcess("workspaces.exe"), "WorkSpaces Win+H scope")
        Assert(DikteCore.IsWorkspacesProcess("WorkSpacesClient.EXE"), "WorkSpaces process case")
        Assert(!DikteCore.IsWorkspacesProcess("fake-workspaces.exe"), "No substring process match")
        Assert(!DikteCore.IsWorkspacesProcess("chrome.exe"), "Normal Chrome keeps native Win+H")
        Assert(DikteCore.HasText(" ığüşöç "), "Turkish text accepted")
        Assert(!DikteCore.HasText(" `r`n `t"), "Whitespace is not a draft")
        punctuation := [
            ["merhaba işleminizi kontrol ediyorum", "Merhaba işleminizi kontrol ediyorum."],
            ["merhaba.", "Merhaba."],
            ["işleminizi kontrol ediyorum", "İşleminizi kontrol ediyorum."],
            ["ışık kontrol ediliyor", "Işık kontrol ediliyor."],
            ["yardımcı olabilir miyim", "Yardımcı olabilir miyim?"],
            ["bekleyebilir misiniz", "Bekleyebilir misiniz?"],
            ["Merhaba, kontrol ediyorum!", "Merhaba, kontrol ediyorum!"],
            ["Bakiye 1.250,50 TL", "Bakiye 1.250,50 TL."],
            ["İşlem numarası 123456", "İşlem numarası 123456"],
            ["https://example.com/a?b=c", "https://example.com/a?b=c"],
            ["ABC123", "ABC123"],
            ["info@example.com", "info@example.com"],
            ["bağlantı https://example.com", "Bağlantı https://example.com"],
            ["  merhaba  `r`n", "  Merhaba.  `r`n"],
            ["merhaba`r`nkontrol ediyorum", "Merhaba.`r`nKontrol ediyorum."],
            [" `r`n `t", " `r`n `t"]]
        for item in punctuation {
            actual := DikteCore.FinalizeText(item[1])
            Assert(actual == item[2], "Punctuation, Turkish casing or protected-data case")
            Assert(DikteCore.FinalizeText(actual) == actual, "Punctuation is idempotent")
        }
        box := DikteCore.DockBounds(0, 0, 1918, 878)
        Assert(box.w = 930 && box.h = 100, "Original compact strip dimensions retained")
        Assert(DikteCore.DockBounds(-1920, 0, 1920, 1080).x < 0, "Secondary monitor coordinates supported")

        receiver := Gui(, "Hizir Bey OTHER APPLICATION")
        receiverEdit := receiver.AddEdit("w450 h90 Multi", "Outside selected normal text.")
        receiver.Show()
        App.ShowPanel()
        Assert(App.PanelHasFocus() && App.ShouldCapture() && App.ShouldCopy(), "Local panel owns dictation and copy hotkeys")
        buttons := 0
        for control in App.window
            if control.Type = "Button"
                buttons += 1
        Assert(buttons = 3, "Two large actions plus a window close button")
        Assert(App.toggleButton.Text = "Başlat" && App.copyButton.Text = "Kopyala" && App.closeButton.Text = "Kapat", "Start-stop, copy and accessible close labels")
        for width in [600, 930, 1080] {
            App.window.Show("w" width " h100")
            Sleep(60)
            App.window.GetClientPos(,, &clientWidth, &clientHeight)
            Assert(clientHeight = 100, "Panel retains 100-pixel height")
            for control in [App.logo, App.brandCaption, App.heading, App.status, App.editor, App.toggleButton, App.copyButton, App.closeButton] {
                control.GetPos(&x, &y, &w, &h)
                Assert(x >= 0 && y >= 0 && x + w <= clientWidth && y + h <= clientHeight, "Control stays inside supported panel width")
            }
            App.editor.GetPos(&ex, &ey, &ew, &eh)
            App.toggleButton.GetPos(&bx, &by, &bw, &bh)
            Assert(ex + ew < bx && bw >= 160 && bh >= 40, "Large buttons do not overlap writing area")
        }
        App.window.Show("w930 h100 x10 y50")
        App.editor.Focus()
        App.editor.Value := "İlk cümle korunacak."
        A_Clipboard := "old clipboard"
        Drive("toggle")
        Assert(App.starts = 1 && App.voiceRequested && App.toggleButton.Text = "Durdur", "Actual Win+H starts local dictation")
        Assert(App.editor.Value = "İlk cümle korunacak.", "Start does not erase existing text")
        Assert(A_Clipboard = "old clipboard", "Start does not touch clipboard")

        App.editor.Value := "Türkçe: ığüşöç İĞÜŞÖÇ.`r`nİkinci satır; noktalama korunur."
        expected := App.editor.Value
        SendMessage(0xB1, 2, 7, App.editor.Hwnd)
        selected := SendMessage(0xB0, 0, 0, App.editor.Hwnd)
        Drive("copy")
        Assert(A_Clipboard = expected, "Actual Ctrl+C copies entire draft instead of selected fragment")
        Assert(App.voiceRequested && App.stops = 0 && App.toggleButton.Text = "Durdur", "Ctrl+C does not stop dictation")
        Assert(App.editor.Value = expected, "Copy does not alter draft or paragraphs")
        Assert(SendMessage(0xB0, 0, 0, App.editor.Hwnd) = selected, "Copy preserves text selection and caret")
        App.editor.Value := expected " Yeni kelimeler."
        Assert(A_Clipboard = expected, "Later words do not change copied snapshot automatically")
        Drive("copy")
        Assert(A_Clipboard = App.editor.Value, "Next Ctrl+C copies latest words")
        App.editor.Value := "yardımcı olabilir miyim"
        Drive("copy")
        Assert(A_Clipboard == "Yardımcı olabilir miyim?", "Live copy snapshot gets terminal punctuation")
        Assert(App.editor.Value = "yardımcı olabilir miyim" && App.voiceRequested, "Live editor remains raw and listening during punctuated copy")
        App.editor.Value := expected " Yeni kelimeler."
        ClickButton(App, App.copyButton)
        Assert(A_Clipboard = App.editor.Value && App.voiceRequested, "Large copy button works during dictation")
        Assert(DllCall("GetFocus", "Ptr") = App.editor.Hwnd, "Copy button returns focus to writing box")
        expected := App.editor.Value
        caretBeforeStop := SendMessage(0xB0, 0, 0, App.editor.Hwnd)
        copied := A_Clipboard
        ClickButton(App, App.toggleButton)
        Assert(App.stops = 1 && !App.voiceRequested && App.toggleButton.Text = "Başlat", "Large stop button stops without transfer")
        Assert(App.panelOpen && App.editor.Value = expected, "Stopped text remains visible and unchanged")
        Assert(A_Clipboard = copied, "Stop does not copy automatically")
        Assert(SendMessage(0xB0, 0, 0, App.editor.Hwnd) = caretBeforeStop, "Stop preserves draft insertion position")
        Drive("toggle")
        Assert(App.starts = 2 && App.voiceRequested && App.editor.Value = expected, "Win+H resumes existing draft")
        Assert(SendMessage(0xB0, 0, 0, App.editor.Hwnd) = caretBeforeStop, "Resume preserves draft insertion position")
        Drive("toggle")
        Assert(App.stops = 2 && !App.voiceRequested, "Second Win+H only stops local dictation")
        Assert(receiverEdit.Value = "Outside selected normal text.", "Start-stop-copy never pastes into another application")

        App.editor.Value := " `r`n `t"
        A_Clipboard := "sentinel"
        Drive("copy")
        Assert(A_Clipboard = "sentinel", "Empty draft does not overwrite clipboard")
        App.editor.Value := "Anında kopyalanacak metin."
        App.busy := true
        Drive("copy")
        Assert(A_Clipboard = App.editor.Value, "Copy shortcut remains immediate during another local operation")
        App.busy := false
        receiver.Show()
        receiverEdit.Focus()
        SendMessage(0xB1, 0, 7, receiverEdit.Hwnd)
        Assert(!App.ShouldCopy() && !App.ShouldCapture(), "Other applications retain their shortcuts")
        Drive("copy")
        Assert(A_Clipboard = "Outside", "Ctrl+C outside panel uses native selected text")
        Assert(App.editor.Value = "Anında kopyalanacak metin.", "External copying leaves local draft intact")

        App.ShowPanel()
        Drive("toggle")
        App.editor.Value := "merhaba işleminizi kontrol ediyorum"
        A_Clipboard := "clipboard must not change on stop"
        Drive("toggle")
        Sleep(1100)
        Assert(App.editor.Value == "Merhaba işleminizi kontrol ediyorum.", "Stopped dictation receives final punctuation after quiet interval")
        Assert(!App.finalizePending && !App.voiceRequested, "Finalization completes without restarting dictation")
        Assert(A_Clipboard = "clipboard must not change on stop", "Stop punctuation never copies automatically")
        Drive("undo")
        Assert(App.editor.Value = "merhaba işleminizi kontrol ediyorum", "Native Ctrl+Z undoes stopped-text punctuation")
        Drive("toggle")
        App.editor.Value := "merhaba."
        Drive("toggle")
        Sleep(1100)
        Assert(App.editor.Value == "Merhaba.", "Stopped finalization also applies casing-only corrections")
        App.editor.Value := "Merhaba, işleminizi kontrol ediyorum."
        App.SetStatus("Hazır · Cümle sonları tamamlandı")
        App.window.Show("w930 h100 x10 y50")
        Sleep(150)
        SplitPath(LogFile,, &logDir)
        preview := logDir "\dikte-preview.png"
        capture := Format('powershell.exe -NoProfile -ExecutionPolicy Bypass -File "{1}" -WindowHandle {2} -Output "{3}"', A_ScriptDir "\capture.ps1", App.window.Hwnd, preview)
        Assert(RunWait(capture,, "Hide") = 0 && FileExist(preview), "Native premium panel preview rendered")

        configDir := A_Temp "\Hizir-Dikte-Local-Test-" A_TickCount
        configFile := configDir "\panel.ini"
        App.settingsPath := configFile
        App.ShowPanel()
        App.window.GetClientPos(&clientX, &clientY)
        App.heading.GetPos(&hx, &hy, &hw, &hh)
        WinGetPos(&oldX, &oldY,,, "ahk_id " App.window.Hwnd)
        command := Format('"{1}" /ErrorStdOut "{2}" {3} {4}', A_AhkPath, A_ScriptDir "\drag-driver.ahk", Round(clientX + hx + hw / 2), Round(clientY + hy + hh / 2))
        Assert(RunWait(command,, "Hide") = 0, "Mouse drag driver completed")
        Sleep(120)
        WinGetPos(&movedX, &movedY,,, "ahk_id " App.window.Hwnd)
        Assert(Abs(movedX - oldX - 60) <= 4 && Abs(movedY - oldY - 35) <= 4, "Header still moves the panel by mouse")
        Assert(FileExist(configFile) && App.customPosition, "Moved position saved")
        Assert(Integer(IniRead(configFile, "Panel", "X")) = movedX && Integer(IniRead(configFile, "Panel", "Y")) = movedY, "INI position matches actual window")
        Assert(!InStr(FileRead(configFile), "Merhaba"), "Only coordinates are written to settings")
        restored := DikteApp(true, configFile)
        restored.ShowPanel()
        WinGetPos(&rx, &ry,,, "ahk_id " restored.window.Hwnd)
        Assert(Abs(rx - movedX) <= 2 && Abs(ry - movedY) <= 2, "Saved position restored by new instance")
        restored.editor.Value := "Konum sıfırlansa da metin kalır."
        restored.ResetPosition()
        Assert(!restored.customPosition && restored.editor.Value != "", "Reset position retains draft")
        restored.Dispose()
        try DirDelete(configDir, true)
        ; A separate real app process must terminate, then open normally again.
        launch := Format('"{1}" /ErrorStdOut "{2}"', A_AhkPath, A_ScriptDir "\..\Hizir-Bey-WorkSpaces-Dikte.ahk")
        Run(launch,, "Hide", &childPid)
        childWindow := WinWait("Hızır Bey · Yerel Dikte 0.4.0 ahk_pid " childPid,, 4)
        Assert(childWindow != 0, "Real app opens for close lifecycle test")
        closeHwnd := 0
        for control in WinGetControlsHwnd("ahk_id " childWindow)
            if ControlGetText(control) = "Kapat"
                closeHwnd := control
        Assert(closeHwnd != 0, "Real app exposes top-right close button")
        WinActivate("ahk_id " childWindow)
        WinGetClientPos(&childX, &childY,,, "ahk_id " childWindow)
        ControlGetPos(&cx, &cy, &cw, &ch, closeHwnd)
        Drive("click", childX + cx + cw / 2, childY + cy + ch / 2)
        ProcessWaitClose(childPid, 3)
        Assert(!ProcessExist(childPid), "X terminates its own AutoHotkey process")
        Assert(!WinExist("ahk_id " childWindow), "X removes the native window")
        Run(launch,, "Hide", &reopenedPid)
        reopened := WinWait("Hızır Bey · Yerel Dikte 0.4.0 ahk_pid " reopenedPid,, 4)
        Assert(reopened != 0 && ProcessExist(reopenedPid), "Same application can be reopened after X")
        WinClose("ahk_id " reopened)
        ProcessWaitClose(reopenedPid, 3)
        Assert(!ProcessExist(reopenedPid), "Native close request also terminates process")
        App.Dispose()
        receiver.Destroy()
        Results .= "`n" Passed " checks passed. Actual Windows 11 microphone recognition requires a user session.`n"
        FileOpen(LogFile, "w", "UTF-8").Write(Results)
        ExitApp(0)
    } catch Error as err {
        Results .= "FAIL " err.Message "`n" err.File ":" err.Line "`n" err.Stack "`n"
        FileOpen(LogFile, "w", "UTF-8").Write(Results)
        ExitApp(1)
    }
}
