import { resolveCategoryFieldKind } from "@/lib/category-fields";
import type { ClassifiedListing } from "@/lib/classifieds-types";
import {
  listingShareHighlights,
  type ListingShareHighlight,
} from "@/lib/listing-share-highlights";
import type { ListingShareTemplate } from "@/lib/listing-share-growth";

const CARD_WIDTH = 1080;
const SQUARE_HEIGHT = 1080;
const STORY_HEIGHT = 1920;
const SYRIA_DOMAIN = "rawa-j.com";

type CardLanguage = "ar" | "en";

export async function renderListingShareCard(
  listing: ClassifiedListing,
  template: ListingShareTemplate,
  language: string,
): Promise<Blob> {
  const width = CARD_WIDTH;
  const height = template.format === "story" ? STORY_HEIGHT : SQUARE_HEIGHT;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas_unavailable");

  await document.fonts?.ready?.catch(() => undefined);
  const cardLanguage: CardLanguage = language === "en" ? "en" : "ar";
  const highlights = listingShareHighlights(
    listing,
    resolveCategoryFieldKind(null, null, listing),
    cardLanguage,
  );
  const image = await loadListingImage(listing.primaryImageUrl);

  const input: ShareCardRenderInput = {
    context,
    listing,
    template,
    language: cardLanguage,
    highlights,
    image,
    width,
    height,
  };

  switch (template.id) {
    case "classic":
      drawClassic(input);
      break;
    case "quick-sale":
      drawQuickSale(input);
      break;
    case "minimal":
      drawMinimal(input);
      break;
    case "emerald":
      drawEmerald(input);
      break;
    case "premium":
      drawPremium(input);
      break;
    case "story":
      drawStory(input);
      break;
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("share_card_encode_failed"));
    }, "image/png");
  });
}

export function listingSharePriceLabel(listing: ClassifiedListing, language: string): string {
  if (listing.priceType === "free") return language === "en" ? "Free" : "مجاني";
  if (listing.priceType === "contact")
    return language === "en" ? "Contact for price" : "تواصل لمعرفة السعر";
  if (listing.priceType === "exchange") return language === "en" ? "Exchange" : "مقايضة";
  if (typeof listing.price !== "number" || !Number.isFinite(listing.price))
    return language === "en" ? "Price on request" : "السعر عند الطلب";
  const formatted = new Intl.NumberFormat(language === "en" ? "en-US" : "ar-SY", {
    maximumFractionDigits: 0,
  }).format(listing.price);
  return `${formatted} ${language === "en" ? "SYP" : "ل.س"}`;
}

export function listingShareLocationLabel(listing: ClassifiedListing, language: string): string {
  const values = [listing.districtAr, listing.governorateNameAr]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  if (values.length) return [...new Set(values)].join(language === "en" ? ", " : "، ");
  return language === "en" ? "Syria" : "سوريا";
}

interface ShareCardRenderInput {
  context: CanvasRenderingContext2D;
  listing: ClassifiedListing;
  template: ListingShareTemplate;
  language: CardLanguage;
  highlights: ListingShareHighlight[];
  image: HTMLImageElement | null;
  width: number;
  height: number;
}

function drawClassic(input: ShareCardRenderInput) {
  const { context, template, listing, language, highlights } = input;
  fillCardBackground(input);
  drawBrandLockup(input, 64, 76, template.surface, template.accent);
  drawShareImage(input, 64, 168, 548, 728, 38);
  context.fillStyle = template.accent;
  context.fillRect(644, 168, 6, 728);

  const textX = language === "en" ? 688 : 1016;
  configureLocalizedText(context, language, language === "en" ? "left" : "right");
  context.fillStyle = template.surface;
  context.font = "800 54px Cairo, sans-serif";
  const titleBottom = drawWrappedText(context, listing.title, textX, 286, 328, 70, 3, language);
  context.fillStyle = template.accent;
  context.font = "800 46px Cairo, sans-serif";
  context.fillText(listingSharePriceLabel(listing, language), textX, titleBottom + 82);
  context.fillStyle = template.surface;
  context.globalAlpha = 0.78;
  context.font = "600 25px Cairo, sans-serif";
  context.fillText(listingShareLocationLabel(listing, language), textX, titleBottom + 132);
  context.globalAlpha = 1;
  drawHighlightStack(input, highlights, 684, Math.max(595, titleBottom + 190), 324, 82, {
    background: template.surface,
    foreground: template.foreground,
    muted: template.muted,
  });
  drawCardUrl(input, 64, 1010, template.surface, "left");
}

