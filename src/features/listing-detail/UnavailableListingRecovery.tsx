import { Link } from "@tanstack/react-router";

import { PageHeader } from "@/components/PageHeader";
import { FeedbackState } from "@/components/feedback/FeedbackState";
import { Button } from "@/components/ui/button";
import { useUiPreferences } from "@/lib/ui-preferences";

export function UnavailableListingRecovery() {
  const { text } = useUiPreferences();

  return (
    <>
      <PageHeader title={text("تفاصيل الإعلان", "Listing details")} />
      <main className="container-wide mobile-page-bottom pt-8 sm:pt-10">
        <FeedbackState
          title={text("هذا الإعلان لم يعد متاحاً", "This listing is no longer available")}
          description={text(
            "قد يكون الإعلان قد بيع أو تأجر أو انتهت مدته أو أزيل من العرض. لا نكشف حالة خاصة غير عامة، لكن يمكنك متابعة البحث بدون الوصول إلى طريق مسدود.",
            "The listing may have been sold, rented, expired, or removed from public view. We do not expose private status details, but you can continue browsing without hitting a dead end.",
          )}
          action={
            <Button asChild>
              <Link to="/listings">{text("تصفح البدائل", "Browse alternatives")}</Link>
            </Button>
          }
        />
      </main>
    </>
  );
}
