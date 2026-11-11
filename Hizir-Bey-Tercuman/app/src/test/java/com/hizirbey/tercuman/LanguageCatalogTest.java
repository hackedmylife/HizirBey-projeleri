package com.hizirbey.tercuman;

import org.junit.Test;
import static org.junit.Assert.*;

public class LanguageCatalogTest {
    @Test public void ocrDoesNotPretendToSupportEveryTranslationLanguage(){
        assertEquals("Unsupported",LanguageCatalog.script("ar"));
        assertEquals("Unsupported",LanguageCatalog.script("ru"));
        assertEquals("Unsupported",LanguageCatalog.script("th"));
        assertEquals("Latin",LanguageCatalog.script("tr"));
        assertEquals("Devanagari",LanguageCatalog.script("hi"));
        assertEquals("Devanagari",LanguageCatalog.script("mr"));
        assertEquals("Chinese",LanguageCatalog.script("zh"));
        assertEquals("Japanese",LanguageCatalog.script("ja"));
        assertEquals("Korean",LanguageCatalog.script("ko"));
    }
    @Test public void recognitionUsesSpecificLocalesWhereNeeded(){
        assertEquals("tr-TR",LanguageCatalog.speechTag("tr"));
        assertEquals("en-US",LanguageCatalog.speechTag("en"));
    }
}
