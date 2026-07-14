    )
    text = sub_once(
        text,
        r'''  const \[placements, setPlacements\].*?\n  useEffect\(\(\) => \{.*?\n  \}, \[canManage\]\);''',
'''  const [placements, setPlacements] = useState<AdPlacementSummary[]>([]);
  const [form, setForm] = useState<PlacementFormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [statusReason, setStatusReason] = useState("");
  const requestIdRef = useRef(0);
  const mutationInFlightRef = useRef(false);
  const uploadInFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadError("");
    const result = await ownerFetchAdPlacements(canManage);
    if (requestId !== requestIdRef.current) return;
    setLoading(false);
    if (!result.ok) {
      setLoadError(result.error.message);
      return;
    }
    setPlacements(result.data);
    setHasLoaded(true);
  }, [canManage]);

  useEffect(() => {
    requestIdRef.current += 1;
    setPlacements([]);
    setHasLoaded(false);
    setLoadError("");
    void refresh();
    return () => {
      requestIdRef.current += 1;
      mutationInFlightRef.current = false;
      uploadInFlightRef.current = false;
    };
  }, [refresh]);''',
        'ad placements load state',
    )
    text = sub_once(
        text,
        r'''  async function handleImageSelection\(file: File \| undefined\) \{.*?\n  \}\n\n  async function submit\(event: FormEvent<HTMLFormElement>\) \{.*?\n  \}\n\n  async function changeStatus\(placement: AdPlacementSummary, status: AdPlacementStatus\) \{.*?\n  \}''',
'''  async function handleImageSelection(file: File | undefined) {
    if (!file || uploadInFlightRef.current) return;
    uploadInFlightRef.current = true;
    setUploadingImage(true);
    setActionError("");
    setNotice("");
    try {
      const result = await ownerUploadAdPlacementImage(canManage, auth.profile?.id ?? null, file);
      if (!result.ok) {
        setActionError(result.error.message);
        return;
      }
      setForm((value) => ({ ...value, imageUrl: result.data }));
      setNotice(text("تم رفع صورة الإعلان بنجاح.", "Ad image uploaded successfully."));
    } finally {
      uploadInFlightRef.current = false;
      setUploadingImage(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutationInFlightRef.current || uploadInFlightRef.current) return;
    if (!form.imageUrl) {
      setActionError(text("اختر صورة الإعلان أولاً.", "Choose an ad image first."));
      return;
    }
    mutationInFlightRef.current = true;
    setSaving(true);
    setActionError("");
    setNotice("");
    try {
      const result = await ownerSaveAdPlacement(canManage, {
        id: form.id,
        expectedVersion: form.expectedVersion,
        name: form.name,
        placementPage: form.placementPage,
        imageUrl: form.imageUrl,
        destinationUrl: form.destinationUrl,
        startsAt: fromLocalDateTimeInput(form.startsAt),
        endsAt: fromLocalDateTimeInput(form.endsAt),
        status: form.status,
        priority: Number(form.priority || 0),
        targetMobile: form.targetMobile,
        targetDesktop: form.targetDesktop,
      });
      if (!result.ok) {
        setActionError(result.error.message);
        return;
      }
      setNotice(
        form.id
          ? text("تم تحديث المساحة الإعلانية وتسجيل العملية.", "Placement updated and audited.")
          : text("تم إنشاء المساحة الإعلانية وتسجيل العملية.", "Placement created and audited."),
      );
      setForm(emptyForm);
      setStatusReason("");
      await refresh();
    } finally {
      mutationInFlightRef.current = false;
      setSaving(false);
    }
  }

  async function changeStatus(placement: AdPlacementSummary, status: AdPlacementStatus) {
    if (mutationInFlightRef.current) return;
    const reason = statusReason.trim();
    if (reason.length < 3) {
      setActionError(
        text("اكتب سبباً واضحاً لتغيير الحالة.", "Enter a clear reason for the status change."),
      );
      return;
    }
    mutationInFlightRef.current = true;
    setSaving(true);
    setActionError("");
    setNotice("");
    try {
      const result = await ownerSetAdPlacementStatus(canManage, {
        id: placement.id,
        status,
        expectedVersion: placement.version,
        reason,
      });
      if (!result.ok) {
        setActionError(result.error.message);
        return;
      }
      setPlacements((current) =>
        current.map((item) => (item.id === placement.id ? { ...item, status } : item)),
      );
      setStatusReason("");
      setNotice(text("تم تغيير الحالة وتسجيل السبب.", "Status changed and reason audited."));
      await refresh();
    } finally {
      mutationInFlightRef.current = false;
      setSaving(false);
    }
  }''',
        'ad placements actions',
    )
    text = replace_once(text, '      {error && <Notice tone="error">{error}</Notice>}', '      {actionError && <Notice tone="error">{actionError}</Notice>}\n      {loadError && hasLoaded ? (\n        <Notice tone="error">\n          {loadError} {" "}\n          <button type="button" onClick={() => void refresh()} className="underline">\n            {text("إعادة المحاولة", "Try again")}\n          </button>\n        </Notice>\n      ) : null}', 'ad placements errors')
    text = replace_once(
        text,
'''        {loading ? (
          <p className="mt-4 text-xs text-muted-foreground">
            {text("جارٍ التحميل...", "Loading...")}
          </p>
        ) : placements.length === 0 ? (''',
'''        {loading && !hasLoaded ? (
          <p className="mt-4 text-xs text-muted-foreground">
            {text("جارٍ التحميل...", "Loading...")}
          </p>
        ) : loadError && !hasLoaded ? (
          <div className="mt-4 rounded-xl bg-destructive/10 p-4 text-xs text-destructive">
            <p>{loadError}</p>
            <button type="button" onClick={() => void refresh()} className="mt-2 font-bold underline">
              {text("إعادة المحاولة", "Try again")}
            </button>
          </div>
        ) : placements.length === 0 ? (''',
        'ad placements list state',
    )
    write(path, text)


