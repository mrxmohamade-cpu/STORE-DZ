# My Store - Production Setup (Firebase + Telegram + Vercel)

هذا المشروع جاهز الآن للعمل بطريقتين:

1. وضع محلي (Local): بدون Firebase، البيانات تُحفظ في المتصفح فقط.
2. وضع سحابي (Cloud): مع Firebase Firestore + Storage + إشعارات تيليجرام.

## 1) إنشاء مشروع Firebase

- ادخل إلى [Firebase Console](https://console.firebase.google.com/).
- أنشئ مشروع جديد.
- فعّل Firestore Database.
- فعّل Storage.
- من Project settings > General > Your apps:
  - أنشئ Web App.
  - انسخ مفاتيح التهيئة.

## 2) إعداد متغيرات البيئة

انسخ الملف:

```bash
cp .env.example .env
```

املأ القيم في `.env`:

- `VITE_FIREBASE_*` من إعدادات Firebase Web App.
- `TELEGRAM_BOT_TOKEN` و `TELEGRAM_CHAT_ID` (تُستخدم على Vercel API فقط).

## 3) إنشاء بوت تيليجرام وربطه بالموقع

- أنشئ بوت عبر `@BotFather` وخذ `BOT_TOKEN`.
- احصل على `CHAT_ID` (يمكن عبر `@userinfobot` أو API updates).
- أضف القيم في Vercel Environment Variables (وليس في كود الواجهة).

المشروع يستخدم endpoint آمن:

- `POST /api/send-order`
- التوكن يبقى على السيرفر فقط.

## 4) تشغيل المشروع محليًا

```bash
npm install
npm run dev
```

## 5) النشر على Vercel

- ارفع المشروع إلى GitHub.
- اربطه بـ Vercel.
- أضف نفس Environment Variables داخل Vercel.
- نفّذ Deploy.

تم تجهيز `vercel.json` ليدعم React SPA + API routes.

## 6) ربط الدومين

- اشترِ Domain من أي مزود.
- من Vercel > Project > Domains أضف الدومين.
- عدّل DNS records كما يعرض Vercel.

## أمان Firebase (مهم)

### Firestore Rules (مبدئيًا)

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /store_data/{docId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

### Storage Rules (مبدئيًا)

```txt
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /products/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

ملاحظة: الأفضل لاحقًا إضافة Firebase Authentication للإدارة بدل كلمة سر ثابتة.
