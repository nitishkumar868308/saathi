import { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  FlatList,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "@/theme/colors";

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
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

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
        <Ionicons name="chevron-down" size={18} color={colors.inkSoft} />
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.backdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={colors.inkSoft} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder={searchPlaceholder}
                placeholderTextColor={colors.inkSoft}
                autoFocus
                style={styles.searchInput}
              />
              {q.length > 0 && (
                <Pressable onPress={() => setQ("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.inkSoft} />
                </Pressable>
              )}
            </View>

            <FlatList
              data={filtered}
              keyExtractor={(it) => String(it.id)}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 380 }}
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
                      <Ionicons name="checkmark" size={18} color={colors.terracotta} />
                    )}
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  rowDisabled: { opacity: 0.5 },
  rowText: { flex: 1, fontSize: 15, color: colors.ink, marginRight: 8 },
  rowPlaceholder: { color: colors.inkSoft },

  backdrop: { flex: 1, backgroundColor: "rgba(46,40,35,0.5)" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginBottom: 14,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.cream,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 15.5, color: colors.ink, padding: 0 },
  opt: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
  },
  optActive: { backgroundColor: "rgba(194,90,55,0.08)" },
  optText: { fontSize: 15.5, color: colors.ink },
  optTextActive: { color: colors.terracotta, fontWeight: "700" },
  empty: { textAlign: "center", color: colors.inkSoft, paddingVertical: 24, fontSize: 14 },
});