function drawQuickSale(input: ShareCardRenderInput) {
  const { context, template, listing, language, highlights, width } = input;
  fillCardBackground(input);
  context.fillStyle = template.surface;
  context.fillRect(0, 0, width, 224);
  drawBrandLockup(input, 56, 62, "#FFFFFF", "#FFFFFF");
  configureLocalizedText(context, language, language === "en" ? "right" : "left");
  context.fillStyle = "#FFFFFF";
  context.font = "900 42px Cairo, sans-serif";
  context.fillText(
    language === "en" ? "READY TO SELL" : "جاهز للبيع",
    language === "en" ? 1024 : 56,
    154,
  );
  drawShareImage(input, 56, 178, 968, 506, 0);
  context.fillStyle = template.foreground;
  configureLocalizedText(context, language, language === "en" ? "left" : "right");
  const textX = language === "en" ? 56 : 1024;
  context.font = "900 50px Cairo, sans-serif";
  const titleBottom = drawWrappedText(context, listing.title, textX, 758, 968, 62, 2, language);
  context.fillStyle = template.surface;
  roundedRectPath(context, 56, titleBottom + 34, 400, 86, 18);
  context.fill();
  context.fillStyle = "#FFFFFF";
  context.font = "900 38px Cairo, sans-serif";
  context.textAlign = "center";
  context.fillText(listingSharePriceLabel(listing, language), 256, titleBottom + 90);
  context.fillStyle = template.foreground;
  configureLocalizedText(context, language, language === "en" ? "right" : "left");
  context.font = "700 24px Cairo, sans-serif";
  context.fillText(
    listingShareLocationLabel(listing, language),
    language === "en" ? 1024 : 56,
    titleBottom + 88,
  );
  drawHighlightsInline(input, highlights, 56, 952, 968, template.foreground, template.muted, " · ");
  drawCardUrl(input, 56, 1040, template.surface, "left");
}

function drawMinimal(input: ShareCardRenderInput) {
  const { context, template, listing, language, highlights } = input;
  fillCardBackground(input);
  context.strokeStyle = template.foreground;
  context.globalAlpha = 0.18;
  context.lineWidth = 2;
  context.strokeRect(42, 42, 996, 996);
  context.globalAlpha = 1;
  context.fillStyle = template.foreground;
  context.textAlign = "center";
  context.direction = "ltr";
  context.font = "800 28px Cairo, sans-serif";
  context.fillText("RAWAJ", 540, 94);
  drawShareImage(input, 170, 138, 740, 430, 6);
  configureLocalizedText(context, language, "center");
  context.fillStyle = template.foreground;
  context.font = "700 47px Cairo, sans-serif";
  const titleBottom = drawWrappedText(context, listing.title, 540, 650, 820, 60, 2, language);
  context.font = "800 43px Cairo, sans-serif";
  context.fillText(listingSharePriceLabel(listing, language), 540, titleBottom + 72);
  context.fillStyle = template.muted;
  context.font = "500 23px Cairo, sans-serif";
  context.fillText(listingShareLocationLabel(listing, language), 540, titleBottom + 118);
  context.strokeStyle = template.foreground;
  context.globalAlpha = 0.14;
  context.beginPath();
  context.moveTo(116, 880);
  context.lineTo(964, 880);
  context.stroke();
  context.globalAlpha = 1;
  drawHighlightsColumns(input, highlights, 116, 920, 848, template.foreground, template.muted);
  drawCardUrl(input, 540, 1015, template.foreground, "center");
}

