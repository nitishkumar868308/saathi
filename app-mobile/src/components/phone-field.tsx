import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  FlatList,
  StyleSheet,
} from "react-native";
import {
  getCountries,
  getCountryCallingCode,
  type CountryCode,
} from "libphonenumber-js";
import { colors } from "@/theme/colors";

function flag(cc: string) {
  return cc
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export function PhoneField({
  country,
  onCountry,
  national,
  onNational,
}: {
  country: CountryCode;
  onCountry: (c: CountryCode) => void;
  national: string;
  onNational: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const all = getCountries().map((c) => ({
      cc: c,
      code: getCountryCallingCode(c),
    }));
    if (!q) return all;
    const s = q.toLowerCase();
    return all.filter(
      (x) => x.cc.toLowerCase().includes(s) || x.code.includes(s),
    );
  }, [q]);

  return (
    <View style={styles.row}>
      <Pressable style={styles.codeBtn} onPress={() => setOpen(true)}>
        <Text style={styles.codeText}>
          {flag(country)} +{getCountryCallingCode(country)}
        </Text>
      </Pressable>
      <TextInput
        style={styles.input}
        value={national}
        onChangeText={onNational}
        placeholder="Phone number"
        placeholderTextColor={colors.inkSoft}
        keyboardType="phone-pad"
      />

      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modal}>
          <TextInput
            style={styles.search}
            value={q}
            onChangeText={setQ}
            placeholder="Country ya code search karo"
            placeholderTextColor={colors.inkSoft}
            autoFocus
          />
          <FlatList
            data={list}
            keyExtractor={(i) => i.cc}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={styles.item}
                onPress={() => {
                  onCountry(item.cc as CountryCode);
                  setOpen(false);
                  setQ("");
                }}
              >
                <Text style={styles.itemText}>
                  {flag(item.cc)}  {item.cc}  +{item.code}
                </Text>
              </Pressable>
            )}
          />
          <Pressable style={styles.close} onPress={() => setOpen(false)}>
            <Text style={styles.closeText}>Band karo</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  codeBtn: {
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
  },
  codeText: { fontSize: 15, fontWeight: "600", color: colors.ink },
  input: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.ink,
    fontSize: 15,
  },
  modal: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  search: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 15,
    marginBottom: 10,
  },
  item: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  itemText: { fontSize: 15, color: colors.ink },
  close: { alignItems: "center", paddingVertical: 16 },
  closeText: { fontSize: 15, fontWeight: "700", color: colors.terracotta },
});
