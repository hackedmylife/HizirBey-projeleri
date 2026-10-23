; SPDX-License-Identifier: GPL-2.0-or-later
; Native owner-drawn controls. No browser, external UI runtime or animations.
class DikteTheme {
    __New(app) {
        this.app := app
        this.hover := 0
        this.width := 930
        this.height := 100
        this.draws := 0
        this.titleFont := this.MakeFont(14, 600)
        this.hintFont := this.MakeFont(10, 400)
        this.drawCallback := ObjBindMethod(this, "DrawButton")
        this.eraseCallback := ObjBindMethod(this, "DrawSurface")
        this.mouseCallback := ObjBindMethod(this, "MouseMoved")
        this.leaveCallback := ObjBindMethod(this, "MouseLeft")
        this.cursorCallback := ObjBindMethod(this, "SetHand")
        OnMessage(0x2B, this.drawCallback)
        OnMessage(0x14, this.eraseCallback)
        OnMessage(0x200, this.mouseCallback)
        OnMessage(0x2A3, this.leaveCallback)
        OnMessage(0x20, this.cursorCallback)
        ; AutoHotkey normalizes Button type bits at creation. Apply owner draw
        ; after creation, preserving the native Button control and click events.
        for button in [app.toggleButton, app.copyButton, app.closeButton] {
            style := DllCall("user32\GetWindowLongPtrW", "Ptr", button.Hwnd, "Int", -16, "Ptr")
            DllCall("user32\SetWindowLongPtrW", "Ptr", button.Hwnd, "Int", -16, "Ptr", (style & ~0xF) | 0xB, "Ptr")
            DllCall("user32\SetWindowPos", "Ptr", button.Hwnd, "Ptr", 0, "Int", 0, "Int", 0, "Int", 0, "Int", 0, "UInt", 0x27)
        }
    }

    MakeFont(size, weight) {
        return DllCall("gdi32\CreateFontW", "Int", -size, "Int", 0, "Int", 0, "Int", 0, "Int", weight,
            "UInt", 0, "UInt", 0, "UInt", 0, "UInt", 1, "UInt", 0, "UInt", 0, "UInt", 5, "UInt", 0, "WStr", "Segoe UI", "Ptr")
    }

    Color(rgb) {
        return ((rgb & 0xFF) << 16) | (rgb & 0xFF00) | ((rgb >> 16) & 0xFF)
    }

    Fill(hdc, x, y, w, h, color) {
        rect := Buffer(16, 0)
        NumPut("Int", x, "Int", y, "Int", x + w, "Int", y + h, rect)
        brush := DllCall("gdi32\CreateSolidBrush", "UInt", this.Color(color), "Ptr")
        DllCall("user32\FillRect", "Ptr", hdc, "Ptr", rect, "Ptr", brush)
        DllCall("gdi32\DeleteObject", "Ptr", brush)
    }

    Round(hdc, x, y, w, h, fill, border, radius := 12) {
        brush := DllCall("gdi32\CreateSolidBrush", "UInt", this.Color(fill), "Ptr")
        pen := DllCall("gdi32\CreatePen", "Int", 0, "Int", 1, "UInt", this.Color(border), "Ptr")
        oldBrush := DllCall("gdi32\SelectObject", "Ptr", hdc, "Ptr", brush, "Ptr")
        oldPen := DllCall("gdi32\SelectObject", "Ptr", hdc, "Ptr", pen, "Ptr")
        DllCall("gdi32\RoundRect", "Ptr", hdc, "Int", x, "Int", y, "Int", x + w - 1, "Int", y + h - 1, "Int", radius, "Int", radius)
        DllCall("gdi32\SelectObject", "Ptr", hdc, "Ptr", oldBrush)
        DllCall("gdi32\SelectObject", "Ptr", hdc, "Ptr", oldPen)
        DllCall("gdi32\DeleteObject", "Ptr", brush)
        DllCall("gdi32\DeleteObject", "Ptr", pen)
    }

