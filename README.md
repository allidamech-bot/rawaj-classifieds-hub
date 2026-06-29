# رَوَاج | RAWAJ

سوق سوريا المجاني للإعلانات المبوّبة — Web/PWA mock-first prototype.

## الرؤية

رَوَاج منصة إعلانات مبوّبة عربية أولاً (RTL) مخصّصة لسوريا فقط: سيارات، عقارات، موبايلات، إلكترونيات، أثاث، خدمات، وظائف، أزياء، حيوانات، تعليم، أعمال، وأكثر — منظّمة حسب المحافظات والمناطق السورية.

## الحالة الحالية

**Mock-first Web/PWA prototype.** كل الواجهات تعمل، لكن الميزات التالية واجهة-فقط (placeholders) ولا تتصل بأي خادم:

- التسجيل/الدخول والمصادقة
- رفع الصور الفعلي
- الرسائل/المحادثات الحيّة
- الإشعارات
- الدفع وتمييز الإعلانات
- إجراءات الإدارة (موافقة/رفض/حظر)
- إرسال الدعم والإبلاغات
- نشر إعلان حقيقي

البيانات تأتي من `src/data/mockData.ts` ومُعلَّمة بوضوح أنها وهمية.

## الواجهة والهوية

نظام **RAWAJ Atlas Design**:

- لوحة ألوان: عاجي `#F8F4EA`، كحلي `#101722`، ذهبي `#B88A44`، زمرّدي ثقة `#166B52`.
- خطوط: Cairo و Tajawal.
- مكوّنات هادئة، ظلال ناعمة، شاشة-أولاً للجوال، RTL بالكامل.

## التقنية

- TanStack Start v1 (React 19 + Vite 8)
- TanStack Router (file-based)
- Tailwind CSS v4
- shadcn/ui + Radix
- TypeScript strict
- lucide-react

## المسارات

| المسار | الوصف |
| --- | --- |
| `/` | الصفحة الرئيسية: بحث، أقسام، مميزة، أحدث، محافظات |
| `/categories` | كل الأقسام |
| `/listings` | نتائج البحث مع فلاتر |
| `/listings/$id` | تفاصيل الإعلان |
| `/add-listing` | إضافة إعلان — 5 خطوات + درجة جودة |
| `/chats` | الرسائل (placeholder) |
| `/profile` | حسابي (placeholder) |
| `/favorites` | المفضلة (placeholder) |
| `/saved-searches` | عمليات البحث المحفوظة (placeholder) |
| `/seller/$id` | صفحة البائع |
| `/promotion` | باقات تمييز الإعلان (mock) |
| `/safety` `/terms` `/privacy` `/prohibited` `/support` | صفحات قانونية ودعم |
| `/admin/*` | لوحة إدارة هيكلية (placeholder) |

## الخطة المستقبلية للخادم

هذا الـ prototype مُهيكَل ليُربط لاحقاً بـ **Lovable Cloud / Supabase**:

- جداول مقترحة: `users`, `listings`, `categories`, `subcategories`, `listing_images`, `favorites`, `saved_searches`, `chats`, `messages`, `reports`, `blocks`, `reviews`, `promotions`, `support_tickets`, `admin_audit_logs`.
- المصادقة عبر Supabase Auth.
- التخزين عبر Supabase Storage.
- الأدوار في جدول `user_roles` منفصل (لتجنّب تصعيد الصلاحيات).

كما يمكن تغليفه لاحقاً عبر Capacitor أو Expo Web لإطلاقه كتطبيق هاتف.

## التشغيل

السكريبتات في `package.json`:

- `dev` — تشغيل خادم التطوير.
- `build` — بناء الإنتاج.
- `build:dev` — بناء وضع التطوير.
- `preview` — معاينة بناء الإنتاج.
- `lint` — فحص ESLint.
- `typecheck` — فحص الأنواع `tsc --noEmit`.
- `format` — Prettier.

## ملاحظات هامة

- التطبيق لسوريا فقط — لا يدعم بلداناً أخرى عمداً.
- التصميم أصلي وليس نسخة من أي سوق إلكتروني آخر.
- لا توجد ميزات حقيقية متصلة بالإنترنت في هذه المرحلة.
