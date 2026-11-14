import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { toast } from "sonner";

import {
  favoriteListing,
  fetchFavoriteStatus,
  unfavoriteListing,
} from "@/lib/api/favorites-guarded";
import type { ClassifiedListing } from "@/lib/classifieds-types";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export function HomeFavoriteButton({ listing }: { listing: ClassifiedListing }) {
  const auth = useAuth();
  const { text } = useUiPreferences();
  const client = useQueryClient();
  const profileId = auth.status === "signedIn" ? auth.profile?.id : undefined;
  const canSave = Boolean(profileId && profileId !== listing.ownerId);
  const queryKey = ["home-favorite", profileId, listing.id] as const;
  const query = useQuery({
    queryKey,
    enabled: canSave,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const result = await fetchFavoriteStatus(profileId ?? null, listing.id);
      if (!result.ok) throw new Error("Favorite status unavailable");
      return result.data;
    },
  });
  const mutation = useMutation({
    mutationFn: async (favorited: boolean) => {
      const setFavorite = favorited ? favoriteListing : unfavoriteListing;
      const result = await setFavorite(profileId ?? null, listing.id);
      if (!result.ok) throw new Error("Favorite update failed");
      return favorited;
    },
    onSuccess: (favorited) => client.setQueryData(queryKey, favorited),
    onError: () =>
      toast.error(
        text("تعذر تحديث المفضلة. حاول مجددًا.", "Could not update favorites. Try again."),
      ),
  });

  const className = "rawaj-signature-latest-card__favorite";
  const icon = <Heart aria-hidden="true" />;
  const addLabel = text("إضافة إلى المفضلة", "Add to favorites");
  if (auth.status === "signedOut") {
    return (
      <Link
        to="/login"
        search={{ returnTo: `/listings/${listing.id}` }}
        className={className}
        aria-label={addLabel}
      >
        {icon}
      </Link>
    );
  }
  if (!canSave) return null;

  const label = query.isError
    ? text("إعادة تحميل حالة المفضلة", "Retry loading favorite status")
    : query.data
      ? text("إزالة من المفضلة", "Remove from favorites")
      : addLabel;
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      aria-pressed={query.data}
      disabled={query.isFetching || mutation.isPending}
      onClick={() => (query.isError ? void query.refetch() : mutation.mutate(!query.data))}
    >
      {icon}
    </button>
  );
}
