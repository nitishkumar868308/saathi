import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import {
  isValidPhoneNumber,
  isSupportedCountry,
  parsePhoneNumberFromString,
  getCountryCallingCode,
  type CountryCode,
} from "libphonenumber-js";

import { makeStyles, useColors } from "@/theme/theme";
import { LoaderOverlay, ScreenLoader } from "@/components/loader";
import { OtpModal } from "@/components/otp-modal";
import { checkPhoneAvailable } from "@/lib/phone-verify";
import { useToast } from "@/components/toast";
import { useAuth } from "@/components/auth-provider";
import { useT } from "@/lib/i18n/LanguageProvider";
import { PhoneField } from "@/components/phone-field";
import { SearchSelect } from "@/components/search-select";
import { pickAndUploadAvatar, AvatarTooLargeError } from "@/lib/avatar";
import { UserAvatar } from "@/components/user-avatar";
import {
  getCountries,
  getStates,
  getCities,
  getUserDetails,
  saveUserDetails,
  countryIso2,
  type LocationItem,
} from "@/lib/user-details";

export default function ProfileDetails() {
  const tc = useColors();
  const styles = useStyles();
  const { profileDetails: t, common: c } = useT();
  const genders = [
    { key: "male", label: t.male },
    { key: "female", label: t.female },
    { key: "other", label: t.other },
  ];
  const toast = useToast();
  const { session } = useAuth();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  // Login wale account ka email — read-only, isliye state ki zaroorat nahi.
  const email = session?.user?.email ?? "";
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>("IN");
  const [phoneNational, setPhoneNational] = useState("");
  const [address, setAddress] = useState("");
  const [gender, setGender] = useState("");

  const [countries, setCountries] = useState<LocationItem[]>([]);
  const [states, setStates] = useState<LocationItem[]>([]);
  const [cities, setCities] = useState<LocationItem[]>([]);
  const [countryId, setCountryId] = useState<number | null>(null);
  const [stateId, setStateId] = useState<number | null>(null);
  const [cityId, setCityId] = useState<number | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  /**
   * Kaunsa number verify ho chuka hai — E.164 me, ya null.
   *
   * ⚠️ Yahan boolean rakhna galat hota. User verify karne ke baad number badal
   * sakta hai, aur tab purana "Verified" ka tick naye (bilkul anjaane) number
   * par chipak jaata. Isliye NUMBER yaad rakhte hain aur neeche usse abhi wale
   * se milate hain. Server par bhi yahi baat trigger se pakki hoti hai — phone
   * badalte hi `phone_verified_at` null ho jaata hai.
   */
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [otpOpen, setOtpOpen] = useState(false);
  /**
   * OTP ki hadd poori ho chuki hai — naya code ab nahi ja sakta.
   *
   * Modal ke bahar rakha hai jaan-boojh ke: modal band hote hi uska error
   * gayab ho jaata tha aur user ko phir wahi "Verify karo" button dikhta tha
   * jo har baar fail hota. Ab note screen par tika rehta hai.
   */
  const [otpBlocked, setOtpBlocked] = useState(false);
  /**
   * "Verify karo" dabne ke baad ki jaanch — modal khulne se PEHLE.
   *
   * ⚠️ Pehle ye jaanch hoti hi nahi thi: modal turant khul jaata tha aur uske
   * ANDAR SMS bhejne ki koshish hoti thi. Number kisi aur account me verified ho
   * to user ko ek saath do ulti baatein dikhti thi — upar "+91… par code bheja
   * hai" aur neeche laal me "ye number kisi aur ka hai". Wo 6 ank ka intezaar
   * karta baitha rehta tha jo kabhi aane hi nahi the.
   *
   * Aur ek chhupa hua kharcha bhi tha: `send-otp` tak pahunchne ka matlab hai us
   * number par OTP ki cooldown aur din/ghante wali ginti kharch ho jaana — ek
   * aise number par jispar SMS kabhi jaana hi nahi tha. Do-teen aisi koshishon
   * ke baad user apna ASLI number bhi verify nahi kar paata tha.
   */
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [cs, existing] = await Promise.all([
          getCountries(),
          getUserDetails(),
        ]);
        setCountries(cs);
        if (existing) {
          setFullName(existing.full_name ?? "");
          setAddress(existing.address ?? "");
          setGender(existing.gender ?? "");
          if (existing.phone_country)
            setPhoneCountry(existing.phone_country as CountryCode);
          if (existing.phone && existing.phone_dial_code) {
            setPhoneNational(existing.phone.replace(existing.phone_dial_code, ""));
          }
          if (existing.phone_verified_at && existing.phone) {
            setVerifiedPhone(existing.phone);
          }
          if (existing.country_id) {
            setCountryId(existing.country_id);
            setStates(await getStates(existing.country_id));
          }
          if (existing.state_id) {
            setStateId(existing.state_id);
            setCities(await getCities(existing.state_id));
          }
          if (existing.city_id) setCityId(existing.city_id);
          if (existing.avatar_url) setAvatarUrl(existing.avatar_url);
        }
      } catch {
        toast.show(t.loadError, "error");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function changePhoto() {
    if (uploadingAvatar) return;
    try {
      setUploadingAvatar(true);
      const url = await pickAndUploadAvatar();
      if (url) {
        setAvatarUrl(url);
        toast.show(t.photoUpdated, "success");
      }
    } catch (e) {
      if (e instanceof AvatarTooLargeError) {
        toast.show(t.photoTooLarge, "error");
      } else {
        toast.show(t.photoFailed, "error");
      }
    } finally {
      setUploadingAvatar(false);
    }
  }

  /** Chuni hui country ki poori DB row — dial code aur ISO dono isi se. */
  const countryRow = countries.find((x) => x.id === countryId);

  /**
   * Chune gaye country ka ISO2 ("IN") — number VALIDATE karne ke liye.
   *
   * Ye ab bhi library ke kaam aata hai (kaunsa number us desh me valid hai, ye
   * DB nahi bata sakti). Par jo code screen par DIKHTA hai wo neeche `dial` me
   * DB se aata hai.
   */
  const countryIso = ((): CountryCode | null => {
    const code = countryIso2(countryRow);
    return code && isSupportedCountry(code) ? (code as CountryCode) : null;
  })();

  async function pickCountry(id: number) {
    setCountryId(id);
    setStateId(null);
    setCityId(null);
    setStates([]);
    setCities([]);
    // Country badla to phone ka dial code bhi wahi ka — profile ab sirf India ke
    // liye nahi hai, aur number hamesha address wale desh ka hi hona chahiye.
    const iso = countryIso2(countries.find((c) => c.id === id));
    if (iso && isSupportedCountry(iso) && iso !== phoneCountry) {
      setPhoneCountry(iso as CountryCode);
      setPhoneNational("");
    }
    try {
      setStates(await getStates(id));
    } catch {
      /* ignore */
    }
  }

  async function pickState(id: number) {
    setStateId(id);
    setCityId(null);
    setCities([]);
    try {
      setCities(await getCities(id));
    } catch {
      /* ignore */
    }
  }

  // Phone ka desh: pehle location wala country, warna jo pehle se save tha.
  const activeCountry: CountryCode = countryIso ?? phoneCountry;

  /**
   * Dikhne wala dial code — DB se.
   *
   * ⚠️ Pehle ye seedha `getCountryCallingCode()` se banta tha. Wo hardcoded to
   * nahi tha, par tha app ke ANDAR: DB me naya country jodne par uska code apne
   * aap nahi aata tha, aur kisi desh ka code badalne ke liye nayi app build
   * karni padti thi.
   *
   * Ab `countries.phone_code` hi sach hai. Library par sirf tab girte hain jab
   * wo column khaali ho (`country-phone-codes.sql` na chala ho) — warna purane
   * users ko khaali code dikhta aur unka number save hi na hota.
   */
  const dial =
    countryRow?.phone_code?.trim() || `+${getCountryCallingCode(activeCountry)}`;
  const fullPhone = `${dial}${phoneNational.replace(/\D/g, "")}`;
  // libphonenumber har desh ke apne rules jaanta hai — 10-digit ka hardcoded
  // India wala check nahi.
  const phoneOk =
    phoneNational.length > 0 && isValidPhoneNumber(fullPhone, activeCountry);
  /**
   * Abhi screen par jo number hai, ye WAHI hai jo verify hua tha?
   *
   * E.164 me mila kar dekhte hain — user "9876543210" likhe ya "98765 43210",
   * dono ek hi number hain. Bina normalize kiye ek space daal dene se "Verified"
   * ka tick gayab ho jaata, jo user ko bilkul bekaar lagta.
   */
  const normalized = parsePhoneNumberFromString(fullPhone, activeCountry)?.number ?? fullPhone;
  const verified = phoneOk && !!verifiedPhone && verifiedPhone === normalized;
  const valid =
    fullName.trim().length > 1 &&
    phoneOk &&
    address.trim().length > 3 &&
    !!gender &&
    !!countryId &&
    !!stateId &&
    !!cityId;

  /**
   * "Verify karo" — modal khulne se PEHLE number ki jaanch.
   *
   * ⚠️ Poori wajah `checkingPhone` ke declaration par likhi hai. Chhota sa
   * saar: pehle modal turant khul jaata tha aur SMS ki koshish uske ANDAR hoti
   * thi, isliye ek hi screen "code bheja hai" aur "ye number kisi aur ka hai"
   * dono ek saath keh deti thi — aur us number par OTP ki hadd bhi bekaar me
   * kharch ho jaati thi.
   */
  async function startVerify() {
    if (checkingPhone) return;
    setVerifyError(null);
    setCheckingPhone(true);
    const err = await checkPhoneAvailable(normalized);
    setCheckingPhone(false);
    if (err) {
      // Yahi wo do line hain jo pehle modal ke andar, SMS "bhejne" ke baad
      // dikhti thi.
      setVerifyError(err === "phone_taken" ? t.errTaken : t.errFailed);
      return;
    }
    setOtpOpen(true);
  }

  async function onSave() {
    if (saving) return;
    if (!valid) {
      toast.show(t.fillAll, "info");
      return;
    }
    setSaving(true);
    try {
      const parsed = parsePhoneNumberFromString(fullPhone, activeCountry);
      await saveUserDetails({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: parsed?.number ?? fullPhone,
        phone_dial_code: dial,
        phone_country: activeCountry,
        address: address.trim(),
        gender,
        country_id: countryId,
        state_id: stateId,
        city_id: cityId,
        avatar_url: avatarUrl,
      });
      toast.show(t.saved, "success");
      if (returnTo) router.replace(returnTo as never);
      else router.back();
    } catch {
      toast.show(t.saveFailed, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={tc.ink} />
        </Pressable>
        <Text style={styles.title}>{t.title}</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <ScreenLoader />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Profile photo — max 2 MB */}
            <View style={styles.avatarWrap}>
              <Pressable onPress={changePhoto} disabled={uploadingAvatar} style={styles.avatar}>
                <UserAvatar uri={avatarUrl} name={fullName} size={92} radius={46} />
                <View style={styles.avatarBadge}>
                  <Ionicons name="camera" size={15} color={tc.white} />
                </View>
              </Pressable>
              <Text style={styles.avatarHint}>{t.photoHint}</Text>
            </View>

            <Text style={styles.label}>{t.fullName}</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder={t.fullNamePlaceholder}
              placeholderTextColor={tc.inkSoft}
            />

            {/* Email login se aata hai — badalna account todta hai, isliye
                read-only. */}
            <Text style={styles.label}>{t.email}</Text>
            <View style={[styles.input, styles.inputLocked]}>
              <Text style={styles.lockedText} numberOfLines={1}>
                {email}
              </Text>
              <Ionicons name="lock-closed" size={15} color={tc.inkSoft} />
            </View>
            <Text style={styles.hint}>{t.emailLocked}</Text>

            {/* Country -> State -> City pehle. Phone ka code inhi se banta hai,
                isliye order ulta nahi kiya ja sakta. */}
            <Text style={styles.label}>{t.country}</Text>
            <SearchSelect
              items={countries}
              value={countryId}
              placeholder={countries.length ? t.countryPick : t.countryNoData}
              searchPlaceholder={t.countrySearch}
              emptyText={t.searchEmpty}
              onSelect={pickCountry}
            />

            <Text style={styles.label}>{t.state}</Text>
            <SearchSelect
              items={states}
              value={stateId}
              placeholder={countryId ? t.statePick : t.stateFirst}
              searchPlaceholder={t.stateSearch}
              emptyText={t.searchEmpty}
              onSelect={pickState}
              disabled={!countryId}
            />

            <Text style={styles.label}>{t.city}</Text>
            <SearchSelect
              items={cities}
              value={cityId}
              placeholder={stateId ? t.cityPick : t.cityFirst}
              searchPlaceholder={t.citySearch}
              emptyText={t.searchEmpty}
              onSelect={setCityId}
              disabled={!stateId}
            />

            <Text style={styles.label}>{t.phone}</Text>
            <PhoneField
              country={activeCountry}
              onCountry={setPhoneCountry}
              national={phoneNational}
              onNational={setPhoneNational}
              locked={!!countryIso}
              dialCode={dial}
            />
            {countryId && !countryIso && (
              <Text style={styles.hint}>{t.phoneCountryUnknown}</Text>
            )}
            {phoneNational.length > 0 && !phoneOk && (
              <Text style={styles.err}>{t.phoneError}</Text>
            )}

            {/* Verify ka status + button.
                Ye ek badi baat hai, isliye chhoti si nahi dikhti: number sirf
                LIKHA hone par reminder ka WhatsApp ek digit ki galti se kisi
                ajnabi ke paas chala jaata hai, aur asli user ko kabhi kuch nahi
                milta — dono me se kisi ko wajah pata nahi chalti. */}
            {phoneOk &&
              (verified ? (
                <View style={styles.verifiedRow}>
                  <Ionicons name="checkmark-circle" size={17} color={tc.sage} />
                  <Text style={styles.verifiedText}>{t.verified}</Text>
                </View>
              ) : otpBlocked ? (
                /**
                 * OTP ki hadd poori — is user ko ab support se reset karwana
                 * hoga.
                 *
                 * ⚠️ Ye note yahan (modal ke BAHAR) hai, aur yahi iska poora
                 * matlab hai. Pehle ye baat sirf modal ke andar ek error line
                 * thi: modal band karte hi wo gayab, aur user ko phir wahi
                 * "Verify karo" button dikhta jo har baar fail hota tha — bina
                 * ye bataye ki ab karna kya hai. Wo baar-baar dabata rehta tha
                 * (aur har dabaav ek aur fail). Ab agla kadam saaf likha hai
                 * aur ek tap door hai.
                 */
                <View style={styles.blockedBox}>
                  <View style={styles.blockedHead}>
                    <Ionicons name="alert-circle" size={17} color={tc.terracotta} />
                    <Text style={styles.blockedTitle}>{t.errTooMany}</Text>
                  </View>
                  <Text style={styles.blockedNote}>{t.otpBlockedNote}</Text>
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/support",
                        // Subject pehle se bhara hua jaata hai — user ko apni
                        // dikkat likhni hi nahi padti, aur admin ko har aisi
                        // ticket ek hi shakal me milti hai (dhoondhne me aasan).
                        params: { subject: t.otpBlockedSubject },
                      } as never)
                    }
                    style={({ pressed }) => [styles.verifyBtn, pressed && { opacity: 0.85 }]}
                  >
                    <Ionicons name="chatbubble-ellipses" size={15} color={tc.white} />
                    <Text style={styles.verifyBtnText}>{t.otpBlockedCta}</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.verifyBox}>
                  <Text style={styles.verifyWhy}>{t.verifyWhy}</Text>
                  {/*
                    ⚠️ WhatsApp wali baat yahan saaf likhi hai, aur ye ek asli
                    kami thi. Plus me reminder aur document expiry ka message
                    WhatsApp par jaata hai — usi number par jo yahan verify hua
                    ho. Par kahin likha hi nahi tha ki ye number WHATSAPP wala
                    hona chahiye. Log apna doosra (bina WhatsApp wala) number
                    verify kar dete the, sab kuch theek dikhta tha, aur ek bhi
                    message kabhi nahi pahunchta tha — bina kisi error ke.
                  */}
                  <View style={styles.waNote}>
                    <Ionicons name="logo-whatsapp" size={14} color={tc.sage} />
                    <Text style={styles.waNoteText}>{t.whatsappNote}</Text>
                  </View>
                  {!!verifyError && <Text style={styles.err}>{verifyError}</Text>}
                  <Pressable
                    onPress={() => void startVerify()}
                    disabled={checkingPhone}
                    style={({ pressed }) => [
                      styles.verifyBtn,
                      (pressed || checkingPhone) && { opacity: 0.85 },
                    ]}
                  >
                    <Ionicons name="shield-checkmark" size={15} color={tc.white} />
                    <Text style={styles.verifyBtnText}>
                      {checkingPhone ? c.loading : t.verifyCta}
                    </Text>
                  </Pressable>
                </View>
              ))}

            <Text style={styles.label}>{t.address}</Text>
            <TextInput
              style={[styles.input, { height: 72 }]}
              value={address}
              onChangeText={setAddress}
              placeholder={t.addressPlaceholder}
              placeholderTextColor={tc.inkSoft}
              multiline
            />

            <Text style={styles.label}>{t.gender}</Text>
            <View style={styles.chips}>
              {genders.map((g) => (
                <Pressable
                  key={g.key}
                  onPress={() => setGender(g.key)}
                  style={[styles.chip, gender === g.key && styles.chipActive]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      gender === g.key && styles.chipTextActive,
                    ]}
                  >
                    {g.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>

          <Pressable
            onPress={onSave}
            disabled={saving || !valid}
            style={({ pressed }) => [
              styles.save,
              (pressed || saving || !valid) && { opacity: 0.6 },
            ]}
          >
            <Text style={styles.saveText}>{t.save}</Text>
          </Pressable>
        </KeyboardAvoidingView>
      )}

      {/* Save/photo-upload — beech me overlay loader, peeche form blocked. */}
      {/* SMS ka 6-ank wala code. OTP app tak kabhi nahi aata — wo Twilio Verify
          ke paas rehta hai; ye screen sirf user ka daala hua code server ko
          deti hai. */}
      <OtpModal
        visible={otpOpen}
        phone={normalized}
        onClose={() => setOtpOpen(false)}
        onBlocked={() => setOtpBlocked(true)}
        onVerified={() => {
          setOtpOpen(false);
          setOtpBlocked(false);
          // Server ne is number ko is user ke naam par likh diya hai — screen
          // ka status usi wakt sudhar jaana chahiye, save dabane ka intezaar
          // kiye bina.
          setVerifiedPhone(normalized);
          toast.show(t.otpOk, "success");
        }}
      />

      <LoaderOverlay visible={saving || uploadingAvatar} />
    </SafeAreaView>
  );
}

