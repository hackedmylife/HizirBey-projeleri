;@Ahk2Exe-SetName Hızır Bey CPU Ses Testi
;@Ahk2Exe-SetDescription CPU üzerinde ses ayırma ve referans eşleştirme denemesi
;@Ahk2Exe-SetVersion 0.1.0.0
;@Ahk2Exe-SetCompanyName Hızır Bey
;@Ahk2Exe-SetMainIcon assets\hizirbey.ico
;@Ahk2Exe-AddResource licenses\AutoHotkey-GPL.txt, LICENSE
;@Ahk2Exe-AddResource licenses\GPL-3.0.txt, LICENSE_APP
#Requires AutoHotkey v2.0.30 64-bit
#SingleInstance Ignore

global AppMutex := DllCall("CreateMutexW", "Ptr", 0, "Int", 1, "WStr", "Local\HizirBeyCpuSesTesti0.1.0", "Ptr")
if A_LastError = 183
    ExitApp(0)
global App := CpuVoiceTest()
if A_Args.Length && A_Args[1] = "--smoke"
    SetTimer(() => App.Quit(), -1200)

class CpuVoiceTest {
    __New() {
        this.root := EnvGet("LOCALAPPDATA") "\HizirBey\CpuSesTesti\0.1.0"
        this.busy := false, this.recording := "", this.pid := 0, this.job := 0
        this.alias := "HizirCpuCapture"
        this.session := this.root "\kayitlar\" FormatTime(, "yyyyMMdd-HHmmss") "-" A_TickCount
        this.reference := "", this.mixture := "", this.result := ""
        this.buttons := []
        this.InstallFiles()
        this.window := Gui("-MaximizeBox", "Hızır Bey · CPU Ses Testi 0.1.0")
        this.window.BackColor := "101217"
        this.window.SetFont("s17 w600 cD7BA76", "Segoe UI")
        this.window.AddText("x26 y22 w690 h30", "Sesini ayırmayı deneyelim.")
        this.window.SetFont("s10 w400 cACB4C3", "Segoe UI")
        this.window.AddText("x28 y62 w690 h44", "CPU üzerinde ses ayırma + ses referansıyla eşleştirme.`nBu araç kayıtları karşılaştırır; henüz Win+H mikrofonuna bağlı değildir.")
        this.readyLabel := this.window.AddText("x28 y119 w690 h20", "İlk hazırlık internetten birkaç yüz MB indirir; sonraki test yereldir.")
        this.AddButton("Modeli hazırla", 28, 150, 210, (*) => this.StartTask("prepare"))
        this.refLabel := this.window.AddText("x28 y212 w690 h20", "1 · Sessiz ortamda, doğal sesinle konuş. Referans henüz yok.")
        this.AddButton("Sesimi kaydet · 20 sn", 28, 240, 280, (*) => this.Record("reference", 20))
        this.AddButton("Referans WAV seç", 328, 240, 260, (*) => this.Pick("reference"))
        this.mixLabel := this.window.AddText("x28 y304 w690 h20", "2 · PC / TV sesini aç ve aynı anda konuş. Karışık kayıt henüz yok.")
        this.AddButton("Karışık kayıt · 15 sn", 28, 332, 280, (*) => this.Record("mixture", 15))
        this.AddButton("Karışık WAV seç", 328, 332, 260, (*) => this.Pick("mixture"))
        this.AddButton("Ayır ve ölç", 28, 400, 280, (*) => this.StartTask("extract"))
        this.AddButton("Kaydı bitir", 328, 400, 260, (*) => this.EndRecording())
        this.window.SetFont("s10 w400 c9CD5B3", "Segoe UI")
        this.status := this.window.AddText("x28 y463 w700 h46", "Hazır · Önce Modeli hazırla'ya bas.")
        this.window.SetFont("s10 w400 cF4F2EC", "Segoe UI")
        this.AddButton("Ham kaydı dinle", 28, 520, 210, (*) => this.Play(false))
        this.AddButton("Ayrılmışı dinle", 252, 520, 210, (*) => this.Play(true))
        this.AddButton("Sonuç klasörü", 476, 520, 210, (*) => this.OpenResults())
        this.window.SetFont("s8 w400 cACB4C3", "Segoe UI")
        this.window.AddText("x28 y582 w690 h32", "Kayıt yalnız sen düğmeye bastığında alınır ve bilgisayarında kalır. Deneysel model; sesini`nkesebilir veya başka sesi seçebilir. Sonucu dinleyerek değerlendir.")
        this.window.OnEvent("Close", (*) => this.Quit())
        this.window.OnEvent("Escape", (*) => this.Quit())
        dark := Buffer(4, 0), NumPut("Int", 1, dark)
        try DllCall("dwmapi\DwmSetWindowAttribute", "Ptr", this.window.Hwnd, "UInt", 20, "Ptr", dark, "UInt", 4)
        this.drawCallback := ObjBindMethod(this, "DrawButton")
        OnMessage(0x2B, this.drawCallback)
        this.pollCallback := ObjBindMethod(this, "Poll")
        SetTimer(this.pollCallback, 250)
        this.window.Show("w750 h640")
        A_TrayMenu.Delete()
        A_TrayMenu.Add("Paneli aç", (*) => this.window.Show())
        A_TrayMenu.Add("Çıkış", (*) => this.Quit())
    }

