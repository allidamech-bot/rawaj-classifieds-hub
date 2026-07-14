      {body && <p className="mt-1 text-xs text-muted-foreground">{body}</p>}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
        >
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}''',
        'promotion panel',
    )
    write(path, text)


def patch_audit():
    path = 'src/routes/admin.audit.tsx'
    text = read(path)
    text = replace_once(
        text,
        'import { useEffect, useState } from "react";',
        'import { useCallback, useEffect, useRef, useState } from "react";',
        'audit imports',
    )
    text = sub_once(
        text,
        r'''  const \[entries, setEntries\].*?\n  async function loadMore\(\) \{.*?\n  \}''',
'''  const [entries, setEntries] = useState<AdminAuditLogEntry[]>([]);
  const [actionPrefix, setActionPrefix] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState("");
  const requestIdRef = useRef(0);
  const loadMoreInFlightRef = useRef(false);

  const loadFirstPage = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadError("");
    const result = await adminFetchAuditLogs(canViewAuditLogs, {
      limit: PAGE_SIZE,
      offset: 0,
      actionPrefix: actionPrefix || null,
    });
    if (requestId !== requestIdRef.current) return;
    setLoading(false);
    setOffset(0);
    if (!result.ok) {
      setLoadError(result.error.message);
      return;
    }
    setEntries(result.data);
    setHasMore(result.data.length === PAGE_SIZE);
    setHasLoaded(true);
  }, [actionPrefix, canViewAuditLogs]);

  useEffect(() => {
    requestIdRef.current += 1;
    loadMoreInFlightRef.current = false;
    setEntries([]);
    setHasLoaded(false);
    setHasMore(false);
    setLoadError("");
    void loadFirstPage();
    return () => {
      requestIdRef.current += 1;
      loadMoreInFlightRef.current = false;
    };
  }, [loadFirstPage]);

  async function loadMore() {
    if (loadMoreInFlightRef.current || loadingMore || !hasMore) return;
    loadMoreInFlightRef.current = true;
    const requestId = requestIdRef.current;
    const nextOffset = offset + PAGE_SIZE;
    setLoadingMore(true);
    setLoadError("");
    try {
      const result = await adminFetchAuditLogs(canViewAuditLogs, {
        limit: PAGE_SIZE,
        offset: nextOffset,
        actionPrefix: actionPrefix || null,
      });
      if (requestId !== requestIdRef.current) return;
      if (!result.ok) {
        setLoadError(result.error.message);
        return;
      }
      setEntries((current) => {
        const byId = new Map(current.map((entry) => [entry.id, entry]));
        for (const entry of result.data) byId.set(entry.id, entry);
        return [...byId.values()];
      });
      setOffset(nextOffset);
      setHasMore(result.data.length === PAGE_SIZE);
    } finally {
      loadMoreInFlightRef.current = false;
      if (requestId === requestIdRef.current) setLoadingMore(false);
    }
  }''',
        'audit load state',
    )
    text = replace_once(
        text,
'''      {error && (
        <p className="rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive hairline">
          {error}
        </p>
      )}

      {loading ? (
        <StatePanel title={text("جارٍ تحميل سجل التدقيق...", "Loading audit log...")} />
      ) : entries.length === 0 ? (''',
'''      {loadError && hasLoaded ? (
        <p className="rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive hairline">
          {loadError}
          <button type="button" onClick={() => void loadFirstPage()} className="ms-2 underline">
            {text("إعادة المحاولة", "Try again")}
          </button>
        </p>
      ) : null}

      {loading && !hasLoaded ? (
        <StatePanel title={text("جارٍ تحميل سجل التدقيق...", "Loading audit log...")} />
      ) : loadError && !hasLoaded ? (
        <StatePanel
          title={text("تعذر تحميل سجل التدقيق", "Could not load audit log")}
          body={loadError}
          actionLabel={text("إعادة المحاولة", "Try again")}
          onAction={() => void loadFirstPage()}
        />
      ) : entries.length === 0 ? (''',
        'audit UI states',
    )
    text = replace_once(
        text,
'''function StatePanel({ title }: { title: string }) {
  return (
    <div className="rounded-2xl bg-card p-8 text-center text-sm font-bold hairline">{title}</div>
  );
}''',
'''function StatePanel({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-2xl bg-card p-8 text-center hairline">
      <p className="text-sm font-bold">{title}</p>
      {body ? <p className="mt-2 text-xs text-muted-foreground">{body}</p> : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}''',
        'audit state panel',
    )
    write(path, text)


def patch_owner_controls():
    path = 'src/routes/admin.owner-controls.tsx'
    text = read(path)
    text = replace_once(
        text,
        'import { useEffect, useState } from "react";',
        'import { useCallback, useEffect, useRef, useState } from "react";',
        'owner controls imports',
    )
    text = sub_once(
        text,
        r'''  const \[controls, setControls\].*?\n  useEffect\(\(\) => \{.*?\n  \}, \[canManage\]\);''',
'''  const [controls, setControls] = useState<OwnerSystemControlSummary[]>([]);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [busyKey, setBusyKey] = useState<OwnerSystemControlKey | null>(null);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const requestIdRef = useRef(0);
  const toggleInFlightRef = useRef<Set<OwnerSystemControlKey>>(new Set());

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadError("");
    const result = await ownerFetchSystemControls(canManage);
    if (requestId !== requestIdRef.current) return;
    setLoading(false);
    if (!result.ok) {
      setLoadError(result.error.message);
      return;
    }
    setControls(result.data);
    setHasLoaded(true);
  }, [canManage]);

  useEffect(() => {
    requestIdRef.current += 1;
    setControls([]);
    setHasLoaded(false);
    setLoadError("");
    void refresh();
    return () => {
      requestIdRef.current += 1;
      toggleInFlightRef.current.clear();
    };
  }, [refresh]);''',
        'owner controls load state',
    )
    text = sub_once(
        text,
        r'''  async function toggle\(control: OwnerSystemControlSummary\) \{.*?\n  \}''',
'''  async function toggle(control: OwnerSystemControlSummary) {
    if (toggleInFlightRef.current.has(control.key)) return;
    toggleInFlightRef.current.add(control.key);
    setBusyKey(control.key);
    setActionError("");
    setNotice("");
    const nextEnabled = !control.enabled;
    try {
      const result = await ownerSetSystemControl(canManage, {
        key: control.key,
        enabled: nextEnabled,
        reason,
        expectedVersion: control.version,
      });
      if (!result.ok) {
        setActionError(result.error.message);
        return;
      }
      setControls((current) =>
        current.map((item) =>
          item.key === control.key
            ? { ...item, enabled: nextEnabled, reason, version: item.version + 1 }
            : item,
        ),
      );
      setReason("");
      setNotice(
        text(
          "تم تغيير مفتاح النظام وتسجيل العملية في سجل التدقيق.",
          "System control changed and audited.",
        ),
      );
      await refresh();
    } finally {
      toggleInFlightRef.current.delete(control.key);
      setBusyKey((current) => (current === control.key ? null : current));
    }
  }''',
        'owner controls toggle',
    )
    text = replace_once(text, '      {error && <Notice tone="error">{error}</Notice>}', '      {actionError && <Notice tone="error">{actionError}</Notice>}\n      {loadError && hasLoaded ? (\n        <Notice tone="error">\n          {loadError} {" "}\n          <button type="button" onClick={() => void refresh()} className="underline">\n            {text("إعادة المحاولة", "Try again")}\n          </button>\n        </Notice>\n      ) : null}', 'owner controls errors')
    text = replace_once(
        text,
'''      <section className="grid gap-3 md:grid-cols-2">
        {loading ? (
          <p className="text-xs text-muted-foreground">{text("جارٍ التحميل...", "Loading...")}</p>
        ) : (
          controls.map((control) => (
            <ControlCard
              key={control.key}
              control={control}
              busy={busyKey === control.key}
              onToggle={() => void toggle(control)}
              text={text}
            />
          ))
        )}
      </section>''',
'''      <section className="grid gap-3 md:grid-cols-2">
        {loading && !hasLoaded ? (
          <p className="text-xs text-muted-foreground">{text("جارٍ التحميل...", "Loading...")}</p>
        ) : loadError && !hasLoaded ? (
          <div className="rounded-2xl bg-card p-5 text-center hairline md:col-span-2">
            <p className="text-sm font-bold">{text("تعذر تحميل مفاتيح النظام", "Could not load system controls")}</p>
            <p className="mt-2 text-xs text-muted-foreground">{loadError}</p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="mt-3 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
            >
              {text("إعادة المحاولة", "Try again")}
            </button>
          </div>
        ) : (
          controls.map((control) => (
            <ControlCard
              key={control.key}
              control={control}
              busy={busyKey === control.key}
              onToggle={() => void toggle(control)}
              text={text}
            />
          ))
        )}
      </section>''',
        'owner controls UI',
    )
    write(path, text)


def patch_ad_placements():
    path = 'src/routes/admin.ad-placements.tsx'
    text = read(path)
    text = replace_once(
        text,
        'import { useEffect, useMemo, useState, type FormEvent } from "react";',
        'import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";',
        'ad placements imports',