// Simple inline select (chips-wrap). Chhoti lists ke liye theek.
const CONTENT = { width: "100%", maxWidth: 560, alignSelf: "center" } as const;

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.cream },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  back: { padding: 4 },
  title: { fontSize: 18, fontWeight: "700", color: c.ink },
  content: { padding: 20, paddingBottom: 20, ...CONTENT },
  avatarWrap: { alignItems: "center", marginBottom: 8 },
  avatar: {
    height: 92,
    width: 92,
    borderRadius: 46,
    backgroundColor: c.creamDeep,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: c.line,
  },
  avatarImg: { height: 92, width: 92, borderRadius: 46 },
  avatarBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    height: 30,
    width: 30,
    borderRadius: 15,
    backgroundColor: c.terracotta,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: c.cream,
  },
  avatarHint: { marginTop: 10, fontSize: 13, color: c.inkSoft },
  label: {
    marginTop: 18,
    marginBottom: 8,
    fontSize: 15,
    fontWeight: "700",
    color: c.ink,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: c.ink,
    fontSize: 15,
  },
  inputLocked: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: c.creamDeep,
  },
  lockedText: { flex: 1, fontSize: 15, color: c.inkSoft },
  hint: { marginTop: 6, fontSize: 12.5, lineHeight: 17, color: c.inkSoft },
  // Verify ho chuka — chhota, shaant nishaan. Yahan kuch karna baaki nahi hai.
  verifiedRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  verifiedText: { fontSize: 13.5, fontWeight: "700", color: c.sage },
  // Verify baaki hai — isse dikhna chahiye, kyunki bina iske WhatsApp reminder
  // galat number par ja sakta hai aur kisi ko pata bhi nahi chalta.
  verifyBox: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(194,90,55,0.3)",
    backgroundColor: "rgba(194,90,55,0.07)",
    padding: 13,
  },
  verifyWhy: { fontSize: 12.5, lineHeight: 19, color: c.inkSoft },
  // "Ye WhatsApp wala number hona chahiye" — sage me, taaki ye chetavni na
  // lage. Ye rok nahi hai, ek zaroori jaankari hai.
  waNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    marginTop: 9,
    borderRadius: 12,
    backgroundColor: "rgba(124,138,107,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  waNoteText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: "600", color: c.ink },
  verifyBtn: {
    marginTop: 11,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: c.terracotta,
  },
  verifyBtnText: { fontSize: 13.5, fontWeight: "800", color: c.white },
  /**
   * "Hadd poori ho gayi" wala note — verifyBox se thoda gehra, taaki ye ek
   * roka hua raasta lage, ek aur suggestion nahi.
   */
  blockedBox: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(194,90,55,0.45)",
    backgroundColor: "rgba(194,90,55,0.12)",
    padding: 13,
  },
  blockedHead: { flexDirection: "row", alignItems: "center", gap: 7 },
  blockedTitle: { flex: 1, fontSize: 13.5, fontWeight: "800", color: c.ink },
  blockedNote: { marginTop: 7, fontSize: 12.5, lineHeight: 19, color: c.inkSoft },
  err: { marginTop: 6, fontSize: 13, color: c.terracotta, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  chipActive: { backgroundColor: c.ink, borderColor: c.ink },
  chipText: { fontSize: 13.5, fontWeight: "600", color: c.inkSoft },
  chipTextActive: { color: c.cream },
  selectEmpty: { fontSize: 14, color: c.inkSoft, fontStyle: "italic" },
  save: {
    margin: 20,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
    height: 54,
    borderRadius: 18,
    backgroundColor: c.terracotta,
  },
  saveText: { color: c.white, fontWeight: "700", fontSize: 16 },
}));
