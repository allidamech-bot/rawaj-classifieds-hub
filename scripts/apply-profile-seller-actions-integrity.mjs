import { readFile, rm, writeFile } from "node:fs/promises";

async function transform(path, mutate) {
  const source = await readFile(path, "utf8");
  const next = mutate(source);
  if (next === source) throw new Error(`${path}: transformation made no changes`);
  await writeFile(path, next);
}
function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}
function replaceRegexOnce(source, pattern, replacement, label) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const count = [...source.matchAll(new RegExp(pattern.source, flags))].length;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(pattern, replacement);
}

await transform("src/routes/profile.tsx", (initial) => {
  let source = initial;
  source = replaceOnce(
    source,
    `  const [logoutError, setLogoutError] = useState("");`,
    `  const [logoutError, setLogoutError] = useState("");\n  const [loggingOut, setLoggingOut] = useState(false);`,
    "profile logout state",
  );
  source = replaceOnce(
    source,
    `  const mediaSavingProfilesRef = useRef<Set<string>>(new Set());`,
    `  const mediaSavingProfilesRef = useRef<Set<string>>(new Set());\n  const logoutInFlightRef = useRef(false);`,
    "profile logout ref",
  );
  source = replaceRegexOnce(
    source,
    /  const reloadListings = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[auth\.profile\?\.id, profileId\]\);/,
    `  const reloadListings = useCallback(async () => {
    if (!profileId) return;
    const currentProfileId = profileId;
    const requestId = ++listingsRequestIdRef.current;
    setMyListingsLoading(true);
    setMyListingsError(null);
    try {
      const result = await fetchCurrentUserListings(currentProfileId);
      if (requestId !== listingsRequestIdRef.current || currentProfileId !== profileIdRef.current) return;
      if (result.ok) {
        setMyListings(result.data);
        setMyListingsHasLoaded(true);
      } else {
        setMyListingsError(result.error);
      }
    } catch (caught) {
      if (requestId !== listingsRequestIdRef.current || currentProfileId !== profileIdRef.current) return;
      setMyListingsError({
        code: "unknown",
        message: caught instanceof Error ? caught.message : text("تعذر تحميل إعلاناتك.", "Could not load your listings."),
        operation: "profile_listings_load",
      });
    } finally {
      if (requestId === listingsRequestIdRef.current && currentProfileId === profileIdRef.current) {
        setMyListingsLoading(false);
      }
    }
  }, [profileId, text]);`,
    "profile listings load lifecycle",
  );
  source = replaceRegexOnce(
    source,
    /  const loadVerificationRequests = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[auth\.profile\?\.id, profileId\]\);/,
    `  const loadVerificationRequests = useCallback(async () => {
    if (!profileId) return;
    const currentProfileId = profileId;
    const requestId = ++verificationRequestIdRef.current;
    setVerificationLoading(true);
    setVerificationError(null);
    try {
      const result = await fetchMyVerificationRequests();
      if (requestId !== verificationRequestIdRef.current || currentProfileId !== profileIdRef.current) return;
      if (result.ok) {
        setVerificationRequests(result.data);
        setVerificationHasLoaded(true);
      } else {
        setVerificationError(result.error);
      }
    } catch (caught) {
      if (requestId !== verificationRequestIdRef.current || currentProfileId !== profileIdRef.current) return;
      setVerificationError({
        code: "unknown",
        message: caught instanceof Error ? caught.message : text("تعذر تحميل طلبات التوثيق.", "Could not load verification requests."),
        operation: "profile_verification_load",
      });
    } finally {
      if (requestId === verificationRequestIdRef.current && currentProfileId === profileIdRef.current) {
        setVerificationLoading(false);
      }
    }
  }, [profileId, text]);`,
    "profile verification load lifecycle",
  );
  source = replaceRegexOnce(
    source,
    /  async function handleLogout\(\) \{[\s\S]*?\n  \}\n\n  async function handleChangePassword/,
    `  async function handleLogout() {
    if (logoutInFlightRef.current) return;
    logoutInFlightRef.current = true;
    setLoggingOut(true);
    setLogoutError("");
    try {
      const result = await auth.signOut();
      if (result.error) setLogoutError(result.error);
    } catch (caught) {
      setLogoutError(
        caught instanceof Error ? caught.message : text("تعذر تسجيل الخروج.", "Could not log out."),
      );
    } finally {
      logoutInFlightRef.current = false;
      setLoggingOut(false);
    }
  }

  async function handleChangePassword`,
    "profile logout lifecycle",
  );
  source = replaceOnce(
    source,
    `    setPasswordNotice("");\n    if (newPassword !== confirmPassword) {`,
    `    setPasswordNotice("");\n    if (newPassword.length < 8) {\n      setPasswordNotice(text("كلمة المرور يجب أن تكون 8 أحرف على الأقل.", "Password must be at least 8 characters."));\n      return;\n    }\n    if (newPassword !== confirmPassword) {`,
    "profile password validation",
  );
  source = replaceOnce(
    source,
    `      setPasswordNotice(text("تم تغيير كلمة المرور بنجاح.", "Password changed successfully."));\n    } finally {`,
    `      setPasswordNotice(text("تم تغيير كلمة المرور بنجاح.", "Password changed successfully."));\n    } catch (caught) {\n      if (currentProfileId === profileIdRef.current) {\n        setPasswordNotice(caught instanceof Error ? caught.message : text("تعذر تغيير كلمة المرور.", "Could not change the password."));\n      }\n    } finally {`,
    "profile password exception handling",
  );
  source = replaceOnce(
    source,
    `      setDeletionNotice(\n        text(\n          "تم تسجيل طلب حذف الحساب. ستراجعه الإدارة قبل تنفيذ الحذف الآمن.",\n          "Your account deletion request was recorded and will be reviewed before secure deletion.",\n        ),\n      );\n    } finally {`,
    `      setDeletionNotice(\n        text(\n          "تم تسجيل طلب حذف الحساب. ستراجعه الإدارة قبل تنفيذ الحذف الآمن.",\n          "Your account deletion request was recorded and will be reviewed before secure deletion.",\n        ),\n      );\n    } catch (caught) {\n      if (currentProfileId === profileIdRef.current) {\n        setDeletionNotice(caught instanceof Error ? caught.message : text("تعذر تسجيل طلب حذف الحساب.", "Could not record the account deletion request."));\n      }\n    } finally {`,
    "profile deletion exception handling",
  );
  source = replaceOnce(
    source,
    `    const payload = {\n      firstName: settingsFirstName,\n      lastName: settingsLastName,\n      displayName: settingsDisplayName || null,\n      governorate: settingsGovernorate || null,\n      cityArea: settingsCityArea || null,\n      bio: settingsBio || null,\n      businessName: settingsBusinessName || null,\n      phone: settingsPhone || null,\n      whatsapp: settingsWhatsapp || null,\n      preferredContactMethod: settingsPreferredContact || null,\n    };`,
    `    const payload = {\n      firstName: settingsFirstName.trim(),\n      lastName: settingsLastName.trim(),\n      displayName: settingsDisplayName.trim() || null,\n      governorate: settingsGovernorate.trim() || null,\n      cityArea: settingsCityArea.trim() || null,\n      bio: settingsBio.trim() || null,\n      businessName: settingsBusinessName.trim() || null,\n      phone: settingsPhone.trim() || null,\n      whatsapp: settingsWhatsapp.trim() || null,\n      preferredContactMethod: settingsPreferredContact.trim() || null,\n    };`,
    "profile payload normalization",
  );
  source = replaceOnce(
    source,
    `          : text("تم حفظ معلومات الحساب وتحديثها.", "Account information saved and refreshed."),\n      );\n    } finally {`,
    `          : text("تم حفظ معلومات الحساب وتحديثها.", "Account information saved and refreshed."),\n      );\n    } catch (caught) {\n      if (currentProfileId === profileIdRef.current) {\n        setSettingsNotice(caught instanceof Error ? caught.message : text("تعذر حفظ معلومات الحساب.", "Could not save account information."));\n      }\n    } finally {`,
    "profile save exception handling",
  );
  source = replaceOnce(
    source,
    `          : text("تم حفظ الصورة وتحديث الحساب.", "Image saved and account refreshed."),\n      );\n    } finally {`,
    `          : text("تم حفظ الصورة وتحديث الحساب.", "Image saved and account refreshed."),\n      );\n    } catch (caught) {\n      if (currentProfileId === profileIdRef.current) {\n        setSettingsNotice(caught instanceof Error ? caught.message : text("تعذر رفع صورة الحساب.", "Could not upload the account image."));\n      }\n    } finally {`,
    "profile media upload exception handling",
  );
  source = replaceOnce(
    source,
    `          : text("تمت إزالة الصورة وتحديث الحساب.", "Image removed and account refreshed."),\n      );\n    } finally {`,
    `          : text("تمت إزالة الصورة وتحديث الحساب.", "Image removed and account refreshed."),\n      );\n    } catch (caught) {\n      if (currentProfileId === profileIdRef.current) {\n        setSettingsNotice(caught instanceof Error ? caught.message : text("تعذر إزالة صورة الحساب.", "Could not remove the account image."));\n      }\n    } finally {`,
    "profile media remove exception handling",
  );
  source = replaceOnce(
    source,
    `<button type="button" onClick={handleLogout}>\n                   <LogOut className="h-4 w-4" />\n                   {text("خروج", "Log out")}\n                 </button>`,
    `<button type="button" onClick={handleLogout} disabled={loggingOut} aria-busy={loggingOut}>\n                   <LogOut className="h-4 w-4" />\n                   {loggingOut ? text("جارٍ الخروج", "Logging out") : text("خروج", "Log out")}\n                 </button>`,
    "profile logout UI state",
  );
  source = replaceOnce(
    source,
    `<form onSubmit={(event) => void handleSaveProfileBasics(event)} className="space-y-4">`,
    `<form onSubmit={(event) => void handleSaveProfileBasics(event)} aria-busy={settingsSaving} className="space-y-4">`,
    "profile settings busy state",
  );
  source = replaceOnce(
    source,
    `                 onSubmit={(event) => void handleChangePassword(event)}\n                 className=`,
    `                 onSubmit={(event) => void handleChangePassword(event)}\n                 aria-busy={passwordSaving}\n                 className=`,
    "profile password form busy state",
  );
  source = source.replaceAll(
    `                       required\n                       value=`,
    `                       required\n                       disabled={passwordSaving}\n                       value=`,
  );
  return source;
});

