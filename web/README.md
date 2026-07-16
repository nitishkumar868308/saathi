# Saathi — Landing Page

Warm, premium, responsive landing page (Next.js + Tailwind) — Vercel pe deploy ke liye taiyaar.
Theme: cream + terracotta + Fraunces/Mulish (Dot by New Computer jaisa cozy premium vibe).

---

## 🚀 Local pe chalao

```bash
cd web
npm install
npm run dev
```

Phir browser mein khol: **http://localhost:3000**

---

## ☁️ Vercel pe deploy (free)

**Aasan tareeka (GitHub se):**

1. Is code ko ek **GitHub repo** mein push karo.
2. [vercel.com](https://vercel.com) pe login (GitHub se).
3. **"Add New → Project"** → apni repo chuno.
4. **Root Directory** = `web` set karo (kyunki landing page is folder mein hai).
5. **Deploy** dabao. Bas — 1 minute mein live URL mil jayega (`...vercel.app`).

**Ya CLI se:**

```bash
npm i -g vercel
cd web
vercel
```

---

## 🌐 Apna domain (optional)

Vercel project → **Settings → Domains** → apna domain add karo (jaise `getsaathi.in`).
Domain Namecheap / GoDaddy / Hostinger se ~₹800/saal mein milega.

---

## 🎨 Customize

- **Colors / fonts:** `tailwind.config.ts`
- **Content / sections:** `app/page.tsx`
- **Copy / bhasha:** `lib/i18n/dictionaries.ts`
- **App ka naam / SEO:** `app/layout.tsx`

---

## 🧱 Stack

Next.js 14 (App Router) · Tailwind CSS · TypeScript · lucide-react icons
