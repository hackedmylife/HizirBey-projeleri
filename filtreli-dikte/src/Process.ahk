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
