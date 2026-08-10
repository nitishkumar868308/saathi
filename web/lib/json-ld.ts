/**
 * JSON-LD (structured data) ko `<script>` ke andar surakshit tareeke se daalna.
 *
 * ⚠️ Har jagah ye likha tha:
 *
 *     <script type="application/ld+json"
 *       dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
 *
 * `JSON.stringify` `</script>` ko NAHI badalta — wo uske liye ek aam string hai.
 * HTML parser ke liye wo string tag ka ant hai. Yaani blog ka title agar aisa ho:
 *
 *     Passport renew </script><script>…</script>
 *
 * …to wo script tag beech me hi band ho jaata hai aur uske baad ka hissa ASLI
 * script ban ke har visitor ke browser me chal jaata hai. Content admin panel se
 * aata hai (blog title/description/tags, SEO fields), isliye ye "apne aap ko
 * nuksaan" nahi hai — ek admin account ya ek galat paste poori public site par
 * baith jaata hai, aur wo HTML me stored rehta hai.
 *
 * Ilaaj chhota hai: `<`, `>` aur `&` ko unke unicode escape se badal do. JSON
 * inhe waise hi padhta hai (`<` = `<`), isliye Google ka parser bilkul
 * wahi data dekhta hai — par HTML parser ko koi tag dikhta hi nahi.
 *
 * U+2028 / U+2029 bhi isliye hain: JSON me ye valid hain par JavaScript me line
 * terminator maane jaate hain, aur kuch purane parser inpar toot jaate hain.
 */

/**
 * Jo char `<script>` ke andar khatarnak hain.
 *
 * ⚠️ U+2028 / U+2029 ko regex literal me SEEDHA likhna ek jaal hai: TypeScript
 * unhe LINE BREAK maanta hai aur `TS1161: Unterminated regular expression
 * literal` de deta hai — build wahin ruk jaata hai. Aur kai editor/tool escape
 * wali shakal ko chupchaap wapas asli akshar me badal dete hain, isliye escape
 * likh dena bhi tik nahi paata. Codepoint se banane par source me sirf ASCII
 * rehta hai aur ye sawaal dobara kabhi nahi uthta.
 */
const UNSAFE = new RegExp(
  `[<>&${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]`,
  "g",
);

/**
 * Ek char ka JSON unicode escape — `<` se `<`.
 *
 * Backslash bhi codepoint se banta hai (92) aur ye jaan-boojh ke hai: is repo ke
 * kuch tool source me likhe hue `\` ko chupchaap ek `\` bana dete hain, aur
 * uska nateeja sabse chupa hua bug hota — `"<"` seedha `<` ban jaata,
 * yaani replace ek no-op, yaani ye poori file bekaar. Codepoint par unka koi
 * asar nahi.
 */
function escapeChar(c: string): string {
  return (
    String.fromCharCode(92) + "u" + c.charCodeAt(0).toString(16).padStart(4, "0")
  );
}

export function ldJson(data: unknown): string {
  return JSON.stringify(data).replace(UNSAFE, escapeChar);
}
