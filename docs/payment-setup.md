# Saathi — In-App Payment (Google Play Billing) Setup

App me payment RevenueCat + Google Play Billing se hota hai. Ye steps USER karega
(code taiyaar hai, par inke bina payment test/ship nahi hoga):

1. **Google Play Console**
   - App ko internal testing track pe publish karo (signed AAB).
   - Subscriptions banao: product id `plus_monthly`, `plus_yearly` (base plans set karo).
   - Merchant/payments profile complete karo.
   - License testers add karo (test purchase bina charge ke).
2. **EAS Development Build** (Expo Go se GPB nahi chalta)
   - `eas build --profile development --platform android`
   - Isi dev build me `react-native-purchases` native module chalega.
3. **RevenueCat**
   - Project banao, Google Play se link (service account JSON).
   - Entitlement id: `plus`. Offering me `plus_monthly` + `plus_yearly` packages jodo.
   - Android API key lo → app `.env` me: `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=...`
4. **GST**: abhi off (registration nahi). Google India me GST khud handle karta hai;
   Console me tax-inclusive price set karna. Baad me apna GST invoice chahiye to alag.
5. **Webhook (baad me)**: RevenueCat → Supabase webhook se `profiles.plan` sync karo
   (refund/cancel handle). Abhi purchase success pe app khud plan set karta hai
   (`markProfilePlus`).

## Abhi (bina setup ke) kya hota hai

- Expo Go me app chalta hai, crash nahi hota.
- Upgrade screen pe "Securely pay" dabao → agar details adhoori → profile form khulta hai.
- Details poori → RevenueCat available na ho to toast: "Payment abhi is build me
  available nahi (dev build chahiye)". Setup ke baad asli purchase chalega.