    InstallFiles() {
        DirCreate(this.root "\engine\resemblyzer")
        DirCreate(this.root "\licenses")
        FileInstall "bootstrap.ps1", this.root "\bootstrap.ps1", 1
        FileInstall "engine\worker.py", this.root "\engine\worker.py", 1
        FileInstall "engine\resemblyzer\__init__.py", this.root "\engine\resemblyzer\__init__.py", 1
        FileInstall "engine\resemblyzer\audio.py", this.root "\engine\resemblyzer\audio.py", 1
        FileInstall "engine\resemblyzer\hparams.py", this.root "\engine\resemblyzer\hparams.py", 1
        FileInstall "engine\resemblyzer\voice_encoder.py", this.root "\engine\resemblyzer\voice_encoder.py", 1
        FileInstall "licenses\Resemblyzer-APACHE.txt", this.root "\licenses\Resemblyzer-APACHE.txt", 1
        FileInstall "licenses\GPL-3.0.txt", this.root "\licenses\GPL-3.0.txt", 1
        FileInstall "NOTICE.txt", this.root "\NOTICE.txt", 1
        FileInstall "README.md", this.root "\README.md", 1
    }

    AddButton(label, x, y, width, callback) {
        this.window.SetFont("s10 w600 cF4F2EC", "Segoe UI")
        button := this.window.AddButton("x" x " y" y " w" width " h44 -Theme", label)
        button.OnEvent("Click", callback)
        style := DllCall("GetWindowLongPtrW", "Ptr", button.Hwnd, "Int", -16, "Ptr")
        DllCall("SetWindowLongPtrW", "Ptr", button.Hwnd, "Int", -16, "Ptr", (style & ~0xF) | 0xB, "Ptr")
        this.buttons.Push(button)
        return button
    }

    DrawButton(wParam, item, msg, hwnd) {
        if hwnd != this.window.Hwnd || NumGet(item, 0, "UInt") != 4
            return
        control := NumGet(item, 24, "Ptr"), hdc := NumGet(item, 32, "Ptr")
        button := 0
        for candidate in this.buttons
            if candidate.Hwnd = control
                button := candidate
        if !button
            return
        rect := item + 40, pressed := NumGet(item, 16, "UInt") & 1
        color := pressed ? 0x374452 : 0x26303B
        brush := DllCall("gdi32\CreateSolidBrush", "UInt", color, "Ptr")
        DllCall("FillRect", "Ptr", hdc, "Ptr", rect, "Ptr", brush)
        DllCall("gdi32\DeleteObject", "Ptr", brush)
        DllCall("gdi32\SetBkMode", "Ptr", hdc, "Int", 1)
        DllCall("gdi32\SetTextColor", "Ptr", hdc, "UInt", 0xECF2F4)
        font := SendMessage(0x31, 0, 0, control)
        old := DllCall("gdi32\SelectObject", "Ptr", hdc, "Ptr", font, "Ptr")
        DllCall("DrawTextW", "Ptr", hdc, "WStr", button.Text, "Int", -1, "Ptr", rect, "UInt", 0x25)
        DllCall("gdi32\SelectObject", "Ptr", hdc, "Ptr", old)
        return 1
    }

