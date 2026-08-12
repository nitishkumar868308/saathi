import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { Stack } from "expo-router/js-stack";
import { useRouter, useSegments, usePathname } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { ToastProvider } from "@/components/toast";
import { AuthProvider, useAuth } from "@/components/auth-provider";
import { LanguageProvider, useLocale } from "@/lib/i18n/LanguageProvider";
import { ThemeProvider, useColors, useThemeMode } from "@/theme/theme";
import { ReminderAlertHost } from "@/components/reminder-alert";
import { ReviewPrompt } from "@/components/review-prompt";
import { DeviceOwnerWarning } from "@/components/device-owner-warning";
import { MultiDeviceWarning } from "@/components/multi-device-warning";
import { LockGate } from "@/components/lock-gate";
import { OfflineGate } from "@/components/offline-gate";
import { AccountGate } from "@/components/account-gate";
import { LockOffer } from "@/components/lock-offer";
import { WhatsAppSetupModal } from "@/components/whatsapp-setup-modal";
import { NetworkBanner } from "@/components/network-banner";
import { useNetworkStatus } from "@/lib/network";
import { ThemeFab } from "@/components/theme-fab";
import { NetAlertModal } from "@/components/net-alert-modal";
import { ScreenLoader } from "@/components/loader";
import { flushNotificationActions, syncNotifications } from "@/lib/notifications";
import { flushOutbox } from "@/lib/reminder-outbox";
import { flushUploads } from "@/lib/doc-upload-queue";
import { listenForegroundPush, listenPushOpens, registerPushToken } from "@/lib/push";
import { setAnalyticsUser, logScreen } from "@/lib/analytics";
import { usePlanForegroundRefresh } from "@/lib/plan-store";
import { installGlobalErrorHandler } from "@/lib/report-error";

// App start hote hi uncaught errors pakadna shuru.
installGlobalErrorHandler();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      {/*
        ⚠️ ThemeProvider sabse BAAHAR (Language/Auth se bhi upar).

        Iske andar ki har cheez rang ke liye ispar tiki hai — Toast, lock
        screen, network banner, saare overlay. Ise andar rakhne par wo cheezein
        jo iske BAAHAR hoti, hamesha light theme me chipki rehti, aur dark mode
        me screen ke kone safed chamakte.
      */}
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <ToastProvider>
              <ThemedStatusBar />
            {/*
              App lock — Providers ke andar (lock screen ko bhasha aur session
              chahiye) par app ke poore content ke upar.

              ⚠️ Ye saare overlay bhi ISKE ANDAR hone chahiye, bahar nahi. Ye
              sab `Modal` hain jo har screen ke upar khulte hain — lock ke upar
              bhi khul jaate the. Sabse bura `ReminderAlertHost` tha: lock lage
              hue phone par bhi reminder ka poora text dikh jaata, aur "Ho gaya"
              dabaya bhi ja sakta tha. Lock ka matlab hi yahi hai ki jab tak wo
              laga hai, app ka kuch bhi na dikhe aur kuch bhi na badla ja sake.
            */}
            <LockGate>
              {/*
                Net na ho to poori app ki jagah sirf offline screen (save kiye
                hue documents — dekho / download / share).

                ⚠️ Ye LockGate ke ANDAR hai, bahar nahi. Tarteeb maayne rakhti
                hai: agar ye lock se BAHAR hota, to koi bhi phone uthata, flight
                mode on karta, aur offline screen se saare documents dekh leta —
                lock poori tarah bypass ho jaata.

                ⚠️ Aur ye overlays se UPAR hai: `NetAlertModal` jaise popup
                offline screen ke upar khulne ka koi matlab nahi (wo baat wo
                screen khud keh rahi hai), par `ReminderAlertHost` ko chalte
                rehna chahiye — reminder ka alarm local hai aur bina net ke bhi
                bajta hai.
              */}
              <OfflineGate>
                {/*
                  Admin ne account band kar diya ho to poori app ki jagah ek
                  saaf baat. ⚠️ OfflineGate ke ANDAR hai: ye jaanch server se
                  hoti hai, aur net na hone par uska jawab "pata nahi" hota hai
                  — us haalat me user ko "account band hai" dikhana sabse bura
                  jhooth hota. Offline screen apne cached documents ke saath
                  pehle aati hai; account ka sach net aane par hi bolta hai.
                */}
                <AccountGate>
                  <RootNavigator />
                </AccountGate>
              {/* Har screen par theme switch — daayen kinare, beech ki oonchai
                  par. Settings ka teen-wala chunav apni jagah rehta hai. */}
              <ThemeFab />
              {/* Internet nahi/dheema — sabse upar patli patti. */}
              <NetworkBanner />
              {/* Net ki wajah se koi kaam ruka — beech screen me popup + retry. */}
              <NetAlertModal />
              </OfflineGate>
              {/* Reminder/expiry ka full-screen alert — kisi bhi screen ke upar.
                  OfflineGate ke BAHAR: alarm local hai, bina net ke bhi bajta
                  hai, aur offline screen par bhi dikhna chahiye. */}
              <ReminderAlertHost />
              {/* 1 hafte baad rating/review popup. */}
              <ReviewPrompt />
              {/* Ye phone kisi aur ke naam par set hai — login ke baad ek baar. */}
              <DeviceOwnerWarning />
              {/* Uska ulta: meri ID aur bhi phones par login hai — sign-in ke baad. */}
              <MultiDeviceWarning />
              {/* "Saathi ko lock kar lo?" — pehla document aane ke baad. */}
              <LockOffer />
              {/* Plus user ne reminder/document banaya par WhatsApp ka number
                  verify nahi hai — tab tak wahan koi message ja hi nahi sakta,
                  aur wo baat kahin likhi hi nahi thi. */}
              <WhatsAppSetupModal />
              </LockGate>
            </ToastProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/**
 * Upar ki ghadi/battery wali patti.
 *
 * ⚠️ Ye pehle `<StatusBar style="dark" />` tha — yaani hamesha gehre icons. Dark
 * theme me gehre background par gehre icons bilkul gayab ho jaate hain: user ko
 * apna time aur battery dikhna hi band ho jaata. Ab ye theme ke saath ulta hota
 * hai.
 */
