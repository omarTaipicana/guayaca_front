package com.guayacatransport.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "GuayacaSession")
public class GuayacaSessionPlugin extends Plugin {
    private static final String ALIAS = "guayaca_session_v1";
    private SecretKey key() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore"); ks.load(null);
        if (!ks.containsAlias(ALIAS)) {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
            generator.generateKey();
        }
        return (SecretKey) ks.getKey(ALIAS, null);
    }
    private SharedPreferences prefs() { return getContext().getSharedPreferences("guayaca_session", Context.MODE_PRIVATE); }
    @PluginMethod public void set(PluginCall call) {
        try {
            String token = call.getString("token", "");
            if (token.isEmpty()) { if(!prefs().edit().clear().commit()) throw new Exception(); call.resolve(); return; }
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key());
            String encrypted = Base64.encodeToString(cipher.doFinal(token.getBytes(java.nio.charset.StandardCharsets.UTF_8)), Base64.NO_WRAP);
            if(!prefs().edit().putString("token", encrypted).putString("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)).commit()) throw new Exception();
            call.resolve();
        } catch (Exception e) { call.reject("No se pudo proteger la sesión en el dispositivo"); }
    }
    @PluginMethod public void get(PluginCall call) {
        try {
            String stored = prefs().getString("token", null); JSObject result = new JSObject();
            if (stored == null) { result.put("token", ""); call.resolve(result); return; }
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(prefs().getString("iv", ""), Base64.NO_WRAP)));
            result.put("token", new String(cipher.doFinal(Base64.decode(stored, Base64.NO_WRAP)), java.nio.charset.StandardCharsets.UTF_8)); call.resolve(result);
        } catch (Exception e) { call.reject("No se pudo recuperar la sesión local; inicia sesión con conexión"); }
    }
    @PluginMethod public void configureChannel(PluginCall call) {
        try {
            boolean sound=Boolean.TRUE.equals(call.getBoolean("sound", false));
            boolean vibration=Boolean.TRUE.equals(call.getBoolean("vibration", false));
            String id="guayaca_s"+(sound?"1":"0")+"v"+(vibration?"1":"0")+"_v1";
            android.app.NotificationChannel channel=new android.app.NotificationChannel(id,"GUAYACA · "+(sound?"sonido":"sin sonido")+" · "+(vibration?"vibración":"sin vibración"),android.app.NotificationManager.IMPORTANCE_HIGH);
            channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PRIVATE);
            channel.enableVibration(vibration);
            if(vibration)channel.setVibrationPattern(new long[]{0,220,100,220});
            if(sound)channel.setSound(android.net.Uri.parse("android.resource://"+getContext().getPackageName()+"/raw/guayaca_alert"),new android.media.AudioAttributes.Builder().setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION).setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            else channel.setSound(null,null);
            ((android.app.NotificationManager)getContext().getSystemService(Context.NOTIFICATION_SERVICE)).createNotificationChannel(channel);
            JSObject result=new JSObject();result.put("id",id);call.resolve(result);
        }catch(Exception e){call.reject("No se pudo configurar el canal de avisos");}
    }
}