def patch_security_test():
    path = 'scripts/admin-security-regression.mjs'
    text = read(path)
    text = replace_once(
        text,
'''const adminMessageReports = read("src/routes/admin.message-reports.tsx");
const bottomDock = read("src/components/shell/BottomDock.tsx");''',
'''const adminMessageReports = read("src/routes/admin.message-reports.tsx");
const adminListings = read("src/routes/admin.listings.tsx");
const adminVerifications = read("src/routes/admin.verifications.tsx");
const adminPromotions = read("src/routes/admin.promotions.tsx");
const adminAudit = read("src/routes/admin.audit.tsx");
const adminOwnerControls = read("src/routes/admin.owner-controls.tsx");
const adminAdPlacements = read("src/routes/admin.ad-placements.tsx");
const bottomDock = read("src/components/shell/BottomDock.tsx");''',
        'security test sources',
    )
    anchor = '''expect(
  "user management separates load and action errors and deduplicates sensitive writes",
  adminUsers.includes("const [hasLoaded, setHasLoaded]") &&
    adminUsers.includes("const [loadError, setLoadError]") &&
    adminUsers.includes("const [actionError, setActionError]") &&
    adminUsers.includes("const actionInFlightRef = useRef(false)") &&
    adminUsers.includes("if (actionInFlightRef.current) return") &&
    adminUsers.includes("const refreshUsers = useCallback") &&
    adminUsers.includes("loadError && !hasLoaded") &&
    adminUsers.includes("finally {") &&
    !/setLoadError\(result\.error\.message\);[\s\S]{0,120}setUsers\(\[\]\)/.test(adminUsers),
);
'''
    additions = '''
expect(
  "listing console preserves data and deduplicates decisions",
  adminListings.includes("const [hasLoaded, setHasLoaded]") &&
    adminListings.includes("const loadRequestIdRef = useRef(0)") &&
    adminListings.includes("const actionInFlightRef = useRef<Set<string>>(new Set())") &&
    adminListings.includes("actionInFlightRef.current.has(actionKey)") &&
    adminListings.includes("loadError && !hasLoaded") &&
    !/setLoadError\(result\.error\.message\);[\s\S]{0,120}setListings\(\[\]\)/.test(adminListings),
);
expect(
  "verification moderation recovers reads documents and actions independently",
  adminVerifications.includes("const [hasLoaded, setHasLoaded]") &&
    adminVerifications.includes("const [documentErrors, setDocumentErrors]") &&
    adminVerifications.includes("const documentInFlightRef = useRef<Set<string>>(new Set())") &&
    adminVerifications.includes("const actionInFlightRef = useRef<Set<string>>(new Set())") &&
    adminVerifications.includes("loadError && !hasLoaded") &&
    !/setLoadError\(result\.error\);[\s\S]{0,120}setRequests\(\[\]\)/.test(adminVerifications),
);
expect(
  "promotion moderation decouples receipts and sensitive actions",
  adminPromotions.includes("const [hasLoaded, setHasLoaded]") &&
    adminPromotions.includes("async function loadReceipt") &&
    adminPromotions.includes("const receiptInFlightRef = useRef<Set<string>>(new Set())") &&
    adminPromotions.includes("const actionInFlightRef = useRef<Set<string>>(new Set())") &&
    adminPromotions.includes("loadError && !hasLoaded") &&
    !adminPromotions.includes("const receiptEntries = await Promise.all"),
);
expect(
  "audit pagination retries and deduplicates without losing entries",
  adminAudit.includes("const [hasLoaded, setHasLoaded]") &&
    adminAudit.includes("const requestIdRef = useRef(0)") &&
    adminAudit.includes("const loadMoreInFlightRef = useRef(false)") &&
    adminAudit.includes("const byId = new Map") &&
    adminAudit.includes("loadError && !hasLoaded") &&
    !/setLoadError\(result\.error\.message\);[\s\S]{0,120}setEntries\(\[\]\)/.test(adminAudit),
);
expect(
  "owner controls preserve state and deduplicate emergency writes",
  adminOwnerControls.includes("const [hasLoaded, setHasLoaded]") &&
    adminOwnerControls.includes("const [loadError, setLoadError]") &&
    adminOwnerControls.includes("const [actionError, setActionError]") &&
    adminOwnerControls.includes("const toggleInFlightRef = useRef<Set<OwnerSystemControlKey>>(new Set())") &&
    adminOwnerControls.includes("toggleInFlightRef.current.has(control.key)") &&
    adminOwnerControls.includes("loadError && !hasLoaded"),
);
expect(
  "ad placement management separates loading uploads and mutations",
  adminAdPlacements.includes("const [hasLoaded, setHasLoaded]") &&
    adminAdPlacements.includes("const [loadError, setLoadError]") &&
    adminAdPlacements.includes("const [actionError, setActionError]") &&
    adminAdPlacements.includes("const mutationInFlightRef = useRef(false)") &&
    adminAdPlacements.includes("const uploadInFlightRef = useRef(false)") &&
    adminAdPlacements.includes("loadError && !hasLoaded") &&
    adminAdPlacements.includes("finally {"),
);
'''
    text = replace_once(text, anchor, anchor + additions, 'security test additions')
    write(path, text)


