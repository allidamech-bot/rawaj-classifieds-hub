import { createFileRoute } from "@tanstack/react-router";
import {
  Ban,
  LockKeyhole,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AccountStatus } from "@/lib/auth-types";
import {
  adminFetchUsers,
  adminLiftUserRestriction,
  adminManageUserAccount,
  adminSetUserRestriction,
  ownerAssignStaffRole,
  ownerRemoveStaffRole,
  type AdminUserSummary,
  type UserRestrictionType,
} from "@/lib/classifieds-api";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: UsersPage,
});

const restrictionOptions: Array<{
  value: UserRestrictionType;
  ar: string;
  en: string;
}> = [
  { value: "posting", ar: "منع إضافة الإعلانات", en: "Block listing creation" },
  { value: "messaging", ar: "منع الرسائل", en: "Block messaging" },
  { value: "reviews", ar: "منع التقييمات", en: "Block reviews" },
  { value: "promotions", ar: "منع الترويج", en: "Block promotions" },
  { value: "uploads", ar: "منع رفع الملفات", en: "Block uploads" },
];

function UsersPage() {
  const { text } = useUiPreferences();
  const auth = useAuth();
  const canManageUsers = auth.hasPermission("canManageUsers");
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AccountStatus>("all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [restrictionType, setRestrictionType] = useState<UserRestrictionType>("posting");
  const [busy, setBusy] = useState(false);
  const requestIdRef = useRef(0);
  const actionInFlightRef = useRef(false);

  const refreshUsers = useCallback(async () => {
    if (!canManageUsers) return false;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadError("");
    const result = await adminFetchUsers(canManageUsers);
    if (requestId !== requestIdRef.current) return false;
    if (!result.ok) {
      setLoadError(result.error.message);
      setLoading(false);
      return false;
    }
    setUsers(result.data);
    setHasLoaded(true);
    setLoading(false);
    return true;
  }, [canManageUsers]);

  useEffect(() => {
    requestIdRef.current += 1;
    actionInFlightRef.current = false;
    setBusy(false);
    if (!canManageUsers) {
      setUsers([]);
      setLoading(false);
      setHasLoaded(false);
      setLoadError("");
      setActionError("");
      return;
    }
    setUsers([]);
    setLoading(false);
    setHasLoaded(false);
    setLoadError("");
    setActionError("");
    void refreshUsers();
    return () => {
      requestIdRef.current += 1;
      actionInFlightRef.current = false;
    };
  }, [canManageUsers, refreshUsers]);

  useEffect(() => {
    if (selectedUserId && !users.some((user) => user.id === selectedUserId)) {
      setSelectedUserId(null);
      setReason("");
    }
  }, [selectedUserId, users]);

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return users.filter((user) => {
      if (statusFilter !== "all" && user.accountStatus !== statusFilter) return false;
      if (!normalized) return true;
      return [user.email, user.displayName, user.id].some((value) =>
        value?.toLowerCase().includes(normalized),
      );
    });
  }, [query, statusFilter, users]);

  const selectedUser = users.find((user) => user.id === selectedUserId) ?? null;
  const reasonReady = reason.trim().length >= 3;

  async function runAction(action: () => Promise<{ ok: boolean; error?: { message: string } }>) {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setBusy(true);
    setActionError("");
    setNotice("");
    try {
      const result = await action();
      if (!result.ok) {
        setActionError(result.error?.message ?? text("تعذر تنفيذ الإجراء.", "Action failed."));
        return;
      }
      setReason("");
      setNotice(text("تم تنفيذ الإجراء وتسجيله.", "Action completed and audited."));
      const refreshed = await refreshUsers();
      if (!refreshed) {
        setNotice(
          text(
            "تم تنفيذ الإجراء، لكن تعذر تحديث قائمة المستخدمين فوراً.",
            "The action completed, but the user list could not refresh immediately.",
          ),
        );
      }
    } finally {
      actionInFlightRef.current = false;
      setBusy(false);
    }
  }

  if (!canManageUsers) {
    return (
      <section className="rounded-2xl bg-card p-5 text-center hairline">
        <ShieldAlert className="mx-auto h-7 w-7 text-warning" />
        <h2 className="mt-3 text-base font-extrabold">{text("غير مخوّل", "Not authorized")}</h2>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-card p-5 hairline">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-muted-surface text-primary">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-extrabold">
                {text("إدارة المستخدمين", "User management")}
              </h2>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                {text(
                  "بحث وإيقاف وحظر واستعادة وتقييد الحسابات من مصدر محمي مع سجل تدقيق.",
                  "Search, suspend, ban, restore, and restrict accounts through audited controls.",
                )}
              </p>
            </div>
          </div>
          {auth.canAccessOwnerControls ? (
            <span className="rounded-lg bg-gold/15 px-3 py-2 text-xs font-bold hairline">
              {text("صلاحية المالك", "Owner authority")}
            </span>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px]">
          <label className="flex items-center gap-2 rounded-xl bg-muted-surface px-3 hairline">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={text("بحث بالاسم أو البريد أو المعرّف", "Search name, email, or ID")}
              aria-label={text("بحث المستخدمين", "Search users")}
              className="h-11 w-full bg-transparent text-sm outline-none"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | AccountStatus)}
            aria-label={text("تصفية المستخدمين حسب الحالة", "Filter users by status")}
            className="h-11 rounded-xl bg-card px-3 text-sm hairline"
          >
            <option value="all">{text("كل الحالات", "All statuses")}</option>
            <option value="active">{text("نشط", "Active")}</option>
            <option value="frozen">{text("موقوف", "Suspended")}</option>
            <option value="disabled">{text("محظور", "Banned")}</option>
            <option value="pending_review">{text("قيد المراجعة", "Pending review")}</option>
          </select>
        </div>
      </section>

      {loadError && hasLoaded ? (
        <RecoveryNotice
          message={loadError}
          busy={loading}
          retryLabel={text("إعادة المحاولة", "Try again")}
          refreshingLabel={text("جارٍ التحديث", "Refreshing")}
          onRetry={() => void refreshUsers()}
        />
      ) : null}
      {actionError ? <Notice tone="error">{actionError}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      {loading && !hasLoaded ? (
        <Panel title={text("جارٍ تحميل المستخدمين...", "Loading users...")} />
      ) : loadError && !hasLoaded ? (
        <Panel
          title={text("تعذر تحميل المستخدمين", "Could not load users")}
          body={loadError}
          actionLabel={text("إعادة المحاولة", "Try again")}
          onAction={() => void refreshUsers()}
        />
      ) : filteredUsers.length === 0 ? (
        <Panel
          title={text("لا توجد نتائج مطابقة", "No matching users")}
          body={text(
            "جرّب تغيير عبارة البحث أو فلتر الحالة.",
            "Try changing the search text or status filter.",
          )}
        />
      ) : (
        <section className="grid gap-3 lg:grid-cols-2">
          {filteredUsers.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              selected={selectedUserId === user.id}
              onSelect={() => {
                setSelectedUserId(user.id);
                setActionError("");
                setNotice("");
              }}
            />
          ))}
        </section>
      )}

      {selectedUser ? (
        <section className="rounded-2xl bg-card p-5 hairline shadow-soft">
          <div className="flex items-start gap-3">
            <UserCog className="mt-0.5 h-5 w-5 text-primary" />
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-extrabold">
                {selectedUser.displayName || selectedUser.email || selectedUser.id}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">{selectedUser.id}</p>
            </div>
          </div>

          {selectedUser.roles.includes("owner") ? (
            <div className="mt-4 rounded-xl bg-gold/10 p-4 text-xs font-semibold leading-6 hairline">
              {text(
                "حساب المالك محمي من الإيقاف والحظر والتقييد وتغيير الدور.",
                "The owner account is protected from suspension, ban, restriction, and role changes.",
              )}
            </div>
          ) : (
            <>
              <label className="mt-4 block">
                <span className="text-xs font-bold">{text("سبب الإجراء", "Action reason")}</span>
                <textarea
                  value={reason}
                  disabled={busy}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  placeholder={text(
                    "اكتب سبباً واضحاً ليُحفظ مع سجل التدقيق.",
                    "Enter a clear reason for the audit trail.",
                  )}
                  className="mt-2 w-full rounded-xl bg-muted-surface p-3 text-sm outline-none hairline disabled:opacity-60"
                />
              </label>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <ControlButton
                  icon={LockKeyhole}
                  label={text("إيقاف مؤقت", "Suspend")}
                  disabled={busy || !reasonReady}
                  onClick={() =>
                    void runAction(() =>
                      adminManageUserAccount(auth.hasPermission("canSuspendUsers"), {
                        userId: selectedUser.id,
                        status: "frozen",
                        reason,
                      }),
                    )
                  }
                />
                <ControlButton
                  icon={UserRoundCheck}
                  label={text("استعادة الحساب", "Restore")}
                  disabled={busy || !reasonReady}
                  onClick={() =>
                    void runAction(() =>
                      adminManageUserAccount(auth.hasPermission("canRestoreUsers"), {
                        userId: selectedUser.id,
                        status: "active",
                        reason,
                      }),
                    )
                  }
                />
                {auth.canAccessOwnerControls ? (
                  <ControlButton
                    icon={Ban}
                    label={text("حظر كامل", "Full ban")}
                    disabled={busy || !reasonReady}
                    danger
                    onClick={() =>
                      void runAction(() =>
                        adminManageUserAccount(auth.hasPermission("canBanUsers"), {
                          userId: selectedUser.id,
                          status: "disabled",
                          reason,
                        }),
                      )
                    }
                  />
                ) : null}
              </div>

              <div className="mt-5 border-t border-border/70 pt-5">
                <h3 className="text-sm font-extrabold">
                  {text("قيود دقيقة", "Granular restrictions")}
                </h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                  <select
                    value={restrictionType}
                    disabled={busy}
                    onChange={(event) =>
                      setRestrictionType(event.target.value as UserRestrictionType)
                    }
                    aria-label={text("نوع التقييد", "Restriction type")}
                    className="h-11 rounded-xl bg-card px-3 text-sm hairline disabled:opacity-60"
                  >
                    {restrictionOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {text(option.ar, option.en)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={busy || !reasonReady}
                    onClick={() =>
                      void runAction(() =>
                        adminSetUserRestriction(auth.hasPermission("canManageUserRestrictions"), {
                          userId: selectedUser.id,
                          restrictionType,
                          reason,
                        }),
                      )
                    }
                    className="rounded-xl bg-warning px-4 py-2 text-xs font-bold disabled:opacity-50"
                  >
                    {text("تطبيق التقييد", "Apply restriction")}
                  </button>
                  <button
                    type="button"
                    disabled={busy || !reasonReady}
                    onClick={() =>
                      void runAction(() =>
                        adminLiftUserRestriction(auth.hasPermission("canManageUserRestrictions"), {
                          userId: selectedUser.id,
                          restrictionType,
                          reason,
                        }),
                      )
                    }
                    className="rounded-xl bg-muted-surface px-4 py-2 text-xs font-bold disabled:opacity-50 hairline"
                  >
                    {text("رفع التقييد", "Lift restriction")}
                  </button>
                </div>
              </div>

              {auth.canAccessOwnerControls ? (
                <div className="mt-5 border-t border-border/70 pt-5">
                  <h3 className="text-sm font-extrabold">{text("إدارة الطاقم", "Staff roles")}</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StaffRoleButton
                      active={selectedUser.roles.includes("admin")}
                      label="Admin"
                      disabled={busy}
                      onAssign={() =>
                        void runAction(() =>
                          ownerAssignStaffRole(auth.hasPermission("canManageRoles"), {
                            userId: selectedUser.id,
                            role: "admin",
                            note: reason || null,
                          }),
                        )
                      }
                      onRemove={() =>
                        void runAction(() =>
                          ownerRemoveStaffRole(auth.hasPermission("canManageRoles"), {
                            userId: selectedUser.id,
                            role: "admin",
                            reason: reason || null,
                          }),
                        )
                      }
                    />
                    <StaffRoleButton
                      active={selectedUser.roles.includes("moderator")}
                      label="Moderator"
                      disabled={busy}
                      onAssign={() =>
                        void runAction(() =>
                          ownerAssignStaffRole(auth.hasPermission("canManageRoles"), {
                            userId: selectedUser.id,
                            role: "moderator",
                            note: reason || null,
                          }),
                        )
                      }
                      onRemove={() =>
                        void runAction(() =>
                          ownerRemoveStaffRole(auth.hasPermission("canManageRoles"), {
                            userId: selectedUser.id,
                            role: "moderator",
                            reason: reason || null,
                          }),
                        )
                      }
                    />
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}

function UserCard({
  user,
  selected,
  onSelect,
}: {
  user: AdminUserSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-2xl p-4 text-start hairline transition ${
        selected ? "bg-primary/5 ring-2 ring-primary/30" : "bg-card hover:bg-muted-surface"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-extrabold">
              {user.displayName || user.email || user.id}
            </h3>
            {user.roles.includes("owner") ? <ShieldCheck className="h-4 w-4 text-gold" /> : null}
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">{user.email || user.id}</p>
        </div>
        <span className="rounded-md bg-muted-surface px-2 py-1 text-[10px] font-bold">
          {user.accountStatus}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Metric value={user.listingCount} label="Listings" />
        <Metric value={user.reportsReceived} label="Received" />
        <Metric value={user.reportsSubmitted} label="Sent" />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {[...user.roles, ...user.activeRestrictions].map((item) => (
          <span key={item} className="rounded-md bg-muted-surface px-2 py-1 text-[10px] font-bold">
            {item}
          </span>
        ))}
      </div>
    </button>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg bg-muted-surface p-2">
      <div className="text-sm font-extrabold">{value.toLocaleString()}</div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function ControlButton({
  icon: Icon,
  label,
  disabled,
  danger = false,
  onClick,
}: {
  icon: typeof Ban;
  label: string;
  disabled: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold disabled:opacity-50 ${
        danger
          ? "bg-destructive text-destructive-foreground"
          : "bg-muted-surface text-foreground hairline"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function StaffRoleButton({
  active,
  label,
  disabled,
  onAssign,
  onRemove,
}: {
  active: boolean;
  label: string;
  disabled: boolean;
  onAssign: () => void;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={active ? onRemove : onAssign}
      className="rounded-xl bg-muted-surface px-3 py-2 text-xs font-bold disabled:opacity-50 hairline"
    >
      {active ? `Remove ${label}` : `Assign ${label}`}
    </button>
  );
}

function RecoveryNotice({
  message,
  busy,
  retryLabel,
  refreshingLabel,
  onRetry,
}: {
  message: string;
  busy: boolean;
  retryLabel: string;
  refreshingLabel: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive hairline">
      <p>{message}</p>
      <button
        type="button"
        disabled={busy}
        onClick={onRetry}
        className="mt-2 rounded-lg bg-card px-3 py-1.5 text-foreground hairline disabled:opacity-60"
      >
        {busy ? refreshingLabel : retryLabel}
      </button>
    </div>
  );
}

function Panel({
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
    <section className="rounded-2xl bg-card p-5 text-center hairline">
      <p className="text-sm font-bold">{title}</p>
      {body ? <p className="mt-1 text-xs leading-6 text-muted-foreground">{body}</p> : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
        >
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}

function Notice({ children, tone }: { children: React.ReactNode; tone: "error" | "success" }) {
  const toneClass =
    tone === "error" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success";
  return (
    <div className={`rounded-xl p-3 text-xs font-semibold hairline ${toneClass}`}>{children}</div>
  );
}
