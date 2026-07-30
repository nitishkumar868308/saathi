import HomeContent from "@/components/HomeContent";
import BlogTeaser from "@/components/BlogTeaser";

/**
 * Home page — server component ka ek patla khol.
 *
 * Poora content `components/HomeContent.tsx` me hai (wo client hai, kyunki
 * language switcher chahiye). Blog ka hissa yahan banta hai aur prop se andar
 * jaata hai — isse posts server par hi padhi jaati hain aur seedha HTML me
 * chali jaati hain. Client ke andar se fetch karte to Google ko wo kabhi
 * dikhtin hi nahi.
 */

// Blog DB se aata hai, isliye home bhi har 10 minute me taaza ho jaata hai.
// Admin nayi post publish kare to `revalidateTag("blog")` turant refresh kar
// deta hai — deploy ki zaroorat nahi.
export const revalidate = 600;

export default function Page() {
  return <HomeContent blog={<BlogTeaser />} />;
}
