; SPDX-License-Identifier: GPL-2.0-or-later
class DikteApp {
    __New(testing := false, settingsPath := "") {
        this.testing := testing
        this.busy := false
        this.panelOpen := false
        this.voiceRequested := false
        this.previousForeground := 0
        this.positioned := false
        this.customPosition := false
        this.lastCopiedText := ""
        this.finalizePending := false
        this.changedAt := A_TickCount
        this.finalizeCallback := ObjBindMethod(this, "FinalizeStoppedText")
        this.settingsPath := settingsPath != "" ? settingsPath : (testing ? "" : EnvGet("LOCALAPPDATA") "\HizirBey\WorkSpacesDikte\panel.ini")
        this.LoadPosition()

        this.window := Gui("+AlwaysOnTop -Caption +ToolWindow -Border -DPIScale", "Hızır Bey · Yerel Dikte 0.4.0")
        this.window.BackColor := "101217"
        this.logo := this.window.AddPicture("x10 y12 w56 h-1 +0x100", A_ScriptDir "\assets\logo.png")
        this.window.SetFont("s7 w500 c9AA4B5", "Segoe UI")
        this.brandCaption := this.window.AddText("x9 y73 w56 h14 Center +0x100", "SES → YAZI")
        this.window.SetFont("s9 w600 cD7BA76", "Segoe UI")
        this.heading := this.window.AddText("x86 y9 w130 h20 +0x100", "YEREL DİKTE  ↔")
        this.window.SetFont("s8 w400 cACB4C3", "Segoe UI")
        this.status := this.window.AddText("x230 y11 w400 h17 +0x100", "Hazır · Win+H / Ctrl+C")
        this.window.SetFont("s11 w400 cF4F2EC", "Segoe UI")
        this.editor := this.window.AddEdit("x90 y40 w570 h44 Multi WantTab -WantReturn -Border -E0x200 -VScroll Background181B22")
        SendMessage(0xD3, 3, 0, this.editor.Hwnd)
        this.editor.OnEvent("Change", ObjBindMethod(this, "TextChanged"))
        this.window.SetFont("s11 w600 c17191E", "Segoe UI")
        this.toggleButton := this.window.AddButton("x600 y8 w160 h40 -TabStop -Theme +0xB", "Başlat")
        this.toggleButton.OnEvent("Click", (*) => this.Toggle())
        this.copyButton := this.window.AddButton("x600 y52 w160 h40 -TabStop -Theme +0xB", "Kopyala")
        this.copyButton.OnEvent("Click", (*) => this.CopyOnly())
        this.closeButton := this.window.AddButton("x900 y8 w24 h24 -TabStop -Theme +0xB", "Kapat")
        this.closeButton.OnEvent("Click", (*) => this.Quit())
        this.theme := DikteTheme(this)
        this.window.OnEvent("Size", ObjBindMethod(this, "Resize"))
        this.window.OnEvent("Close", (*) => this.Quit())
        this.window.OnEvent("Escape", (*) => this.MarkStopped())
        this.dragCallback := ObjBindMethod(this, "DragPanel")
        this.moveCallback := ObjBindMethod(this, "MovedPanel")
        OnMessage(0x0201, this.dragCallback)
        OnMessage(0x0232, this.moveCallback)
        if !testing {
            TraySetIcon(A_ScriptDir "\assets\hizirbey.ico")
            A_IconTip := "Hızır Bey · Yerel Dikte | Win+H · Ctrl+C"
            A_TrayMenu.Delete()
            A_TrayMenu.Add("Paneli aç", (*) => this.ShowPanel())
            A_TrayMenu.Default := "Paneli aç"
            A_TrayMenu.Add("Kısayolu yeniden yakala", (*) => this.Rehook())
            A_TrayMenu.Add("Konumu sıfırla", (*) => this.ResetPosition())
            A_TrayMenu.Add()
            A_TrayMenu.Add("Çıkış", (*) => this.Quit())
            InstallKeybdHook(true, true)
            this.watchTimer := ObjBindMethod(this, "WatchForeground")
            SetTimer(this.watchTimer, 300)
            this.errorCallback := ObjBindMethod(this, "OnFailure")
            OnError(this.errorCallback)
            this.ShowPanel()
        }
    }

    SetStatus(message) {
        this.status.Text := message
        this.status.SetFont(this.voiceRequested ? "c9CD5B3" : "cACB4C3")
        this.theme.Refresh()
    }

    Resize(guiObj, minMax, width, height) {
        if minMax = -1
            return
        this.status.Move(,, Max(120, width - 442))
        this.editor.Move(,, width - 312, 44)
        this.toggleButton.Move(width - 202, 8, 160, 40)
        this.copyButton.Move(width - 202, 52, 160, 40)
        this.closeButton.Move(width - 30, 8, 24, 24)
        this.theme.Resize(width, height)
    }

