package com.rawaj.marketplace;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.ConnectivityManager;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

/** Native, bundled launch and main-frame failure UI. No new JS bridge or TLS override. */
final class RawajLaunchController {
    private static final String HOME = "https://rawa-j.com/";
    private static final long STARTUP_TIMEOUT_MS = 20000L;
    private final Activity activity;
    private final Bridge bridge;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private FrameLayout overlay;
    private String target = HOME;
    private boolean failed;
    private boolean loading;
    private int previousAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_AUTO;

    private final Runnable startupTimeout = this::handleStartupTimeout;

    private void handleStartupTimeout() {
        if (!loading || overlay == null) return;
        bridge.getWebView().stopLoading();
        showFailure(networkAvailable() ? R.string.connection_failed_title : R.string.connection_offline_title,
            networkAvailable() ? R.string.connection_failed_message : R.string.connection_offline_message, true);
    }

    RawajLaunchController(Activity activity, Bridge bridge) {
        this.activity = activity;
        this.bridge = bridge;
    }

    void install() {
        // Extend the real Capacitor client, preserving its request interception,
        // navigation policies, bridge reset and plugin lifecycle callbacks.
        bridge.getWebView().setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                if (!trusted(url)) return;
                target = url;
                failed = false;
                if (overlay != null) showLoading();
            }

