# RAWAJ Supabase Auth Foundation

هذه الوثيقة تخص sprint تأسيس المصادقة فقط. لا تحول RAWAJ إلى backend كامل، ولا تضيف CRUD حقيقي للإعلانات أو الدفع أو الرسائل.

## المتغيرات المطلوبة

أضف القيم العامة فقط إلى ملف البيئة المحلي المناسب للمشروع:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

- لا تضع `service_role` في الواجهة.
- إذا كانت القيم غير موجودة، يعمل التطبيق في حالة `authUnavailable` ويظل التصفح العام والنموذج التجريبي متاحين.
- عميل Supabase موجود في `src/lib/supabase.ts`.

## حالات Auth الحالية

الواجهة تدعم الحالات التالية عبر `AuthProvider` و `useAuth`:

- `loading`
- `signedOut`
- `signedIn`
- `authUnavailable`

صفحات RAWAJ العامة يجب أن تبقى قابلة للتصفح في كل الحالات.

## مخطط Supabase

ملف التأسيس:

`supabase/migrations/202606290001_auth_roles_foundation.sql`

يشمل:

- `profiles`
- `user_roles`
- `audit_logs`
- enum للأدوار
- enum لحالة الحساب
- enum لحالة التوثيق
- RLS policies مبدئية

القواعد الأمنية المقصودة:

- المستخدم يقرأ ملفه الشخصي، ويحدث حقولاً محدودة فقط.
- المستخدم لا يستطيع منح نفسه دوراً.
- الأدمن لا يستطيع ترقية نفسه.
- الأدمن لا يستطيع تعديل المالك.
- المالك يدير الأدوار.
- دور المالك محمي من الحذف/demotion عبر trigger.
- سجلات التدقيق يقرأها owner/admin فقط.

## Bootstrap المالك

ملف التشغيل اليدوي:

`supabase/manual/bootstrap_owner_allidamech.sql`

الغرض منه ترقية الحساب التالي فقط إلى owner:

`allidamech@gmail.com`

المتطلبات:

1. تفعيل Supabase Auth.
2. إنشاء المستخدم أو تسجيل دخوله أولاً حتى يظهر في `auth.users`.
3. تشغيل ملف bootstrap يدوياً من Supabase SQL Editor.

الملف idempotent:

- لا يكرر صف owner إذا كان موجوداً.
- لا يفشل إذا لم يكن المستخدم موجوداً؛ يعرض notice فقط.
- لا يستخدم service role في frontend.

## ما يزال Mock

- إنشاء وتعديل وحذف الإعلانات.
- رفع الصور.
- الرسائل.
- الدفع والترويج.
- تنفيذ إجراءات Owner/Admin.
- سجل النشاط الحقيقي للأعمال الإدارية.

هذه الملفات تضيف foundation فقط، وليست تفعيل backend كامل.
