-- Apka Saathi — SEO settings + Blog posts (dono admin se editable)
-- Supabase SQL Editor me Run karo. (Dobara run safe hai.)
--
-- Soch: SEO code me hardcode nahi hona chahiye. Title/description badalne ke liye
-- har baar deploy karna pade — ye SEO ka sabse bada dushman hai, kyunki tuning
-- roz-roz karni padti hai. Isliye:
--
--   seo_pages  — har page ka title, description, keywords, OG, noindex
--   blog_posts — poori blog, admin se likhi/badli jaa sakti hai
--
-- Website in dono ko padhti hai; DB khaali ho ya na chale to code me diye gaye
-- defaults chal jaate hain (site kabhi khaali meta ke saath live nahi jaati).

/* ------------------------------------------------------------------ */
/* 1. SEO — per page                                                    */
/* ------------------------------------------------------------------ */

create table if not exists public.seo_pages (
  -- Site-relative path: "/" , "/about", "/blog", "/support"…
  path            text primary key,
  title           text,
  description     text,
  keywords        text[],
  og_title        text,
  og_description  text,
  -- true = is page ko search engine se chhupao (robots noindex).
  noindex         boolean not null default false,
  updated_at      timestamptz not null default now()
);

-- Sab padh sakte hain — meta tags waise bhi HTML me public hi hote hain.
-- Likhna sirf service_role (admin API) se.
alter table public.seo_pages enable row level security;
drop policy if exists "read seo" on public.seo_pages;
create policy "read seo" on public.seo_pages for select using (true);

-- Shuruaati rows — admin panel me kuch to dikhe. `do nothing` isliye ki dobara
-- run karne par admin ki likhi hui values wapas na badal jaayein.
insert into public.seo_pages (path, title, description, keywords) values
  ('/',
   'Reminder App for Documents, Medicine & Bills — Apka Saathi',
   'Apka Saathi reminds you before your passport, Aadhaar, insurance or FASTag expires, and nudges you for medicines, bills and daily tasks. Free Android app in Hindi and English.',
   array['reminder app','document reminder app','document expiry reminder','medicine reminder app','bill reminder app','passport expiry reminder','Aadhaar reminder','insurance renewal reminder','FASTag recharge reminder','Hindi reminder app','Apka Saathi']),
  ('/about', 'About',
   'Why we built Saathi — a reminder app that takes the burden of remembering off you. Our story and what we care about.', null),
  ('/contact', 'Contact',
   'Questions, feedback or just hello — reach the Saathi team and we will reply quickly.', null),
  ('/support', 'Support & Help',
   'Get help with Apka Saathi — reminders arriving late, notifications not showing, account and billing questions.', null),
  ('/blog', 'Blog — Reminders, Documents & Deadlines',
   'Practical guides on tracking document expiry dates, passport and Aadhaar renewals, medicine reminders and bill due dates.', null),
  ('/privacy', 'Privacy Policy',
   'How Apka Saathi stores your documents and reminders, what we never do with your data, and the control you keep.', null),
  ('/terms', 'Terms & Conditions',
   'The terms that apply when you use Apka Saathi — plain and short.', null)
on conflict (path) do nothing;

/* ------------------------------------------------------------------ */
/* 2. Blog                                                              */
/* ------------------------------------------------------------------ */

create table if not exists public.blog_posts (
  slug             text primary key,
  title            text not null,
  description      text not null,
  heading          text not null,
  intro            text not null,
  -- [{ "h": "...", "p": ["para", "para"] }, …]
  sections         jsonb not null default '[]'::jsonb,
  tags             text[] not null default '{}',
  reading_minutes  int not null default 4,
  -- Draft post site par nahi dikhti aur sitemap me bhi nahi jaati.
  is_published     boolean not null default true,
  published_at     date not null default current_date,
  updated_at       timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create index if not exists blog_published_idx
  on public.blog_posts(is_published, published_at desc);

alter table public.blog_posts enable row level security;
drop policy if exists "read published posts" on public.blog_posts;
-- Sirf published posts public. Draft sirf admin API (service_role) ko dikhte hain.
create policy "read published posts" on public.blog_posts for select
  using (is_published = true);

-- `updated_at` khud badle — admin bhoole to bhi Google ko sahi date jaaye.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists blog_posts_touch on public.blog_posts;
create trigger blog_posts_touch before update on public.blog_posts
  for each row execute function public.touch_updated_at();

drop trigger if exists seo_pages_touch on public.seo_pages;
create trigger seo_pages_touch before update on public.seo_pages
  for each row execute function public.touch_updated_at();
