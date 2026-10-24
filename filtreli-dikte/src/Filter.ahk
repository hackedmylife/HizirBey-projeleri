; Project additions: GPL-3.0-or-later. Base panel retains its original license.
class FilteredDikteApp extends DikteApp {
    __New(testing := false, settingsPath := "") {
        super.__New(testing, settingsPath)
        this.window.Title := "Hızır Bey · Filtreli Dikte 0.1.0"
        this.heading.Text := "FİLTRELİ DİKTE ↔"
        if !testing {
            this.filter := FilterManager(this)
            A_TrayMenu.Insert("Çıkış", "Filtre ayarları", (*) => this.filter.Settings())
            A_TrayMenu.Insert("Çıkış", "VB-CABLE kurulum sayfası", (*) => Run("https://vb-audio.com/Cable/"))
            this.SetStatus("Filtre ayarları · Sonra Başlat")
            if FileExist(this.filter.root "\ready.txt") && FileExist(this.filter.root "\config.ini")
                try this.filter.Launch("serve")
        }
    }
    Toggle() {
        if this.HasOwnProp("filter")
            this.filter.Toggle()
        else
            super.Toggle()
    }
    StopVoice() {
        if this.HasOwnProp("filter")
            this.filter.Stop()
        else
            super.StopVoice()
    }
    MarkStopped() {
        super.MarkStopped()
        if this.HasOwnProp("filter") && this.filter.wanted && !this.filter.pendingStop
            this.filter.Cancel()
    }
    OnFailure(err, mode) {
        this.busy := false
        if this.HasOwnProp("filter")
            try this.filter.Fail("İşlem tamamlanamadı; filtre durduruldu")
        return true
    }
    Dispose() {
        if this.HasOwnProp("filter")
            this.filter.Close()
        super.Dispose()
    }
}

class FilterManager {
    __New(app, root := "", cache := "") {
        this.app := app
        this.root := root != "" ? root : EnvGet("LOCALAPPDATA") "\HizirBey\FiltreliDikte\0.1.0"
        this.cache := cache != "" ? cache : EnvGet("LOCALAPPDATA") "\HizirBey\CpuSesTesti\0.1.0"
        this.process := false, this.mode := "", this.seq := 0
        this.pendingStart := false, this.pendingStop := false, this.wanted := false
        this.configured := false, this.lastMessage := "", this.closed := false
        this.Install()
        this.poll := ObjBindMethod(this, "Poll")
        SetTimer(this.poll, 200)
    }