function drawEmerald(input: ShareCardRenderInput) {
  const { context, template, listing, language, highlights } = input;
  fillCardBackground(input);
  context.fillStyle = template.accent;
  context.globalAlpha = 0.12;
  context.beginPath();
  context.arc(90, 140, 230, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.arc(1040, 1010, 300, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;
  drawBrandLockup(input, 68, 72, template.surface, template.accent);
  context.strokeStyle = template.accent;
  context.lineWidth = 5;
  roundedRectPath(context, 132, 156, 816, 492, 96);
  context.stroke();
  drawShareImage(input, 148, 172, 784, 460, 82);
  configureLocalizedText(context, language, "center");
  context.fillStyle = template.surface;
  context.font = "800 48px Cairo, sans-serif";
  const titleBottom = drawWrappedText(context, listing.title, 540, 724, 860, 60, 2, language);
  context.fillStyle = template.accent;
  context.font = "900 44px Cairo, sans-serif";
  context.fillText(listingSharePriceLabel(listing, language), 540, titleBottom + 72);
  context.fillStyle = template.surface;
  context.globalAlpha = 0.76;
  context.font = "600 23px Cairo, sans-serif";
  context.fillText(listingShareLocationLabel(listing, language), 540, titleBottom + 116);
  context.globalAlpha = 1;
  drawHighlightsColumns(input, highlights, 110, 930, 860, template.surface, template.accent);
  drawCardUrl(input, 540, 1040, template.accent, "center");
}

function drawPremium(input: ShareCardRenderInput) {
  const { context, template, listing, language, highlights } = input;
  fillCardBackground(input);
  context.strokeStyle = template.accent;
  context.lineWidth = 3;
  context.strokeRect(34, 34, 1012, 1012);
  context.globalAlpha = 0.35;
  context.lineWidth = 1;
  context.strokeRect(48, 48, 984, 984);
  context.globalAlpha = 1;
  drawBrandLockup(input, 76, 76, template.accent, template.accent);
  drawShareImage(input, 84, 150, 912, 462, 14);
  context.strokeStyle = template.accent;
  context.lineWidth = 3;
  context.strokeRect(84, 150, 912, 462);
  configureLocalizedText(context, language, "center");
  context.fillStyle = template.surface;
  context.font = "700 48px Cairo, sans-serif";
  const titleBottom = drawWrappedText(context, listing.title, 540, 686, 860, 60, 2, language);
  context.fillStyle = template.accent;
  context.font = "800 48px Cairo, sans-serif";
  context.fillText(listingSharePriceLabel(listing, language), 540, titleBottom + 70);
  context.fillStyle = template.surface;
  context.globalAlpha = 0.7;
  context.font = "500 22px Cairo, sans-serif";
  context.fillText(listingShareLocationLabel(listing, language), 540, titleBottom + 112);
  context.globalAlpha = 1;
  drawHighlightsColumns(input, highlights, 96, 922, 888, template.surface, template.accent);
  drawCardUrl(input, 540, 1012, template.accent, "center");
}

function drawStory(input: ShareCardRenderInput) {
  const { context, template, listing, language, highlights, width, height } = input;
  fillCardBackground(input);
  drawShareImage(input, 0, 0, width, 1120, 0);
  const overlay = context.createLinearGradient(0, 420, 0, 1120);
  overlay.addColorStop(0, "rgba(20,38,61,0)");
  overlay.addColorStop(1, template.background);
  context.fillStyle = overlay;
  context.fillRect(0, 420, width, 700);
  drawBrandLockup(input, 72, 82, "#FFFFFF", template.accent);
  configureLocalizedText(context, language, language === "en" ? "left" : "right");
  const textX = language === "en" ? 72 : width - 72;
  context.fillStyle = "#FFFFFF";
  context.font = "900 68px Cairo, sans-serif";
  const titleBottom = drawWrappedText(context, listing.title, textX, 800, width - 144, 88, 3, language);
  context.fillStyle = template.accent;
  context.font = "900 62px Cairo, sans-serif";
  context.fillText(listingSharePriceLabel(listing, language), textX, titleBottom + 88);
  context.fillStyle = "#FFFFFF";
  context.globalAlpha = 0.82;
  context.font = "600 31px Cairo, sans-serif";
  context.fillText(listingShareLocationLabel(listing, language), textX, titleBottom + 146);
  context.globalAlpha = 1;
  context.fillStyle = template.surface;
  roundedRectPath(context, 72, 1190, width - 144, 500, 44);
  context.fill();
  configureLocalizedText(context, language, language === "en" ? "left" : "right");
  context.fillStyle = template.foreground;
  context.font = "800 35px Cairo, sans-serif";
  context.fillText(language === "en" ? "Listing highlights" : "أبرز التفاصيل", textX, 1262);
  drawHighlightStack(input, highlights, 112, 1315, width - 224, 96, {
    background: "#FFFFFF",
    foreground: template.foreground,
    muted: template.muted,
  });
  configureLocalizedText(context, language, "center");
  context.fillStyle = template.surface;
  context.font = "800 34px Cairo, sans-serif";
  context.fillText(
    language === "en" ? "View the listing on RAWAJ" : "شاهد الإعلان على رواج",
    width / 2,
    1780,
  );
  drawCardUrl(input, width / 2, height - 74, template.accent, "center");
}

function fillCardBackground({ context, template, width, height }: ShareCardRenderInput) {
  context.fillStyle = template.background;
  context.fillRect(0, 0, width, height);
  context.textBaseline = "alphabetic";
}

function drawBrandLockup(
  input: ShareCardRenderInput,
  margin: number,
  y: number,
  brandColor: string,
  domainColor: string,
) {
  const { context, language, width } = input;
  configureLocalizedText(context, language, language === "en" ? "left" : "right");
  context.fillStyle = brandColor;
  context.font = "800 38px Cairo, sans-serif";
  context.fillText(language === "en" ? "RAWAJ" : "رواج", language === "en" ? margin : width - margin, y);
  const previousDirection = context.direction;
  context.direction = "ltr";
  context.textAlign = language === "en" ? "right" : "left";
  context.fillStyle = domainColor;
  context.font = "700 22px Cairo, sans-serif";
  context.fillText(SYRIA_DOMAIN, language === "en" ? width - margin : margin, y - 3);
  context.direction = previousDirection;
}

function drawShareImage(
  input: ShareCardRenderInput,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const { context, image, template } = input;
  context.save();
  roundedRectPath(context, x, y, width, height, radius);
  context.clip();
  context.fillStyle = template.surface;
  context.fillRect(x, y, width, height);
  if (image) drawImageCover(context, image, x, y, width, height);
  else drawImageFallback(context, x, y, width, height, template);
  context.restore();
}

function drawHighlightStack(
  input: ShareCardRenderInput,
  highlights: ListingShareHighlight[],
  x: number,
  y: number,
  width: number,
  rowHeight: number,
  colors: { background: string; foreground: string; muted: string },
) {
  const { context, language } = input;
  highlights.forEach((highlight, index) => {
    const rowY = y + index * (rowHeight + 12);
    context.fillStyle = colors.background;
    context.globalAlpha = 0.96;
    roundedRectPath(context, x, rowY, width, rowHeight, 16);
    context.fill();
    context.globalAlpha = 1;
    const textX = language === "en" ? x + 20 : x + width - 20;
    configureLocalizedText(context, language, language === "en" ? "left" : "right");
    context.fillStyle = colors.muted;
    context.font = "700 17px Cairo, sans-serif";
    context.fillText(highlight.label, textX, rowY + 27);
    context.fillStyle = colors.foreground;
    context.font = "800 24px Cairo, sans-serif";
    context.fillText(fitCanvasText(context, highlight.value, width - 40), textX, rowY + 59);
  });
}

function drawHighlightsColumns(
  input: ShareCardRenderInput,
  highlights: ListingShareHighlight[],
  x: number,
  y: number,
  width: number,
  foreground: string,
  accent: string,
) {
  const { context, language } = input;
  const columnWidth = width / Math.max(highlights.length, 1);
  highlights.forEach((highlight, index) => {
    const centerX = x + columnWidth * index + columnWidth / 2;
    configureLocalizedText(context, language, "center");
    context.fillStyle = accent;
    context.font = "700 17px Cairo, sans-serif";
    context.fillText(highlight.label, centerX, y);
    context.fillStyle = foreground;
    context.font = "800 23px Cairo, sans-serif";
    context.fillText(fitCanvasText(context, highlight.value, columnWidth - 24), centerX, y + 34);
  });
}

function drawHighlightsInline(
  input: ShareCardRenderInput,
  highlights: ListingShareHighlight[],
  x: number,
  y: number,
  width: number,
  foreground: string,
  muted: string,
  separator: string,
) {
  if (highlights.length === 0) return;
  const { context, language } = input;
  configureLocalizedText(context, language, language === "en" ? "left" : "right");
  context.fillStyle = muted;
  context.font = "700 21px Cairo, sans-serif";
  const value = highlights.map((highlight) => `${highlight.label}: ${highlight.value}`).join(separator);
  context.fillText(fitCanvasText(context, value, width), language === "en" ? x : x + width, y);
  context.fillStyle = foreground;
}

function drawCardUrl(input: ShareCardRenderInput, x: number, y: number, color: string, align: CanvasTextAlign) {
  const { context } = input;
  context.direction = "ltr";
  context.textAlign = align;
  context.fillStyle = color;
  context.font = "700 20px ui-monospace, monospace";
  context.fillText(SYRIA_DOMAIN, x, y);
}

function configureLocalizedText(context: CanvasRenderingContext2D, language: CardLanguage, align: CanvasTextAlign) {
  context.direction = language === "en" ? "ltr" : "rtl";
  context.textAlign = align;
}

function fitCanvasText(context: CanvasRenderingContext2D, value: string, maxWidth: number) {
  if (context.measureText(value).width <= maxWidth) return value;
  let fitted = value;
  while (fitted.length > 1 && context.measureText(`${fitted}…`).width > maxWidth) fitted = fitted.slice(0, -1);
  return `${fitted.trimEnd()}…`;
}

function drawImageFallback(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  template: ListingShareTemplate,
) {
  context.fillStyle = template.surface;
  context.fillRect(x, y, width, height);
  context.fillStyle = template.foreground;
  context.globalAlpha = 0.09;
  context.beginPath();
  context.arc(x + width * 0.68, y + height * 0.34, Math.min(width, height) * 0.28, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;
  context.fillStyle = template.accent;
  context.font = "800 64px Cairo, sans-serif";
  context.textAlign = "center";
  context.direction = "rtl";
  context.fillText("رواج", x + width / 2, y + height / 2 + 20);
}

function drawImageCover(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const renderedWidth = image.naturalWidth * scale;
  const renderedHeight = image.naturalHeight * scale;
  const offsetX = x + (width - renderedWidth) / 2;
  const offsetY = y + (height - renderedHeight) / 2;
  context.drawImage(image, offsetX, offsetY, renderedWidth, renderedHeight);
}

function roundedRectPath(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
  language: CardLanguage,
) {
  context.direction = language === "en" ? "ltr" : "rtl";
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return y;
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width <= maxWidth || !line) {
      line = next;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length === maxLines - 1) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  const consumedWords = lines.join(" ").split(/\s+/).length;
  if (consumedWords < words.length && lines.length > 0) {
    const lastIndex = lines.length - 1;
    lines[lastIndex] = `${lines[lastIndex].replace(/[.…]+$/u, "")}…`;
  }
  lines.forEach((entry, index) => context.fillText(entry, x, y + index * lineHeight));
  return y + (lines.length - 1) * lineHeight;
}

async function loadListingImage(source: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!source) return null;
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = source;
  });
}
