import { createFileRoute } from "@tanstack/react-router";
import {
  Ban,
  CheckCircle2,
  LockKeyhole,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

const restrictionOptions: Array<{ value: UserRestrictionType; ar: string; en: string }> = [
  { value: "posting", ar: "منع إضافة الإعلانات", en: "Block listing creation" },
  { value: "messaging", ar: "منع الرسائل", en: "Block messaging" },
  { value: "reviews", ar: "منع التقييمات", en: "Block reviews" },
  { value: "promotions", ar: "منع الترويج", en: "Block promotions" },
  { value: "uploads", ar: "منع رفع الملفات", en: "Block uploads" },
];

function UsersPage() {
  const { text } = useUiPreferences();
  const auth = useAuth();
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AccountStatus>("all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [restrictionType, setRestrictionType] = useState<UserRestrictionType>("posting");
  const [busyAction, setBusyAction] = useState("");

  async function loadUsers() {
    setLoading(true);
    setError("");
    const result = await adminFetchUsers(auth.canAccessAdmin);
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setUsers(result.data);
  }

  useEffect(() => {
    let cancelled = false;
    void adminFetchUsers(auth.canAccessAdmin).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setUsers(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [auth.canAccessAdmin]);

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

  async function runAccountAction(status: AccountStatus) {
    if (!selectedUser || reason.trim().length < 3 || busyAction) return;
    setBusyAction(`status:${status}`);
    setError("");
    setNotice("");
    const result = await adminManageUserAccount(auth.canAccessAdmin, {
      userId: selectedUser.id,
      status,
      reason,
    });
    setBusyAction("");
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setNotice(
      text("تم تحديث حالة الحساب وتسجيل الإجراء.", "Account status updated and audited."),
    );
    setReason("");
    await loadUsers();
  }

  async function setRestriction() {
    if (!selectedUser || reason.trim().length < 3 || busyAction) return;
    setBusyAction(`restrict:${restrictionType}`);
    setError("");
    setNotice("");
    const result = await adminSetUserRestriction(auth.canAccessAdmin, {
      userId: selectedUser.id,
      restrictionType,
      reason,
    });
    setBusyAction("");
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setNotice(text("تم تطبيق التقييد وتسجيل الإجراء.", "Restriction applied and audited."));
    setReason("");
    await loadUsers();
  }

  async function liftRestriction() {
    if (!selectedUser || reason.trim().length < 3 || busyAction) return;
    setBusyAction(`lift:${restrictionType}`);
    setError("");
    setNotice("");
    const result = await adminLiftUserRestriction(auth.canAccessAdmin, {
      userId: selectedUser.id,
      restrictionType,
      reason,
    });
    setBusyAction("");
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setNotice(text("تم رفع التقييد وتسجيل الإجراء.", "Restriction lifted and audited."));
    setReason("");
    await loadUsers();
  }

  async function assignStaffRole(role: "admin" | "moderator") {
    if (!selectedUser || busyAction) return;
    setBusyAction(`assign:${role}`);
    setError("");
    setNotice("");
    const result = await ownerAssignStaffRole(auth.canAccessOwnerControls, {
      userId: selectedUser.id,
      role,
      note: reason || null,
    });
    setBusyAction("");
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setNotice(text("تم تعيين دور الطاقم وتسجيل الإجراء.", "Staff role assigned and audited."));
    setReason("");
    await loadUsers();
  }

  async function removeStaffRole(role: "admin" | "moderator") {
    if (!selectedUser || busyAction) return;
    setBusyAction(`remove:${role}`);
    setError("");
    setNotice("");
    const result = await ownerRemoveStaffRole(auth.canAccessOwnerControls, {
      userId: selectedUser.id,
      role,
      reason: reason || null,
    });
    setBusyAction("");
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setNotice(text("تمت إزالة دور الطاقم وتسجيل الإجراء.", "Staff role removed and audited."));
    setReason("");
    await loadUsers();
  }

  if (!auth.canAccessAdmin) {
    return (
      <section className="rounded-2xl bg-card p-5 text-center hairline">
        <ShieldAlert className="mx-auto h-7 w-7 text-warning" />
        <h2 className="mt-3 text-base font-extrabold">
          {text("غير مخوّل", "Not authorized")}
        </h2>
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
                  "بحث ومراجعة وإيقاف وحظر واستعادة وتقييد الحسابات من مصدر محمي مع سجل تدقيق.",
                  "Search, review, suspend, ban, restore, and restrict accounts through protected audited actions.",
                )}
              </p>
            </div>
          </div>
          {auth.canAccessOwnerControls && (
            <span className="rounded-lg bg-gold/15 px-3 py-2 text-xs font-bold text-gold-foreground hairline">
              {text("صلاحية المالك", "Owner authority")}
            </span>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px]">
          <label className="flex items-center gap-2 rounded-xl bg-muted-surface px-3 hairline">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={text("بحث بالاسم أو البريد أو المعرّف", "Search name, email, or ID")}
              className="h-11 w-full bg-transparent text-sm outline-none"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | AccountStatus)}
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

      {error && <Message tone="error">{error}</Message>}
      {notice && <Message tone="success">{notice}</Message>}

      {loading ? (
        <section className="rounded-2xl bg-card p-5 text-sm text-muted-foreground hairline">
          {text("جارٍ تحميل المستخدمين...", "Loading users...")}
        </section>
      ) : (
        <section className="grid gap-3 lg:grid-cols-2">
          {filteredUsers.map((user) => {
            const selected = selectedUserId === user.id;
            const protectedOwner = user.roles.includes("owner");
            return (
              <button
                key={user.id}
                type="button"
                onClick={() => setSelectedUserId(user.id)}
                className={`rounded-2xl p-4 text-start hairline transition ${
                  selected
                    ? "bg-primary/5 ring-2 ring-primary/30"
                    : "bg-card hover:bg-muted-surface"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-extrabold">
                        {user.displayName || user.email || text("مستخدم رواج", "RAWAJ user")}
                      </h3>
                      {protectedOwner && <ShieldCheck className="h-4 w-4 text-gold" />}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {user.email || user.id}
                    </p>
                  </div>
                  <StatusBadge status={user.accountStatus} />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Metric value={user.listingCount} label={text("إعلانات", "Listings")} />
                  <Metric
                    value={user.reportsReceived}
                    label={text("بلاغات عليه", "Reports received")}
                  />
                  <Metric
                    value={user.reportsSubmitted}
                    label={text("بلاغات أرسلها", "Reports sent")}
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {user.roles.map((role) => (
                    <span
                      key={role}
                      className="rounded-md bg-muted-surface px-2 py-1 text-[10px] font-bold"
                    >
                      {role}
                    </span>
                  ))}
                  {user.activeRestrictions.map((restriction) => (
                    <span
                      key={restriction}
                      className="rounded-md bg-warning/10 px-2 py-1 text-[10px] font-bold text-warning"
                    >
                      {restriction}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </section>
      )}

      {selectedUser && (
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
                "هذا هو حساب المالك المحمي. إجراءات الإيقاف والحظر والتقييد وتغيير الدور غير متاحة عليه.",
                "This is the protected owner account. Suspension, ban, restriction, and role changes are unavailable.",
              )}
            </div>
          ) : (
            <>
              <label className="mt-4 block">
                <span className="text-xs font-bold">{text("سبب الإجراء", "Action reason")}</span>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  placeholder={text(
                    "اكتب سبباً واضحاً. يُحفظ مع سجل التدقيق.",
                    "Enter a clear reason. It is stored with the audit trail.",
                  )}
                  className="mt-2 w-full rounded-xl bg-muted-surface p-3 text-sm outline-none hairline"
                />
              </label>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <ActionButton
                  icon={LockKeyhole}
                  label={text("إيقاف مؤقت", "Suspend")}
                  disabled={busyAction !== "" || reason.trim().length < 3}
                  onClick={() => void runAccountAction("frozen")}
                />
                <ActionButton
                  icon={UserRoundCheck}
                  label={text("استعادة الحساب", "Restore")}
                  disabled={busyAction !== "" || reason.trim().length < 3}
                  onClick={() => void runAccountAction("active")}
                />
                {auth.canAccessOwnerControls && (
                  <ActionButton
                    icon={Ban}
                    label={text("حظر كامل", "Full ban")}
                    danger
                    disabled={busyAction !== "" || reason.trim().length < 3}
                    onClick={() => void runAccountAction("disabled")}
                  />
                )}
              </div>

              <div className="mt-5 border-t border-border/70 pt-5">
                <h3 className="text-sm font-extrabold">
                  {text("قيود دقيقة", "Granular restrictions")}
                </h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                  <select
                    value={restrictionType}
                    onChange={(event) =>
                      setRestrictionType(event.target.value as UserRestrictionType)
                    }
                    className="h-11 rounded-xl bg-card px-3 text-sm hairline"
                  >
                    {restrictionOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {text(option.ar, option.en)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={busyAction !== "" || reason.trim().length < 3}
                    onClick={() => void setRestriction()}
                    className="rounded-xl bg-warning px-4 py-2 text-xs font-bold text-warning-foreground disabled:opacity-50"
                  >
                    {text("تطبيق التقييد", "Apply restriction")}
                  </button>
                  <button
                    type="button"
                    disabled={busyAction !== "" || reason.trim().length < 3}
                    onClick={() => void liftRestriction()}
                    className="rounded-xl bg-muted-surface px-4 py-2 text-xs font-bold disabled:opacity-50 hairline"
                  >
                    {text("رفع التقييد", "Lift restriction")}
                  </button>
                </div>
              </div>

              {auth.canAccessOwnerControls && (
                <div className="mt-5 border-t border-border/70 pt-5">
                  <h3 className="text-sm font-extrabold">
                    {text("إدارة الطاقم", "Staff roles")}
                  </h3>
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">
                    {text(
                      "المالك فقط يستطيع تعيين أو إزالة Admin وModerator. لا يمكن إنشاء Owner آخر.",
                      "Only the owner can assign or remove Admin and Moderator. Another Owner cannot be created.",
                    )}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedUser.roles.includes("admin") ? (
                      <button
                        type="button"
                        disabled={busyAction !== ""}
                        onClick={() => void removeStaffRole("admin")}
                        className="rounded-xl bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive disabled:opacity-50"
                      >
                        {text("إزالة Admin", "Remove Admin")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busyAction !== ""}
                        onClick={() => void assignStaffRole("admin")}
                        className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
                      >
                        {text("تعيين Admin", "Assign Admin")}
                      </button>
                    )}
                    {selectedUser.roles.includes("moderator") ? (
                      <button
                        type="button"
                        disabled={busyAction !== ""}
                        onClick={() => void removeStaffRole("moderator")}
                        className="rounded-xl bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive disabled:opacity-50"
                      >
                        {text("إزالة Moderator", "Remove Moderator")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busyAction !== ""}
                        onClick={() => void assignStaffRole("moderator")}
                        className="rounded-xl bg-muted-surface px-3 py-2 text-xs font-bold disabled:opacity-50 hairline"
                      >
                        {text("تعيين Moderator", "Assign Moderator")}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: AccountStatus }) {
  const { text } = useUiPreferences();
  const labels: Record<AccountStatus, { ar: string; en: string }> = {
    active: { ar: "نشط", en: "Active" },
    frozen: { ar: "موقوف", en: "Suspended" },
    disabled: { ar: "محظور", en: "Banned" },
    pending_review: { ar: "قيد المراجعة", en: "Pending" },
  };
  return (
    <span className="shrink-0 rounded-md bg-muted-surface px-2 py-1 text-[10px] font-bold">
      {text(labels[status].ar, labels[status].en)}
    </span>
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

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger = false,
}: {
  icon: typeof CheckCircle2;
  label: string;
  onClick: () => void;
  disabled: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
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

function Message({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "error" | "success";
}) {
  const toneClass =
    tone === "error" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success";
  return <div className={`rounded-xl p-3 text-xs font-semibold hairline ${toneClass}`}>{children}</div>;
}
