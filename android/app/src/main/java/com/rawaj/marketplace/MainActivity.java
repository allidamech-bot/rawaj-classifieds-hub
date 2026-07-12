package com.rawaj.marketplace;

import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.DecelerateInterpolator;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.getcapacitor.BridgeActivity;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    private static final int INTRO_BACKGROUND_COLOR = Color.rgb(8, 6, 5);
    private static final String RAWAJ_ORIGIN = "https://rawa-j.com";
    private static final String RAWAJ_HOST = "rawa-j.com";
    private static final String RAWAJ_AUTH_SCHEME = "com.rawaj.marketplace";
    private static final long INTRO_MIN_VISIBLE_MS = 1800L;
    private static final long INTRO_MAX_VISIBLE_MS = 8000L;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(RawajNativePlugin.class);
        super.onCreate(savedInstanceState);

        routeIncomingIntent(getIntent());
        if (savedInstanceState == null) {
            showRawajLaunchIntro();
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        routeIncomingIntent(intent);
    }

    @Override
    public void onBackPressed() {
        final WebView webView = getBridge() == null ? null : getBridge().getWebView();
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    private void routeIncomingIntent(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) {
            return;
        }

        final String targetUrl = webUrlForDeepLink(intent.getData());
        final WebView webView = getBridge() == null ? null : getBridge().getWebView();
        if (targetUrl == null || webView == null) {
            return;
        }

        webView.post(
            () -> {
                final String currentUrl = webView.getUrl();
                if (!targetUrl.equals(currentUrl)) {
                    webView.loadUrl(targetUrl);
                }
            }
        );
    }

    private String webUrlForDeepLink(Uri uri) {
        if (uri == null || uri.getScheme() == null) {
            return null;
        }

        final String scheme = uri.getScheme().toLowerCase(Locale.ROOT);
        final String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);

        if ("https".equals(scheme)) {
            if (!RAWAJ_HOST.equals(host) && !host.endsWith("." + RAWAJ_HOST)) {
                return null;
            }
            return uri.toString();
        }

        if (
            RAWAJ_AUTH_SCHEME.equals(scheme) &&
            "auth".equals(host) &&
            "/callback".equals(uri.getPath())
        ) {
            return Uri.parse(RAWAJ_ORIGIN + "/auth/callback")
                .buildUpon()
                .encodedQuery(uri.getEncodedQuery())
                .encodedFragment(uri.getEncodedFragment())
                .build()
                .toString();
        }

        return null;
    }

    private void showRawajLaunchIntro() {
        final ViewGroup root = findViewById(android.R.id.content);
        if (root == null) {
            return;
        }

        final int previousStatusBarColor = getWindow().getStatusBarColor();
        final int previousNavigationBarColor = getWindow().getNavigationBarColor();
        final long introStartedAt = SystemClock.uptimeMillis();

        getWindow().setStatusBarColor(INTRO_BACKGROUND_COLOR);
        getWindow().setNavigationBarColor(INTRO_BACKGROUND_COLOR);

        final FrameLayout overlay = new FrameLayout(this);
        overlay.setBackgroundResource(R.drawable.rawaj_intro_background);
        overlay.setClickable(true);
        overlay.setFocusable(true);
        overlay.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);

        final LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER_HORIZONTAL);

        final FrameLayout logoStage = new FrameLayout(this);
        final LinearLayout.LayoutParams logoStageParams =
            new LinearLayout.LayoutParams(dp(300), dp(300));

        final View glow = new View(this);
        glow.setBackgroundResource(R.drawable.rawaj_logo_glow);
        glow.setAlpha(0f);
        glow.setScaleX(0.72f);
        glow.setScaleY(0.72f);
        logoStage.addView(
            glow,
            new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
                Gravity.CENTER
            )
        );

        final ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.rawaj_logo_mark);
        logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
        logo.setAlpha(0f);
        logo.setScaleX(0.76f);
        logo.setScaleY(0.76f);
        logo.setTranslationY(dp(22));
        final FrameLayout.LayoutParams logoParams =
            new FrameLayout.LayoutParams(dp(246), dp(246), Gravity.CENTER);
        logoStage.addView(logo, logoParams);
        content.addView(logoStage, logoStageParams);

        final TextView arabicName = new TextView(this);
        arabicName.setText("رواج");
        arabicName.setTextColor(getColor(R.color.rawaj_intro_ivory));
        arabicName.setTextSize(58f);
        arabicName.setTypeface(Typeface.create("sans-serif", Typeface.NORMAL));
        arabicName.setGravity(Gravity.CENTER);
        arabicName.setShadowLayer(dp(18), 0f, dp(3), Color.rgb(196, 105, 19));
        arabicName.setAlpha(0f);
        arabicName.setTranslationY(dp(18));
        content.addView(
            arabicName,
            new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        );

        final TextView englishName = new TextView(this);
        englishName.setText("R A W A J");
        englishName.setTextColor(getColor(R.color.rawaj_intro_gold));
        englishName.setTextSize(15f);
        englishName.setTypeface(Typeface.create("serif", Typeface.NORMAL));
        englishName.setGravity(Gravity.CENTER);
        englishName.setAlpha(0f);
        englishName.setTranslationY(dp(12));
        final LinearLayout.LayoutParams englishParams =
            new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            );
        englishParams.topMargin = dp(2);
        content.addView(englishName, englishParams);

        final FrameLayout.LayoutParams contentParams =
            new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER
            );
        contentParams.bottomMargin = dp(18);
        overlay.addView(content, contentParams);

        root.addView(
            overlay,
            new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );

        glow
            .animate()
            .alpha(0.9f)
            .scaleX(1.08f)
            .scaleY(1.08f)
            .setDuration(900L)
            .setInterpolator(new DecelerateInterpolator())
            .start();

        logo
            .animate()
            .alpha(1f)
            .scaleX(1f)
            .scaleY(1f)
            .translationY(0f)
            .setDuration(680L)
            .setInterpolator(new DecelerateInterpolator())
            .start();

        arabicName
            .animate()
            .alpha(1f)
            .translationY(0f)
            .setStartDelay(420L)
            .setDuration(520L)
            .setInterpolator(new DecelerateInterpolator())
            .start();

        englishName
            .animate()
            .alpha(1f)
            .translationY(0f)
            .setStartDelay(590L)
            .setDuration(480L)
            .setInterpolator(new DecelerateInterpolator())
            .start();

        final Runnable finishWhenWebContentIsReady = new Runnable() {
            @Override
            public void run() {
                if (overlay.getParent() != root) {
                    return;
                }

                final long elapsed = SystemClock.uptimeMillis() - introStartedAt;
                final WebView webView = getBridge() == null ? null : getBridge().getWebView();
                final boolean reachedDeadline = elapsed >= INTRO_MAX_VISIBLE_MS;
                final boolean mayFinish = elapsed >= INTRO_MIN_VISIBLE_MS;

                if (mayFinish && (isWebContentReady(webView) || reachedDeadline)) {
                    fadeOutIntro(
                        root,
                        overlay,
                        previousStatusBarColor,
                        previousNavigationBarColor
                    );
                    return;
                }

                overlay.postDelayed(this, 120L);
            }
        };
        overlay.post(finishWhenWebContentIsReady);
    }

    private boolean isWebContentReady(WebView webView) {
        if (webView == null || webView.getProgress() < 90) {
            return false;
        }
        final String url = webView.getUrl();
        return url != null && !url.isEmpty() && !"about:blank".equals(url);
    }

    private void fadeOutIntro(
        ViewGroup root,
        FrameLayout overlay,
        int previousStatusBarColor,
        int previousNavigationBarColor
    ) {
        overlay
            .animate()
            .alpha(0f)
            .setDuration(380L)
            .setInterpolator(new DecelerateInterpolator())
            .withEndAction(
                () -> {
                    if (overlay.getParent() == root) {
                        root.removeView(overlay);
                    }
                    getWindow().setStatusBarColor(previousStatusBarColor);
                    getWindow().setNavigationBarColor(previousNavigationBarColor);
                }
            )
            .start();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
