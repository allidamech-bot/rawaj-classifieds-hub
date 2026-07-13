from pathlib import Path

MAIN_ACTIVITY = Path("android/app/src/main/java/com/rawaj/marketplace/MainActivity.java")


def replace_once(source: str, old: str, new: str, label: str) -> str:
    if old not in source:
        raise SystemExit(f"{label} was not found")
    return source.replace(old, new, 1)


def main() -> None:
    source = MAIN_ACTIVITY.read_text(encoding="utf-8")

    source = replace_once(
        source,
        'private static final String RAWAJ_ORIGIN = "https://rawa-j.com";',
        'private static final String RAWAJ_ORIGIN = "https://localhost";',
        "RAWAJ_ORIGIN production constant",
    )

    source = replace_once(
        source,
        """        super.onCreate(savedInstanceState);

        routeIncomingIntent(getIntent());""",
        """        super.onCreate(savedInstanceState);

        forceBundledPreviewOrigin();
        routeIncomingIntent(getIntent());""",
        "MainActivity onCreate marker",
    )

    source = replace_once(
        source,
        """    @Override
    protected void onNewIntent(Intent intent) {""",
        """    @Override
    public void onResume() {
        super.onResume();
        forceBundledPreviewOrigin();
    }

    @Override
    protected void onNewIntent(Intent intent) {""",
        "MainActivity onNewIntent marker",
    )

    source = replace_once(
        source,
        """    private void routeIncomingIntent(Intent intent) {""",
        """    private String localPreviewUrl(Uri uri) {
        final Uri.Builder builder = Uri.parse(RAWAJ_ORIGIN).buildUpon();
        final String path = uri.getEncodedPath();
        builder.encodedPath(path == null || path.isEmpty() ? "/" : path);
        builder.encodedQuery(uri.getEncodedQuery());
        builder.encodedFragment(uri.getEncodedFragment());
        return builder.build().toString();
    }

    private void forceBundledPreviewOrigin() {
        final WebView webView = getBridge() == null ? null : getBridge().getWebView();
        if (webView == null) {
            return;
        }

        final long[] delays = new long[] { 0L, 250L, 750L, 1500L };
        for (long delay : delays) {
            webView.postDelayed(
                () -> {
                    final String currentUrl = webView.getUrl();
                    if (currentUrl == null || currentUrl.trim().isEmpty()) {
                        return;
                    }

                    final Uri currentUri = Uri.parse(currentUrl);
                    final String host = currentUri.getHost() == null
                        ? ""
                        : currentUri.getHost().toLowerCase(Locale.ROOT);
                    if (!RAWAJ_HOST.equals(host) && !host.endsWith("." + RAWAJ_HOST)) {
                        return;
                    }

                    final String localUrl = localPreviewUrl(currentUri);
                    if (!localUrl.equals(currentUrl)) {
                        webView.stopLoading();
                        webView.loadUrl(localUrl);
                        webView.postDelayed(webView::clearHistory, 350L);
                    }
                },
                delay
            );
        }
    }

    private void routeIncomingIntent(Intent intent) {""",
        "MainActivity routeIncomingIntent marker",
    )

    source = replace_once(
        source,
        """            return uri.toString();""",
        """            return localPreviewUrl(uri);""",
        "MainActivity HTTPS deep-link return",
    )

    if "clearCache(true)" in source:
        raise SystemExit("Bundled preview must not clear WebView storage")

    MAIN_ACTIVITY.write_text(source, encoding="utf-8")


if __name__ == "__main__":
    main()
