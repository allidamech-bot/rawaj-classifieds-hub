import { replaceOnce } from "./mobile-stabilization-patch-utils.mjs";

const activity = "android/app/src/main/java/com/rawaj/marketplace/MainActivity.java";

await replaceOnce(
  activity,
  "private static final long INTRO_MIN_VISIBLE_MS = 1800L;",
  "private static final long INTRO_MIN_VISIBLE_MS = 650L;",
  "short launch minimum",
);
await replaceOnce(
  activity,
  "private static final long INTRO_MAX_VISIBLE_MS = 8000L;",
  "private static final long INTRO_MAX_VISIBLE_MS = 2400L;",
  "bounded launch maximum",
);
await replaceOnce(
  activity,
  "new LinearLayout.LayoutParams(dp(300), dp(300));",
  "new LinearLayout.LayoutParams(dp(220), dp(220));",
  "intro stage size",
);
await replaceOnce(
  activity,
  "new FrameLayout.LayoutParams(dp(246), dp(246), Gravity.CENTER);",
  "new FrameLayout.LayoutParams(dp(176), dp(176), Gravity.CENTER);",
  "intro logo size",
);
await replaceOnce(
  activity,
  "arabicName.setTextSize(58f);",
  "arabicName.setTextSize(46f);",
  "intro Arabic size",
);
await replaceOnce(
  activity,
  "englishName.setTextSize(15f);",
  "englishName.setTextSize(13f);",
  "intro English size",
);
await replaceOnce(activity, ".setDuration(900L)", ".setDuration(520L)", "intro glow duration");
await replaceOnce(activity, ".setDuration(680L)", ".setDuration(420L)", "intro logo duration");
await replaceOnce(
  activity,
  ".setStartDelay(420L)\n            .setDuration(520L)",
  ".setStartDelay(180L)\n            .setDuration(300L)",
  "intro Arabic timing",
);
await replaceOnce(
  activity,
  ".setStartDelay(590L)\n            .setDuration(480L)",
  ".setStartDelay(300L)\n            .setDuration(260L)",
  "intro English timing",
);
await replaceOnce(
  activity,
  "webView.getProgress() < 90",
  "webView.getProgress() < 70",
  "intro readiness threshold",
);
await replaceOnce(activity, ".setDuration(380L)", ".setDuration(220L)", "intro fade duration");

await replaceOnce(
  "src/routes/index.tsx",
  'import { createFileRoute, useNavigate } from "@tanstack/react-router";',
  'import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";',
  "home router import",
);
await replaceOnce(
  "src/routes/index.tsx",
  'import { useState, type FormEvent } from "react";',
  'import { useCallback, useState, type FormEvent } from "react";',
  "home callback import",
);
await replaceOnce(
  "src/routes/index.tsx",
  'import { AppHeader } from "@/components/AppHeader";',
  'import { AppHeader } from "@/components/AppHeader";\nimport { NativePullToRefresh } from "@/components/native/NativePullToRefresh";',
  "home pull refresh import",
);
await replaceOnce(
  "src/routes/index.tsx",
  `  const navigate = useNavigate();
  const { language, text } = useUiPreferences();`,
  `  const navigate = useNavigate();
  const router = useRouter();
  const { language, text } = useUiPreferences();`,
  "home router state",
);
await replaceOnce(
  "src/routes/index.tsx",
  `  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = searchValue.trim();
    void navigate({ to: "/listings", search: q ? { q } : {} });
  }

  return (`,
  `  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = searchValue.trim();
    void navigate({ to: "/listings", search: q ? { q } : {} });
  }

  const refreshHome = useCallback(async () => {
    await router.invalidate();
  }, [router]);

  return (`,
  "home refresh callback",
);
await replaceOnce(
  "src/routes/index.tsx",
  `    <>
      <AppHeader />`,
  `    <>
      <NativePullToRefresh onRefresh={refreshHome} />
      <AppHeader />`,
  "home refresh mount",
);

await replaceOnce(
  "src/routes/__root.tsx",
  'import marketplaceSystemCss from "../marketplace-system.css?url";',
  'import marketplaceSystemCss from "../marketplace-system.css?url";\nimport mobileAppStabilizationCss from "../mobile-app-stabilization.css?url";',
  "mobile stabilization stylesheet import",
);
await replaceOnce(
  "src/routes/__root.tsx",
  `        { rel: "stylesheet", href: communicationCenterV2Css },
        { rel: "stylesheet", href: marketplaceSystemCss },`,
  `        { rel: "stylesheet", href: communicationCenterV2Css },
        { rel: "stylesheet", href: mobileAppStabilizationCss },
        { rel: "stylesheet", href: marketplaceSystemCss },`,
  "mobile stabilization stylesheet link",
);
