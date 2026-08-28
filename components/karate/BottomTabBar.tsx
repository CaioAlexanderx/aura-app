// ============================================================
// AURA KARATÊ — Barra inferior (mobile) com agrupamento em "Mais"
//
// A barra era um flex row de itens com `flex: 1`: cada aba nova espremia
// todas as outras. O shell do dojô chegou a NOVE abas fixas — num aparelho
// de 375px dá ~41px por aba, e "Mensalidades"/"Certificados" saíam
// truncados num rótulo de 10px. A saída de sempre (esconder a aba no
// mobile) tinha o efeito colateral de deixar a tela INALCANÇÁVEL pelo
// celular: era o caso de Configurações, que não tinha nenhum outro link
// no app inteiro.
//
// Regra (decisão do Caio, 28/08/2026): no máximo `maxSlots` ícones. Cabendo
// tudo, mostra tudo; passando disso, os primeiros (maxSlots - 1) ficam na
// barra e o resto vai para um menu "Mais" (hambúrguer). Nada some — o que
// não cabe fica a um toque de distância.
//
// A ORDEM da lista é a prioridade: quem vem primeiro fica na barra. Quem
// mexer na nav decide, por posição, o que é atalho e o que é menu.
// ============================================================
import React, { useState, useCallback } from "react";
import {
  Modal, View, Text, TouchableOpacity, Pressable, ScrollView,
  StyleSheet, Platform, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateFonts, KarateRadius } from "@/constants/karateTheme";

export interface BottomTabBarItem {
  label: string;
  icon: string;
  route: string;
}

export interface BottomTabBarProps {
  items: BottomTabBarItem[];
  isActive: (item: BottomTabBarItem) => boolean;
  onNavigate: (route: string) => void;
  /** Teto de ícones na barra, "Mais" incluído. Padrão 5. */
  maxSlots?: number;
}

/**
 * Divide a nav entre o que fica na barra e o que vai para o menu.
 * Exportada para teste: a regra de corte é o que quebra em silêncio quando
 * alguém adiciona a próxima aba.
 */
export function splitTabs<T>(items: T[], maxSlots: number): { visible: T[]; overflow: T[] } {
  // Cabendo tudo, nada de "Mais" com um item só dentro — o hambúrguer custa
  // um slot, então só compensa quando esconde MAIS de um.
  if (items.length <= maxSlots) return { visible: items, overflow: [] };
  return { visible: items.slice(0, maxSlots - 1), overflow: items.slice(maxSlots - 1) };
}

export function BottomTabBar({ items, isActive, onNavigate, maxSlots = 5 }: BottomTabBarProps) {
  const [aberto, setAberto] = useState(false);
  const { visible, overflow } = splitTabs(items, Math.max(2, maxSlots));
  const overflowAtivo = overflow.some(isActive);

  // Fecha o menu ANTES de navegar: <Modal> de topo no RN Web fica preso por
  // baixo da rota nova se não for fechado primeiro — armadilha já conhecida
  // deste produto (ver PraticanteFichaModal).
  const irPara = useCallback((route: string) => {
    setAberto(false);
    onNavigate(route);
  }, [onNavigate]);

  return (
    <>
      <View style={styles.bottomBar}>
        {visible.map((item) => {
          const active = isActive(item);
          return (
            <TouchableOpacity
              key={item.route}
              style={styles.tabItem}
              onPress={() => onNavigate(item.route)}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              testID={`tab-${item.route}`}
            >
              <Icon name={item.icon as any} size={22} color={active ? KarateColors.primary : KarateColors.ink4} />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        {overflow.length > 0 && (
          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => setAberto(true)}
            accessibilityRole="button"
            accessibilityLabel="Mais seções"
            accessibilityState={{ selected: overflowAtivo, expanded: aberto }}
            testID="tab-mais"
          >
            <Icon name="menu" size={22} color={overflowAtivo ? KarateColors.primary : KarateColors.ink4} />
            <Text style={[styles.tabLabel, overflowAtivo && styles.tabLabelActive]} numberOfLines={1}>
              Mais
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={aberto} transparent animationType="fade" onRequestClose={() => setAberto(false)}>
        <Pressable style={styles.overlay} onPress={() => setAberto(false)} accessibilityLabel="Fechar menu">
          {/* Pressable interno engole o toque: tocar na folha não fecha. */}
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Mais seções</Text>
              <TouchableOpacity
                onPress={() => setAberto(false)}
                accessibilityRole="button"
                accessibilityLabel="Fechar"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="close" size={18} color={KarateColors.ink3} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetList}>
              {overflow.map((item) => {
                const active = isActive(item);
                return (
                  <TouchableOpacity
                    key={item.route}
                    style={[styles.sheetItem, active && styles.sheetItemActive]}
                    onPress={() => irPara(item.route)}
                    accessibilityRole="link"
                    accessibilityLabel={item.label}
                    accessibilityState={{ selected: active }}
                    testID={`mais-${item.route}`}
                  >
                    <Icon name={item.icon as any} size={19} color={active ? KarateColors.primary : KarateColors.ink3} />
                    <Text style={[styles.sheetItemTxt, active && styles.sheetItemTxtActive]} numberOfLines={1}>
                      {item.label}
                    </Text>
                    <Icon name="chevron-right" size={15} color={KarateColors.ink4} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: KarateColors.border,
    backgroundColor: KarateColors.bg,
    paddingBottom: Platform.OS === "ios" ? 16 : 6,
  } as ViewStyle,
  tabItem: { flex: 1, alignItems: "center", paddingTop: 8, gap: 2 } as ViewStyle,
  tabLabel: { fontSize: 10, color: KarateColors.ink4, fontWeight: "600" } as TextStyle,
  tabLabelActive: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,

  // Folha ancorada embaixo: o menu sai de onde o dedo tocou, não do meio da
  // tela — o polegar já está na barra inferior.
  overlay: {
    flex: 1,
    backgroundColor: "rgba(43,38,32,0.42)",
    justifyContent: "flex-end",
  } as ViewStyle,
  sheet: {
    backgroundColor: KarateColors.surface,
    borderTopLeftRadius: KarateRadius.md,
    borderTopRightRadius: KarateRadius.md,
    borderTopWidth: 1,
    borderTopColor: KarateColors.border,
    paddingBottom: Platform.OS === "ios" ? 28 : 14,
    maxHeight: "70%",
  } as ViewStyle,
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  } as ViewStyle,
  sheetTitle: {
    fontFamily: KarateFonts.heading,
    fontSize: 15,
    fontWeight: "500",
    color: KarateColors.ink,
  } as TextStyle,
  sheetScroll: { flexGrow: 0 } as ViewStyle,
  sheetList: { paddingHorizontal: 10, paddingBottom: 6, gap: 2 } as ViewStyle,
  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: KarateRadius.sm,
  } as ViewStyle,
  sheetItemActive: { backgroundColor: KarateColors.primarySoft } as ViewStyle,
  sheetItemTxt: { flex: 1, fontSize: 14, fontWeight: "600", color: KarateColors.ink2 } as TextStyle,
  sheetItemTxtActive: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,
});

export default BottomTabBar;