    Say(text) {
        this.status.Text := text
    }

    Pick(which) {
        if this.busy || this.recording != ""
            return
        path := FileSelect(1,, "WAV kaydı seç", "WAV (*.wav)")
        if path = ""
            return
        if which = "reference" {
            this.reference := path
            this.refLabel.Text := "1 · Referans seçildi · Kayıtta yalnız senin sesin bulunmalı."
        } else {
            this.mixture := path
            this.mixLabel.Text := "2 · Karışık kayıt seçildi."
        }
        this.InvalidateResult()
    }

    InvalidateResult() {
        this.result := ""
    }

    Mci(command) {
        errorCode := DllCall("winmm\mciSendStringW", "WStr", command, "Ptr", 0, "UInt", 0, "Ptr", 0)
        if errorCode {
            message := Buffer(1024, 0)
            DllCall("winmm\mciGetErrorStringW", "UInt", errorCode, "Ptr", message, "UInt", 512)
            throw Error(StrGet(message, "UTF-16"))
        }
    }

    Record(which, seconds) {
        if this.busy || this.recording != ""
            return
        try {
            DllCall("winmm\PlaySoundW", "Ptr", 0, "Ptr", 0, "UInt", 0)
            this.Mci("open new type waveaudio alias " this.alias)
            this.Mci("set " this.alias " time format milliseconds")
            this.Mci("set " this.alias " bitspersample 16 samplespersec 16000 channels 1 alignment 2 bytespersec 32000")
            this.Mci("record " this.alias)
            this.recording := which
            this.recordStarted := A_TickCount
            this.recordDuration := seconds
            this.InvalidateResult()
            this.Say("Kayıt başladı · " seconds " saniye doğal sesinle konuş.")
        } catch Error as err {
            try this.Mci("close " this.alias)
            this.recording := ""
            this.Say("Mikrofon açılamadı: " err.Message)
        }
    }

    EndRecording() {
        if this.recording = ""
            return
        which := this.recording
        this.recording := ""
        try {
            this.Mci("stop " this.alias)
            DirCreate(this.session)
            path := this.session "\" which ".wav"
            this.Mci('save ' this.alias ' "' path '"')
            if which = "reference" {
                this.reference := path
                this.refLabel.Text := "1 · Referans kaydı alındı."
            } else {
                this.mixture := path
                this.mixLabel.Text := "2 · Karışık kayıt alındı."
            }
            this.Say("Kayıt tamamlandı · Diğer kaydı al veya Ayır ve ölç'e bas.")
        } catch Error as err {
            this.Say("Kayıt kaydedilemedi: " err.Message)
        } finally {
            try this.Mci("close " this.alias)
        }
    }

    StartTask(action) {
        if this.busy || this.recording != ""
            return
        if action = "extract" {
            if !FileExist(this.root "\ready.json") {
                this.Say("Önce Modeli hazırla'ya bas.")
                return
            }
            if this.reference = "" || this.mixture = "" {
                this.Say("Önce sessiz referans ve karışık kayıt gerekli.")
                return
            }
            this.result := ""
            this.pendingResult := this.session "\sonuc-" A_TickCount
        }
        try {
            try FileDelete(this.root "\done.txt")
            try FileDelete(this.root "\status.txt")
            command := '"' EnvGet("SystemRoot") '\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "' this.root '\bootstrap.ps1" -Root "' this.root '" -Action ' action
            if action = "extract"
                command .= ' -Reference "' this.reference '" -Mixture "' this.mixture '" -Output "' this.pendingResult '"'
            this.process := OwnedProcess(command, this.root)
            this.busy := true
            this.action := action
            this.Say(action = "prepare" ? "İlk hazırlık başladı · İndirme birkaç dakika sürebilir…" : "CPU ayırma başladı…")
        } catch Error as err {
            this.Say("İşlem başlatılamadı: " err.Message)
        }
    }

