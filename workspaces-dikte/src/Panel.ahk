; SPDX-License-Identifier: GPL-2.0-or-later
class DikteApp {
    __New(testing := false) {
        this.testing := testing
        this.busy := false
        this.panelOpen := false
        this.paused := false
        this.target := 0
        this.targetPid := 0
        this.lastWorkspace := 0
        this.previousForeground := 0
        this.lastText := ""
        this.pasteIssued := false
        this.voiceRequested := false
        this.changedAt := A_TickCount
        this.delayMs := 1000

        this.window := Gui("+AlwaysOnTop +Resize +MinSize640x480", "Hızır Bey · WorkSpaces Dikte 0.1.0")
        this.window.BackColor := "F3F5FA"
        this.window.MarginX := 24
        this.window.MarginY := 20
        this.window.SetFont("s17 w700 c18233A", "Segoe UI")
        this.heading := this.window.AddText("xm ym w570 h34", "HIZIR BEY  /  SESLİ YAZMA")
        this.window.SetFont("s10 w400 c59647A", "Segoe UI")
        this.hint := this.window.AddText("xm y+6 w590 h36", "Win+H: başlat / bitir ve aktar   ·   Ctrl+Enter: bitir ve aktar")
        this.status := this.window.AddText("xm y+10 w590 h34 c3451B2", "WorkSpaces'te yazı alanına tıkla, ardından Win+H'ye bas.")
        this.window.SetFont("s12 c18233A", "Segoe UI")
        this.editor := this.window.AddEdit("xm y+8 w590 h158 Multi WantTab -WantReturn BackgroundFFFFFF")
        this.editor.OnEvent("Change", ObjBindMethod(this, "TextChanged"))
        this.window.SetFont("s10 c18233A", "Segoe UI")
        this.transferButton := this.window.AddButton("xm y+16 w180 h38", "Bitir ve aktar")
        this.transferButton.OnEvent("Click", (*) => this.Finish())
        this.copyButton := this.window.AddButton("x+8 yp w90 h38", "Kopyala")
        this.copyButton.OnEvent("Click", (*) => this.CopyOnly())
        this.resumeButton := this.window.AddButton("x+8 yp w130 h38", "Dikteye devam")
        this.resumeButton.OnEvent("Click", (*) => this.StartVoice())
        this.hideButton := this.window.AddButton("x+8 yp w90 h38", "Gizle")
        this.hideButton.OnEvent("Click", (*) => this.HidePanel())
        this.restoreButton := this.window.AddButton("xm y+10 w140 h30", "Son metni getir")
        this.restoreButton.OnEvent("Click", (*) => this.RestoreLast())
        this.clearButton := this.window.AddButton("x+8 yp w80 h30", "Temizle")
        this.clearButton.OnEvent("Click", (*) => this.ClearDraft())
        this.delayLabel := this.window.AddText("x+18 yp+5 w155 h24", "Aktarım beklemesi:")
        this.delayControl := this.window.AddDropDownList("x+0 yp-5 w130 Choose2", ["0,5 saniye", "1 saniye", "1,5 saniye", "2,5 saniye"])
        this.delayControl.OnEvent("Change", (*) => this.delayMs := [500, 1000, 1500, 2500][this.delayControl.Value])
        this.footer := this.window.AddText("xm y+14 w590 h30 c59647A", "Metin bu oturumda korunur. Göndermeden önce kontrol et.")
        this.window.OnEvent("Size", ObjBindMethod(this, "Resize"))
        this.window.OnEvent("Close", (*) => this.HidePanel())
        this.window.OnEvent("Escape", (*) => this.HidePanel())
        if !testing {
            A_IconTip := "Hızır Bey · WorkSpaces Dikte | Win+H"
            A_TrayMenu.Delete()
            A_TrayMenu.Add("Paneli aç", (*) => this.ShowPanel())
            A_TrayMenu.Default := "Paneli aç"
            A_TrayMenu.Add("Kısayolu yeniden yakala", (*) => this.Rehook())
            A_TrayMenu.Add("Not Defteri vb. için deneme modu", (*) => this.ToggleTestMode())
            A_TrayMenu.Add("Kısayolları duraklat", (*) => this.TogglePause())
            A_TrayMenu.Add()
            A_TrayMenu.Add("Çıkış", (*) => this.Quit())
            InstallKeybdHook(true, true)
            this.watchTimer := ObjBindMethod(this, "WatchForeground")
            SetTimer(this.watchTimer, 300)
            OnError(ObjBindMethod(this, "OnFailure"))
            this.ShowPanel()
        }
    }

