# صلاحيتي

تطبيق أندرويد عربي (RTL) لتتبع تواريخ انتهاء صلاحية المنتجات: مسح QR/باركود، صورة المنتج، أو إدخال يدوي، مع تنبيهات محلية يحدد المستخدم موعدها، وتسجيل دخول بحساب Google، وحفظ البيانات في Supabase.

## التقنيات
React + Vite + TypeScript، Capacitor 8، Supabase (Auth + Postgres + Storage مع RLS)، ML Kit للمسح.

## الإعداد اليدوي لتسجيل الدخول بـ Google
1. في Google Cloud أنشئ OAuth Client (Web) وانسخ Client ID و Secret.
2. في لوحة Supabase: Authentication → Providers → Google → فعّله والصق البيانات، وأضف Redirect URI الظاهر في الصفحة إلى Google Cloud.
3. في Authentication → URL Configuration → Redirect URLs أضف: `com.salahiyati.app://auth-callback`

## البناء
كل دفع إلى `main` يشغّل GitHub Actions: فحص الأنواع، اختبارات الوحدة، اختبارات المتصفح (لقطات شاشة في Artifacts)، ثم بناء APK ونشره في Releases.

محليًا: `npm install && npm run dev`
