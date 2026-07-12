package com.rawaj.marketplace;

import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.DecelerateInterpolator;
import android.view.animation.OvershootInterpolator;
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
    private static final long INTRO_MIN_VISIBLE_MS = 650L;
    private static final long INTRO_MAX_VISIBLE_MS = 2400L;

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

        final View ambientGlow = new View(this);
        ambientGlow.setBackground(radialGlow(Color.argb(138, 196, 92, 18), Color.TRANSPARENT, 260));
        ambientGlow.setAlpha(0f);
        ambientGlow.setScaleX(0.72f);
        ambientGlow.setScaleY(0.72f);
        overlay.addView(
            ambientGlow,
            new FrameLayout.LayoutParams(dp(470), dp(470), Gravity.CENTER)
        );

        final View topSheen = new View(this);
        topSheen.setBackground(
            roundedGradient(
                new int[] {
                    Color.TRANSPARENT,
                    Color.argb(42, 242, 199, 127),
                    Color.TRANSPARENT
                },
                999
            )
        );
        topSheen.setAlpha(0f);
        topSheen.setRotation(-18f);
        final FrameLayout.LayoutParams sheenParams =
            new FrameLayout.LayoutParams(dp(360), dp(2), Gravity.CENTER);
        sheenParams.topMargin = -dp(120);
        overlay.addView(topSheen, sheenParams);

        final LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER_HORIZONTAL);
        content.setPadding(dp(24), 0, dp(24), 0);

        final FrameLayout logoStage = new FrameLayout(this);
        final LinearLayout.LayoutParams logoStageParams =
            new LinearLayout.LayoutParams(dp(248), dp(248));

        final View outerRing = new View(this);
        outerRing.setBackground(ringDrawable(Color.argb(90, 242, 199, 127), dp(1)));
        outerRing.setAlpha(0f);
        outerRing.setScaleX(0.64f);
        outerRing.setScaleY(0.64f);
        outerRing.setRotation(-20f);
        logoStage.addView(
            outerRing,
            new FrameLayout.LayoutParams(dp(232), dp(232), Gravity.CENTER)
        );

        final View innerRing = new View(this);
        innerRing.setBackground(ringDrawable(Color.argb(72, 242, 113, 55), dp(1)));
        innerRing.setAlpha(0f);
        innerRing.setScaleX(1.18f);
        innerRing.setScaleY(1.18f);
        innerRing.setRotation(16f);
        logoStage.addView(
            innerRing,
            new FrameLayout.LayoutParams(dp(196), dp(196), Gravity.CENTER)
        );

        final View glow = new View(this);
        glow.setBackgroundResource(R.drawable.rawaj_logo_glow);
        glow.setAlpha(0f);
        glow.setScaleX(0.58f);
        glow.setScaleY(0.58f);
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
        logo.setScaleX(0.56f);
        logo.setScaleY(0.56f);
        logo.setRotation(-5f);
        logo.setTranslationY(dp(18));
        final FrameLayout.LayoutParams logoParams =
            new FrameLayout.LayoutParams(dp(158), dp(158), Gravity.CENTER);
        logoStage.addView(logo, logoParams);
        content.addView(logoStage, logoStageParams);

        final TextView arabicName = new TextView(this);
        arabicName.setText("رواج");
        arabicName.setTextColor(getColor(R.color.rawaj_intro_ivory));
        arabicName.setTextSize(44f);
        arabicName.setTypeface(Typeface.create("sans-serif", Typeface.BOLD));
        arabicName.setGravity(Gravity.CENTER);
        arabicName.setLetterSpacing(0.015f);
        arabicName.setShadowLayer(dp(18), 0f, dp(3), Color.rgb(196, 105, 19));
        arabicName.setAlpha(0f);
        arabicName.setTranslationY(dp(20));
        content.addView(
            arabicName,
            new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        );

        final View brandLine = new View(this);
        brandLine.setBackground(
            roundedGradient(
                new int[] {
                    Color.TRANSPARENT,
                    Color.argb(230, 242, 199, 127),
                    Color.TRANSPARENT
                },
                999
            )
        );
        brandLine.setAlpha(0f);
        brandLine.setScaleX(0.3f);
        final LinearLayout.LayoutParams lineParams =
            new LinearLayout.LayoutParams(dp(88), dp(1));
        lineParams.topMargin = dp(6);
        content.addView(brandLine, lineParams);

        final TextView tagline = new TextView(this);
        tagline.setText("السوق الأقرب إليك");
        tagline.setTextColor(Color.argb(190, 242, 231, 216));
        tagline.setTextSize(11f);
        tagline.setTypeface(Typeface.create("sans-serif", Typeface.NORMAL));
        tagline.setGravity(Gravity.CENTER);
        tagline.setLetterSpacing(0.035f);
        tagline.setAlpha(0f);
        tagline.setTranslationY(dp(10));
        final LinearLayout.LayoutParams taglineParams =
            new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            );
        taglineParams.topMargin = dp(8);
        content.addView(tagline, taglineParams);

        final TextView englishName = new TextView(this);
        englishName.setText("R A W A J");
        englishName.setTextColor(getColor(R.color.rawaj_intro_gold));
        englishName.setTextSize(11f);
        englishName.setTypeface(Typeface.create("serif", Typeface.NORMAL));
        englishName.setGravity(Gravity.CENTER);
        englishName.setLetterSpacing(0.11f);
        englishName.setAlpha(0f);
        englishName.setTranslationY(dp(9));
        final LinearLayout.LayoutParams englishParams =
            new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            );
        englishParams.topMargin = dp(7);
        content.addView(englishName, englishParams);

        final FrameLayout progressRail = new FrameLayout(this);
        progressRail.setBackground(solidRounded(Color.argb(30, 255, 255, 255), 999));
        progressRail.setAlpha(0f);
        final LinearLayout.LayoutParams progressParams =
            new LinearLayout.LayoutParams(dp(116), dp(3));
        progressParams.topMargin = dp(22);

        final View progressFill = new View(this);
        progressFill.setBackground(
            roundedGradient(
                new int[] {
                    Color.rgb(242, 199, 127),
                    Color.rgb(242, 113, 55)
                },
                999
            )
        );
        progressFill.setTranslationX(-dp(38));
        progressRail.addView(
            progressFill,
            new FrameLayout.LayoutParams(dp(42), dp(3), Gravity.CENTER)
        );
        content.addView(progressRail, progressParams);

        final FrameLayout.LayoutParams contentParams =
            new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER
            );
        contentParams.bottomMargin = dp(12);
        overlay.addView(content, contentParams);

        root.addView(
            overlay,
            new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );

        ambientGlow
            .animate()
            .alpha(0.88f)
            .scaleX(1.04f)
            .scaleY(1.04f)
            .setDuration(900L)
            .setInterpolator(new DecelerateInterpolator())
            .start();

        topSheen
            .animate()
            .alpha(0.68f)
            .translationY(dp(24))
            .setStartDelay(120L)
            .setDuration(680L)
            .setInterpolator(new DecelerateInterpolator())
            .start();

        outerRing
            .animate()
            .alpha(0.48f)
            .scaleX(1.03f)
            .scaleY(1.03f)
            .rotation(0f)
            .setDuration(850L)
            .setInterpolator(new DecelerateInterpolator())
            .start();

        innerRing
            .animate()
            .alpha(0.34f)
            .scaleX(1f)
            .scaleY(1f)
            .rotation(0f)
            .setStartDelay(60L)
            .setDuration(720L)
            .setInterpolator(new DecelerateInterpolator())
            .start();

        glow
            .animate()
            .alpha(0.92f)
            .scaleX(1.12f)
            .scaleY(1.12f)
            .setDuration(720L)
            .setInterpolator(new DecelerateInterpolator())
            .start();

        logo
            .animate()
            .alpha(1f)
            .scaleX(1f)
            .scaleY(1f)
            .rotation(0f)
            .translationY(0f)
            .setDuration(560L)
            .setInterpolator(new OvershootInterpolator(0.72f))
            .start();

        arabicName
            .animate()
            .alpha(1f)
            .translationY(0f)
            .setStartDelay(170L)
            .setDuration(360L)
            .setInterpolator(new DecelerateInterpolator())
            .start();

        brandLine
            .animate()
            .alpha(1f)
            .scaleX(1f)
            .setStartDelay(260L)
            .setDuration(360L)
            .setInterpolator(new DecelerateInterpolator())
            .start();

        tagline
            .animate()
            .alpha(1f)
            .translationY(0f)
            .setStartDelay(300L)
            .setDuration(340L)
            .setInterpolator(new DecelerateInterpolator())
            .start();

        englishName
            .animate()
            .alpha(1f)
            .translationY(0f)
            .setStartDelay(390L)
            .setDuration(300L)
            .setInterpolator(new DecelerateInterpolator())
            .start();

        progressRail
            .animate()
            .alpha(1f)
            .setStartDelay(420L)
            .setDuration(220L)
            .start();

        progressFill
            .animate()
            .translationX(dp(38))
            .setStartDelay(430L)
            .setDuration(900L)
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

                overlay.postDelayed(this, 100L);
            }
        };
        overlay.post(finishWhenWebContentIsReady);
    }

    private boolean isWebContentReady(WebView webView) {
        if (webView == null || webView.getProgress() < 70) {
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
            .scaleX(1.015f)
            .scaleY(1.015f)
            .setDuration(240L)
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

    private GradientDrawable radialGlow(int centerColor, int edgeColor, int radiusDp) {
        final GradientDrawable drawable = new GradientDrawable();
        drawable.setShape(GradientDrawable.OVAL);
        drawable.setGradientType(GradientDrawable.RADIAL_GRADIENT);
        drawable.setGradientRadius(dp(radiusDp));
        drawable.setColors(new int[] { centerColor, edgeColor });
        return drawable;
    }

    private GradientDrawable ringDrawable(int strokeColor, int strokeWidth) {
        final GradientDrawable drawable = new GradientDrawable();
        drawable.setShape(GradientDrawable.OVAL);
        drawable.setColor(Color.TRANSPARENT);
        drawable.setStroke(strokeWidth, strokeColor);
        return drawable;
    }

    private GradientDrawable solidRounded(int color, int radiusDp) {
        final GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(radiusDp));
        return drawable;
    }

    private GradientDrawable roundedGradient(int[] colors, int radiusDp) {
        final GradientDrawable drawable =
            new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, colors);
        drawable.setCornerRadius(dp(radiusDp));
        return drawable;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