    Label(hdc, text, x, y, w, h, font, color) {
        rect := Buffer(16, 0)
        NumPut("Int", x, "Int", y, "Int", x + w, "Int", y + h, rect)
        old := DllCall("gdi32\SelectObject", "Ptr", hdc, "Ptr", font, "Ptr")
        DllCall("gdi32\SetBkMode", "Ptr", hdc, "Int", 1)
        DllCall("gdi32\SetTextColor", "Ptr", hdc, "UInt", this.Color(color))
        DllCall("user32\DrawTextW", "Ptr", hdc, "WStr", text, "Int", -1, "Ptr", rect, "UInt", 0x824)
        DllCall("gdi32\SelectObject", "Ptr", hdc, "Ptr", old)
    }

    Resize(width, height) {
        this.width := width, this.height := height
        try WinSetRegion("0-0 w" width " h" height " r16-16", "ahk_id " this.app.window.Hwnd)
        this.Refresh()
    }

    Refresh() {
        DllCall("user32\InvalidateRect", "Ptr", this.app.window.Hwnd, "Ptr", 0, "Int", 1)
        for button in [this.app.toggleButton, this.app.copyButton, this.app.closeButton]
            DllCall("user32\InvalidateRect", "Ptr", button.Hwnd, "Ptr", 0, "Int", 1)
    }

    DrawSurface(hdc, lParam, msg, hwnd) {
        if hwnd != this.app.window.Hwnd
            return
        this.Fill(hdc, 0, 0, this.width, this.height, 0x101217)
        this.Round(hdc, 0, 0, this.width, this.height, 0x101217, 0x373941, 16)
        this.Fill(hdc, 70, 14, 1, 72, 0x30333B)
        this.Round(hdc, 80, 34, this.width - 292, 56, 0x181B22, 0x343B47, 12)
        return 1
    }

