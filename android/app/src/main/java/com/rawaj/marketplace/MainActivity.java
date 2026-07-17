package com.rawaj.marketplace;

import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.DecelerateInterpolator;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int INTRO_BACKGROUND_COLOR = Color.rgb(8, 6, 5);
    private static final String TRUSTED_WEB_SCHEME = "https";
    private static final String TRUSTED_WEB_HOST = "rawa-j.com";
    private static final String OAUTH_CALLBACK_PATH = "/auth/callback";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
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

        if (host != null && !host.isBlank()) {
            combined.append('/').append(host);
        }
        if (path != null && !path.isBlank()) {
            if (combined.length() == 0 && !path.startsWith("/")) {
                combined.append('/');
            }
            combined.append(path);
        }

        return combined.length() == 0 ? "/" : combined.toString();
    }

    private void showRawajLaunchIntro() {
        final ViewGroup root = findViewById(android.R.id.content);
        if (root == null) {
            return;
        }

        final int previousStatusBarColor = getWindow().getStatusBarColor();
        final int previousNavigationBarColor = getWindow().getNavigationBarColor();

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

        overlay
            .animate()
            .alpha(0f)
            .setStartDelay(1800L)
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
