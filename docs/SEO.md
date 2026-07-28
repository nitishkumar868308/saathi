# SEO — setup aur roz ka kaam

Ye file batati hai ki SEO ka kaunsa hissa **code me** hai, kaunsa **admin panel
me**, aur launch ke baad kya-kya karna hai.

Sabse zaroori baat pehle: **title, description, keywords aur blog — sab admin
panel se badalte hain, code se nahi.** SEO tuning roz ka kaam hai; har chhote
badlaav ke liye deploy karna padta to koi karta hi nahi.

---

## 1. Ek baar ka setup

### 1.1 Database

Supabase → SQL Editor → ye do file chalao (dono dobara chalana safe hai):

```
supabase/seo-blog.sql          -- seo_pages + blog_posts
supabase/devices-analytics.sql -- devices + analytics_events + admin RPCs
supabase/reminder-note.sql     -- reminders.note (email me description ke liye)
```

### 1.2 Environment variables

`web/.env.local` (aur Vercel → Project → Settings → Environment Variables):

| Variable | Kis liye |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical, sitemap aur OG URLs. `https://www.apkasaathi.com` |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Search Console ka HTML-tag verification (sirf token, poora tag nahi) |
| `NEXT_PUBLIC_GA_ID` | Google Analytics 4 Measurement ID (`G-XXXXXXX`) |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Website SEO/blog inhi se padhti hai |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin panel likhne ke liye (sirf server par) |
| `NEXT_PUBLIC_PLAY_STORE_URL` | Download button ka link |
| `NEXT_PUBLIC_PLAY_STORE_LIVE` | Launch ke din `true` |

### 1.3 Google Search Console

1. [search.google.com/search-console](https://search.google.com/search-console) → **Add property** → *URL prefix* → `https://www.apkasaathi.com`
2. Verification me **HTML tag** chuno. Jo `content="..."` dikhe, wahi token
   `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` me daal do aur deploy karo. Tag apne
   aap lag jaayega (`app/layout.tsx` → `metadata.verification`).
3. Verify dabao.
4. **Sitemaps** → `sitemap.xml` add karo.

### 1.4 Google Analytics 4

1. [analytics.google.com](https://analytics.google.com) → Admin → **Data Streams**
   → Web → apna domain daalo.
2. **Measurement ID** (`G-XXXXXXX`) copy karke `NEXT_PUBLIC_GA_ID` me daalo.
3. GA4 ko Search Console se jodo: GA4 Admin → **Search Console links**.

> GA4 aur apna analytics — dono chalte hain, dono ka kaam alag hai.
> GA4 aggregate ke liye (kitne log, kahan se). Apna wala (admin → Analytics)
> per-user journey ke liye — ek user ne website par kaunse page dekhe aur phir
> app me kya kiya, ek hi timeline me.

---

## 2. Roz/hafte ka kaam — admin panel

### Admin → SEO

Har page ki ek row: title, meta description, OG title/description, keywords,
aur "search se chhupao" (noindex).

- **Title** 60 characters ke andar. Sabse kaam ka keyword pehle, brand aakhir me.
- **Description** ~155 characters. Ye wahi line hai jo Google ke result me dikhti
  hai — isko ad ki tarah likho, keyword ki list ki tarah nahi.
- Dono par counter laga hai; limit paar hote hi laal ho jaata hai.
- Save karte hi live site par lag jaata hai (`revalidateTag("seo")`), deploy nahi
  karna padta.

### Admin → Blog

Nayi post likho, purani badlo, draft me rakho.

- **Slug** wahi rakho jo log search karte hain: `passport-renewal-reminder`,
  `medicine-reminder-app`.
- Body "sections" me hoti hai: har section ka ek heading (H2) aur uske neeche
  paragraphs. Textarea me **khaali line se naya paragraph** banta hai.
- Publish karte hi post website, sitemap aur "Read next" — teenon me aa jaati
  hai.
- Post ka `BlogPosting` + `BreadcrumbList` structured data apne aap ban jaata hai.

### Admin → Analytics

- Rozana events/sessions, aur sabse zyada dekhe gaye screens/pages.
- **Ek user ka safar**: Users tab se user ID copy karke daalo — us user ne
  website par kya dekha aur app me kya dabaya, kram se.

---

## 3. Launch ke baad ki checklist

- [ ] Search Console me **URL Inspection** se ye pages ek-ek karke *Request
      indexing* karo: `/`, `/blog`, `/about`, `/support`, `/contact`, aur har
      blog post.
- [ ] `NEXT_PUBLIC_PLAY_STORE_LIVE=true` karo.
- [ ] App ke screenshots `web/public/screenshots/` me daal ke
      `web/lib/screenshots.ts` ki list bharo — homepage ka "Inside the app"
      section apne aap dikhne lagega.
- [ ] Play Store par asli rating aane ke baad `app/layout.tsx` ke JSON-LD me
      `aggregateRating` add karo. **Isse pehle nahi** — banaya hua rating markup
      Google se manual action la sakta hai.
- [ ] Search Console → **Pages** report har hafte dekho. "Crawled – currently not
      indexed" ya "Discovered – currently not indexed" ka matlab aksar patla
      content hota hai: us page ka content badhao, phir dobara indexing maango.

---

## 4. Lambi race ki strategy

Target keywords: *reminder app*, *document reminder*, *document expiry reminder*,
*medicine reminder*, *bill reminder*, *passport expiry reminder*, *Aadhaar
reminder*.

Kaam karne wala tareeka:

1. **Har keyword ka apna page.** Ek page das keyword par rank nahi karta. Har
   bade keyword ke liye ek blog post, jiska slug aur H1 usi keyword se bane.
2. **Aapas me link karo.** Har nayi post ko do purani posts se link karo, aur
   homepage ke content block se blog par. Google isi tarah nayi post dhoondhta
   hai.
3. **Purani post refresh karte raho.** Content update karke `updated_at` badalna
   nayi post likhne se aasan hai, aur aksar utna hi kaam karta hai.
4. **Ek sawaal, ek jawab.** Jo post ek seedha sawaal poori tarah answer karti hai
   ("passport kab renew karna chahiye") wo lambi general post se hamesha aage
   nikalti hai.
5. **Rating/review markup tabhi jab asli ho.** Baaki structured data (Organization,
   SoftwareApplication, FAQPage, BlogPosting) pehle se laga hua hai.

---

## 5. Code me kya-kya hai (reference)

| Cheez | File |
|---|---|
| Per-page meta (DB + fallback) | `web/lib/seo-server.ts` |
| Blog (DB + seed fallback) | `web/lib/blog-server.ts`, `web/lib/blog.ts` |
| Organization + WebSite + SoftwareApplication JSON-LD | `web/app/layout.tsx` |
| FAQPage JSON-LD | `web/components/Faq.tsx`, `web/app/support/page.tsx` |
| BlogPosting + Breadcrumb JSON-LD | `web/app/blog/[slug]/page.tsx` |
| sitemap.xml | `web/app/sitemap.ts` |
| robots.txt | `web/app/robots.ts` |
| OG image (static PNG) | `web/app/opengraph-image.png`, banane ka script `web/scripts/gen-og.mjs` |
| 404 / error page | `web/app/not-found.tsx`, `web/app/error.tsx` |
| Homepage ka content block | `web/components/SeoIntro.tsx` + `web/lib/i18n/dictionaries.ts` (`seo`) |
| Web analytics events | `web/lib/analytics.ts`, `web/components/PageTracker.tsx` |
| App analytics events | `app-mobile/src/lib/analytics.ts` |