    Install() {
        DirCreate(this.root "\engine\resemblyzer")
        DirCreate(this.root "\licenses")
        if !A_IsCompiled {
            SplitPath(A_LineFile,, &source)
            for path in ["bootstrap.ps1", "engine\worker.py", "engine\service.py", "engine\dsp.py", "engine\resemblyzer\__init__.py", "engine\resemblyzer\audio.py", "engine\resemblyzer\hparams.py", "engine\resemblyzer\voice_encoder.py", "licenses\Resemblyzer-APACHE.txt", "README.md", "NOTICE.txt"]
                FileCopy(source "\..\" path, this.root "\" path, 1)
            return
        }
        FileInstall "bootstrap.ps1", this.root "\bootstrap.ps1", 1
        FileInstall "engine\worker.py", this.root "\engine\worker.py", 1
        FileInstall "engine\service.py", this.root "\engine\service.py", 1
        FileInstall "engine\dsp.py", this.root "\engine\dsp.py", 1
        FileInstall "engine\resemblyzer\__init__.py", this.root "\engine\resemblyzer\__init__.py", 1
        FileInstall "engine\resemblyzer\audio.py", this.root "\engine\resemblyzer\audio.py", 1
        FileInstall "engine\resemblyzer\hparams.py", this.root "\engine\resemblyzer\hparams.py", 1
        FileInstall "engine\resemblyzer\voice_encoder.py", this.root "\engine\resemblyzer\voice_encoder.py", 1
        FileInstall "licenses\Resemblyzer-APACHE.txt", this.root "\licenses\Resemblyzer-APACHE.txt", 1
        FileInstall "README.md", this.root "\README.md", 1
        FileInstall "NOTICE.txt", this.root "\NOTICE.txt", 1
    }

    WriteCommand(text) {
        temp := this.root "\command.tmp"
        FileOpen(temp, "w", "UTF-8-RAW").Write(text)
        FileMove(temp, this.root "\command.txt", 1)
    }

    State() {
        result := Map("phase", "", "message", "")
        try {
            for line in StrSplit(FileRead(this.root "\state.txt", "UTF-8"), "`n", "`r") {
                position := InStr(line, "=")
                if position
                    result[SubStr(line, 1, position - 1)] := SubStr(line, position + 1)
            }
        }
        return result
    }

    Alive() {
        return IsObject(this.process) && this.process.Running()
    }

    Launch(mode) {
        if this.Alive()
            this.process.Close()
        this.process := false
        this.mode := mode
        this.lastMessage := ""
        try FileDelete(this.root "\state.txt")
        this.WriteCommand("stop")
        command := '"' EnvGet("SystemRoot") '\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "' this.root '\bootstrap.ps1" -Root "' this.root '" -CacheRoot "' this.cache '" -Action ' mode
        this.process := OwnedProcess(command, this.root)
    }

    Toggle() {
        if this.app.busy
            return
        if this.pendingStart {
            this.Cancel()
            return
        }
        if this.pendingStop
            return
        if this.app.voiceRequested {
            this.Stop()
            return
        }
        if !FileExist(this.root "\ready.txt") || !FileExist(this.root "\config.ini") {
            this.Settings()
            this.app.SetStatus("Önce filtre ayarlarını tamamla")
            return
        }
        this.pendingStart := true, this.wanted := true
        this.deadline := A_TickCount + 90000
        this.app.toggleButton.Text := "Bekle / İptal"
        try {
            if !this.Alive() || this.mode != "serve"
                this.Launch("serve")
            this.app.SetStatus("Ses profilin hazırlanıyor…")
        } catch Error as err {
            this.Fail(err.Message)
        }
    }

    Stop() {
        if this.pendingStart {
            this.Cancel()
            return
        }
        if !this.app.voiceRequested || this.pendingStop
            return
        this.pendingStop := true
        this.wanted := false
        this.deadline := A_TickCount + 15000
        this.WriteCommand("stop")
        this.app.toggleButton.Text := "Bitiriliyor"
        this.app.SetStatus("Son kelimeler aktarılıyor…")
    }

    Cancel() {
        this.pendingStart := false, this.pendingStop := false, this.wanted := false
        try this.WriteCommand("stop")
        this.app.toggleButton.Text := this.app.voiceRequested ? "Durdur" : "Başlat"
        this.app.SetStatus("Başlatma iptal edildi")
    }

    Fail(message) {
        this.pendingStart := false, this.pendingStop := false, this.wanted := false
        if this.Alive()
            this.process.Close()
        this.process := false
        if this.app.voiceRequested
            DikteApp.Prototype.StopVoice.Call(this.app)
        this.app.toggleButton.Text := "Başlat"
        this.app.SetStatus("Filtre: " message)
        if this.HasOwnProp("setupStatus")
            try this.setupStatus.Text := message
    }

    Poll() {
        if this.closed || !IsObject(this.process)
            return
        information := this.State(), phase := information["phase"]
        if information["message"] != "" && information["message"] != this.lastMessage {
            this.lastMessage := information["message"]
            this.app.SetStatus(this.lastMessage)
            if this.HasOwnProp("setupStatus")
                try this.setupStatus.Text := this.lastMessage
        }
        if phase = "error" {
            this.Fail(information["message"])
            return
        }
        if this.pendingStart = true && (phase = "ready" || phase = "stopped") {
            this.seq += 1
            this.WriteCommand("start " this.seq)
            ; Clear the old ready state so the same command is sent once.
            this.app.SetStatus("Mikrofon filtresi açılıyor…")
            this.pendingStart := "opening"
        }
        if this.pendingStart = "opening" && phase = "running" {
            this.pendingStart := false
            DikteApp.Prototype.Toggle.Call(this.app)
            if !this.app.voiceRequested {
                this.wanted := false
                this.WriteCommand("stop")
            } else {
                this.app.SetStatus("Filtreli dikte · Ctrl+C: kopyala")
            }
        }
        if this.pendingStop && phase = "stopped" {
            this.pendingStop := false
            DikteApp.Prototype.StopVoice.Call(this.app)
        }
        if (this.pendingStart || this.pendingStop) && A_TickCount > this.deadline {
            this.Fail("Ses işlemi zamanında tamamlanamadı")
            return
        }
        if !this.Alive() {
            code := this.process.ExitCode()
            this.process.Close(), this.process := false
            if this.mode = "serve" {
                this.Fail("Ses motoru kapandı; ayarları kontrol et")
            } else if code = 0 {
                this.FillDevices()
            } else {
                this.Fail("Hazırlık tamamlanamadı; günlükleri kontrol et")
            }
        }
    }

    Settings() {
        if this.app.voiceRequested || this.pendingStart || this.pendingStop {
            this.app.SetStatus("Ayarlar için önce dikteyi durdur")
            return
        }
        if this.HasOwnProp("setup") {
            this.setup.Show()
            return
        }
        this.setup := Gui("+Owner" this.app.window.Hwnd " -MaximizeBox", "Filtre ayarları · Bir kez kurulum")
        this.setup.BackColor := "101217"
        this.setup.SetFont("s10 cF4F2EC", "Segoe UI")
        this.setup.AddText("x20 y18 w650 h45", "1 · VB-CABLE kurulu olmalı. Gerçek mikrofonunu filtreye,`nWin+H'nin varsayılan mikrofonunu CABLE Output'a bağlayacağız.")
        this.setup.AddButton("x20 y76 w270 h36", "VB-CABLE resmî kurulum sayfası").OnEvent("Click", (*) => Run("https://vb-audio.com/Cable/"))
        this.setup.AddButton("x310 y76 w340 h36", "Motoru hazırla / Aygıtları bul").OnEvent("Click", (*) => this.Prepare())
        this.setup.AddText("x20 y130 w630 h20", "2 · Fiziksel mikrofon (dahili mikrofonunu seç)")
        this.inputChoice := this.setup.AddDropDownList("x20 y156 w630 c17191E")
        this.setup.AddText("x20 y198 w630 h20", "3 · Temiz ses çıkışı: CABLE Input")
        this.outputChoice := this.setup.AddDropDownList("x20 y224 w630 c17191E")
        this.setup.AddText("x20 y266 w630 h20", "4 · Sessiz ortamda aldığın 20 saniyelik reference.wav")
        this.referenceEdit := this.setup.AddEdit("x20 y292 w500 ReadOnly Background181B22 cF4F2EC")
        this.setup.AddButton("x535 y290 w115 h30", "Sesini seç").OnEvent("Click", (*) => this.PickReference())
        previous := "", newest := ""
        Loop Files this.cache "\kayitlar\reference.wav", "FR" {
            if A_LoopFileTimeModified > newest
                newest := A_LoopFileTimeModified, previous := A_LoopFileFullPath
        }
        saved := this.root "\config.ini"
        if FileExist(saved)
            previous := IniRead(saved, "filter", "reference", previous)
        this.referenceEdit.Value := previous
        this.setup.AddText("x20 y338 w630 h44", "5 · Win+H → dişli → Varsayılan mikrofon → CABLE Output.`nBu seçim program tarafından doğrulanamaz; Windows'ta bir kez seçmelisin.")
        this.setup.AddButton("x20 y390 w270 h34", "Win+H mikrofon seçimini aç").OnEvent("Click", (*) => this.NativeSettings())
        this.confirmed := this.setup.AddCheckbox("x20 y440 w630 cF4F2EC -Theme", "Win+H mikrofonunu CABLE Output olarak seçtim.")
        this.confirmed.Value := FileExist(saved) ? IniRead(saved, "filter", "confirmed", 0) : 0
        this.setup.AddButton("x20 y480 w270 h40", "Kaydet").OnEvent("Click", (*) => this.Save())
        this.setup.AddButton("x310 y480 w340 h40", "Günlük / ayar klasörü").OnEvent("Click", (*) => Run('explorer.exe "' this.root '"'))
        this.setupStatus := this.setup.AddText("x20 y540 w630 h46", "Önce motoru hazırla; eski CPU denemesinin motoru ve modelleri tekrar kullanılır.")
        this.setup.OnEvent("Close", (*) => this.setup.Hide())
        this.setup.OnEvent("Escape", (*) => this.setup.Hide())
        this.setup.Show("w675 h605")
        this.FillDevices()
    }

    Prepare() {
        if this.Alive() && this.mode != "serve"
            return
        try {
            this.Launch("prepare")
            this.setupStatus.Text := "CPU motoru hazırlanıyor; ilk kullanım indirme yapabilir…"
        } catch Error as err {
            this.Fail(err.Message)
        }
    }

    FillDevices() {
        if !this.HasOwnProp("inputChoice")
            return
        this.inputRows := [], this.outputRows := [], inputs := [], outputs := []
        try {
            for line in StrSplit(FileRead(this.root "\devices.txt", "UTF-8"), "`n", "`r") {
                row := StrSplit(line, "`t")
                if row.Length != 4
                    continue
                if row[1] = "input"
                    this.inputRows.Push(row), inputs.Push(row[3])
                if row[1] = "output"
                    this.outputRows.Push(row), outputs.Push(row[3])
            }
        }
        this.inputChoice.Delete(), this.outputChoice.Delete()
        this.inputChoice.Add(inputs), this.outputChoice.Add(outputs)
        if inputs.Length
            this.inputChoice.Choose(1)
        if outputs.Length
            this.outputChoice.Choose(1)
        if !outputs.Length
            this.setupStatus.Text := "CABLE Input bulunamadı. VB-CABLE'ı kurup bilgisayarı yeniden başlat; sonra Aygıtları bul."
        saved := this.root "\config.ini"
        if FileExist(saved) {
            for index, name in inputs
                if name = IniRead(saved, "filter", "input_name", "")
                    this.inputChoice.Choose(index)
            for index, name in outputs
                if name = IniRead(saved, "filter", "output_name", "")
                    this.outputChoice.Choose(index)
        }
    }

    PickReference() {
        path := FileSelect(1, this.cache "\kayitlar", "Kendi ses referansını seç", "WAV (*.wav)")
        if path != ""
            this.referenceEdit.Value := path
    }

    NativeSettings() {
        this.app.ShowPanel()
        this.app.FocusEditor()
        DikteApp.Prototype.RequestNativeVoice.Call(this.app)
        this.nativeSetupOpened := true
        this.setupStatus.Text := "Win+H dişlisinden CABLE Output'u seç; sonra bu pencereye geri dön."
    }

    Save() {
        if !this.inputChoice.Value || !this.outputChoice.Value || !FileExist(this.referenceEdit.Value) || !this.confirmed.Value {
            this.setupStatus.Text := "Mikrofon, CABLE Input, kendi referansın ve Win+H onayı gerekli."
            return
        }
        input := this.inputRows[this.inputChoice.Value], output := this.outputRows[this.outputChoice.Value]
        text := "[filter]`nreference=" this.referenceEdit.Value "`ninput_name=" input[3] "`ninput_host=" input[4] "`noutput_name=" output[3] "`noutput_host=" output[4] "`nconfirmed=1`n"
        FileOpen(this.root "\config.ini", "w", "UTF-8-RAW").Write(text)
        this.setup.Hide()
        this.CloseNativeSetup()
        this.app.SetStatus("Ayarlar kaydedildi · Başlat")
        try this.Launch("serve")
    }

    CloseNativeSetup() {
        if this.HasOwnProp("nativeSetupOpened") && this.nativeSetupOpened {
            this.app.ShowPanel()
            this.app.FocusEditor()
            this.app.RequestNativeStop()
            this.nativeSetupOpened := false
        }
    }

    Close() {
        this.CloseNativeSetup()
        this.closed := true
        SetTimer(this.poll, 0)
        if IsObject(this.process)
            this.process.Close()
        if this.HasOwnProp("setup")
            try this.setup.Destroy()
    }
}
