import { resolveCategoryFieldKind } from "@/lib/category-fields";
import type { ClassifiedListing } from "@/lib/classifieds-types";
import { listingShareHighlights } from "@/lib/listing-share-highlights";
import type { ListingShareTemplate } from "@/lib/listing-share-growth";

const CARD_WIDTH = 1080;
const SQUARE_HEIGHT = 1080;
const STORY_HEIGHT = 1920;
const FONT_FAMILY = '"Cairo", "Noto Sans Arabic", Arial, sans-serif';

export async function renderListingShareCard(
  listing: ClassifiedListing,
  template: ListingShareTemplate,
  language: string,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = template.format === "story" ? STORY_HEIGHT : SQUARE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");

  await document.fonts?.ready?.catch(() => undefined);
  const image = await loadListingImage(listing.primaryImageUrl);
  const highlights = listingShareHighlights(
    listing,
    resolveCategoryFieldKind(null, null, listing),
    language,
  ).map(({ label, value }) => `${label}: ${value}`);
  const copy = {
    title: listing.title.trim() || (language === "en" ? "Listing on RAWAJ" : "إعلان على رواج"),
    price: listingSharePriceLabel(listing, language),
    location: listingShareLocationLabel(listing, language),
    cta: language === "en" ? "View the listing on rawa-j.com" : "شاهد الإعلان على rawa-j.com",
    brand: language === "en" ? "RAWAJ  |  SYRIA" : "رواج  |  RAWAJ",
    noImage: language === "en" ? "RAWAJ Marketplace" : "سوق رواج سوريا",
    highlights,
  };
  setDirection(ctx, language);

  if (template.id === "quick-sale") drawQuickSale(ctx, image, copy, language);
  else if (template.id === "minimal") drawMinimal(ctx, image, copy, language);
  else if (template.id === "emerald") drawEmerald(ctx, image, copy, language);
  else if (template.id === "premium") drawPremium(ctx, image, copy, language);
  else if (template.id === "story") drawStory(ctx, image, copy, language);
  else drawClassic(ctx, image, copy, language);

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("blob_failed"))),
      "image/png",
      0.94,
    ),
  );
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
  if (values.length) return [...new Set(values)].join(" · ");
  return language === "en" ? "Syria" : "سوريا";
}

type CardCopy = {
  title: string;
  price: string;
  location: string;
  cta: string;
  brand: string;
  noImage: string;
  highlights: string[];
};

function drawClassic(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  copy: CardCopy,
  language: string,
) {
  fill(ctx, "#122238", 0, 0, 1080, 1080);
  drawBrand(ctx, copy.brand, 64, 70, "#F5F0E6", language, 34);
  fillRound(ctx, "#F5F0E6", 42, 132, 996, 900, 30);
  drawMedia(ctx, image, 66, 156, 948, 540, 22, "#D8C9A9", copy.noImage, language);
  fillRound(ctx, "#C99A43", 66, 724, 10, 218, 5);
  drawTextBlock(ctx, copy.title, language === "ar" ? 970 : 100, 758, 870, 50, 2, "#122238", 700, language);
  drawText(ctx, copy.price, 100, 878, "#9A681A", 700, 43, language, "left");
  drawText(ctx, copy.location, 970, 878, "#667085", 500, 28, language, "right");
  drawHighlights(ctx, copy.highlights, 970, 918, 870, 23, "#667085", language, "right");
  drawText(ctx, copy.cta, 970, 1004, "#122238", 700, 25, language, "right");
}

function drawQuickSale(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  copy: CardCopy,
  language: string,
) {
  fill(ctx, "#F4EEE2", 0, 0, 1080, 1080);
  fill(ctx, "#CC641A", 0, 0, 260, 1080);
  ctx.save();
  ctx.translate(130, 870);
  ctx.rotate(-Math.PI / 2);
  drawText(ctx, copy.brand, 0, 0, "#FFF7EC", 800, 34, language, "center");
  ctx.restore();
  drawMedia(ctx, image, 294, 62, 724, 600, 38, "#E4C6A7", copy.noImage, language);
  fillRound(ctx, "#21160F", 294, 698, 724, 2, 1);
  drawText(ctx, language === "en" ? "READY TO MOVE" : "جاهز للبيع", 1018, 748, "#CC641A", 800, 27, language, "right");
  drawTextBlock(ctx, copy.title, 1018, 812, 724, 51, 2, "#21160F", 800, language, "right");
  drawText(ctx, copy.price, 1018, 940, "#CC641A", 900, 50, language, "right");
  drawHighlights(ctx, copy.highlights, 1018, 978, 724, 22, "#715D50", language, "right");
  drawText(ctx, `${copy.location}  ·  ${copy.cta}`, 1018, 1060, "#715D50", 600, 22, language, "right");
}