    DragPanel(wParam, lParam, msg, hwnd) {
        if hwnd = this.heading.Hwnd || hwnd = this.status.Hwnd || hwnd = this.window.Hwnd || hwnd = this.logo.Hwnd || hwnd = this.brandCaption.Hwnd {
            DllCall("ReleaseCapture")
            PostMessage(0xA1, 2,,, "ahk_id " this.window.Hwnd)
            return 0
        }
    }

    MovedPanel(wParam, lParam, msg, hwnd) {
        if hwnd != this.window.Hwnd
            return
        WinGetPos(&x, &y,,, "ahk_id " this.window.Hwnd)
        this.savedX := x, this.savedY := y
        this.customPosition := true
        this.SavePosition()
    }

    LoadPosition() {
        if this.settingsPath = "" || !FileExist(this.settingsPath)
            return
        try {
            x := IniRead(this.settingsPath, "Panel", "X", "")
            y := IniRead(this.settingsPath, "Panel", "Y", "")
            if RegExMatch(x, "^-?\d+$") && RegExMatch(y, "^-?\d+$") {
                this.savedX := Integer(x), this.savedY := Integer(y)
                this.customPosition := true
            }
        }
    }

    SavePosition() {
        if this.settingsPath = "" || !this.customPosition
            return
        try {
            SplitPath(this.settingsPath,, &directory)
            DirCreate(directory)
            IniWrite(this.savedX, this.settingsPath, "Panel", "X")
            IniWrite(this.savedY, this.settingsPath, "Panel", "Y")
        }
    }

    PositionVisible(x, y, width, height) {
        Loop MonitorGetCount() {
            MonitorGetWorkArea(A_Index, &left, &top, &right, &bottom)
            if Min(x + width, right) - Max(x, left) >= 100
                && Min(y + height, bottom) - Max(y, top) >= 30
                return true
        }
        return false
    }

    ResetPosition() {
        this.customPosition := false
        if this.settingsPath != "" && FileExist(this.settingsPath)
            try IniDelete(this.settingsPath, "Panel")
        this.positioned := false
        this.ShowPanel()
    }

    Dispose() {
        SetTimer(this.finalizeCallback, 0)
        this.theme.Dispose()
        OnMessage(0x0201, this.dragCallback, 0)
        OnMessage(0x0232, this.moveCallback, 0)
        if this.HasOwnProp("watchTimer")
            SetTimer(this.watchTimer, 0)
        if this.HasOwnProp("errorCallback")
            OnError(this.errorCallback, 0)
        this.window.Destroy()
    }

    ProcessName(hwnd) {
        try return WinGetProcessName("ahk_id " hwnd)
        catch
            return ""
    }

    FocusEditor() {
        if DllCall("GetFocus", "Ptr") = this.editor.Hwnd
            return
        start := Buffer(4, 0), finish := Buffer(4, 0)
        SendMessage(0xB0, start.Ptr, finish.Ptr, this.editor.Hwnd)
        this.editor.Focus()
        SendMessage(0xB1, NumGet(start, 0, "UInt"), NumGet(finish, 0, "UInt"), this.editor.Hwnd)
    }

    PanelHasFocus() {
        return this.panelOpen && WinActive("ahk_id " this.window.Hwnd)
    }

    VoiceToolbarHasFocus() {
        return this.panelOpen && this.voiceRequested
            && StrLower(this.ProcessName(WinExist("A"))) = "textinputhost.exe"
    }

    ShouldCapture() {
        return this.PanelHasFocus() || this.VoiceToolbarHasFocus()
            || DikteCore.IsWorkspacesProcess(this.ProcessName(WinExist("A")))
    }

    ShouldCopy() {
        ; Other applications keep their own Ctrl+C, even while the panel is open.
        return this.PanelHasFocus() || this.VoiceToolbarHasFocus()
    }

    WaitReleased() {
        for key in ["h", "LWin", "RWin", "LControl", "RControl", "LAlt", "RAlt", "LShift", "RShift"] {
            if !KeyWait(key, "T2") {
                this.SetStatus("Tuşları bırakıp yeniden dene; metin burada.")
                return false
            }
        }
        return true
    }

    Toggle() {
        if this.busy
            return
        if this.voiceRequested
            this.StopVoice()
        else
            this.StartVoice()
    }

    ShowPanel(activate := true) {
        if !this.positioned {
            try {
                WinGetPos(&x, &y, &w, &h, "A")
                if w < 1000
                    x := 0, y := 0, w := A_ScreenWidth, h := A_ScreenHeight
            } catch {
                x := 0, y := 0, w := A_ScreenWidth, h := A_ScreenHeight
            }
            box := DikteCore.DockBounds(x, y, w, h)
            if this.customPosition && this.PositionVisible(this.savedX, this.savedY, box.w, box.h)
                box.x := this.savedX, box.y := this.savedY
            this.window.Show("w" box.w " h" box.h " x" box.x " y" box.y (activate ? "" : " NA"))
            this.positioned := true
        } else
            this.window.Show(activate ? "" : "NA")
        this.panelOpen := true
        if activate
            this.FocusEditor()
    }

