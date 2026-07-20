import { readFile, rm, writeFile } from "node:fs/promises";

const path = "src/routes/admin.campaigns.tsx";
let source = await readFile(path, "utf8");

function replaceOnce(before, after, label) {
  const matches = source.split(before).length - 1;
  if (matches !== 1) throw new Error(`${label}: expected one match, found ${matches}.`);
  source = source.replace(before, after);
}

function replaceRegexOnce(pattern, replacement, label) {
  const matches = [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))];
  if (matches.length !== 1) throw new Error(`${label}: expected one match, found ${matches.length}.`);
  source = source.replace(pattern, replacement);
}

replaceOnce(
  'import { useEffect, useMemo, useState, type FormEvent } from "react";',
  'import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";',
  "React useRef import",
);
replaceOnce(
  '  const [saving, setSaving] = useState(false);',
  '  const [saving, setSaving] = useState(false);\n  const mutationInFlightRef = useRef(false);',
  "campaign mutation ref",
);
replaceOnce(
  '  function editCampaign(campaign: CampaignSummary) {',
  '  function editCampaign(campaign: CampaignSummary, preserveFeedback = false) {',
  "campaign selection feedback option",
);
replaceOnce(
  '    setError("");\n    setNotice("");\n    void refreshCreatives(campaign.id);',
  '    setError("");\n    if (!preserveFeedback) setNotice("");\n    void refreshCreatives(campaign.id);',
  "campaign feedback preservation",
);

replaceRegexOnce(
  /  async function saveCampaign\(event: FormEvent<HTMLFormElement>\) \{[\s\S]*?\n  \}\n\n  async function changeStatus/,
  `  async function saveCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutationInFlightRef.current) return;
    mutationInFlightRef.current = true;
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const result = await ownerSaveCampaign(canManage, {
        id: campaignForm.id,
        expectedVersion: campaignForm.expectedVersion,
        name: campaignForm.name,
        status: campaignForm.status,
        startsAt: fromLocalDateTimeInput(campaignForm.startsAt),
        endsAt: fromLocalDateTimeInput(campaignForm.endsAt),
        targetPages: campaignForm.targetPages,
        targetCategoryIds: [
          ...new Set(
            campaignForm.categoryIdsText
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
          ),
        ],
      });

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      const campaignId = result.data.id;
      setNotice(
        campaignForm.id
          ? text("تم تحديث الحملة وتسجيل العملية.", "Campaign updated and audited.")
          : text("تم إنشاء الحملة وتسجيل العملية.", "Campaign created and audited."),
      );
      const refreshed = await ownerFetchCampaigns(canManage);
      if (!refreshed.ok) {
        setError(refreshed.error.message);
        return;
      }
      setCampaigns(refreshed.data);
      const campaign = refreshed.data.find((item) => item.id === campaignId);
      if (campaign) editCampaign(campaign, true);
    } finally {
      mutationInFlightRef.current = false;
      setSaving(false);
    }
  }

  async function changeStatus`,
  "campaign save lifecycle",
);

replaceRegexOnce(
  /  async function changeStatus\(campaign: CampaignSummary, status: CampaignStatus\) \{[\s\S]*?\n  \}\n\n  function editCreative/,
  `  async function changeStatus(campaign: CampaignSummary, status: CampaignStatus) {
    if (mutationInFlightRef.current) return;
    const reason = statusReason.trim();
    if (reason.length < 3) {
      setError(
        text(
          "اكتب سبباً واضحاً لتغيير حالة الحملة.",
          "Enter a clear reason for the status change.",
        ),
      );
      return;
    }

    mutationInFlightRef.current = true;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await ownerSetCampaignStatus(canManage, {
        id: campaign.id,
        status,
        expectedVersion: campaign.version,
        reason,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setStatusReason("");
      setNotice(
        text("تم تغيير حالة الحملة وتسجيل السبب.", "Campaign status changed and audited."),
      );
      await refreshCampaigns();
    } finally {
      mutationInFlightRef.current = false;
      setSaving(false);
    }
  }

  function editCreative`,
  "campaign status lifecycle",
);

replaceRegexOnce(
  /  async function saveCreative\(event: FormEvent<HTMLFormElement>\) \{[\s\S]*?\n  \}\n\n  if \(!canManage\)/,
  `  async function saveCreative(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!campaignForm.id || mutationInFlightRef.current) return;
    mutationInFlightRef.current = true;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await ownerSaveCampaignCreative(canManage, {
        id: creativeForm.id,
        expectedVersion: creativeForm.expectedVersion,
        campaignId: campaignForm.id,
        name: creativeForm.name,
        imageUrl: creativeForm.imageUrl,
        destinationUrl: creativeForm.destinationUrl,
        weight: Number(creativeForm.weight || 100),
        isActive: creativeForm.isActive,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setCreativeForm({ ...emptyCreative, campaignId: campaignForm.id });
      setNotice(text("تم حفظ التصميم الإعلاني وتسجيل العملية.", "Creative saved and audited."));
      await refreshCreatives(campaignForm.id);
      await refreshCampaigns();
    } finally {
      mutationInFlightRef.current = false;
      setSaving(false);
    }
  }

  if (!canManage)`,
  "campaign creative lifecycle",
);

replaceOnce(
  '            disabled={loading}',
  '            disabled={loading || saving}',
  "campaign refresh disabled state",
);

await writeFile(path, source);
await rm("scripts/apply-admin-campaign-integrity.mjs", { force: true });
