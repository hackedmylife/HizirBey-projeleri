; SPDX-License-Identifier: GPL-2.0-or-later
class DikteCore {
    static DockBounds(x, y, w, h) {
        width := Min(1080, Max(600, Round(w * 0.485)))
        return {x: Round(x + w * 0.272), y: Round(y + h * 0.109), w: width, h: 100}
    }

    static IsWorkspacesProcess(name) {
        return RegExMatch(StrLower(name), "^(workspaces|workspacesclient|amazonworkspaces)\.exe$") > 0
    }

    static HasText(text) {
        return Trim(text, " `t`r`n") != ""
    }
}
