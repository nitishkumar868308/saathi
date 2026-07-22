import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import {
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  getCountryCallingCode,
  type CountryCode,
} from "libphonenumber-js";

import { colors } from "@/theme/colors";
import { Loader } from "@/components/loader";
import { useToast } from "@/components/toast";
import { useAuth } from "@/components/auth-provider";
import { useT } from "@/lib/i18n/LanguageProvider";
import { PhoneField } from "@/components/phone-field";
import { SearchSelect } from "@/components/search-select";
import { pickAndUploadAvatar, AvatarTooLargeError } from "@/lib/avatar";
import {
  getCountries,
  getStates,
  getCities,
  getUserDetails,
  saveUserDetails,
  type LocationItem,
} from "@/lib/user-details";

export default function ProfileDetails() {
  const { profileDetails: t } = useT();
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
  const [email, setEmail] = useState(session?.user?.email ?? "");
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
          setEmail(existing.email ?? session?.user?.email ?? "");
          setAddress(existing.address ?? "");
          setGender(existing.gender ?? "");
          if (existing.phone_country)
            setPhoneCountry(existing.phone_country as CountryCode);
          if (existing.phone && existing.phone_dial_code) {
            setPhoneNational(existing.phone.replace(existing.phone_dial_code, ""));
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

  async function pickCountry(id: number) {
    setCountryId(id);
    setStateId(null);
    setCityId(null);
    setStates([]);
    setCities([]);
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

  const dial = `+${getCountryCallingCode(phoneCountry)}`;
  const fullPhone = `${dial}${phoneNational.replace(/\D/g, "")}`;
  const phoneOk =
    phoneNational.length > 0 && isValidPhoneNumber(fullPhone, phoneCountry);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const valid =
    fullName.trim().length > 1 &&
    emailOk &&
    phoneOk &&
    address.trim().length > 3 &&
    !!gender &&
    !!countryId &&
    !!stateId &&
    !!cityId;

  async function onSave() {
    if (saving) return;
    if (!valid) {
      toast.show(t.fillAll, "info");
      return;
    }
    setSaving(true);
    try {
      const parsed = parsePhoneNumberFromString(fullPhone, phoneCountry);
      await saveUserDetails({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: parsed?.number ?? fullPhone,
        phone_dial_code: dial,
        phone_country: phoneCountry,
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
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>{t.title}</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={{ marginTop: 40 }}>
            <Loader />
          </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Profile photo — max 2 MB */}
            <View style={styles.avatarWrap}>
              <Pressable onPress={changePhoto} disabled={uploadingAvatar} style={styles.avatar}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
                ) : (
                  <Ionicons name="person" size={38} color={colors.inkSoft} />
                )}
                <View style={styles.avatarBadge}>
                  {uploadingAvatar ? (
                    <Loader size={26} color={colors.white} />
                  ) : (
                    <Ionicons name="camera" size={15} color={colors.white} />
                  )}
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
              placeholderTextColor={colors.inkSoft}
            />

            <Text style={styles.label}>{t.email}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder={t.emailPlaceholder}
              placeholderTextColor={colors.inkSoft}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>{t.phone}</Text>
            <PhoneField
              country={phoneCountry}
              onCountry={setPhoneCountry}
              national={phoneNational}
              onNational={setPhoneNational}
            />
            {phoneNational.length > 0 && !phoneOk && (
              <Text style={styles.err}>{t.phoneError}</Text>
            )}

            <Text style={styles.label}>{t.address}</Text>
            <TextInput
              style={[styles.input, { height: 72 }]}
              value={address}
              onChangeText={setAddress}
              placeholder={t.addressPlaceholder}
              placeholderTextColor={colors.inkSoft}
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
            {saving ? (
              <Loader size={30} color={colors.white} />
            ) : (
              <Text style={styles.saveText}>{t.save}</Text>
            )}
          </Pressable>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

// Simple inline select (chips-wrap). Chhoti lists ke liye theek.
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  back: { padding: 4 },
  title: { fontSize: 18, fontWeight: "700", color: colors.ink },
  content: { padding: 20, paddingBottom: 20 },
  avatarWrap: { alignItems: "center", marginBottom: 8 },
  avatar: {
    height: 92,
    width: 92,
    borderRadius: 46,
    backgroundColor: colors.creamDeep,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
  },
  avatarImg: { height: 92, width: 92, borderRadius: 46 },
  avatarBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    height: 30,
    width: 30,
    borderRadius: 15,
    backgroundColor: colors.terracotta,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.cream,
  },
  avatarHint: { marginTop: 10, fontSize: 13, color: colors.inkSoft },
  label: {
    marginTop: 18,
    marginBottom: 8,
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.ink,
    fontSize: 15,
  },
  err: { marginTop: 6, fontSize: 13, color: colors.terracotta, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 13.5, fontWeight: "600", color: colors.inkSoft },
  chipTextActive: { color: colors.cream },
  selectEmpty: { fontSize: 14, color: colors.inkSoft, fontStyle: "italic" },
  save: {
    margin: 20,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
    height: 54,
    borderRadius: 18,
    backgroundColor: colors.terracotta,
  },
  saveText: { color: colors.white, fontWeight: "700", fontSize: 16 },
});
