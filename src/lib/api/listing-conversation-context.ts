import { fetchMyConversations } from "@/lib/api/messaging";
import type { ClassifiedsResult, Conversation } from "@/lib/classifieds-types";

export async function fetchListingConversationContext(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<Conversation | null>> {
  const cleanListingId = listingId.trim();
  if (!cleanListingId) {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: "تعذر تحديد الإعلان المرتبط بالمحادثة.",
      },
    };
  }

  const result = await fetchMyConversations(userId);
  if (!result.ok) return result;

  return {
    ok: true,
    data: result.data.find((conversation) => conversation.listingId === cleanListingId) ?? null,
  };
}
