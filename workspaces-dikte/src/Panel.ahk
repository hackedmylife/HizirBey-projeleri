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
        this.bridgeSession := ""
        this.bridgeTimeout := testing ? 150 : 6000
        this.dockTarget := -1

        this.window := Gui("+AlwaysOnTop -Caption +ToolWindow +Border -DPIScale", "Hızır Bey · WorkSpaces Dikte 0.2.0")
        this.window.BackColor := "F3F5FA"
        this.window.SetFont("s9 w700 c27375C", "Segoe UI")
        this.heading := this.window.AddText("x8 y7 w100 h18", "HIZIR BEY")
        this.window.SetFont("s8 w400 c3451B2", "Segoe UI")
        this.status := this.window.AddText("x110 y7 w250 h18", "LiveChat'i seç ve Win+H'ye bas.")
        this.window.SetFont("s10 c18233A", "Segoe UI")
        this.editor := this.window.AddEdit("x8 y31 w750 h42 Multi WantTab -WantReturn BackgroundFFFFFF")
        this.editor.OnEvent("Change", ObjBindMethod(this, "TextChanged"))
        this.window.SetFont("s8 c18233A", "Segoe UI")
        this.transferButton := this.window.AddButton("x550 y3 w110 h25", "Bitir ve aktar")
        this.transferButton.OnEvent("Click", (*) => this.Finish())
        this.copyButton := this.window.AddButton("x666 y3 w70 h25", "Kopyala")
        this.copyButton.OnEvent("Click", (*) => this.CopyOnly())
        this.resumeButton := this.window.AddButton("x330 y77 w62 h21", "Devam")
        this.resumeButton.OnEvent("Click", (*) => this.StartVoice())
        this.hideButton := this.window.AddButton("x742 y3 w24 h25", "×")
        this.hideButton.OnEvent("Click", (*) => this.HidePanel())
        this.restoreButton := this.window.AddButton("x398 y77 w76 h21", "Son metin")
        this.restoreButton.OnEvent("Click", (*) => this.RestoreLast())
        this.clearButton := this.window.AddButton("x480 y77 w62 h21", "Temizle")
        this.clearButton.OnEvent("Click", (*) => this.ClearDraft())
        this.footer := this.window.AddText("x8 y80 w310 h17 c59647A", "Win+H / Ctrl+Enter · Metin önce bu kutuda yazılır.")
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
            A_TrayMenu.Add("Aktarım beklemesi: 1 saniye", (*) => this.CycleDelay())
            A_TrayMenu.Add()
            A_TrayMenu.Add("Çıkış", (*) => this.Quit())
            InstallKeybdHook(true, true)
            this.watchTimer := ObjBindMethod(this, "WatchForeground")
            SetTimer(this.watchTimer, 300)
            OnError(ObjBindMethod(this, "OnFailure"))
            OnMessage(0x0201, ObjBindMethod(this, "DragPanel"))
            this.ShowPanel()
        }
    }

    SetStatus(message) {
        this.status.Text := message
        this.footer.Text := "Win+H / Ctrl+Enter · Gönderim sende."
    }

    TextChanged(*) {
        this.changedAt := A_TickCount
    }

    Resize(guiObj, minMax, width, height) {
        if minMax = -1
            return
        this.status.Move(,, Max(130, width - 330))
        this.editor.Move(,, width - 16, 42)
        this.transferButton.Move(width - 214, 3)
        this.copyButton.Move(width - 98, 3)
        this.hideButton.Move(width - 24, 3)
        this.resumeButton.Move(width - 220, 77)
        this.restoreButton.Move(width - 152, 77)
        this.clearButton.Move(width - 70, 77)
        this.footer.Move(,, Max(250, width - 240))
    }

    DragPanel(wParam, lParam, msg, hwnd) {
        if hwnd = this.heading.Hwnd || hwnd = this.status.Hwnd
            PostMessage(0xA1, 2,,, "ahk_id " this.window.Hwnd)
    }

    CycleDelay() {
        oldLabel := "Aktarım beklemesi: " (this.delayMs = 1000 ? "1 saniye" : "2,5 saniye")
        this.delayMs := this.delayMs = 1000 ? 2500 : 1000
        A_TrayMenu.Rename(oldLabel, "Aktarım beklemesi: " (this.delayMs = 1000 ? "1 saniye" : "2,5 saniye"))
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
        if this.panelOpen && !this.pasteIssued && (this.voiceRequested || this.editor.Value != "") {
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
            this.bridgeSession := ""
        }
        this.ShowPanel()
        this.StartVoice()
    }

    ShowPanel(activate := true) {
        if this.dockTarget != this.target {
            hwnd := this.target ? this.target : WinExist("A")
            try {
                WinGetPos(&x, &y, &w, &h, "ahk_id " hwnd)
                if w < 1000
                    x := 0, y := 0, w := A_ScreenWidth, h := A_ScreenHeight
            } catch {
                x := 0, y := 0, w := A_ScreenWidth, h := A_ScreenHeight
            }
            box := DikteCore.DockBounds(x, y, w, h)
            this.window.Show("w" box.w " h" box.h " x" box.x " y" box.y (activate ? "" : " NA"))
            this.dockTarget := this.target
        } else
            this.window.Show(activate ? "" : "NA")
        this.panelOpen := true
        if activate
            this.editor.Focus()
    }

    StartVoice() {
        if this.busy
            return
        this.busy := true
        try {
            if !this.target && this.lastWorkspace
                this.CaptureTarget(this.lastWorkspace)
            if this.RequiresBridge() && this.bridgeSession = "" {
                if !this.WaitReleased()
                    return
                WinActivate("ahk_id " this.target)
                if !WinWaitActive("ahk_id " this.target,, 2) || !this.RequestBridge(false) {
                    this.ShowPanel()
                    this.SetStatus("Köprü hazır değil. WorkSpaces Chrome'unda köprüyü yükle / yenile.")
                    return
                }
            }
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
            this.SetStatus("Dinleniyor yazınca konuş · Bitir: Win+H / Ctrl+Enter")
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
            if !this.TargetExists() {
                this.PutClipboard(text)
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
            bridge := this.RequiresBridge()
            if bridge && (this.bridgeSession = "" || !this.RequestBridge(true)) {
                this.ShowPanel()
                this.SetStatus("LiveChat hedefi doğrulanamadı. Taslak burada; köprüyü kontrol et.")
                return
            }
            if !this.PutClipboard(text) {
                this.ShowPanel()
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
            if bridge && !this.WaitBridge("DONE", this.bridgeSession) {
                this.ShowPanel()
                this.SetStatus("Onay gelmedi. Taslak korundu; LiveChat'i kontrol et.")
                return
            }
            this.pasteIssued := true
            if bridge
                this.PutClipboard(text)
            this.ShowPanel(false)
            this.SetStatus(bridge ? "LiveChat yazı alanına aktarıldı · Gönderim sende." : "Metin yapıştırıldı · Yeni dikte: Win+H.")
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

    RequiresBridge() {
        return this.target && DikteCore.IsWorkspacesProcess(this.ProcessName(this.target))
    }

    RequestBridge(arm := false) {
        if !this.PutClipboard("HB-DIKTE-WAIT-" A_TickCount)
            return false
        SendLevel(0)
        SendEvent("^+y")
        return this.WaitBridge("READY", arm ? this.bridgeSession : "", arm)
    }

    WaitBridge(kind, expectedId := "", arm := false) {
        started := A_TickCount
        while A_TickCount - started < this.bridgeTimeout {
            Sleep(60)
            try signal := DikteCore.BridgeSignal(A_Clipboard)
            catch
                continue
            if signal.kind = ""
                continue
            if signal.kind = "ERROR" || (expectedId != "" && signal.id != expectedId)
                return false
            if signal.kind != kind
                continue
            if kind = "READY" {
                if !InStr("|prepared|armed|", "|" signal.detail "|") || (arm && signal.detail != "armed")
                    return false
                this.bridgeSession := signal.id
            }
            return true
        }
        return false
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
