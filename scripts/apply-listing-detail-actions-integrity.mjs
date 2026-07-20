import { readFile, rm, writeFile } from "node:fs/promises";

async function transform(path, mutate) {
  const source = await readFile(path, "utf8");
  const next = mutate(source);
  if (next === source) throw new Error(`${path}: transformation made no changes`);
  await writeFile(path, next);
}
function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}
function replaceRegexOnce(source, pattern, replacement, label) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const count = [...source.matchAll(new RegExp(pattern.source, flags))].length;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(pattern, replacement);
}

await transform("src/routes/listings.$id.tsx", (initial) => {
  let source = initial;
  source = replaceOnce(
    source,
    `  const [fav, setFav] = useState(false);\n  const [actionMessage`,
    `  const [fav, setFav] = useState(false);\n  const [favoriteBusy, setFavoriteBusy] = useState(false);\n  const [reportBusy, setReportBusy] = useState(false);\n  const [messageBusy, setMessageBusy] = useState(false);\n  const [actionMessage`,
    "listing detail action busy states",
  );
  source = replaceOnce(
    source,
    `    async function loadFavorite() {\n      const result = await fetchFavoriteStatus(profileId, id);\n      if (!cancelled && requestId === favoriteRequestIdRef.current && result.ok) {\n        setFav(result.data);\n      } else if (!cancelled && requestId === favoriteRequestIdRef.current && !result.ok) {\n        setActionMessage(text("تعذر تحميل حالة المفضلة.", "Could not load favorite status."));\n      }\n    }`,
    `    async function loadFavorite() {\n      try {\n        const result = await fetchFavoriteStatus(profileId, id);\n        if (!cancelled && requestId === favoriteRequestIdRef.current && result.ok) {\n          setFav(result.data);\n        } else if (!cancelled && requestId === favoriteRequestIdRef.current && !result.ok) {\n          setActionMessage(text("تعذر تحميل حالة المفضلة.", "Could not load favorite status."));\n        }\n      } catch {\n        if (!cancelled && requestId === favoriteRequestIdRef.current) {\n          setActionMessage(text("تعذر تحميل حالة المفضلة.", "Could not load favorite status."));\n        }\n      }\n    }`,
    "favorite status exception handling",
  );
  source = replaceOnce(
    source,
    `    favoriteInFlightRef.current = true;\n    setFav(desiredFavoriteState);`,
    `    favoriteInFlightRef.current = true;\n    setFavoriteBusy(true);\n    setFav(desiredFavoriteState);`,
    "favorite busy start",
  );
  source = replaceOnce(
    source,
    `    } finally {\n      favoriteInFlightRef.current = false;\n    }`,
    `    } finally {\n      favoriteInFlightRef.current = false;\n      setFavoriteBusy(false);\n    }`,
    "favorite busy release",
  );
  source = replaceRegexOnce(
    source,
    /  async function reportListing\(\) \{[\s\S]*?\n  \}\n\n  async function messageSeller/,
    `  async function reportListing() {
    setActionMessage(null);
    if (auth.status !== "signedIn") {
      void navigate({ to: "/login", search: { returnTo: `/listings/${id}` } });
      return;
    }
    if (reportInFlightRef.current) return;
    const startProfileId = auth.profile?.id ?? null;
    const startProfileGeneration = profileGenerationRef.current;
    if (!startProfileId) return;
    reportInFlightRef.current = true;
    setReportBusy(true);
    try {
      const result = await createListingReport(
        id,
        "suspicious_listing",
        "بلاغ سريع من صفحة الإعلان.",
      );
      if (
        profileIdRef.current !== startProfileId ||
        profileGenerationRef.current !== startProfileGeneration
      ) {
        return;
      }
      setActionMessage(
        result.ok
          ? text("تم إرسال البلاغ للمراجعة.", "Report sent for review.")
          : text("تعذر إرسال البلاغ الآن.", "Could not send the report now."),
      );
    } catch {
      if (
        profileIdRef.current === startProfileId &&
        profileGenerationRef.current === startProfileGeneration
      ) {
        setActionMessage(text("تعذر إرسال البلاغ الآن.", "Could not send the report now."));
      }
    } finally {
      reportInFlightRef.current = false;
      if (profileGenerationRef.current === startProfileGeneration) setReportBusy(false);
    }
  }

  async function messageSeller`,
    "listing report lifecycle",
  );
  source = replaceRegexOnce(
    source,
    /  async function messageSeller\(\) \{[\s\S]*?\n  \}\n\n  async function shareListing/,
    `  async function messageSeller() {
    setActionMessage(null);
    if (auth.status !== "signedIn") {
      void navigate({ to: "/login", search: { returnTo: `/listings/${id}` } });
      return;
    }
    const startProfileId = auth.profile?.id ?? null;
    const startProfileGeneration = profileGenerationRef.current;
    if (!startProfileId || messageInFlightRef.current === startProfileId) return;
    if (listing?.ownerId === auth.profile?.id) {
      setActionMessage(text("لا يمكنك بدء محادثة مع نفسك.", "You cannot message yourself."));
      return;
    }
    if (!listing || listing.status !== "approved") {
      setActionMessage(
        text(
          "المحادثات متاحة للإعلانات المعتمدة فقط.",
          "Messages are available for approved listings only.",
        ),
      );
      return;
    }
    messageInFlightRef.current = startProfileId;
    setMessageBusy(true);
    try {
      const result = await startListingConversation(listing.id);
      if (
        profileIdRef.current !== startProfileId ||
        profileGenerationRef.current !== startProfileGeneration
      ) {
        return;
      }
      if (!result.ok) {
        setActionMessage(text("تعذر بدء المحادثة الآن.", "Could not start the conversation now."));
        return;
      }
      await navigate({ to: "/chats", search: { conversation: result.data } });
    } catch {
      if (
        profileIdRef.current === startProfileId &&
        profileGenerationRef.current === startProfileGeneration
      ) {
        setActionMessage(text("تعذر بدء المحادثة الآن.", "Could not start the conversation now."));
      }
    } finally {
      if (
        profileGenerationRef.current === startProfileGeneration &&
        messageInFlightRef.current === startProfileId
      ) {
        messageInFlightRef.current = null;
        setMessageBusy(false);
      }
    }
  }

  async function shareListing`,
    "listing conversation lifecycle",
  );
  source = replaceRegexOnce(
    source,
    /  async function createPriceAlert\(\) \{[\s\S]*?\n  \}\n\n  function goBack/,
    `  async function createPriceAlert() {
    setActionMessage(null);
    if (auth.status !== "signedIn") {
      void navigate({ to: "/login", search: { returnTo: `/listings/${id}` } });
      return;
    }
    if (
      !listing ||
      listing.price === null ||
      !["fixed", "negotiable"].includes(listing.priceType)
    ) {
      setActionMessage(
        text(
          "تنبيه السعر متاح للإعلانات ذات السعر الرقمي.",
          "Price alerts are available for listings with a numeric price.",
        ),
      );
      return;
    }

    if (alertInFlightRef.current) return;
    alertInFlightRef.current = true;
    setAlertBusy(true);
    try {
      const result = await createSavedSearch(auth.profile?.id ?? null, {
        nameAr: `نتائج مشابهة بسعر ${listing.price}`,
        filters: {
          categoryId: listing.categoryId,
          governorateId: listing.governorateId,
          priceMax: listing.price,
          sort: "cheapest",
        },
        alertFrequency: "daily",
      });
      if (!result.ok) {
        setActionMessage(
          text("تعذر إنشاء تنبيه السعر الآن.", "Could not create the price alert now."),
        );
        return;
      }
      setAlertCreated(true);
      setActionMessage(
        text(
          "تم حفظ بحث يومي لإعلانات مشابهة بهذا السعر أو أقل.",
          "A daily search was saved for similar listings at this price or lower.",
        ),
      );
    } catch {
      setActionMessage(
        text("تعذر إنشاء تنبيه السعر الآن.", "Could not create the price alert now."),
      );
    } finally {
      alertInFlightRef.current = false;
      setAlertBusy(false);
    }
  }

  function goBack`,
    "price alert lifecycle",
  );
  source = replaceOnce(
    source,
    `          favorite={fav}\n          showFavorite={!isOwner}`,
    `          favorite={fav}\n          favoriteBusy={favoriteBusy}\n          showFavorite={!isOwner}`,
    "favorite busy media binding",
  );
  source = replaceOnce(
    source,
    `                 alertBusy={alertBusy}\n                 alertCreated={alertCreated}`,
    `                 alertBusy={alertBusy}\n                 reportBusy={reportBusy}\n                 alertCreated={alertCreated}`,
    "report busy safety binding",
  );
  source = replaceOnce(
    source,
    `                 canMessage={!isOwner}\n                 onMessage={messageSeller}`,
    `                 canMessage={!isOwner}\n                 messageBusy={messageBusy}\n                 onMessage={messageSeller}`,
    "message busy seller binding",
  );
  source = replaceOnce(
    source,
    `         onMessage={() => void messageSeller()}\n         onOffer={() => void messageSeller()}`,
    `         messageBusy={messageBusy}\n         onMessage={() => void messageSeller()}\n         onOffer={() => void messageSeller()}`,
    "message busy dock binding",
  );
  return source;
});