function ThemedStatusBar() {
  const { scheme } = useThemeMode();
  return <StatusBar style={scheme === "dark" ? "light" : "dark"} />;
}

function RootNavigator() {
  const tc = useColors();
  const { session, loading } = useAuth();
  const { ready: langReady, chosen: langChosen } = useLocale();
  // Sirf "net wapas aaya" wale pal ke liye — neeche outbox flush isi par chalta
  // hai. Banner apna alag probe chalata hai; ye hook usi ek sach ko padhta hai.
  const { offline } = useNetworkStatus();
  const segments = useSegments();
  const router = useRouter();
  // Pichhli baar session tha ya nahi — logout (tha→null) ko fresh launch se alag
  // karne ke liye. Logout ke baad language-select; fresh launch pe login.
  const prevSession = useRef(false);

  // `language` naya typed-route hai — string compare ke liye cast (codebase idiom).
  const first = segments[0] as string | undefined;
  const hasSession = !!session;
  const decided = !loading && langReady;

  /**
   * Wo screens jahan bina login ke pahunchna zaroori hai.
   *
   * ⚠️ `forgot-password` yahan hona ZAROORI hai. Wo screen use hi tab hoti hai
   * jab user andar nahi aa paa raha — agar ise "login zaroori hai" wale niyam
   * me rakh dein to tap karte hi wo wapas login par phenk diya jaata hai, aur
   * password reset ka koi rasta hi nahi bachta.
   *
   * `new-password` bhi: recovery link se aane par session to ban jaata hai, par
   * user ko wahin rukna hai — "/" par bhej dene se wo naya password kabhi set
   * hi nahi karega aur agli baar phir wahi bhoola hua password maanga jayega.
   */
  const isAuthRoute =
    first === "login" ||
    first === "auth" ||
    first === "forgot-password" ||
    first === "new-password";

  /**
   * Abhi jis screen par hain, kya wo GALAT screen hai?
   *
   * ⚠️ Ye render ke waqt pata hona zaroori hai. Pehle sirf neeche wala effect
   * tha, aur effect render ke BAAD chalta hai — matlab ek poora frame `Stack`
   * apne default route `(tabs)` (dashboard) ke saath paint ho jaata tha, aur
   * uske baad language/login screen aati thi. User ko app kholte hi "pehle
   * dashboard, phir bhasha wala page" isi wajah se dikhta tha (aur dashboard
   * ka saara data fetch bekaar me chal kar cancel ho jaata tha).
   *
   * Ye sirf "route badalna hai ya nahi" batata hai — KAHAN jaana hai wo faisla
   * effect ka hi hai. Dono ki shartein bilkul ek jaisi rakhi hain, warna ek
   * kahega "badlo" aur doosra kuch karega hi nahi — loader hamesha ke liye
   * atak jaayega.
   */
  const needsRedirect =
    decided &&
    ((!langChosen && first !== "language") ||
      (langChosen && !hasSession && !isAuthRoute && first !== "language") ||
      (langChosen && hasSession && (first === "login" || first === "language")));

  useEffect(() => {
    if (loading || !langReady) return;

    // Pehli baar (bhasha choose nahi ki): sabse pehle language select.
    if (!langChosen) {
      if (first !== "language") router.replace("/language" as never);
      prevSession.current = hasSession;
      return;
    }

    if (!hasSession && !isAuthRoute && first !== "language") {
      // Abhi-abhi logout hua (pehle session tha) -> language select.
      // App pehle se hai par logged out (fresh launch) -> login.
      router.replace(prevSession.current ? ("/language" as never) : "/login");
    } else if (hasSession && (first === "login" || first === "language")) {
      router.replace("/");
    }
    prevSession.current = hasSession;
  }, [hasSession, loading, langReady, langChosen, first, isAuthRoute, router]);

  // Reminders + document expiries OS me dobara schedule karo. Zaroori hai kyunki
  // scheduled notifications reinstall ke baad nahi bachti, aur doosre device pe
  // banaye gaye data ke liye kabhi bani hi nahi thi.
  const uid = session?.user?.id;
  useEffect(() => {
    // Login/user badla — yahan sach me sab kuch dobara lagana hai, throttle
    // nahi lagna chahiye.
    //
    // Flush PEHLE: offline banaye reminders ke paas abhi `local:` wali id hai.
    // Unhe server par bhej ke asli id mil jaaye, uske baad hi sync chale —
    // warna sync unhe dekh hi nahi paata (server ki list me hain hi nahi) aur
    // do alag ids ke alarm saath-saath chalte rehte hain.
    if (uid) {
      /**
       * ⚠️ Tarteeb: pehle notification ke button wale kaam, phir sync.
       *
       * Notification ke "Ho gaya" button se nipta hua reminder headless task me
       * sirf ek line ban ke pada hota hai. Agar sync usse PEHLE chal jaye to wo
       * usi reminder ka alarm dobara laga deta hai — user "Ho gaya" daba chuka
       * hai aur usi kaam ka alarm phir se bajta hai.
       */
      void flushNotificationActions()
        .catch(() => {})
        .finally(() => {
          void flushOutbox().finally(() => void syncNotifications({ force: true }));
        });
      // Jo document backup hone se reh gaye the — unhe ab bhej do. Alag chain me
      // isliye ki ek bada upload reminder ke alarm lagne me deri na kare.
      void flushUploads();
    }
    setAnalyticsUser(uid ?? null);
  }, [uid]);

  /**
   * Push (admin ke message ke liye) — login ke baad is phone ka pata server ko.
   *
   * Login ke saath bandha hai kyunki token user ke naam par save hota hai:
   * logout hone par listener band ho jaata hai, aur agla user login karega to
   * usi token ka maalik badal jaayega (`save_device_token`). Warna ek hi phone
   * par purane user ko naye user ki notification chali jaati.
   *
   * Firebase set na ho to dono function chup-chaap kuch nahi karte — local
   * reminders par koi asar nahi.
   */
  useEffect(() => {
    if (!uid) return;
    const stopToken = registerPushToken();
    const stopForeground = listenForegroundPush();
    // Tap ka hisaab — admin panel ki Report isi se banti hai ("kisne khola").
    // Login ke baad hi, kyunki server ki RPC bina session ke kuch nahi likhti.
    const stopOpens = listenPushOpens();
    return () => {
      stopToken();
      stopForeground();
      stopOpens();
    };
  }, [uid]);

  /**
   * App wapas saamne aate hi schedules dobara mila lo (item 17).
   *
   * ⚠️ Pehle sync SIRF login par chalta tha. Isliye ye sab chup-chaap toot jaata
   * tha: net na hone par bana reminder OS me kabhi schedule hi nahi hota; doosre
   * phone se banaya reminder is phone par kabhi nahi aata; permission baad me
   * di ho to usse pehle ke saare reminders bina alarm ke pade rehte the.
   *
   * Ye sirf local scheduling hai — net ki zaroorat nahi, isliye dheeme internet
   * par bhi notification theek waqt par bajti hai.
   */
  useEffect(() => {
    if (!uid) return;
    const sub = AppState.addEventListener("change", (s: AppStateStatus) => {
      if (s !== "active") return;
      // Net wapas aa chuka ho sakta hai — kataar me pade reminders ab server par
      // ja sakte hain. Fail ho to kuch nahi bigadta: wo kataar me hi rehte hain.
      //
      // Notification ke button wale kaam PEHLE (upar wajah likhi hai) — user ne
      // lock screen se hi "Ho gaya" daba diya ho sakta hai.
      void flushNotificationActions()
        .catch(() => {})
        .finally(() => {
          void flushOutbox().finally(() => void syncNotifications());
        });
      void flushUploads();
    });
    return () => sub.remove();
  }, [uid]);

  /**
   * Net wapas aate hi kataar khaali karo — app band kiye bina.
   *
   * ⚠️ Iske bina ek asli khaali jagah thi. Flush sirf DO mauke par chalta tha:
   * login par, aur app ke wapas saamne aane par. Par sabse aam soorat yahi hoti
   * hai ki user app KHOLE HUE hi signal se bahar nikal jaye (lift, basement,
   * train), wahan reminder banaye — wo kataar me chala jaata hai — aur phir
   * signal wapas aa jaye. Banner apne aap hat jaata tha, sab theek dikhta tha,
   * par reminder phone me hi pada rehta tha jab tak user kisi doosri app par
   * na jaye.
   *
   * Alarm us beech bhi bajta hai (wo poora local hai), isliye kuch "tootta"
   * nahi tha — par reminder doosre phone par nahi dikhta tha, aur app uninstall
   * ho jaye to wo hamesha ke liye chala jaata.
   *
   * Sirf offline → online wale MOD par chalta hai, har render par nahi. Flush
   * khud bhi ek waqt me ek hi chalta hai (`flushOutbox` me rok lagi hai),
   * isliye AppState wale se takrane par bhi dono ek hi kaam do baar nahi karte.
   */
  const wasOffline = useRef(false);
  useEffect(() => {
    if (!uid) return;
    if (wasOffline.current && !offline) {
      void flushOutbox().finally(() => void syncNotifications());
      // Net wapas aaya — jo document R2 tak nahi pahunche the, ab pahunch sakte
      // hain. Yahi wo lamha hai jab wo sabse zyada fail hote the (user document
      // wahin banata hai jahan signal kharab hai).
      void flushUploads();
    }
    wasOffline.current = offline;
  }, [offline, uid]);

  /**
   * App wapas saamne aayi — plan bhi dobara poochho.
   *
   * ⚠️ Play Store ki kharidari app ke BAHAR poori hoti hai (Google ka sheet), aur
   * uska webhook server par thodi der baad pahunchta hai. Pehle plan sirf app
   * khulne par padha jaata tha, isliye kharidne ke turant baad wapas aane par
   * user ka swagat wahi purana "Plus lo" banner karta tha — usi cheez ka jo usne
   * abhi kharidi thi.
   *
   * Ek hi jagah (root) par, har screen se nahi — warna chaaron tab ek saath chaar
   * call bhejte.
   */
  usePlanForegroundRefresh();

  // Har screen change ek event — admin panel ka "journey" isi se banta hai.
  // Ek hi jagah rakha hai taaki nayi screen add karne par kuch yaad na rakhna pade.
  const pathname = usePathname();
  useEffect(() => {
    // Redirect ke beech ka pathname asli screen nahi hai — use log karne se
    // analytics me har launch par ek jhootha "/" (dashboard) view chadh jaata tha.
    if (!decided || needsRedirect) return;
    logScreen(pathname || "/");
  }, [pathname, decided, needsRedirect]);

  // Jab tak faisla nahi hua — ya ho gaya par hum abhi galat screen par hain —
  // loader hi dikhao. `needsRedirect` ke bina yahan dashboard ek pal ke liye
  // paint ho jaata tha.
  if (!decided || needsRedirect) {
    return <ScreenLoader />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: tc.cream },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="language" />
      <Stack.Screen name="login" />
      <Stack.Screen name="auth" />
      {/* Password bhool gaye — dono screens bina login ke bhi khulti hain
          (`isAuthRoute` upar dekho). */}
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="new-password" />
      <Stack.Screen name="add-document" options={{ presentation: "modal" }} />
      <Stack.Screen name="add-reminder" options={{ presentation: "modal" }} />
      <Stack.Screen name="notes" />
      <Stack.Screen name="app-lock" />
      {/* Note likhna ek "abhi ka" kaam hai — modal usse baaki app se alag rakhta
          hai aur band karna ek swipe me ho jaata hai. */}
      <Stack.Screen name="note-edit" options={{ presentation: "modal" }} />
      {/* Note se reminder — sirf "kab?". Poori add-reminder screen wahan bahut
          bhaari padti thi (wajah `note-reminder.tsx` ke upar likhi hai). */}
      <Stack.Screen name="note-reminder" options={{ presentation: "modal" }} />
      <Stack.Screen name="support" />
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}
