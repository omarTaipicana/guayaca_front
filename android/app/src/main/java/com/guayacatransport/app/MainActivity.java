package com.guayacatransport.app;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
    @Override protected void onNewIntent(android.content.Intent intent) {
        setIntent(intent);
        super.onNewIntent(intent);
    }
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GuayacaSessionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