await transform("src/features/listing-detail/ListingMediaExperience.tsx", (initial) => {
  let source = initial;
  source = replaceOnce(source, `  favorite: boolean;\n  showFavorite?:`, `  favorite: boolean;\n  favoriteBusy?: boolean;\n  showFavorite?:`, "media favorite busy type");
  source = replaceOnce(source, `  favorite,\n  showFavorite = true,`, `  favorite,\n  favoriteBusy = false,\n  showFavorite = true,`, "media favorite busy default");
  source = replaceOnce(
    source,
    `                   onClick={onToggleFavorite}\n                   aria-pressed={favorite}`,
    `                   onClick={onToggleFavorite}\n                   disabled={favoriteBusy}\n                   aria-busy={favoriteBusy}\n                   aria-pressed={favorite}`,
    "media favorite disabled",
  );
  return source;
});

await transform("src/features/listing-detail/ListingSafetyAndAlert.tsx", (initial) => {
  let source = initial;
  source = replaceOnce(source, `  alertBusy: boolean;\n  alertCreated`, `  alertBusy: boolean;\n  reportBusy: boolean;\n  alertCreated`, "safety report busy type");
  source = replaceOnce(source, `  alertBusy,\n  alertCreated,`, `  alertBusy,\n  reportBusy,\n  alertCreated,`, "safety report busy prop");
  source = replaceOnce(
    source,
    `          <button type="button" onClick={onReport} data-tone="report">\n            <Flag aria-hidden="true" />\n            {text("إبلاغ عن الإعلان", "Report listing")}\n          </button>`,
    `          <button\n            type="button"\n            onClick={onReport}\n            disabled={reportBusy}\n            aria-busy={reportBusy}\n            data-tone="report"\n          >\n            <Flag aria-hidden="true" />\n            {reportBusy\n              ? text("جارٍ إرسال البلاغ", "Sending report")\n              : text("إبلاغ عن الإعلان", "Report listing")}\n          </button>`,
    "safety report disabled",
  );
  return source;
});

