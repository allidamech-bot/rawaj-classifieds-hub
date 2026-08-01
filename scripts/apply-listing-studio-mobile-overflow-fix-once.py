from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    source = file.read_text(encoding="utf-8")
    if old not in source:
        raise SystemExit(f"marker missing in {path}: {old[:120]!r}")
    file.write_text(source.replace(old, new, 1), encoding="utf-8")


replace_once(
    "src/lib/route-styles.ts",
    'import homeNotificationOverlayFixCss from "../home-notification-overlay-fix.css?url";\n',
    'import homeNotificationOverlayFixCss from "../home-notification-overlay-fix.css?url";\nimport listingStudioMobileOverflowFixCss from "../listing-studio-mobile-overflow-fix.css?url";\n',
)
replace_once(
    "src/lib/route-styles.ts",
    "  homeNotificationOverlayFixCss,\n] as const;",
    "  homeNotificationOverlayFixCss,\n  listingStudioMobileOverflowFixCss,\n] as const;",
)

path = Path("scripts/listing-studio-v4.test.mjs")
source = path.read_text(encoding="utf-8")
source = source.replace(
    "  navigationFix,\n  packageJson,",
    "  navigationFix,\n  mobileOverflowFix,\n  packageJson,",
    1,
)
source = source.replace(
    '  readFile(new URL("../src/listing-studio-navigation-fix.ts", import.meta.url), "utf8"),\n  readFile(new URL("../package.json", import.meta.url), "utf8"),',
    '  readFile(new URL("../src/listing-studio-navigation-fix.ts", import.meta.url), "utf8"),\n  readFile(new URL("../src/listing-studio-mobile-overflow-fix.css", import.meta.url), "utf8"),\n  readFile(new URL("../package.json", import.meta.url), "utf8"),',
    1,
)
marker = 'test("listing studio back navigation is explicit and cannot submit the form", () => {'
contract = '''test("mobile horizontal strips remain internal scroll containers", () => {
  assert.match(
    routeStyles,
    /listingStudioMobileOverflowFixCss from "\\.\\.\\/listing-studio-mobile-overflow-fix\\.css\\?url"/,
  );
  assert.ok(
    routeStyles.indexOf("listingStudioMobileOverflowFixCss") >
      routeStyles.indexOf("homeNotificationOverlayFixCss"),
  );
  assert.match(mobileOverflowFix, /width:\\s*100% !important/);
  assert.match(mobileOverflowFix, /max-width:\\s*100% !important/);
  assert.match(mobileOverflowFix, /min-width:\\s*0 !important/);
  assert.match(mobileOverflowFix, /overflow-x:\\s*auto !important/);
  assert.match(mobileOverflowFix, /contain:\\s*inline-size/);
  assert.match(mobileOverflowFix, /overscroll-behavior-inline:\\s*contain/);
});

'''
if marker not in source:
    raise SystemExit("listing studio contract insertion marker missing")
path.write_text(source.replace(marker, contract + marker, 1), encoding="utf-8")
