import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Linking } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { useDigitalChannel } from "@/hooks/useDigitalChannel";
import { PageHeader } from "@/components/PageHeader";
import { TabBar } from "@/components/TabBar";
import { Icon } from "@/components/Icon";
import { ListSkeleton } from "@/components/ListSkeleton";
import { BASE_URL } from "@/services/api";
import { IS_WIDE, TABS } from "@/components/screens/canal/shared";
import { TabMeuSite } from "@/components/screens/canal/TabMeuSite";
import { TabVitrine } from "@/components/screens/canal/TabVitrine";
import { TabEntrega } from "@/components/screens/canal/TabEntrega";

export default function CanalDigitalScreen() {
  const [tab, setTab] = useState(0);
  const { company } = useAuthStore();
  const { config, products, isLoading, saveConfig, isSaving, requestDomain, isRequestingDomain } = useDigitalChannel();
  const plan = company?.plan || "essencial";
  const hasAccess = ({ essencial: 0, negocio: 1, expansao: 2 }[plan] ?? 0) >= 1;

  if (!hasAccess) {
    return (
      <ScrollView style={s.screen} contentContainerStyle={s.content}>
        <PageHeader title="Canal Digital" />
        <View style={s.lockBox}>
          <Icon name="globe" size={36} color={Colors.ink3} />
          <Text style={s.lockTitle}>Canal Digital</Text>
          <Text style={s.lockDesc}>Crie sua loja online em minutos. Vitrine de produtos, dominio personalizado e mais.</Text>
          <View style={s.lockBadge}><Text style={s.lockBadgeText}>Disponivel no plano Negocio</Text></View>
          <Pressable style={s.upgradeBtn}><Text style={s.upgradeBtnText}>Ver planos</Text></Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <PageHeader title="Canal Digital" />
      <View style={s.hero}>
        <View style={s.heroIcon}><Icon name="globe" size={22} color={Colors.violet3} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.heroTitle}>Sua loja online em minutos</Text>
          <Text style={s.heroDesc}>Configure sua vitrine, personalize e compartilhe o link.</Text>
        </View>
        {config.is_published && (
          <Pressable onPress={() => Linking.openURL(`${BASE_URL}/storefront/${config.slug || "minha-loja"}/page`)} style={s.viewSiteBtn}>
            <Icon name="globe" size={13} color={Colors.violet3} />
            <Text style={s.viewSiteBtnText}>Ver site</Text>
          </Pressable>
        )}
      </View>
      <TabBar tabs={TABS} active={tab} onSelect={setTab} />
      {isLoading ? <ListSkeleton rows={4} /> : (
        <>
          {tab === 0 && <TabMeuSite config={config} saveConfig={saveConfig} isSaving={isSaving} requestDomain={requestDomain} isRequestingDomain={isRequestingDomain} />}
          {tab === 1 && <TabVitrine config={config} products={products} saveConfig={saveConfig} isSaving={isSaving} />}
          {tab === 2 && <TabEntrega config={config} saveConfig={saveConfig} isSaving={isSaving} />}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 }, content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  hero: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.violetD, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border2 },
  heroIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border, flexShrink: 0 },
  heroTitle: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  heroDesc: { fontSize: 11, color: Colors.ink3, marginTop: 2, lineHeight: 16 },
  viewSiteBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.bg3, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: Colors.border2, flexShrink: 0 },
  viewSiteBtnText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  lockBox: { alignItems: "center", paddingVertical: 48, gap: 12, backgroundColor: Colors.bg3, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, padding: 32 },
  lockTitle: { fontSize: 22, color: Colors.ink, fontWeight: "800" },
  lockDesc: { fontSize: 13, color: Colors.ink3, textAlign: "center", lineHeight: 20, maxWidth: 320 },
  lockBadge: { backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1, borderColor: Colors.border2 },
  lockBadgeText: { fontSize: 12, color: Colors.violet3, fontWeight: "700" },
  upgradeBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14 },
  upgradeBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