await transform("src/features/listing-detail/ListingSellerProfileCard.tsx", (initial) => {
  let source = initial;
  source = replaceOnce(source, `  canMessage: boolean;\n  onMessage`, `  canMessage: boolean;\n  messageBusy: boolean;\n  onMessage`, "seller message busy type");
  source = replaceOnce(source, `  canMessage,\n  onMessage,`, `  canMessage,\n  messageBusy,\n  onMessage,`, "seller message busy prop");
  source = replaceOnce(
    source,
    `          <button type="button" onClick={onMessage}>\n            <MessageCircle aria-hidden="true" />\n            {text("مراسلة", "Message")}\n          </button>`,
    `          <button type="button" onClick={onMessage} disabled={messageBusy} aria-busy={messageBusy}>\n            <MessageCircle aria-hidden="true" />\n            {messageBusy ? text("جارٍ الفتح", "Opening") : text("مراسلة", "Message")}\n          </button>`,
    "seller message disabled",
  );
  return source;
});

await transform("src/features/listing-detail/ListingContactDock.tsx", (initial) => {
  let source = initial;
  source = replaceOnce(source, `  whatsappUrl: string | null;\n  onMessage`, `  whatsappUrl: string | null;\n  messageBusy: boolean;\n  onMessage`, "dock message busy type");
  source = replaceOnce(source, `  whatsappUrl,\n  onMessage,`, `  whatsappUrl,\n  messageBusy,\n  onMessage,`, "dock message busy prop");
  source = replaceOnce(
    source,
    `             <button type="button" onClick={onMessage} className="rawaj-contact-dock__primary">\n               <MessageCircle aria-hidden="true" />\n               {text("مراسلة", "Message")}\n             </button>\n             <button type="button" onClick={onOffer} className="rawaj-contact-dock__offer">\n               <Tag aria-hidden="true" />\n               {text("قدّم عرضًا", "Make an offer")}\n             </button>`,
    `             <button\n               type="button"\n               onClick={onMessage}\n               disabled={messageBusy}\n               aria-busy={messageBusy}\n               className="rawaj-contact-dock__primary"\n             >\n               <MessageCircle aria-hidden="true" />\n               {messageBusy ? text("جارٍ الفتح", "Opening") : text("مراسلة", "Message")}\n             </button>\n             <button\n               type="button"\n               onClick={onOffer}\n               disabled={messageBusy}\n               aria-busy={messageBusy}\n               className="rawaj-contact-dock__offer"\n             >\n               <Tag aria-hidden="true" />\n               {messageBusy ? text("جارٍ الفتح", "Opening") : text("قدّم عرضًا", "Make an offer")}\n             </button>`,
    "dock message disabled",
  );
  return source;
});

await rm("scripts/apply-listing-detail-actions-integrity.mjs", { force: true });
