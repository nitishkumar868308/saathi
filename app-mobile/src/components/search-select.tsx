import { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { makeStyles, useColors } from "@/theme/theme";

type Item = { id: number; name: string };

/**
 * Searchable dropdown — country/state/city jaise bade lists ke liye.
 * Chips ki jagah: ek row (selected/placeholder) → tap pe search-wala modal.
 */
export function SearchSelect({
  items,
  value,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled,
  onSelect,
}: {
  items: Item[];
  value: number | null;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  disabled?: boolean;
  onSelect: (id: number) => void;
}) {
  const tc = useColors();
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const selected = items.find((i) => i.id === value);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((i) => i.name.toLowerCase().includes(s));
  }, [items, q]);

  const isDisabled = disabled || items.length === 0;

  return (
    <>
      <Pressable
        onPress={() => {
          if (isDisabled) return;
          setQ("");
          setOpen(true);
        }}
        style={[styles.row, isDisabled && styles.rowDisabled]}
      >
        <Text style={[styles.rowText, !selected && styles.rowPlaceholder]} numberOfLines={1}>
          {selected ? selected.name : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={tc.inkSoft} />
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        {/*
          Sheet ko keyboard ke upar rakho.
          Pehle sheet screen ke neeche chipki thi, isliye keyboard khulte hi
          results uske peeche chale jaate the — 2-3 match hone par list bilkul
          gayab lagti thi aur user samajhta tha "data hi nahi hai".
          KeyboardAvoidingView sheet ko upar utha deta hai, aur list ki min-height
          se kam-se-kam do rows hamesha dikhti hain.
        */}
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable style={{ flex: 1 }} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={tc.inkSoft} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder={searchPlaceholder}
                placeholderTextColor={tc.inkSoft}
                autoFocus
                style={styles.searchInput}
              />
              {q.length > 0 && (
                <Pressable onPress={() => setQ("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={tc.inkSoft} />
                </Pressable>
              )}
            </View>

            <FlatList
              data={filtered}
              keyExtractor={(it) => String(it.id)}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="none"
              style={{ maxHeight: Math.min(380, height * 0.45) }}
              contentContainerStyle={{ minHeight: filtered.length ? 108 : 0 }}
              ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
              renderItem={({ item }) => {
                const active = item.id === value;
                return (
                  <Pressable
                    onPress={() => {
                      onSelect(item.id);
                      setOpen(false);
                    }}
                    style={[styles.opt, active && styles.optActive]}
                  >
                    <Text style={[styles.optText, active && styles.optTextActive]}>
                      {item.name}
                    </Text>
                    {active && (
                      <Ionicons name="checkmark" size={18} color={tc.terracotta} />
                    )}
                  </Pressable>
                );
              }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  rowDisabled: { opacity: 0.5 },
  rowText: { flex: 1, fontSize: 15, color: c.ink, marginRight: 8 },
  rowPlaceholder: { color: c.inkSoft },

  backdrop: { flex: 1, backgroundColor: "rgba(46,40,35,0.5)" },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.line,
    marginBottom: 14,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.cream,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 15.5, color: c.ink, padding: 0 },
  opt: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
  },
  optActive: { backgroundColor: "rgba(194,90,55,0.08)" },
  optText: { fontSize: 15.5, color: c.ink },
  optTextActive: { color: c.terracotta, fontWeight: "700" },
  empty: { textAlign: "center", color: c.inkSoft, paddingVertical: 24, fontSize: 14 },
}));
