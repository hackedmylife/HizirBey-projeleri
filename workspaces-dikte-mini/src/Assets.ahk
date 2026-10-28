; SPDX-License-Identifier: GPL-2.0-or-later
class DikteAssets {
    static directory := ""

    static GetDir() {
        if this.directory != ""
            return this.directory
        if !A_IsCompiled {
            SplitPath(A_LineFile,, &sourceDir)
            return sourceDir "\..\assets"
        }
        ; FileInstall embeds only the public tray icon. Extract into a
        ; fresh per-process temporary directory, never alongside the user's EXE.
        directory := A_Temp "\HizirBey-DikteMini-" DllCall("GetCurrentProcessId") "-" A_TickCount "-" Random(100000, 999999)
        DirCreate(directory)
        try {
            FileInstall "assets\hizirbey.ico", directory "\hizirbey.ico"
        } catch Error as err {
            try DirDelete(directory, true)
            throw err
        }
        this.directory := directory
        OnExit((*) => DikteAssets.Cleanup())
        return directory
    }

    static Cleanup() {
        if this.directory != "" {
            try DirDelete(this.directory, true)
        }
        return 0
    }
}
