import json
from pathlib import Path

CONFIG_PATH = Path("android/app/src/main/assets/capacitor.config.json")
MAIN_ACTIVITY = Path("android/app/src/main/java/com/rawaj/marketplace/MainActivity.java")
NATIVE_PLUGIN = Path("android/app/src/main/java/com/rawaj/marketplace/RawajNativePlugin.java")
ASSETS_DIR = Path("android/app/src/main/assets/public/assets")


def main() -> None:
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    server = config.get("server", {})
    if "url" in server:
        raise SystemExit("Bundled preview unexpectedly contains server.url")

    main_activity = MAIN_ACTIVITY.read_text(encoding="utf-8")
    required_native_markers = (
        'RAWAJ_ORIGIN = "https://localhost"',
        "forceBundledPreviewOrigin()",
        "localPreviewUrl(Uri uri)",
    )
    for marker in required_native_markers:
        if marker not in main_activity:
            raise SystemExit(f"Bundled MainActivity is missing {marker}")
    if "clearCache(true)" in main_activity:
        raise SystemExit("Bundled preview must not clear WebView storage or auth state")

    native_plugin = NATIVE_PLUGIN.read_text(encoding="utf-8")
    for marker in ("getAuthStorage", "setAuthStorage", "removeAuthStorage"):
        if marker not in native_plugin:
            raise SystemExit(f"Native auth storage is missing {marker}")

    javascript_files = sorted(ASSETS_DIR.glob("*.js"))
    if not javascript_files:
        raise SystemExit("Bundled preview JavaScript assets were not found")
    javascript = "\n".join(
        path.read_text(encoding="utf-8", errors="ignore") for path in javascript_files
    )

    if "rawaj-chat-inbox" not in javascript:
        raise SystemExit("Bundled APK does not contain the new chat inbox UI")
    if "rawaj-message-workspace" in javascript:
        raise SystemExit("Bundled APK still contains the retired chat workspace UI")
    for marker in ("getAuthStorage", "setAuthStorage", "removeAuthStorage"):
        if marker not in javascript:
            raise SystemExit(f"Bundled APK JavaScript is missing {marker}")


if __name__ == "__main__":
    main()
