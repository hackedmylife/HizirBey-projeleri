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

    static FinalizeText(text) {
        result := ""
        for index, line in StrSplit(text, "`n")
            result .= (index > 1 ? "`n" : "") this.FinalizeLine(line)
        return result
    }

    static FinalizeLine(line) {
        if !this.HasText(line)
            return line
        RegExMatch(line, "s)^(.*?)([ `t`r]*)$", &parts)
        body := parts[1], trailing := parts[2]
        clean := Trim(body, " `t")
        ; Preserve standalone data, URLs and addresses. No semantic comma guessing.
        if RegExMatch(clean, "i)^(https?://|www\.)") || (!RegExMatch(clean, "\s") && !RegExMatch(clean, "i)^(merhaba|selam|teşekkürler|tamam|peki|evet|hayır|nasılsınız|nasılsın)[.!?…,:;]?$"))
            return line
        if pos := RegExMatch(body, "^[ `t]*\K\p{Ll}", &first) {
            upper := first[0] = "i" ? "İ" : (first[0] = "ı" ? "I" : StrUpper(first[0]))
            body := SubStr(body, 1, pos - 1) upper SubStr(body, pos + StrLen(first[0]))
        }
        RegExMatch(body, "(\S+)$", &last)
        if RegExMatch(body, "\p{L}$") && !RegExMatch(last[1], "[.@:/\\]") {
            question := RegExMatch(body, "i)(?:^|\s)(m[ıiuü](y[ıiuü][mz]|s[ıiuü]n([ıiuü]z)?)?|nasılsınız|nasılsın)$")
            body .= question ? "?" : "."
        }
        return body trailing
    }
}