    SetStatus(message) {
        this.status.Text := message
    }

    TextChanged(*) {
        this.changedAt := A_TickCount
    }

    Resize(guiObj, minMax, width, height) {
        if minMax = -1
            return
        wide := Max(590, width - 48)
        this.heading.Move(,, wide)
        this.hint.Move(,, wide)
        this.status.Move(,, wide)
        this.editor.Move(,, wide, Max(158, height - 298))
        y := Max(346, height - 134)
        for control in [this.transferButton, this.copyButton, this.resumeButton, this.hideButton]
            control.Move(, y)
        this.restoreButton.Move(, y + 48)
        this.clearButton.Move(, y + 48)
        ; Keep the lower settings row at a fixed relative location.
        this.delayControl.Move(, y + 48)
        this.delayLabel.Move(, y + 53)
        this.footer.Move(, y + 86, wide)
    }

    ProcessName(hwnd) {
        try return WinGetProcessName("ahk_id " hwnd)
        catch
            return ""
    }

    PanelHasFocus() {
        return this.panelOpen && WinActive("ahk_id " this.window.Hwnd)
    }

    ShouldCapture() {
        if this.paused
            return false
        hwnd := WinExist("A")
        name := this.ProcessName(hwnd)
        if this.PanelHasFocus()
            return true
        if this.panelOpen && StrLower(name) = "textinputhost.exe"
            return true
        return DikteCore.IsAllowedProcess(name, this.testMode)
    }

    testMode := false

    WaitReleased() {
        ; Physical modifiers must be released before injecting native Win+H / Ctrl+V.
        for key in ["h", "Enter", "LWin", "RWin", "LControl", "RControl", "LAlt", "RAlt", "LShift", "RShift"] {
            if !KeyWait(key, "T2") {
                this.SetStatus("Tuşları bırakıp yeniden dene; metnin panelde duruyor.")
                return false
            }
        }
        return true
    }

    CaptureTarget(hwnd) {
        if !hwnd || hwnd = this.window.Hwnd
            return false
        name := this.ProcessName(hwnd)
        if !DikteCore.IsAllowedProcess(name, this.testMode)
            return false
        try {
            this.target := hwnd
            this.targetPid := WinGetPID("ahk_id " hwnd)
            return true
        } catch {
            return false
        }
    }

    Toggle() {
        if this.busy
            return
        active := WinExist("A")
        if this.panelOpen && (this.voiceRequested || this.editor.Value != "") {
            this.Finish()
            return
        }
        if !this.CaptureTarget(active)
            return
        if this.pasteIssued {
            ; A separate recoverable copy survives the start of the next dictation.
            this.lastText := this.editor.Value
            this.editor.Value := ""
            this.pasteIssued := false
        }
        this.ShowPanel()
        this.StartVoice()
    }

    ShowPanel() {
        if !this.panelOpen {
            ; Center in the monitor occupied by the target; this does not resize it.
            hwnd := this.target ? this.target : WinExist("A")
            try {
                WinGetPos(&x, &y, &w, &h, "ahk_id " hwnd)
                this.window.Show("w680 h480 x" Round(x + (w - 680) / 2) " y" Max(0, Round(y + h * 0.14)))
            } catch {
                this.window.Show("w680 h480 Center")
            }
        } else
            this.window.Show()
        this.panelOpen := true
        this.editor.Focus()
    }

