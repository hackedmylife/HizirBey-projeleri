package com.hizirbey.tercuman;
import android.content.Context;
import android.security.keystore.*;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;
final class ApiKeyStore {
    private static final String ALIAS="hizir-groq-key-v1";
    private static javax.crypto.SecretKey key()throws Exception{
        KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
        if(store.containsAlias(ALIAS))return (javax.crypto.SecretKey)store.getKey(ALIAS,null);
        KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());return generator.generateKey();
    }
    static boolean has(Context c){return c.getSharedPreferences("api-secrets",0).contains("groq");}
    static void save(Context c,String value)throws Exception{
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());
        String sealed=Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)),Base64.NO_WRAP);
        if(!c.getSharedPreferences("api-secrets",0).edit().putString("groq",sealed).commit())throw new java.io.IOException("Anahtar kaydedilemedi.");
    }
    static String read(Context c)throws Exception{
        String sealed=c.getSharedPreferences("api-secrets",0).getString("groq","");if(sealed.isEmpty())return "";String[] parts=sealed.split(":",2);
        if(parts.length!=2)throw new java.io.IOException("Anahtar okunamadı.");Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)));
        return new String(cipher.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),StandardCharsets.UTF_8);
    }
    static void clear(Context c){c.getSharedPreferences("api-secrets",0).edit().clear().apply();}
}
