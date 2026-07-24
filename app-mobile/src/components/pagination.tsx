import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";

/**
 * List ko chhote pages me baanto (client-side). resetKey badle (filter/search)
 * to page 1 pe wapas.
 */
export function usePaged<T>(items: T[], pageSize = 10, resetKey?: unknown) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [page, pageCount]);

  const pageItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  );

  return { page, setPage, pageCount, pageItems };
}

/** Sirf controls — prev, page numbers, next. Koi text nahi. */
export function Pagination({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (p: number) => void;
}) {
  if (pageCount <= 1) return null;
  const pages = pageWindow(page, pageCount);

  return (
    <View style={styles.wrap}>
      <Arrow name="chevron-back" disabled={page <= 1} onPress={() => onPage(page - 1)} />
      {pages.map((p, i) =>
        p === "…" ? (
          <Text key={`g-${i}`} style={styles.gap}>
            …
          </Text>
        ) : (
          <Pressable
            key={p}
            onPress={() => onPage(p)}
            style={[styles.page, p === page && styles.pageActive]}
          >
            <Text style={[styles.pageText, p === page && styles.pageTextActive]}>{p}</Text>
          </Pressable>
        ),
      )}
      <Arrow name="chevron-forward" disabled={page >= pageCount} onPress={() => onPage(page + 1)} />
    </View>
  );
}

function Arrow({
  name,
  disabled,
  onPress,
}: {
  name: "chevron-back" | "chevron-forward";
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={[styles.arrow, disabled && styles.arrowOff]}
    >
      <Ionicons name={name} size={18} color={disabled ? colors.line : colors.ink} />
    </Pressable>
  );
}

function pageWindow(page: number, pageCount: number): (number | "…")[] {
  if (pageCount <= 6) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);
  if (start > 2) out.push("…");
  for (let p = start; p <= end; p++) out.push(p);
  if (end < pageCount - 1) out.push("…");
  out.push(pageCount);
  return out;
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
  },
  arrow: {
    height: 38,
    width: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  arrowOff: { opacity: 0.5 },
  page: {
    minWidth: 38,
    height: 38,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  pageActive: { backgroundColor: colors.terracotta, borderColor: colors.terracotta },
  pageText: { fontSize: 14, fontWeight: "700", color: colors.inkSoft },
  pageTextActive: { color: colors.white },
  gap: { paddingHorizontal: 2, color: colors.inkSoft, fontWeight: "700" },
});
