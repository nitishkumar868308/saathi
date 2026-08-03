import HomeContent from "@/components/HomeContent";
import BlogTeaser from "@/components/BlogTeaser";
import { getPublicReviews, getReviewStats } from "@/lib/reviews-server";
import { SITE_URL, SITE_NAME } from "@/lib/seo-server";

/**
 * Home page — server component ka ek patla khol.
 *
 * Poora content `components/HomeContent.tsx` me hai (wo client hai, kyunki
 * language switcher chahiye). Blog aur asli reviews ka hissa yahan banta hai aur
 * prop se andar jaata hai — isse dono server par hi padhe jaate hain aur seedha
 * HTML me chale jaate hain. Client ke andar se fetch karte to Google ko wo kabhi
 * dikhte hi nahi.
 */

// Blog aur reviews dono DB se aate hain, isliye home har 10 minute me taaza ho
// jaata hai. Admin nayi post publish kare to `revalidateTag("blog")` turant
// refresh kar deta hai — deploy ki zaroorat nahi.
export const revalidate = 600;

export default async function Page() {
  // Dono saath — ek doosre ka intezaar nahi karte. Dono kabhi throw nahi karte:
  // fail hone par khaali list/zero aata hai aur page waise hi ban jaata hai.
  const [reviews, reviewStats] = await Promise.all([
    getPublicReviews(9),
    getReviewStats(),
  ]);

  /**
   * Asli rating ka structured data — sirf tab jab sach me reviews hain.
   *
   * ⚠️ Ye `app/layout.tsx` me jaan-boojh ke NAHI hai. Google ki shart hai ki
   * rating asli ho aur usi page par dikhti ho jahan markup hai. Reviews sirf
   * home par dikhte hain, isliye markup bhi sirf yahin — aur wo bhi tabhi jab
   * `reviewStats` me sach me kuch ho. Banaya hua rating markup manual action la
   * sakta hai, isliye yahan koi default/fallback number nahi hai.
   */
  const ratingLd =
    reviews.length > 0 && reviewStats.avg != null && reviewStats.count > 0
      ? {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "@id": `${SITE_URL}/#app`,
          name: SITE_NAME,
          applicationCategory: "ProductivityApplication",
          operatingSystem: "Android",
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: reviewStats.avg,
            reviewCount: reviewStats.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : null;

  return (
    <>
      {ratingLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ratingLd) }}
        />
      )}
      <HomeContent
        blog={<BlogTeaser />}
        reviews={reviews}
        reviewStats={reviewStats}
      />
    </>
  );
}
