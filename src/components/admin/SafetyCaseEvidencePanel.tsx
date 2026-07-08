import { Link2, MessageSquareText, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import {
  safetyAddCaseLink,
  safetyAddCaseNote,
  safetyFetchCaseLinks,
  safetyFetchCaseNotes,
  type SafetyCaseLink,
  type SafetyCaseLinkType,
  type SafetyCaseNote,
} from "@/lib/classifieds-api";

export function SafetyCaseEvidencePanel({
  caseId,
  canManage,
  text,
}: {
  caseId: string;
  canManage: boolean;
  text: (ar: string, en: string) => string;
}) {
  const [notes, setNotes] = useState<SafetyCaseNote[]>([]);
  const [links, setLinks] = useState<SafetyCaseLink[]>([]);
  const [note, setNote] = useState("");
  const [linkType, setLinkType] = useState<SafetyCaseLinkType>("listing_report");
  const [linkId, setLinkId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    const [noteResult, linkResult] = await Promise.all([
      safetyFetchCaseNotes(canManage, caseId),
      safetyFetchCaseLinks(canManage, caseId),
    ]);
    if (noteResult.ok) setNotes(noteResult.data);
    if (linkResult.ok) setLinks(linkResult.data);
    setError(
      !noteResult.ok ? noteResult.error.message : !linkResult.ok ? linkResult.error.message : "",
    );
  }

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      safetyFetchCaseNotes(canManage, caseId),
      safetyFetchCaseLinks(canManage, caseId),
    ]).then(([noteResult, linkResult]) => {
      if (cancelled) return;
      if (noteResult.ok) setNotes(noteResult.data);
      if (linkResult.ok) setLinks(linkResult.data);
      if (!noteResult.ok) setError(noteResult.error.message);
      else if (!linkResult.ok) setError(linkResult.error.message);
    });
    return () => {
      cancelled = true;
    };
  }, [canManage, caseId]);

  async function addNote() {
    if (busy) return;
    setBusy(true);
    setError("");
    const result = await safetyAddCaseNote(canManage, caseId, note);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setNote("");
    await refresh();
  }

  async function addLink() {
    if (busy) return;
    setBusy(true);
    setError("");
    const result = await safetyAddCaseLink(canManage, { caseId, linkType, linkId });
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setLinkId("");
    await refresh();
  }

  return (
    <section className="rounded-2xl bg-card p-5 hairline">
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-extrabold">{text("ملاحظات داخلية", "Internal notes")}</h3>
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={text("أضف ملاحظة لا تظهر للمستخدم", "Add a staff-only note")}
              className="input min-w-0 flex-1"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void addNote()}
              className="rawaj-chip px-3 py-2"
              aria-label={text("إضافة ملاحظة", "Add note")}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
            {notes.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {text("لا توجد ملاحظات بعد.", "No notes yet.")}
              </p>
            ) : (
              notes.map((item) => (
                <article key={item.id} className="rounded-xl bg-muted-surface p-3 hairline">
                  <p className="text-xs leading-5">{item.note}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </article>
              ))
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-extrabold">{text("روابط القضية", "Case links")}</h3>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[150px_1fr_auto]">
            <select
              value={linkType}
              onChange={(event) => setLinkType(event.target.value as SafetyCaseLinkType)}
              className="input"
            >
              <option value="listing_report">listing_report</option>
              <option value="message_report">message_report</option>
              <option value="listing">listing</option>
              <option value="account">account</option>
            </select>
            <input
              value={linkId}
              onChange={(event) => setLinkId(event.target.value)}
              placeholder={text(
                "معرف البلاغ أو الإعلان أو الحساب",
                "Report, listing, or account ID",
              )}
              className="input min-w-0"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void addLink()}
              className="rawaj-chip px-3 py-2"
              aria-label={text("إضافة رابط", "Add link")}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
            {links.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {text("لا توجد روابط بعد.", "No links yet.")}
              </p>
            ) : (
              links.map((item) => (
                <article key={item.id} className="rounded-xl bg-muted-surface p-3 hairline">
                  <p className="text-[11px] font-bold">{item.linkType}</p>
                  <p className="mt-1 break-all text-xs text-muted-foreground">{item.linkId}</p>
                </article>
              ))
            )}
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive hairline">
          {error}
        </p>
      )}
    </section>
  );
}
