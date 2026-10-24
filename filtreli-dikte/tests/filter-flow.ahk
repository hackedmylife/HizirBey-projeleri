#Requires AutoHotkey v2.0.30 64-bit
global Checks := 0, Results := "", ResultFile := A_Args[1]
SetTimer(RunFlow, -100)
#Include ..\Hizir-Bey-Filtreli-Dikte.ahk

class FilterProbe extends FilteredDikteApp {
    starts := 0
    stops := 0
    RequestNativeVoice() {
        this.starts += 1
    }
    RequestNativeStop() {
        this.stops += 1
    }
}
class FakeProcess {
    alive := true
    closed := 0
    Running() {
        return this.alive
    }
    Close() {
        this.alive := false
        this.closed += 1
    }
    ExitCode() {
        return 0
    }
}
class FlowManager extends FilterManager {
    opened := 0
    Install() {
        DirCreate(this.root)
    }
    Settings() {
        this.opened += 1
    }
    Launch(mode) {
        this.mode := mode
        this.process := FakeProcess()
    }
}
Assert(value, message) {
    global Checks, Results
    if !value
        throw Error(message)
    Checks += 1
    Results .= "PASS " message "`n"
}
WriteState(manager, phase, message := "fixture") {
    FileOpen(manager.root "\state.txt", "w", "UTF-8-RAW").Write("phase=" phase "`nmessage=" message "`n")
}
RunFlow() {
    global App, Checks, Results, ResultFile
    try {
        App.Dispose()
        App := FilterProbe(true)
        directory := A_Temp "\Filter Flow Türkçe " A_TickCount
        App.filter := FlowManager(App, directory, directory "\cache")
        manager := App.filter
        SetTimer(manager.pollTimer, 0)
        manager.Toggle()
        Assert(manager.opened = 1 && App.starts = 0, "Unconfigured start opens settings without native voice")
        FileOpen(directory "\ready.txt", "w").Write("ready")
        FileOpen(directory "\config.ini", "w").Write("fixture")
        manager.Launch("serve")
        WriteState(manager, "warming")
        manager.Toggle()
        Assert(manager.pendingStart && App.starts = 0 && !App.voiceRequested, "Warming waits before starting native recognition")
        WriteState(manager, "running")
        manager.Poll()
        Assert(App.starts = 0, "Stale running state cannot acknowledge a new start")
        WriteState(manager, "ready")
        manager.Poll()
        first := FileRead(directory "\command.txt")
        manager.Poll()
        Assert(FileRead(directory "\command.txt") = first && manager.seq = 1, "Ready handshake emits one start command")
        Assert(App.starts = 0, "Ready alone cannot start recognition before audio opens")
        WriteState(manager, "running")
        manager.Poll()
        Assert(App.starts = 1 && App.voiceRequested, "Running audio acknowledges the native dictation start")
        App.editor.Value := "işleminizi kontrol ediyorum"
        App.CopyOnly()
        Assert(A_Clipboard == "İşleminizi kontrol ediyorum." && manager.wanted && App.voiceRequested, "Copy retains the active filter and formats only clipboard text")
        manager.Stop()
        Assert(manager.pendingStop && App.stops = 0, "Stop waits for the audio tail")
        WriteState(manager, "draining")
        manager.Poll()
        Assert(App.stops = 0 && App.voiceRequested, "Native recognition stays open during tail playback")
        WriteState(manager, "stopped")
        manager.Poll()
        Assert(App.stops = 1 && !App.voiceRequested, "Native stop follows successful tail drain")
        manager.Toggle()
        manager.Poll()
        WriteState(manager, "running")
        manager.Poll()
        Assert(App.starts = 2 && App.voiceRequested, "Prepared service supports the next dictation")
        WriteState(manager, "error", "fixture failure")
        manager.Poll()
        Assert(App.stops = 2 && !App.voiceRequested && !manager.Alive(), "Backend failure stops recognition and never falls back to raw audio")
        manager.Launch("serve")
        WriteState(manager, "warming")
        manager.Toggle()
        manager.Toggle()
        WriteState(manager, "ready")
        manager.Poll()
        Assert(!manager.pendingStart && App.starts = 2, "Cancelling warmup cannot start recognition later")
        manager.Toggle()
        manager.deadline := A_TickCount - 1
        WriteState(manager, "warming")
        manager.Poll()
        Assert(!manager.Alive() && !manager.pendingStart, "Warmup timeout closes the service")
        shell := EnvGet("SystemRoot") "\System32\WindowsPowerShell\v1.0\powershell.exe"
        childFile := directory "\child-pid.txt"
        fixture := directory "\owned-process.ps1"
        FileOpen(fixture, "w", "UTF-8").Write('$child = Start-Process -FilePath "' shell '" -ArgumentList "-NoProfile -Command Start-Sleep -Seconds 60" -PassThru`n[IO.File]::WriteAllText("' childFile '", [string]$child.Id)`nStart-Sleep -Seconds 60')
        manager.process := OwnedProcess('"' shell '" -NoProfile -ExecutionPolicy Bypass -File "' fixture '"', directory)
        deadline := A_TickCount + 6000
        while !FileExist(childFile) && A_TickCount < deadline
            Sleep(50)
        Assert(FileExist(childFile) && manager.Alive(), "Owned process starts a real nested worker")
        nestedPid := Integer(FileRead(childFile))
        Assert(ProcessExist(nestedPid), "Nested worker exists before app cleanup")
        App.Dispose()
        ProcessWaitClose(nestedPid, 3)
        Assert(!ProcessExist(nestedPid) && !manager.Alive(), "App cleanup kills its entire owned process group")
        DirDelete(directory, true)
        Results .= "`n" Checks " filter lifecycle checks passed. Native microphone calls were probes.`n"
        FileOpen(ResultFile, "w", "UTF-8").Write(Results)
        ExitApp(0)
    } catch Error as err {
        Results .= "FAIL " err.Message "`n" err.Stack
        FileOpen(ResultFile, "w", "UTF-8").Write(Results)
        ExitApp(1)
    }
}
