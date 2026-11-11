package com.hizirbey.tercuman;

import java.util.*;

public final class LanguageCatalog {
    public static final Locale TURKISH = Locale.forLanguageTag("tr");
    private static final Set<String> NON_LATIN = new HashSet<>(Arrays.asList(
        "ar","be","bg","bn","el","fa","gu","he","hi","ja","ka","kn","ko",
        "mk","mr","ru","ta","te","th","uk","ur","zh"));
    private LanguageCatalog() {}
    public static String name(String code) {
        String name = Locale.forLanguageTag(code).getDisplayLanguage(TURKISH);
        if (name.isEmpty()) return code;
        return name.substring(0,1).toUpperCase(TURKISH) + name.substring(1);
    }
    public static String speechTag(String code) {
        switch (code) {
            case "tr": return "tr-TR";
            case "en": return "en-US";
            case "mk": return "mk-MK";
            case "de": return "de-DE";
            case "ar": return "ar-SA";
            case "zh": return "zh-CN";
            case "pt": return "pt-BR";
            case "es": return "es-ES";
            case "fr": return "fr-FR";
            case "ja": return "ja-JP";
            case "ko": return "ko-KR";
            case "hi": return "hi-IN";
            case "ru": return "ru-RU";
            default: return code;
        }
    }
    public static boolean supportsEmbeddedSpeech(String code) {
        return !code.equals("eo")&&!code.equals("ga");
    }
    /** OCR availability is independent from translation availability. */
    public static String script(String code) {
        if (code.equals("zh")) return "Chinese";
        if (code.equals("ja")) return "Japanese";
        if (code.equals("ko")) return "Korean";
        if (code.equals("hi") || code.equals("mr")) return "Devanagari";
        return NON_LATIN.contains(code) ? "Unsupported" : "Latin";
    }
}
