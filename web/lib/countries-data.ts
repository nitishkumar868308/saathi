/**
 * Admin pricing picker ke liye country list — code, naam, currency, symbol, aur
 * ek DEFAULT conversion rate (1 INR = ? local). Ye sirf shuruaati value hai;
 * admin actual rate DB me set karta hai. App/web actual rows DB se padhte hain.
 */
export type CountrySeed = {
  code: string;
  name: string;
  currency: string;
  symbol: string;
  rate: number; // 1 INR = rate local (approx default)
};

export const COUNTRIES: CountrySeed[] = [
  { code: "IN", name: "India", currency: "INR", symbol: "₹", rate: 1 },
  { code: "US", name: "United States", currency: "USD", symbol: "$", rate: 0.012 },
  { code: "GB", name: "United Kingdom", currency: "GBP", symbol: "£", rate: 0.0095 },
  { code: "CA", name: "Canada", currency: "CAD", symbol: "C$", rate: 0.016 },
  { code: "AU", name: "Australia", currency: "AUD", symbol: "A$", rate: 0.018 },
  { code: "AE", name: "United Arab Emirates", currency: "AED", symbol: "د.إ", rate: 0.044 },
  { code: "SA", name: "Saudi Arabia", currency: "SAR", symbol: "﷼", rate: 0.045 },
  { code: "QA", name: "Qatar", currency: "QAR", symbol: "﷼", rate: 0.044 },
  { code: "KW", name: "Kuwait", currency: "KWD", symbol: "د.ك", rate: 0.0037 },
  { code: "OM", name: "Oman", currency: "OMR", symbol: "﷼", rate: 0.0046 },
  { code: "BH", name: "Bahrain", currency: "BHD", symbol: ".د.ب", rate: 0.0045 },
  { code: "SG", name: "Singapore", currency: "SGD", symbol: "S$", rate: 0.016 },
  { code: "MY", name: "Malaysia", currency: "MYR", symbol: "RM", rate: 0.056 },
  { code: "NZ", name: "New Zealand", currency: "NZD", symbol: "NZ$", rate: 0.020 },
  { code: "DE", name: "Germany", currency: "EUR", symbol: "€", rate: 0.011 },
  { code: "FR", name: "France", currency: "EUR", symbol: "€", rate: 0.011 },
  { code: "IT", name: "Italy", currency: "EUR", symbol: "€", rate: 0.011 },
  { code: "ES", name: "Spain", currency: "EUR", symbol: "€", rate: 0.011 },
  { code: "NL", name: "Netherlands", currency: "EUR", symbol: "€", rate: 0.011 },
  { code: "IE", name: "Ireland", currency: "EUR", symbol: "€", rate: 0.011 },
  { code: "CH", name: "Switzerland", currency: "CHF", symbol: "CHF", rate: 0.0106 },
  { code: "SE", name: "Sweden", currency: "SEK", symbol: "kr", rate: 0.126 },
  { code: "NO", name: "Norway", currency: "NOK", symbol: "kr", rate: 0.128 },
  { code: "ZA", name: "South Africa", currency: "ZAR", symbol: "R", rate: 0.22 },
  { code: "JP", name: "Japan", currency: "JPY", symbol: "¥", rate: 1.8 },
  { code: "CN", name: "China", currency: "CNY", symbol: "¥", rate: 0.086 },
  { code: "HK", name: "Hong Kong", currency: "HKD", symbol: "HK$", rate: 0.094 },
  { code: "NP", name: "Nepal", currency: "NPR", symbol: "रू", rate: 1.6 },
  { code: "BD", name: "Bangladesh", currency: "BDT", symbol: "৳", rate: 1.32 },
  { code: "LK", name: "Sri Lanka", currency: "LKR", symbol: "Rs", rate: 3.6 },
  { code: "PK", name: "Pakistan", currency: "PKR", symbol: "₨", rate: 3.3 },
  { code: "PH", name: "Philippines", currency: "PHP", symbol: "₱", rate: 0.68 },
  { code: "ID", name: "Indonesia", currency: "IDR", symbol: "Rp", rate: 190 },
  { code: "TH", name: "Thailand", currency: "THB", symbol: "฿", rate: 0.42 },
  { code: "VN", name: "Vietnam", currency: "VND", symbol: "₫", rate: 300 },
  { code: "BR", name: "Brazil", currency: "BRL", symbol: "R$", rate: 0.067 },
  { code: "MX", name: "Mexico", currency: "MXN", symbol: "MX$", rate: 0.22 },
  { code: "TR", name: "Turkey", currency: "TRY", symbol: "₺", rate: 0.41 },
  { code: "RU", name: "Russia", currency: "RUB", symbol: "₽", rate: 1.1 },
  { code: "AR", name: "Argentina", currency: "ARS", symbol: "$", rate: 12 },
  { code: "EG", name: "Egypt", currency: "EGP", symbol: "£", rate: 0.58 },
  { code: "NG", name: "Nigeria", currency: "NGN", symbol: "₦", rate: 18 },
  { code: "KE", name: "Kenya", currency: "KES", symbol: "KSh", rate: 1.55 },
];

export const COUNTRY_BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));