function drawMinimal(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  copy: CardCopy,
  language: string,
) {
  fill(ctx, "#F7F4ED", 0, 0, 1080, 1080);
  drawText(ctx, copy.brand, 64, 74, "#182537", 800, 30, language);
  fill(ctx, "#182537", 64, 103, 952, 2);
  drawMedia(ctx, image, 64, 144, 952, 540, 4, "#E8E2D7", copy.noImage, language);
  drawTextBlock(ctx, copy.title, 1016, 754, 952, 48, 2, "#182537", 700, language, "right");
  drawText(ctx, copy.price, 1016, 876, "#182537", 800, 44, language, "right");
  drawHighlights(ctx, copy.highlights, 1016, 918, 952, 23, "#667085", language, "right");
  drawText(ctx, copy.location, 64, 1005, "#667085", 500, 25, language, "left");
  drawText(ctx, copy.cta, 1016, 1027, "#182537", 700, 23, language, "right");
}

function drawEmerald(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  copy: CardCopy,
  language: string,
) {
  fill(ctx, "#0C3B35", 0, 0, 1080, 1080);
  fillRound(ctx, "#B49A62", 52, 52, 976, 646, 34);
  drawMedia(ctx, image, 64, 64, 952, 622, 26, "#285E55", copy.noImage, language);
  fillRound(ctx, "#F2F0E8", 52, 730, 976, 298, 30);
  drawBrand(ctx, copy.brand, 92, 772, "#0C3B35", language, 28);
  drawTextBlock(ctx, copy.title, 988, 825, 896, 41, 2, "#102B27", 800, language, "right");
  drawText(ctx, copy.price, 988, 916, "#8C6A2F", 800, 38, language, "right");
  drawText(ctx, copy.location, 92, 916, "#667A75", 600, 24, language, "left");
  drawHighlights(ctx, copy.highlights, 988, 948, 896, 21, "#667A75", language, "right");
  drawText(ctx, copy.cta, 988, 1018, "#0C3B35", 700, 22, language, "right");
}

function drawPremium(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  copy: CardCopy,
  language: string,
) {
  fill(ctx, "#242529", 0, 0, 1080, 1080);
  fillRound(ctx, "#B48A42", 48, 48, 984, 984, 34);
  fillRound(ctx, "#242529", 54, 54, 972, 972, 30);
  drawBrand(ctx, copy.brand, 92, 112, "#D9B66F", language, 31);
  drawMedia(ctx, image, 92, 166, 584, 770, 22, "#3B3B3F", copy.noImage, language);
  fillRound(ctx, "#ECE5D8", 710, 166, 278, 770, 22);
  drawText(ctx, language === "en" ? "SELECTED" : "مختار", 944, 234, "#8F6A2D", 800, 22, language, "right");
  drawTextBlock(ctx, copy.title, 944, 322, 190, 42, 5, "#202126", 800, language, "right");
  drawText(ctx, copy.price, 944, 632, "#8F6A2D", 900, 35, language, "right");
  drawTextBlock(ctx, copy.location, 944, 705, 190, 32, 2, "#746E65", 600, language, "right");
  drawHighlights(ctx, copy.highlights, 944, 768, 190, 25, "#746E65", language, "right");
  fillRound(ctx, "#202126", 744, 842, 210, 74, 12);
  drawText(ctx, language === "en" ? "VIEW NOW" : "شاهد الآن", 849, 889, "#ECE5D8", 800, 23, language, "center");
  drawText(ctx, "rawa-j.com", 988, 988, "#D9B66F", 700, 26, language, "right");
}

