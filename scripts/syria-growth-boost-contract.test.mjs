import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Syria Share Card Growth UI Arabic literals are valid UTF-8 and free of encoding mojibake", () => {
  const growth = read("src/features/growth/RawajGrowthLayer.tsx");
  const requiredArabic = [
    "إعلانك قيد المراجعة",
    "شارك إعلانك",
    "اختر شكل البطاقة",
    "شارك البطاقة",
    "تنزيل",
    "نسخ الرابط",
    "تعذر تحميل الإعلان الآن",
    "تم فتح نافذة المشاركة",
    "تم نسخ رابط الإعلان",
    "تعذر نسخ الرابط",
    "تم تنزيل بطاقة الإعلان",
    "تعذر إنشاء الصورة الآن",
    "نجهز بطاقات إعلانك",
    "تصاميم",
    "إغلاق",
  ];
  for (const phrase of requiredArabic) {
    assert.match(growth, new RegExp(phrase), `Growth component must contain correct Arabic: ${phrase}`);
  }
  const forbiddenMojibake = [
    "ط§",
    "ط¥",
    "ظ„",
    "طھظ…",
    "ط¥ط±",
    "ط´ط§ظ‡ط¯",
    "طھط¹ط°ط±",
    "طھظ†ط²ظٹظ„",
  ];
  for (const marker of forbiddenMojibake) {
    assert.doesNotMatch(growth, new RegExp(marker), `Growth component must not contain mojibake marker: ${marker}`);
  }
});