    DrawButton(wParam, item, msg, hwnd) {
        if hwnd != this.app.window.Hwnd || NumGet(item, 0, "UInt") != 4
            return
        offset := A_PtrSize = 8 ? 24 : 20
        control := NumGet(item, offset, "Ptr")
        if control != this.app.toggleButton.Hwnd && control != this.app.copyButton.Hwnd && control != this.app.closeButton.Hwnd
            return
        this.draws += 1
        hdc := NumGet(item, offset + A_PtrSize, "Ptr")
        rect := item + offset + 2 * A_PtrSize
        width := NumGet(rect, 8, "Int") - NumGet(rect, 0, "Int")
        height := NumGet(rect, 12, "Int") - NumGet(rect, 4, "Int")
        state := NumGet(item, 16, "UInt")
        pressed := state & 1
        if control = this.app.closeButton.Hwnd {
            this.Fill(hdc, 0, 0, width, height, 0x101217)
            hot := this.hover = control || pressed
            if hot
                this.Round(hdc, 0, 0, width, height, 0x482A31, 0x79434D, 8)
            pen := DllCall("gdi32\CreatePen", "Int", 0, "Int", 2, "UInt", this.Color(hot ? 0xF4BBC0 : 0xACB4C3), "Ptr")
            oldPen := DllCall("gdi32\SelectObject", "Ptr", hdc, "Ptr", pen, "Ptr")
            DllCall("gdi32\MoveToEx", "Ptr", hdc, "Int", 8, "Int", 8, "Ptr", 0)
            DllCall("gdi32\LineTo", "Ptr", hdc, "Int", 17, "Int", 17)
            DllCall("gdi32\MoveToEx", "Ptr", hdc, "Int", 16, "Int", 8, "Ptr", 0)
            DllCall("gdi32\LineTo", "Ptr", hdc, "Int", 7, "Int", 17)
            DllCall("gdi32\SelectObject", "Ptr", hdc, "Ptr", oldPen)
            DllCall("gdi32\DeleteObject", "Ptr", pen)
            return 1
        }
        primary := control = this.app.toggleButton.Hwnd
        stopping := primary && this.app.voiceRequested
        hover := control = this.hover
        fill := primary ? (stopping ? (hover ? 0x4A292E : 0x352126) : (hover ? 0xE8CE92 : 0xD7BA76)) : (hover ? 0x2D343F : 0x202630)
        if pressed
            fill := primary ? (stopping ? 0x582E35 : 0xBCA060) : 0x323C49
        border := primary ? (stopping ? 0x9A525B : 0xE8CE92) : 0x414C5B
        ink := primary && !stopping ? 0x17191E : (stopping ? 0xF3B3B6 : 0xF4F2EC)
        this.Fill(hdc, 0, 0, width, height, 0x101217)
        this.Round(hdc, 0, 0, width, height, fill, border, 12)
        if primary {
            if stopping
                this.Round(hdc, 17, 13, 14, 14, ink, ink, 3)
            else {
                points := Buffer(24, 0)
                NumPut("Int", 18, "Int", 12, "Int", 18, "Int", 28, "Int", 31, "Int", 20, points)
                brush := DllCall("gdi32\CreateSolidBrush", "UInt", this.Color(ink), "Ptr")
                oldBrush := DllCall("gdi32\SelectObject", "Ptr", hdc, "Ptr", brush, "Ptr")
                oldPen := DllCall("gdi32\SelectObject", "Ptr", hdc, "Ptr", DllCall("gdi32\GetStockObject", "Int", 8, "Ptr"), "Ptr")
                DllCall("gdi32\Polygon", "Ptr", hdc, "Ptr", points, "Int", 3)
                DllCall("gdi32\SelectObject", "Ptr", hdc, "Ptr", oldPen)
                DllCall("gdi32\SelectObject", "Ptr", hdc, "Ptr", oldBrush)
                DllCall("gdi32\DeleteObject", "Ptr", brush)
            }
        } else {
            this.Round(hdc, 16, 12, 12, 14, fill, ink, 3)
            this.Round(hdc, 20, 16, 12, 14, fill, ink, 3)
        }
        label := primary ? this.app.toggleButton.Text : "Kopyala"
        this.Label(hdc, label, 43, 6, width - 49, 19, this.titleFont, ink)
        this.Label(hdc, primary ? "Win + H" : "Ctrl + C", 43, 24, width - 49, 12, this.hintFont, primary && !stopping ? 0x46402E : 0xA9B2C1)
        if state & 0x10 {
            focus := Buffer(16, 0)
            NumPut("Int", 4, "Int", 4, "Int", width - 4, "Int", height - 4, focus)
            DllCall("user32\DrawFocusRect", "Ptr", hdc, "Ptr", focus)
        }
        return 1
    }

    MouseMoved(wParam, lParam, msg, hwnd) {
        if hwnd != this.app.toggleButton.Hwnd && hwnd != this.app.copyButton.Hwnd && hwnd != this.app.closeButton.Hwnd
            return
        if this.hover != hwnd {
            this.hover := hwnd
            this.Refresh()
            tracking := Buffer(A_PtrSize = 8 ? 24 : 16, 0)
            NumPut("UInt", tracking.Size, "UInt", 2, "Ptr", hwnd, tracking)
            DllCall("user32\TrackMouseEvent", "Ptr", tracking)
        }
    }

    MouseLeft(wParam, lParam, msg, hwnd) {
        if this.hover = hwnd {
            this.hover := 0
            this.Refresh()
        }
    }

    SetHand(wParam, lParam, msg, hwnd) {
        if wParam = this.app.toggleButton.Hwnd || wParam = this.app.copyButton.Hwnd || wParam = this.app.closeButton.Hwnd {
            cursor := DllCall("user32\LoadCursorW", "Ptr", 0, "Ptr", 32649, "Ptr")
            DllCall("user32\SetCursor", "Ptr", cursor)
            return 1
        }
    }

    Dispose() {
        OnMessage(0x2B, this.drawCallback, 0)
        OnMessage(0x14, this.eraseCallback, 0)
        OnMessage(0x200, this.mouseCallback, 0)
        OnMessage(0x2A3, this.leaveCallback, 0)
        OnMessage(0x20, this.cursorCallback, 0)
        DllCall("gdi32\DeleteObject", "Ptr", this.titleFont)
        DllCall("gdi32\DeleteObject", "Ptr", this.hintFont)
    }
}