function drawStory(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  copy: CardCopy,
  language: string,
) {
  fill(ctx, "#14263D", 0, 0, 1080, 1920);
  drawMedia(ctx, image, 0, 0, 1080, 1180, 0, "#27415F", copy.noImage, language);
  const overlay = ctx.createLinearGradient(0, 580, 0, 1220);
  overlay.addColorStop(0, "rgba(20,38,61,0)");
  overlay.addColorStop(1, "rgba(20,38,61,1)");
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 580, 1080, 680);
  drawBrand(ctx, copy.brand, 72, 110, "#FFFFFF", language, 34);
  fillRound(ctx, "#C78A2D", 72, 1230, 936, 8, 4);
  drawTextBlock(ctx, copy.title, 1008, 1345, 936, 72, 3, "#FFFFFF", 800, language, "right");
  drawText(ctx, copy.price, 1008, 1608, "#F0C676", 900, 58, language, "right");
  drawText(ctx, copy.location, 1008, 1686, "#D4DEE9", 600, 31, language, "right");
  drawHighlights(ctx, copy.highlights, 1008, 1724, 936, 27, "#D4DEE9", language, "right");
  fillRound(ctx, "#F5F0E6", 72, 1814, 936, 74, 18);
  drawText(ctx, copy.cta, 540, 1862, "#14263D", 800, 27, language, "center");
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

function drawMedia(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fallback: string,
  fallbackLabel: string,
  language: string,
) {
  ctx.save();
  roundedRectPath(ctx, x, y, width, height, radius);
  ctx.clip();
  fill(ctx, fallback, x, y, width, height);
  if (image) drawImageCover(ctx, image, x, y, width, height);
  else {
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(x + width * 0.76, y + height * 0.28, Math.min(width, height) * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    drawText(ctx, fallbackLabel, x + width / 2, y + height / 2 + 12, "#FFFFFF", 800, Math.max(25, Math.min(44, width * 0.055)), language, "center");
  }
  ctx.restore();
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function drawBrand(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  color: string,
  language: string,
  size: number,
) {
  drawText(ctx, value, language === "ar" ? CARD_WIDTH - x : x, y, color, 800, size, language);
}

function drawTextBlock(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
  color: string,
  weight: number,
  language: string,
  align: CanvasTextAlign = language === "ar" ? "right" : "left",
) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${Math.round(lineHeight * 0.78)}px ${FONT_FAMILY}`;
  ctx.textAlign = align;
  ctx.direction = language === "ar" ? "rtl" : "ltr";
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last.trim()}…`;
  }
  lines.forEach((current, index) => ctx.fillText(current, x, y + index * lineHeight));
}

function drawText(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  color: string,
  weight: number,
  size: number,
  language: string,
  align: CanvasTextAlign = language === "ar" ? "right" : "left",
) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${FONT_FAMILY}`;
  ctx.textAlign = align;
  ctx.direction = language === "ar" ? "rtl" : "ltr";
  ctx.fillText(value, x, y);
}

function drawHighlights(
  ctx: CanvasRenderingContext2D,
  highlights: string[],
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  color: string,
  language: string,
  align: CanvasTextAlign,
) {
  ctx.font = `600 ${Math.round(lineHeight * 0.82)}px ${FONT_FAMILY}`;
  highlights.slice(0, 3).forEach((highlight, index) => {
    drawText(
      ctx,
      fitSingleLine(ctx, highlight, maxWidth),
      x,
      y + index * lineHeight,
      color,
      600,
      Math.round(lineHeight * 0.82),
      language,
      align,
    );
  });
}

function fitSingleLine(ctx: CanvasRenderingContext2D, value: string, maxWidth: number) {
  if (ctx.measureText(value).width <= maxWidth) return value;
  let fitted = value;
  while (fitted.length > 1 && ctx.measureText(`${fitted}…`).width > maxWidth) {
    fitted = fitted.slice(0, -1);
  }
  return `${fitted.trim()}…`;
}

function setDirection(ctx: CanvasRenderingContext2D, language: string) {
  ctx.direction = language === "ar" ? "rtl" : "ltr";
  ctx.textAlign = language === "ar" ? "right" : "left";
  ctx.textBaseline = "alphabetic";
}

function fill(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, width: number, height: number) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
}

function fillRound(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, width: number, height: number, radius: number) {
  ctx.fillStyle = color;
  roundedRectPath(ctx, x, y, width, height, radius);
  ctx.fill();
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}
