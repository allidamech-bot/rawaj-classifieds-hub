import { readFile, rm, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after, label) {
  const source = await readFile(path, "utf8");
  const matches = source.split(before).length - 1;
  if (matches !== 1) throw new Error(`${label}: expected one match, found ${matches}`);
  await writeFile(path, source.replace(before, after));
}

async function replaceRegexOnce(path, pattern, replacement, label) {
  const source = await readFile(path, "utf8");
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const matches = [...source.matchAll(new RegExp(pattern.source, flags))];
  if (matches.length !== 1) throw new Error(`${label}: expected one match, found ${matches.length}`);
  await writeFile(path, source.replace(pattern, replacement));
}

await replaceOnce(
  "src/routes/login.tsx",
  'import { useState, type FormEvent, type ReactNode } from "react";',
  'import { useRef, useState, type FormEvent, type ReactNode } from "react";',
  "login useRef import",
);

await replaceOnce(
  "src/routes/login.tsx",
  '  const [loading, setLoading] = useState(false);\n  const [error, setError] = useState("");',
  '  const [loading, setLoading] = useState(false);\n  const [error, setError] = useState("");\n  const signInInFlightRef = useRef(false);',
  "google sign-in lock",
);

await replaceRegexOnce(
  "src/routes/login.tsx",
  /  async function handleGoogleSignIn\(\) \{[\s\S]*?\n  \}\n\n  return \(/,
  `  async function handleGoogleSignIn() {
    if (signInInFlightRef.current) return;
    signInInFlightRef.current = true;
    setError("");
    setLoading(true);
    try {
      const result = await auth.signInWithGoogle(returnTo);
      if (result.error) {
        setError(authErrorMessage({ message: result.error }, "callback", text));
      }
    } catch (error) {
      setError(
        authErrorMessage(error instanceof Error ? error : null, "callback", text),
      );
    } finally {
      signInInFlightRef.current = false;
      setLoading(false);
    }
  }

  return (`,
  "google sign-in lifecycle",
);

await replaceOnce(
  "src/routes/login.tsx",
  '  const [message, setMessage] = useState("");\n  const [error, setError] = useState("");',
  '  const [message, setMessage] = useState("");\n  const [error, setError] = useState("");\n  const submitInFlightRef = useRef(false);',
  "login submit lock",
);

await replaceRegexOnce(
  "src/routes/login.tsx",
  /  async function handleSubmit\(event: FormEvent<HTMLFormElement>\) \{[\s\S]*?\n  \}\n\n  return \(/,
  `  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitInFlightRef.current) return;
    setMessage("");
    setError("");

    const client = supabase;
    if (!client) {
      setError(
        text(
          "خدمة الحسابات غير متاحة الآن. يمكنك تصفح الإعلانات والمحاولة لاحقاً.",
          "Account service is unavailable right now. You can browse listings and try again later.",
        ),
      );
      return;
    }

    const cleanEmail = email.trim();
    const cleanName = displayName.trim();
    if (!cleanEmail) {
      setError(text("أدخل بريدك الإلكتروني.", "Enter your email address."));
      return;
    }

    if (mode === "forgot") {
      submitInFlightRef.current = true;
      setSubmitting(true);
      try {
        const callbackUrl = new URL("/auth/callback", window.location.origin);
        callbackUrl.searchParams.set("type", "recovery");
        callbackUrl.searchParams.set("returnTo", returnTo);
        const { error: resetError } = await client.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: callbackUrl.toString(),
        });
        if (resetError) {
          setError(authErrorMessage(resetError, "recovery", text));
          return;
        }
        setMessage(
          text(
            "إذا كان البريد مسجلاً، ستصلك رسالة لإعادة تعيين كلمة المرور. تحقق من البريد الوارد أو الرسائل غير المرغوب بها.",
            "If the email is registered, you will receive a password reset message. Check your inbox or spam folder.",
          ),
        );
      } catch (error) {
        setError(authErrorMessage(error instanceof Error ? error : null, "recovery", text));
      } finally {
        submitInFlightRef.current = false;
        setSubmitting(false);
      }
      return;
    }

    if (password.length < 6) {
      setError(
        text(
          "كلمة المرور يجب أن تكون 6 أحرف على الأقل.",
          "Password must be at least 6 characters.",
        ),
      );
      return;
    }
    if (mode === "register" && cleanName.length < 2) {
      setError(text("أدخل اسما واضحا للحساب.", "Enter a clear account name."));
      return;
    }

    const signupCallbackUrl = new URL("/auth/callback", window.location.origin);
    signupCallbackUrl.searchParams.set("returnTo", returnTo);
    submitInFlightRef.current = true;
    setSubmitting(true);
    try {
      const result =
        mode === "login"
          ? await client.auth.signInWithPassword({ email: cleanEmail, password })
          : await client.auth.signUp({
              email: cleanEmail,
              password,
              options: {
                emailRedirectTo: signupCallbackUrl.toString(),
                data: { display_name: cleanName },
              },
            });

      if (result.error) {
        setError(authErrorMessage(result.error, mode === "login" ? "login" : "register", text));
        return;
      }

      const profileError =
        result.data.session && result.data.user
          ? await ensureOwnProfile(client, result.data.user, cleanName)
          : null;
      if (profileError) {
        setError(
          text(
            "تم تسجيل الدخول، لكن تعذر تجهيز بيانات الحساب الآن. حاول مرة أخرى أو تواصل مع الدعم.",
            "You are signed in, but account details could not be prepared right now. Try again or contact support.",
          ),
        );
        return;
      }

      if (mode === "register") {
        if (result.data.session) {
          setMessage(text("تم إنشاء الحساب. جارٍ إدخالك إلى رواج.", "Account created. Opening RAWAJ now."));
          await navigate({ to: returnTo });
          return;
        }
        setMessage(
          text(
            "تم إرسال رابط تفعيل الحساب إلى بريدك الإلكتروني. افتح البريد واضغط على رابط التفعيل لإكمال إنشاء الحساب. إذا لم تجد الرسالة خلال دقائق، تحقق من مجلد الرسائل غير المرغوبة / Spam.",
            "We sent an account activation link to your email. Open your inbox and click the activation link to complete account setup. If you do not see it within a few minutes, check your Spam or Junk folder.",
          ),
        );
        return;
      }

      setMessage(text("تم تسجيل الدخول", "Logged in"));
      await navigate({ to: returnTo });
    } catch (error) {
      setError(
        authErrorMessage(
          error instanceof Error ? error : null,
          mode === "login" ? "login" : "register",
          text,
        ),
      );
    } finally {
      submitInFlightRef.current = false;
      setSubmitting(false);
    }
  }

  return (`,
  "login submit lifecycle",
);

await replaceOnce(
  "src/routes/reset-password.tsx",
  'import { useEffect, useState, type FormEvent } from "react";',
  'import { useEffect, useRef, useState, type FormEvent } from "react";',
  "reset useRef import",
);

await replaceOnce(
  "src/routes/reset-password.tsx",
  '  const [message, setMessage] = useState("");\n  const [error, setError] = useState("");',
  '  const [message, setMessage] = useState("");\n  const [error, setError] = useState("");\n  const saveInFlightRef = useRef(false);\n  const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);',
  "reset locks",
);

await replaceOnce(
  "src/routes/reset-password.tsx",
  '  }, []);\n\n  async function submit(event: FormEvent<HTMLFormElement>) {',
  '  }, []);\n\n  useEffect(\n    () => () => {\n      if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current);\n    },\n    [],\n  );\n\n  async function submit(event: FormEvent<HTMLFormElement>) {',
  "reset timer cleanup",
);

await replaceRegexOnce(
  "src/routes/reset-password.tsx",
  /  async function submit\(event: FormEvent<HTMLFormElement>\) \{[\s\S]*?\n  \}\n\n  const loginDestination/,
  `  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveInFlightRef.current) return;
    setMessage("");
    setError("");

    if (!hasActivePasswordRecoverySession()) {
      setReady(false);
      setError(
        text(
          "انتهت جلسة الاستعادة. اطلب رابطًا جديدًا قبل تغيير كلمة المرور.",
          "The recovery session expired. Request a new link before changing your password.",
        ),
      );
      return;
    }
    if (password.length < 6) {
      setError(text("كلمة المرور يجب أن تكون 6 أحرف على الأقل.", "Password must be at least 6 characters."));
      return;
    }
    if (password !== confirmPassword) {
      setError(text("تأكيد كلمة المرور غير مطابق.", "Password confirmation does not match."));
      return;
    }

    const client = supabase;
    if (!client) {
      setError(text("خدمة الحسابات غير متاحة الآن. حاول لاحقاً.", "Account service is unavailable right now. Try later."));
      return;
    }

    saveInFlightRef.current = true;
    setSaving(true);
    try {
      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError) {
        setError(authErrorMessage(updateError, "update-password", text));
        return;
      }
      clearPasswordRecoverySession();
      setPassword("");
      setConfirmPassword("");
      setMessage(
        text(
          "تم تحديث كلمة المرور. جارٍ إعادتك إلى الصفحة التي كنت تريدها.",
          "Password updated. Returning you to the page you wanted.",
        ),
      );
      navigationTimerRef.current = setTimeout(() => void navigate({ to: returnTo }), 700);
    } catch (error) {
      setError(authErrorMessage(error instanceof Error ? error : null, "update-password", text));
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }

  const loginDestination`,
  "reset submit lifecycle",
);

await replaceOnce(
  "src/routes/reset-password.tsx",
  '<form onSubmit={(event) => void submit(event)} className="space-y-3">',
  '<form onSubmit={(event) => void submit(event)} aria-busy={saving} className="space-y-3">',
  "reset form busy state",
);

for (const marker of [
  '                    required\n                    className="input pe-11"',
]) {
  // Both new-password fields share the same exact marker.
  const path = "src/routes/reset-password.tsx";
  let source = await readFile(path, "utf8");
  const matches = source.split(marker).length - 1;
  if (matches !== 2) throw new Error(`reset input disabled state: expected two matches, found ${matches}`);
  source = source.split(marker).join(`                    required\n                    disabled={saving}\n                    className="input pe-11"`);
  await writeFile(path, source);
}

await rm("scripts/apply-public-auth-integrity.mjs", { force: true });