            @Override public void onPageCommitVisible(WebView view, String url) {
                super.onPageCommitVisible(view, url);
                if (trusted(url) && !failed) dismiss();
            }

            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (!request.isForMainFrame() || !trusted(request.getUrl().toString())) return;
                int code = error.getErrorCode();
                boolean retryable = "GET".equalsIgnoreCase(request.getMethod());
                target = request.getUrl().toString();
                if (code == WebViewClient.ERROR_FAILED_SSL_HANDSHAKE) {
                    showFailure(R.string.connection_security_title, R.string.connection_security_message, retryable);
                } else if (code == WebViewClient.ERROR_HOST_LOOKUP || code == WebViewClient.ERROR_CONNECT
                        || code == WebViewClient.ERROR_TIMEOUT || code == WebViewClient.ERROR_IO) {
                    boolean online = networkAvailable();
                    showFailure(online ? R.string.connection_failed_title : R.string.connection_offline_title,
                        online ? R.string.connection_failed_message : R.string.connection_offline_message, retryable);
                } else {
                    // Other error types remain under normal WebView/Capacitor handling.
                    dismiss();
                }
            }

            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                super.onReceivedHttpError(view, request, response);
                if (!request.isForMainFrame() || !trusted(request.getUrl().toString())) return;
                int status = response.getStatusCode();
                if (status >= 500 && status <= 599) {
                    target = request.getUrl().toString();
                    showFailure(R.string.connection_server_title, R.string.connection_server_message,
                        "GET".equalsIgnoreCase(request.getMethod()));
                }
            }
        });
    }

    void showInitialLoading() {
        showLoading();
    }

    private static boolean trusted(String url) {
        if (url == null) return false;
        Uri uri = Uri.parse(url);
        return "https".equalsIgnoreCase(uri.getScheme()) && "rawa-j.com".equalsIgnoreCase(uri.getHost())
            && (uri.getPort() == -1 || uri.getPort() == 443);
    }

    private boolean networkAvailable() {
        ConnectivityManager manager = (ConnectivityManager) activity.getSystemService(Activity.CONNECTIVITY_SERVICE);
        return manager != null && manager.getActiveNetwork() != null;
    }

    private void showLoading() {
        failed = false;
        loading = true;
        LinearLayout content = makeOverlay();
        ProgressBar spinner = new ProgressBar(activity);
        spinner.setIndeterminateTintList(ColorStateList.valueOf(activity.getColor(R.color.rawaj_intro_gold)));
        content.addView(spinner, new LinearLayout.LayoutParams(dp(30), dp(30)));
        addText(content, R.string.launch_loading, 14, false);
        handler.removeCallbacks(startupTimeout);
        handler.postDelayed(startupTimeout, STARTUP_TIMEOUT_MS);
    }

    private void showFailure(int title, int message, boolean retryable) {
        failed = true;
        loading = false;
        handler.removeCallbacks(startupTimeout);
        LinearLayout content = makeOverlay();
        addText(content, title, 22, true);
        addText(content, message, 16, false);
        if (retryable) {
            Button retry = addButton(content, R.string.connection_retry, true);
            retry.setOnClickListener(v -> {
                if (!failed || !trusted(target)) return;
                showLoading();
                bridge.getWebView().loadUrl(target);
            });
        }
        Button settings = addButton(content, R.string.connection_settings, false);
        settings.setOnClickListener(v -> {
            try {
                activity.startActivity(new Intent(Settings.ACTION_WIRELESS_SETTINGS));
            } catch (ActivityNotFoundException ignored) {
                settings.setEnabled(false);
            }
        });
    }

    private LinearLayout makeOverlay() {
        ViewGroup root = activity.findViewById(android.R.id.content);
        if (overlay == null) {
            overlay = new FrameLayout(activity);
            overlay.setBackgroundColor(activity.getColor(R.color.rawaj_launch_background));
            overlay.setClickable(true);
            previousAccessibility = bridge.getWebView().getImportantForAccessibility();
            bridge.getWebView().setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
            root.addView(overlay, new ViewGroup.LayoutParams(-1, -1));
            ViewCompat.setOnApplyWindowInsetsListener(overlay, (view, insets) -> {
                Insets safe = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
                return insets;
            });
            ViewCompat.requestApplyInsets(overlay);
        } else {
            overlay.removeAllViews();
        }
        ScrollView scroll = new ScrollView(activity);
        scroll.setFillViewport(true);
        overlay.addView(scroll, new FrameLayout.LayoutParams(-1, -1));
        LinearLayout content = new LinearLayout(activity);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER);
        content.setLayoutDirection(View.LAYOUT_DIRECTION_LOCALE);
        content.setPadding(dp(24), dp(20), dp(24), dp(20));
        scroll.addView(content, new ScrollView.LayoutParams(-1, -2));

        ImageView logo = new ImageView(activity);
        logo.setImageResource(R.drawable.rawaj_logo_mark);
        logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
        logo.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        int screenWidth = activity.getResources().getConfiguration().screenWidthDp;
        int screenHeight = activity.getResources().getConfiguration().screenHeightDp;
        int logoSize = Math.max(72, Math.min(168, Math.min(screenWidth, screenHeight) / 3));
        content.addView(logo, new LinearLayout.LayoutParams(dp(logoSize), dp(logoSize)));
        addText(content, R.string.app_name, 24, true);
        return content;
    }

    private void addText(LinearLayout parent, int text, int size, boolean bold) {
        TextView label = new TextView(activity);
        label.setGravity(Gravity.CENTER);
        label.setText(text);
        label.setTextSize(size);
        label.setTextColor(activity.getColor(R.color.rawaj_intro_ivory));
        if (bold) label.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.topMargin = dp(10);
        parent.addView(label, params);
    }

    private Button addButton(LinearLayout parent, int text, boolean primary) {
        Button button = new Button(activity);
        button.setText(text);
        button.setAllCaps(false);
        button.setMinHeight(dp(48));
        button.setTextColor(primary ? Color.BLACK : activity.getColor(R.color.rawaj_intro_ivory));
        if (primary) button.setBackgroundTintList(ColorStateList.valueOf(activity.getColor(R.color.rawaj_intro_gold)));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.topMargin = dp(12);
        parent.addView(button, params);
        return button;
    }

    private void dismiss() {
        handler.removeCallbacks(startupTimeout);
        loading = false;
        if (overlay != null) {
            ViewGroup parent = (ViewGroup) overlay.getParent();
            if (parent != null) parent.removeView(overlay);
            overlay = null;
            bridge.getWebView().setImportantForAccessibility(previousAccessibility);
        }
    }

    void dispose() { dismiss(); }

    private int dp(int value) {
        return Math.round(value * activity.getResources().getDisplayMetrics().density);
    }
}
