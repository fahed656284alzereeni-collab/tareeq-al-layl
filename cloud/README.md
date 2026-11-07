# مرسال — واجهة Cloudflare Pages

هذا مجلد تطبيق الويب الجديد، معزول عن التطبيق القديم الموجود في جذر المستودع.

## البنية المستهدفة

- GitHub: المصدر الوحيد للكود وسجل التغييرات.
- Cloudflare Pages: بناء ونشر مجلد `cloud` إلى رابط مجاني من نوع `*.pages.dev`.
- Supabase: Google Auth، ملفات المستخدمين، المحادثات، الرسائل وRealtime.

## إعداد Cloudflare Pages

عند ربط المستودع في Cloudflare Pages استخدم:
- Production branch: `mersal-cloudflare-migration` أثناء التجربة فقط.
- Root directory: `cloud`.
- Build command: `npm run build`.
- Build output directory: `dist`.
- لا يوجد نطاق مدفوع مطلوب.

لا تعتبر النسخة تجريبية صالحة للإنتاج قبل إكمال إعداد Google OAuth، وفحص سياسات RLS وRealtime واختبارات VoiceOver.

## التطوير محليًا

```sh
npm install
npm run dev
npm run build
```

## إعداد Google OAuth المطلوب لاحقًا

يجب إضافة رابط Cloudflare Pages النهائي إلى قائمة Redirect URLs في Supabase، وضبط Google provider في Supabase بمعلومات OAuth Web Client. لا تضع Client Secret في هذا المستودع أو في كود المتصفح.

## سياسة التحديثات

1. كل ميزة جديدة تعمل على فرع مستقل.
2. بناء واختبار نسخة المعاينة قبل الدمج.
3. لا تجرى تغييرات على جداول الإنتاج دون migration موثق ومراجعة RLS.
4. لا تُحذف بيانات المستخدمين أو محادثاتهم عند نشر واجهة جديدة.
5. يبقى التطبيق القديم في جذر المستودع دون تغيير حتى اجتياز النسخة الجديدة اختبارات القبول.

## حدود النسخة الحالية

هذه بداية واجهة المراسلة الخاصة فقط: دخول Google، البحث عن الملفات الشخصية، فتح محادثة فردية، إرسال الرسائل واستقبالها عبر Realtime. لا تشمل بعد إدارة الملف الشخصي، الإشعارات، المرفقات، الحظر، أو ترحيل حسابات Firebase القديمة.
