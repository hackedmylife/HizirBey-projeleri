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
        this.settingsPath := settingsPath != "" ? settingsPath : (testing ? "" : EnvGet("LOCALAPPDATA") "\HizirBey\WorkSpacesDikte\panel.ini")
        this.LoadPosition()

        this.window := Gui("+AlwaysOnTop -Caption +ToolWindow +Border -DPIScale", "Hızır Bey · Yerel Dikte 0.3.0")
        this.window.BackColor := "F3F5FA"
        this.window.SetFont("s10 w700 c27375C", "Segoe UI")
        this.heading := this.window.AddText("x10 y6 w130 h22 +0x100", "HIZIR BEY  ↔")
        this.window.SetFont("s8 w400 c3451B2", "Segoe UI")
        this.status := this.window.AddText("x148 y9 w400 h18 +0x100", "Hazır · Win+H: başlat/durdur · Ctrl+C: kopyala")
        this.window.SetFont("s11 c18233A", "Segoe UI")
        this.editor := this.window.AddEdit("x10 y32 w570 h58 Multi WantTab -WantReturn BackgroundFFFFFF")
        this.window.SetFont("s14 w600 c18233A", "Segoe UI")
        this.toggleButton := this.window.AddButton("x600 y8 w160 h40 -TabStop", "Başlat")
        this.toggleButton.OnEvent("Click", (*) => this.Toggle())
        this.copyButton := this.window.AddButton("x600 y52 w160 h40 -TabStop", "Kopyala")
        this.copyButton.OnEvent("Click", (*) => this.CopyOnly())
        this.window.OnEvent("Size", ObjBindMethod(this, "Resize"))
        this.window.OnEvent("Close", (*) => this.HidePanel())
        this.window.OnEvent("Escape", (*) => this.MarkStopped())
        this.dragCallback := ObjBindMethod(this, "DragPanel")
        this.moveCallback := ObjBindMethod(this, "MovedPanel")
        OnMessage(0x0201, this.dragCallback)
        OnMessage(0x0232, this.moveCallback)
        if !testing {
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
    }

    Resize(guiObj, minMax, width, height) {
        if minMax = -1
            return
        this.status.Move(,, Max(120, width - 330))
        this.editor.Move(,, width - 190, 58)
        this.toggleButton.Move(width - 170, 8, 160, 40)
        this.copyButton.Move(width - 170, 52, 160, 40)
    }

    DragPanel(wParam, lParam, msg, hwnd) {
        if hwnd = this.heading.Hwnd || hwnd = this.status.Hwnd || hwnd = this.window.Hwnd {
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
            this.SetStatus("Windows'ta Dinleniyor yazınca konuş · Ctrl+C: kopyala")
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

    MarkStopped() {
        this.voiceRequested := false
        this.toggleButton.Text := "Başlat"
        this.SetStatus("Durduruldu · Metin kutuda bekliyor · Ctrl+C: kopyala")
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
        text := this.editor.Value
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
            this.lastCopiedText := text
            this.SetStatus(this.voiceRequested ? "Kopyalandı · Dikte devam ediyor." : "Kopyalandı · Metin burada bekliyor.")
            return true
        } catch {
            this.SetStatus("Panoya erişilemedi. Metin burada; yeniden Kopyala'ya bas.")
            return false
        } finally {
            if this.PanelHasFocus() && DllCall("GetFocus", "Ptr") != this.editor.Hwnd
                this.FocusEditor()
        }
    }

    HidePanel() {
        if this.busy
            return
        if this.voiceRequested
            this.StopVoice()
        this.window.Hide()
        this.panelOpen := false
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
        if DikteCore.HasText(this.editor.Value) && this.editor.Value != this.lastCopiedText
            && MsgBox("Kopyalanmamış metin var. Yine de çıkılsın mı?", "Hızır Bey", "YesNo Icon?") != "Yes"
            return
        ExitApp()
    }

    OnFailure(err, mode) {
        this.busy := false
        try this.ShowPanel()
        try this.SetStatus("İşlem tamamlanamadı. Metin kutuda korunuyor.")
        return true
    }
}