    StartVoice() {
        if this.busy
            return
        this.busy := true
        try {
            if !this.target && this.lastWorkspace
                this.CaptureTarget(this.lastWorkspace)
            this.ShowPanel()
            if !this.WaitReleased()
                return
            WinActivate("ahk_id " this.window.Hwnd)
            if !WinWaitActive("ahk_id " this.window.Hwnd,, 2) {
                this.SetStatus("Yerel panel odaklanamadı. Panele tıkla ve Dikteye devam'ı seç.")
                return
            }
            this.editor.Focus()
            Sleep(120)
            if !this.PanelHasFocus()
                return
            ; Hook hotkeys ignore this script's level-0 synthetic events.
            SendLevel(0)
            SendEvent("#h")
            this.voiceRequested := true
            this.SetStatus("Windows çubuğunda 'Dinleniyor' görünce konuş. Bitince Win+H / Ctrl+Enter.")
        } finally {
            this.busy := false
        }
    }

    StopLocalVoice() {
        WinActivate("ahk_id " this.window.Hwnd)
        if !WinWaitActive("ahk_id " this.window.Hwnd,, 2)
            return false
        this.editor.Focus()
        SendLevel(0)
        SendEvent("{Escape}")
        this.voiceRequested := false
        return true
    }

    Finish() {
        if this.busy
            return
        this.busy := true
        try {
            if !this.WaitReleased() || !this.StopLocalVoice()
                return
            this.SetStatus("Son kelimeler bekleniyor…")
            started := A_TickCount
            settled := false
            while A_TickCount - started < 5000 {
                Sleep(60)
                if DikteCore.IsSettled(A_TickCount, started, this.changedAt) {
                    settled := true
                    break
                }
            }
            if !settled {
                this.SetStatus("Metin hâlâ değişiyor. Windows diktesini kapatıp yeniden aktar.")
                return
            }
            text := DikteCore.ChatText(this.editor.Value)
            if text = "" {
                this.SetStatus("Henüz metin oluşmadı. Dikteye devam ile yeniden dene.")
                return
            }
            this.lastText := this.editor.Value
            if !this.PutClipboard(text)
                return
            if !this.TargetExists() {
                this.SetStatus("Hedef pencere yok. Metin kopyalandı; doğru alana Ctrl+V ile yapıştır.")
                return
            }
            this.window.Hide()
            this.panelOpen := false
            WinActivate("ahk_id " this.target)
            if !WinWaitActive("ahk_id " this.target,, 2) {
                this.ShowPanel()
                this.SetStatus("WorkSpaces'e odaklanamadım. Metin kopyalı; doğru alana Ctrl+V yap.")
                return
            }
            Sleep(this.delayMs)
            foreground := WinExist("A")
            foregroundPid := foreground ? WinGetPID("ahk_id " foreground) : 0
            if !DikteCore.CanPaste(text, this.target, this.targetPid, foreground, foregroundPid)
                || A_Clipboard != text || !this.ModifiersReleased() {
                this.ShowPanel()
                this.SetStatus("Odak, pano veya tuş durumu değişti. Metin duruyor; yeniden aktarabilirsin.")
                return
            }
            ; Exactly one paste. Remote field delivery cannot be acknowledged locally.
            ; Keep the clipboard for delayed WorkSpaces sync; never restore it on a timer.
            SendLevel(0)
            SendEvent("^v")
            this.pasteIssued := true
            this.SetStatus("Yapıştırma istendi. Yeni dikte için WorkSpaces'te Win+H; gerekirse Son metni getir.")
        } catch Error as err {
            this.ShowPanel()
            this.SetStatus("Aktarım tamamlanamadı; metnin panelde duruyor. Kopyala ile devam edebilirsin.")
        } finally {
            this.busy := false
        }
    }

