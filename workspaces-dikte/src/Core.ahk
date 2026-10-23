; SPDX-License-Identifier: GPL-2.0-or-later
class DikteCore {
    static IsWorkspacesProcess(name) {
        return RegExMatch(StrLower(name), "^(workspaces|workspacesclient|amazonworkspaces)\.exe$") > 0
    }

    static IsAllowedProcess(name, testMode := false) {
        return this.IsWorkspacesProcess(name) || (testMode && name != "")
    }

    static ChatText(text) {
        ; Paste one paragraph. Do not synthesize Enter, punctuation, or chat commands.
        return Trim(RegExReplace(text, "\R+", " "), " `t")
    }

    static CanPaste(text, expectedHwnd, expectedPid, actualHwnd, actualPid) {
        return this.ChatText(text) != "" && expectedHwnd != 0 && expectedPid > 0
            && expectedHwnd = actualHwnd && expectedPid = actualPid
    }

    static IsSettled(now, started, changed, minimum := 1000, quiet := 800) {
        return now - started >= minimum && now - changed >= quiet
    }
}