    StartVoice() {
        if this.busy || this.voiceRequested
            return
        this.busy := true
        try {
            this.finalizePending := false
            SetTimer(this.finalizeCallback, 0)
            this.ShowPanel()
            if !this.WaitReleased()
                return
            WinActivate("ahk_id " this.window.Hwnd)
            if !WinWaitActive("ahk_id " this.window.Hwnd,, 2) {
                this.SetStatus("Paneli odaklayıp Başlat'a bas.")
                return
            }
            this.FocusEditor()
            Sleep(120)
            if !this.PanelHasFocus()
                return
            this.RequestNativeVoice()
            this.voiceRequested := true
            this.toggleButton.Text := "Durdur"
            this.SetStatus("Dikte açık · Ctrl+C: kopyala")
        } finally {
            this.busy := false
        }
    }

    RequestNativeVoice() {
        SendLevel(0)
        SendEvent("#h")
    }

    RequestNativeStop() {
        SendLevel(0)
        SendEvent("{Escape}")
    }

    TextChanged(*) {
        this.changedAt := A_TickCount
    }

    MarkStopped() {
        wasListening := this.voiceRequested
        this.voiceRequested := false
        this.toggleButton.Text := "Başlat"
        if wasListening {
            this.finalizePending := true
            this.stoppedAt := A_TickCount
            SetTimer(this.finalizeCallback, -120)
        }
        this.SetStatus("Durduruldu · Metin burada")
    }

    FinalizeStoppedText() {
        if !this.finalizePending || this.voiceRequested
            return
        if A_TickCount - this.stoppedAt < 700 || A_TickCount - this.changedAt < 450 {
            if A_TickCount - this.stoppedAt < 4000
                SetTimer(this.finalizeCallback, -120)
            else
                this.finalizePending := false
            return
        }
        this.finalizePending := false
        raw := this.editor.Value
        text := DikteCore.FinalizeText(raw)
        if text != raw {
            start := Buffer(4, 0), finish := Buffer(4, 0)
            SendMessage(0xB0, start.Ptr, finish.Ptr, this.editor.Hwnd)
            left := NumGet(start, 0, "UInt"), right := NumGet(finish, 0, "UInt")
            if left = right && right = StrLen(raw)
                left := StrLen(text), right := left
            SendMessage(0xB1, 0, -1, this.editor.Hwnd)
            SendMessage(0xC2, 1, StrPtr(text), this.editor.Hwnd)
            SendMessage(0xB1, left, right, this.editor.Hwnd)
            if this.lastCopiedText = raw
                this.lastCopiedText := text
        }
        this.SetStatus("Hazır · Cümle sonları tamamlandı")
    }

    StopVoice() {
        if this.busy || !this.voiceRequested
            return
        this.busy := true
        try {
            this.ShowPanel()
            if !this.WaitReleased()
                return
            if !WinWaitActive("ahk_id " this.window.Hwnd,, 2)
                return
            this.FocusEditor()
            this.RequestNativeStop()
            this.MarkStopped()
        } finally {
            this.busy := false
        }
    }

    CopyOnly() {
        ; Snapshot immediately; no stop, wait for silence, or selection change.
        raw := this.editor.Value
        text := DikteCore.FinalizeText(raw)
        if !DikteCore.HasText(text) {
            this.SetStatus("Kopyalanacak metin yok.")
            if this.PanelHasFocus() && DllCall("GetFocus", "Ptr") != this.editor.Hwnd
                this.FocusEditor()
            return false
        }
        try {
            A_Clipboard := text
            if !ClipWait(1) || A_Clipboard != text
                throw Error("clipboard")
            this.lastCopiedText := raw
            this.SetStatus(this.voiceRequested ? "Kopyalandı · Dikte sürüyor" : "Kopyalandı · Metin burada")
            return true
        } catch {
            this.SetStatus("Panoya erişilemedi. Metin burada; yeniden Kopyala'ya bas.")
            return false
        } finally {
            if this.PanelHasFocus() && DllCall("GetFocus", "Ptr") != this.editor.Hwnd
                this.FocusEditor()
        }
    }

    WatchForeground() {
        if this.busy
            return
        hwnd := WinExist("A")
        if hwnd = this.previousForeground
            return
        this.previousForeground := hwnd
        if DikteCore.IsWorkspacesProcess(this.ProcessName(hwnd))
            InstallKeybdHook(true, true)
    }

    Rehook() {
        InstallKeybdHook(true, true)
        this.SetStatus("Kısayol yenilendi · Win+H / Ctrl+Alt+H")
    }

    Quit() {
        ; Close this application, including its keyboard hook and tray process.
        ; Never terminate AutoHotkey by process name: other macros may use it.
        if this.voiceRequested {
            try this.FocusEditor()
            try this.RequestNativeStop()
        }
        try this.Dispose()
        ExitApp(0)
    }

    OnFailure(err, mode) {
        this.busy := false
        try this.ShowPanel()
        try this.SetStatus("İşlem tamamlanamadı. Metin kutuda korunuyor.")
        return true
    }
}