    TargetExists() {
        try return this.target && WinExist("ahk_id " this.target)
            && WinGetPID("ahk_id " this.target) = this.targetPid
        catch
            return false
    }

    ModifiersReleased() {
        for key in ["LWin", "RWin", "LControl", "RControl", "LAlt", "RAlt", "LShift", "RShift"]
            if GetKeyState(key, "P")
                return false
        return true
    }

    PutClipboard(text) {
        try {
            A_Clipboard := text
            if ClipWait(1) && A_Clipboard = text
                return true
        }
        this.SetStatus("Panoya erişilemedi. Metin duruyor; biraz sonra yeniden dene.")
        return false
    }

    CopyOnly() {
        if this.busy
            return
        text := DikteCore.ChatText(this.editor.Value)
        if text != "" && this.PutClipboard(text) {
            this.lastText := this.editor.Value
            this.SetStatus("Kopyalandı. WorkSpaces'te doğru yazı alanına Ctrl+V ile yapıştır.")
        }
    }

    HidePanel() {
        if this.busy
            return
        this.busy := true
        try {
            this.StopLocalVoice()
            this.window.Hide()
            this.panelOpen := false
        } finally {
            this.busy := false
        }
    }

    RestoreLast() {
        if this.busy || this.lastText = ""
            return
        if this.editor.Value != "" && this.editor.Value != this.lastText
            && MsgBox("Mevcut taslak son metinle değiştirilsin mi?", "Son metni getir", "YesNo Icon?") != "Yes"
            return
        this.editor.Value := this.lastText
        this.pasteIssued := false
        this.SetStatus("Son metin getirildi. Kopyalayabilir veya yeniden aktarabilirsin.")
    }

    ClearDraft() {
        if this.busy || this.editor.Value = ""
            return
        if MsgBox("Paneldeki taslak temizlensin mi?", "Taslağı temizle", "YesNo Icon?") = "Yes" {
            this.lastText := this.editor.Value
            this.editor.Value := ""
            this.pasteIssued := false
        }
    }

    WatchForeground() {
        if this.busy || this.paused
            return
        hwnd := WinExist("A")
        if hwnd = this.previousForeground
            return
        this.previousForeground := hwnd
        if DikteCore.IsWorkspacesProcess(this.ProcessName(hwnd)) {
            this.lastWorkspace := hwnd
            ; WorkSpaces may install its own hook on activation. Retake precedence once.
            InstallKeybdHook(true, true)
        }
    }

    Rehook() {
        InstallKeybdHook(true, true)
        this.SetStatus("Kısayol yenilendi. WorkSpaces'e dönüp Win+H veya Ctrl+Alt+H dene.")
    }

    ToggleTestMode() {
        this.testMode := !this.testMode
        A_TrayMenu.ToggleCheck("Not Defteri vb. için deneme modu")
        this.SetStatus(this.testMode ? "Deneme modu açık: diğer uygulamalarda da Win+H yakalanır." : "Win+H yalnız WorkSpaces ve bu panelde yakalanır.")
    }

    TogglePause() {
        this.paused := !this.paused
        A_TrayMenu.ToggleCheck("Kısayolları duraklat")
        this.SetStatus(this.paused ? "Kısayollar duraklatıldı. Sağ alttaki simgeden sürdürebilirsin." : "Kısayollar etkin. WorkSpaces'te Win+H kullanabilirsin.")
    }

    Quit() {
        if this.editor.Value != "" && !this.pasteIssued
            && MsgBox("Taslak yalnız bu oturumda tutuluyor. Yine de çıkılsın mı?", "Hızır Bey", "YesNo Icon?") != "Yes"
            return
        ExitApp()
    }

    OnFailure(err, mode) {
        this.busy := false
        try this.ShowPanel()
        try this.SetStatus("İşlem tamamlanamadı. Metin panelde duruyor; Kopyala ile devam et.")
        return true
    }
}