await transform("src/routes/seller.$id.tsx", (initial) => {
  let source = initial;
  source = replaceRegexOnce(
    source,
    /  const loadEligibility = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[profileId, seller\.id, shouldCheckEligibility\]\);/,
    `  const loadEligibility = useCallback(async () => {
    const currentProfileId = profileId;
    if (!shouldCheckEligibility || !currentProfileId) {
      eligibilityRequestIdRef.current += 1;
      setEligibilityState("idle");
      return;
    }
    const requestId = ++eligibilityRequestIdRef.current;
    setEligibilityState("loading");
    setNotice("");
    try {
      const result = await fetchSellerReviewEligibility(seller.id);
      if (
        requestId !== eligibilityRequestIdRef.current ||
        currentProfileId !== profileIdRef.current ||
        seller.id !== sellerIdRef.current
      ) return;
      if (!result.ok) {
        setEligibilityState("error");
        setNotice(result.error.message);
        return;
      }
      if (result.data.eligible) {
        setEligibilityState("eligible");
      } else if (result.data.reason === "existing_review") {
        setEligibilityState("existing_review");
      } else if (result.data.reason === "no_qualifying_interaction") {
        setEligibilityState("no_qualifying_interaction");
      } else {
        setEligibilityState("error");
      }
    } catch (caught) {
      if (
        requestId === eligibilityRequestIdRef.current &&
        currentProfileId === profileIdRef.current &&
        seller.id === sellerIdRef.current
      ) {
        setEligibilityState("error");
        setNotice(caught instanceof Error ? caught.message : text("تعذر التحقق من أهلية التقييم.", "Could not check review eligibility."));
      }
    }
  }, [profileId, seller.id, shouldCheckEligibility, text]);`,
    "seller eligibility lifecycle",
  );
  source = replaceOnce(
    source,
    `    const currentRating = rating;\n    const currentComment = comment;\n    const currentTraits = selectedTraits;`,
    `    const currentRating = rating;\n    const currentComment = comment.trim();\n    const currentTraits = selectedTraits;\n    if (currentComment.length > 0 && currentComment.length < 10) {\n      setNotice(text("اكتب 10 أحرف على الأقل أو اترك التعليق فارغاً.", "Write at least 10 characters or leave the comment empty."));\n      return;\n    }`,
    "seller review validation",
  );
  source = replaceOnce(
    source,
    `        }\n      }\n    } finally {\n      reviewSubmitScopesRef.current.delete(scopeKey);`,
    `        }\n      }\n    } catch (caught) {\n      if (currentProfileId === profileIdRef.current && currentSellerId === sellerIdRef.current) {\n        setNotice(caught instanceof Error ? caught.message : text("تعذر إرسال التقييم.", "Could not submit the review."));\n      }\n    } finally {\n      reviewSubmitScopesRef.current.delete(scopeKey);`,
    "seller review exception handling",
  );
  source = replaceOnce(
    source,
    `<form onSubmit={(event) => void submitReview(event)} className="mt-4 space-y-2">`,
    `<form onSubmit={(event) => void submitReview(event)} aria-busy={saving} className="mt-4 space-y-2">`,
    "seller review busy state",
  );
  source = replaceOnce(
    source,
    `                   aria-pressed={rating === value}\n                   onClick=`,
    `                   aria-pressed={rating === value}\n                   disabled={saving}\n                   onClick=`,
    "seller rating disabled state",
  );
  return source;
});

await rm("scripts/apply-profile-seller-actions-integrity.mjs", { force: true });