    Poll() {
        if this.recording != "" {
            remaining := this.recordDuration - Floor((A_TickCount - this.recordStarted) / 1000)
            if remaining <= 0
                this.EndRecording()
            else
                this.Say("Kayıt alınıyor · " remaining " saniye · Kaydı bitir ile erken durdurabilirsin.")
        }
        if !this.busy
            return
        try this.Say(FileRead(this.root "\status.txt", "UTF-8"))
        if !this.process.Running() {
            exitCode := this.process.ExitCode()
            this.process.Close()
            this.busy := false
            if exitCode = 0 && this.action = "extract" && FileExist(this.pendingResult "\rapor.json")
                this.result := this.pendingResult
            if exitCode != 0 {
                try message := FileRead(this.root "\status.txt", "UTF-8")
                catch
                    message := "İşlem tamamlanamadı. Sonuç klasöründeki günlükleri kontrol et."
                this.Say(message)
            }
        }
    }

    Play(clean) {
        if this.busy || this.recording != ""
            return
        path := clean ? (this.result != "" ? this.result "\ayrilmis.wav" : "") : this.mixture
        if path = "" || !FileExist(path) {
            this.Say(clean ? "Önce başarılı bir ayırma testi gerekli." : "Önce karışık kayıt gerekli.")
            return
        }
        DllCall("winmm\PlaySoundW", "WStr", path, "Ptr", 0, "UInt", 0x20001)
    }

    OpenResults() {
        path := this.result != "" ? this.result : this.root
        try Run('explorer.exe "' path '"')
    }

    Quit() {
        SetTimer(this.pollCallback, 0)
        DllCall("winmm\PlaySoundW", "Ptr", 0, "Ptr", 0, "UInt", 0)
        try this.Mci("close " this.alias)
        if this.busy
            try this.process.Close()
        ExitApp(0)
    }
}

class OwnedProcess {
    __New(command, directory) {
        ; Start suspended, assign to a private kill-on-close job, then resume.
        ; Closing this app cannot leave pip / Python / PowerShell children behind.
        this.job := DllCall("CreateJobObjectW", "Ptr", 0, "Ptr", 0, "Ptr")
        this.handle := 0
        if !this.job
            throw Error("İşlem grubu oluşturulamadı · " A_LastError)
        limits := Buffer(144, 0)
        NumPut("UInt", 0x2000, limits, 16)
        if !DllCall("SetInformationJobObject", "Ptr", this.job, "Int", 9, "Ptr", limits, "UInt", limits.Size) {
            code := A_LastError
            this.Close()
            throw Error("İşlem grubu ayarlanamadı · " code)
        }
        startup := Buffer(104, 0), info := Buffer(24, 0)
        NumPut("UInt", 104, startup)
        commandBuffer := Buffer(StrPut(command, "UTF-16") * 2, 0)
        StrPut(command, commandBuffer, "UTF-16")
        if !DllCall("CreateProcessW", "Ptr", 0, "Ptr", commandBuffer, "Ptr", 0, "Ptr", 0, "Int", 0, "UInt", 0x08000004, "Ptr", 0, "WStr", directory, "Ptr", startup, "Ptr", info) {
            code := A_LastError
            this.Close()
            throw Error("Alt işlem açılamadı · " code)
        }
        this.handle := NumGet(info, 0, "Ptr"), thread := NumGet(info, 8, "Ptr")
        if !DllCall("AssignProcessToJobObject", "Ptr", this.job, "Ptr", this.handle) {
            code := A_LastError
            DllCall("TerminateProcess", "Ptr", this.handle, "UInt", 1)
            DllCall("CloseHandle", "Ptr", thread)
            this.Close()
            throw Error("Alt işlem gruba atanamadı · " code)
        }
        DllCall("ResumeThread", "Ptr", thread)
        DllCall("CloseHandle", "Ptr", thread)
    }
    Running() {
        return DllCall("WaitForSingleObject", "Ptr", this.handle, "UInt", 0) = 0x102
    }
    ExitCode() {
        code := 1
        DllCall("GetExitCodeProcess", "Ptr", this.handle, "UInt*", &code)
        return code
    }
    Close() {
        if this.job
            DllCall("CloseHandle", "Ptr", this.job)
        if this.handle
            DllCall("CloseHandle", "Ptr", this.handle)
        this.job := 0, this.handle := 0
    }
}
