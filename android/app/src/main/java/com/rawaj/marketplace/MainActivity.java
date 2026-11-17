package com.rawaj.marketplace;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TRUSTED_WEB_SCHEME = "https";
    private static final String TRUSTED_WEB_HOST = "rawa-j.com";
    private static final String OAUTH_CALLBACK_PATH = "/auth/callback";

    private RawajLaunchController launchController;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        if (bridge != null) {
            launchController = new RawajLaunchController(this, bridge);
            launchController.install();
            if (savedInstanceState == null) {
                launchController.showInitialLoading();
            }
        }
    }

    @Override
    protected void onDestroy() {
        if (launchController != null) launchController.dispose();
        super.onDestroy();
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        routeIncomingIntent(intent);
    }

    private void routeIncomingIntent(Intent intent) {
        if (intent == null || bridge == null) {
            return;
        }

        final Uri incoming = intent.getData();
        if (incoming == null) {
            return;
        }

        final Uri trustedTarget = trustedTargetFor(incoming);
        if (trustedTarget == null) {
            return;
        }

        bridge.getWebView().post(() -> bridge.getWebView().loadUrl(trustedTarget.toString()));
    }

    private Uri trustedTargetFor(Uri incoming) {
        final String scheme = incoming.getScheme();
        final String host = incoming.getHost();

        if (
            TRUSTED_WEB_SCHEME.equalsIgnoreCase(scheme) &&
            TRUSTED_WEB_HOST.equalsIgnoreCase(host)
        ) {
            return incoming;
        }

        if (!getString(R.string.custom_url_scheme).equalsIgnoreCase(scheme)) {
            return null;
        }

        final String customPath = customSchemePath(incoming);
        if (!OAUTH_CALLBACK_PATH.equals(customPath)) {
            return null;
        }

        return new Uri.Builder()
            .scheme(TRUSTED_WEB_SCHEME)
            .authority(TRUSTED_WEB_HOST)
            .path(OAUTH_CALLBACK_PATH)
            .encodedQuery(incoming.getEncodedQuery())
            .encodedFragment(incoming.getEncodedFragment())
            .build();
    }

    private String customSchemePath(Uri incoming) {
        final String host = incoming.getHost();
        final String path = incoming.getPath();
        final StringBuilder combined = new StringBuilder();

        if (host != null && !host.isEmpty()) {
            combined.append('/').append(host);
        }
        if (path != null && !path.isEmpty()) {
            if (combined.length() == 0 && !path.startsWith("/")) {
                combined.append('/');
            }
            combined.append(path);
        }

        return combined.length() == 0 ? "/" : combined.toString();
    }

}
