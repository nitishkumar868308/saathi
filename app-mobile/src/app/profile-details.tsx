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
import { useToast } from "@/components/toast";
import { useAuth } from "@/components/auth-provider";
import { PhoneField } from "@/components/phone-field";
import { SearchSelect } from "@/components/search-select";
import {
  getCountries,
  getStates,
  getCities,
  getUserDetails,
  saveUserDetails,
  type LocationItem,
} from "@/lib/user-details";

const GENDERS = [
  { key: "male", label: "Male" },
  { key: "female", label: "Female" },
  { key: "other", label: "Other" },
];

export default function ProfileDetails() {
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
        }
      } catch {
        toast.show("Details load nahi hui", "error");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      toast.show("Saare fields sahi se bharo", "info");
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
      });
      toast.show("Details save ho gayi ✅", "success");
      if (returnTo) router.replace(returnTo as never);
      else router.back();
    } catch {
      toast.show("Save nahi hua", "error");
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
        <Text style={styles.title}>Meri details</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.terracotta} style={{ marginTop: 40 }} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.label}>Poora naam</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Aapka naam"
              placeholderTextColor={colors.inkSoft}
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@email.com"
              placeholderTextColor={colors.inkSoft}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Phone number</Text>
            <PhoneField
              country={phoneCountry}
              onCountry={setPhoneCountry}
              national={phoneNational}
              onNational={setPhoneNational}
            />
            {phoneNational.length > 0 && !phoneOk && (
              <Text style={styles.err}>Sahi phone number daalo</Text>
            )}

            <Text style={styles.label}>Address</Text>
            <TextInput
              style={[styles.input, { height: 72 }]}
              value={address}
              onChangeText={setAddress}
              placeholder="Ghar / office ka pata"
              placeholderTextColor={colors.inkSoft}
              multiline
            />

            <Text style={styles.label}>Gender</Text>
            <View style={styles.chips}>
              {GENDERS.map((g) => (
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

            <Text style={styles.label}>Country</Text>
            <SearchSelect
              items={countries}
              value={countryId}
              placeholder={countries.length ? "Country chuno" : "Data import karo"}
              searchPlaceholder="Country search karo…"
              emptyText="Kuch nahi mila"
              onSelect={pickCountry}
            />

            <Text style={styles.label}>State</Text>
            <SearchSelect
              items={states}
              value={stateId}
              placeholder={countryId ? "State chuno" : "Pehle country"}
              searchPlaceholder="State search karo…"
              emptyText="Kuch nahi mila"
              onSelect={pickState}
              disabled={!countryId}
            />

            <Text style={styles.label}>City</Text>
            <SearchSelect
              items={cities}
              value={cityId}
              placeholder={stateId ? "City chuno" : "Pehle state"}
              searchPlaceholder="City search karo…"
              emptyText="Kuch nahi mila"
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
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.saveText}>Save karo</Text>
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
