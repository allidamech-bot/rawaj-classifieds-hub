import { readFile, rm, writeFile } from "node:fs/promises";

const path = "src/features/reviews/SellerReviewCard.tsx";
let source = await readFile(path, "utf8");

function replaceOnce(before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  source = source.replace(before, after);
}

replaceOnce(
  `    responseScopesRef.current.add(scopeKey);\n    setNotice("");\n    setSaving(true);`,
  `    const normalizedResponse = responseText.trim();\n    if (normalizedResponse.length > 0 && normalizedResponse.length < 3) {\n      setNotice(text("اكتب 3 أحرف على الأقل أو احذف الرد.", "Write at least 3 characters or remove the response."));\n      return;\n    }\n\n    responseScopesRef.current.add(scopeKey);\n    setNotice("");\n    setSaving(true);`,
  "review response validation",
);
replaceOnce(
  `      const result = await setSellerReviewResponse(review.id, responseText);`,
  `      const result = await setSellerReviewResponse(review.id, normalizedResponse);`,
  "review response normalization",
);
replaceOnce(
  `          : text("تم حذف رد البائع.", "Seller response removed."),\n      );\n    } finally {`,
  `          : text("تم حذف رد البائع.", "Seller response removed."),\n      );\n    } catch (caught) {\n      if (currentProfileId === profileIdRef.current) {\n        setNotice(\n          caught instanceof Error\n            ? caught.message\n            : text("تعذر حفظ رد البائع.", "Could not save the seller response."),\n        );\n      }\n    } finally {`,
  "review response exception handling",
);
replaceOnce(
  `    reportScopesRef.current.add(scopeKey);\n    setReportNotice("");`,
  `    const normalizedDetails = reportDetails.trim();\n    reportScopesRef.current.add(scopeKey);\n    setReportNotice("");`,
  "review report normalization",
);
replaceOnce(
  `      const result = await createSellerReviewReport(review.id, reportReason, reportDetails);`,
  `      const result = await createSellerReviewReport(review.id, reportReason, normalizedDetails);`,
  "review report normalized payload",
);
replaceOnce(
  `          "Report submitted for review without automatically hiding the review.",\n        ),\n      );\n    } finally {`,
  `          "Report submitted for review without automatically hiding the review.",\n        ),\n      );\n    } catch (caught) {\n      if (currentProfileId === profileIdRef.current) {\n        setReportNotice(\n          caught instanceof Error\n            ? caught.message\n            : text("تعذر إرسال بلاغ التقييم.", "Could not submit the review report."),\n        );\n      }\n    } finally {`,
  "review report exception handling",
);
replaceOnce(
  `<form\n          onSubmit={(event) => void submitReport(event)}\n          className=`,
  `<form\n          onSubmit={(event) => void submitReport(event)}\n          aria-busy={reportSaving}\n          className=`,
  "review report form busy state",
);
replaceOnce(
  `<form onSubmit={submitResponse} className="mt-3 space-y-2 border-t border-border/70 pt-3">`,
  `<form onSubmit={submitResponse} aria-busy={saving} className="mt-3 space-y-2 border-t border-border/70 pt-3">`,
  "review response form busy state",
);

await writeFile(path, source);
await rm("scripts/apply-review-card-actions-integrity.mjs", { force: true });
