# Huawei direct draft upload for RAWAJ

This workflow uploads the **existing, signed 1.0.4 (build 5) APK** from verified GitHub Actions run [38654844080](https://github.com/allidamech-bot/rawaj-classifieds-hub/actions/runs/38654844080). It avoids iPad file pickers and **never submits for AppGallery review or publication**.

## One-time setup

1. In Huawei AppGallery Connect, choose **Users and permissions → Connect API**, then create a dedicated API client with app-package management access to RAWAJ. Obtain the **Client ID** and **Key**. Keep the Key private.
2. Obtain RAWAJ's **numeric Huawei App ID** under the application's basic information. This is not `com.rawaj.marketplace`.
3. In the [GitHub repository's Actions secrets](https://github.com/allidamech-bot/rawaj-classifieds-hub/settings/secrets/actions), create three repository secrets: `HUAWEI_API_CLIENT_ID`, `HUAWEI_API_CLIENT_SECRET` (the Huawei Key), and `HUAWEI_APP_ID`.
4. In [GitHub Actions](https://github.com/allidamech-bot/rawaj-classifieds-hub/actions), open **Upload existing RAWAJ APK to Huawei Draft**. Click **Run workflow**, type `UPLOAD`, and run.
5. After success, return to Huawei **Manage packages** to inspect the 1.0.4 candidate and run Cloud Testing. Do not submit until actual app launch and sign-in on a GMS-free Huawei device are verified.

## Important safeguards

- The workflow never uploads `3.apk` from Google Play.
- It does not build or re-sign the app, so the signing identity is unchanged.
- The artifact is retained until **2026-10-28**; if it expires, a new *consistent-key* build must be prepared, not a newly generated random-key build.
- GitHub Actions secrets must never be copied into the repository or pasted into chat.
- A successful package upload is **not** a passed device test.