patch_listings()
patch_verifications()
patch_promotions()
patch_audit()
patch_owner_controls()
patch_ad_placements()
patch_security_test()


import subprocess
commands = [
    ["npx", "prettier", "--write",
     "src/routes/admin.listings.tsx",
     "src/routes/admin.verifications.tsx",
     "src/routes/admin.promotions.tsx",
     "src/routes/admin.audit.tsx",
     "src/routes/admin.owner-controls.tsx",
     "src/routes/admin.ad-placements.tsx",
     "scripts/admin-security-regression.mjs"],
    ["npx", "eslint",
     "src/routes/admin.listings.tsx",
     "src/routes/admin.verifications.tsx",
     "src/routes/admin.promotions.tsx",
     "src/routes/admin.audit.tsx",
     "src/routes/admin.owner-controls.tsx",
     "src/routes/admin.ad-placements.tsx"],
    ["node", "scripts/admin-security-regression.mjs"],
    ["npm", "run", "typecheck"],
]
print("INTERNAL VALIDATION START")
for command in commands:
    result = subprocess.run(command, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    print(f"$ {' '.join(command)}")
    print(result.stdout)
    if result.returncode != 0:
        raise SystemExit(result.returncode)

for temporary in [
    ".github/admin-extended-recovery-error.txt",
    ".github/admin-extended-patch.b64",
    ".github/admin-extended-v2.b64",
    ".github/workflows/patch-admin-extended-recovery.yml",
    ".github/workflows/run-admin-extended-recovery-pr.yml",
    ".github/workflows/apply-admin-extended-v2.yml",
    ".github/admin-extended-recovery.trigger",
    ".github/admin-extended-v2-part1.py",
    ".github/admin-extended-v2-part2.py",
    ".github/admin-extended-v2-part3.py",
    ".github/admin-extended-v2-part4.py",
]:
    Path(temporary).unlink(missing_ok=True)

subprocess.run(["git", "config", "user.name", "github-actions[bot]"], check=True)
subprocess.run(
    ["git", "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"],
    check=True,
)
subprocess.run(["git", "add", "-A"], check=True)
subprocess.run(["git", "commit", "-m", "Recover extended admin queues safely"], check=True)
subprocess.run(
    ["git", "push", "origin", "HEAD:feature/recover-admin-extended-queues-v2"],
    check=True,
)
print("ADMIN EXTENDED RECOVERY PUSHED")