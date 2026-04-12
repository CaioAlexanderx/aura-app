import { View, Text, Pressable, Image, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { BASE_URL } from "@/services/api";
import { fmtCNPJ, regimeLabel } from "./shared";
import type { ProfileField } from "./shared";

type Props = {
  companyName: string;
  cnpj: string;
  taxRegime: string;
  profileFields: ProfileField[];
  onLogoSaved?: (url: string) => void;
  onLogoRemoved?: () => void;
};

export function ProfileHero({ companyName, cnpj, taxRegime, profileFields, onLogoSaved, onLogoRemoved }: Props) {
  const { company, token, companyLogo, setCompanyLogo } = useAuthStore();
  const completeDone = profileFields.filter(f => f.ok).length;
  const completePct  = Math.round((completeDone / profileFields.length) * 100);
  const missing      = profileFields.filter(f => !f.ok).map(f => f.label);

  async function handleLogoUpload() {
    if (Platform.OS !== "web") return;
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/png,image/jpeg,image/webp";
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0]; if (!file) return;
      if (file.size > 2 * 1024 * 1024) { toast.error("Max 2MB"); return; }
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Full = reader.result as string;
        // Show immediately (optimistic)
        setCompanyLogo(base64Full);
        try { if (typeof localStorage !== "undefined") localStorage.setItem("aura_company_logo", base64Full); } catch {}

        // P1 #5: Upload to R2 and persist URL
        if (company?.id && token) {
          try {
            const base64Data = base64Full.split(",")[1] || base64Full;
            const contentType = file.type || "image/png";
            const res = await fetch(`${BASE_URL}/companies/${company.id}/storage/upload`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
              body: JSON.stringify({ content: base64Data, filename: "logo." + (contentType.split("/")[1] || "png"), category: "branding", content_type: contentType }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data.url) {
                setCompanyLogo(data.url);
                onLogoSaved?.(data.url);
              }
            }
          } catch {}
        }
        toast.success("Logo atualizada");
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  function handleLogoRemove() {
    setCompanyLogo("");
    try { if (typeof localStorage !== "undefined") localStorage.removeItem("aura_company_logo"); } catch {}
    onLogoRemoved?.();
    toast.info("Logo removida");
  }

  return (
    <View style={s.hero}>
      <Pressable onPress={handleLogoUpload} style={s.avatar}>
        {companyLogo
          ? <Image source={{ uri: companyLogo }} style={s.avatarImg} resizeMode="cover" />
          : <Text style={s.avatarInitial}>{(companyName || "E").charAt(0).toUpperCase()}</Text>}
        {Platform.OS === "web" && (
          <View style={s.avatarOverlay}><Icon name="upload" size={14} color="#fff" /></View>
        )}
      </Pressable>
      <View style={s.heroInfo}>
        <Text style={s.heroName} numberOfLines={1}>{companyName || "Minha Empresa"}</Text>
        {cnpj
          ? <Text style={s.heroSub}>{fmtCNPJ(cnpj)}{taxRegime ? " \u00b7 " + regimeLabel(taxRegime) : ""}</Text>
          : <Text style={[s.heroSub, { color: Colors.amber }]}>CNPJ nao informado</Text>}
        <View style={s.progressRow}>
          <View style={s.progressTrack}><View style={[s.progressFill, { width: completePct + "%" as any }]} /></View>
          <Text style={s.progressLabel}>{completePct}%</Text>
        </View>
        {missing.length > 0 && <Text style={s.progressMissing}>Faltam: {missing.join(", ")}</Text>}
      </View>
      {companyLogo && (
        <Pressable onPress={handleLogoRemove} style={s.heroAction}>
          <Icon name="x" size={14} color={Colors.red} />
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  hero:           { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: Colors.bg3, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 4 },
  avatar:         { width: 60, height: 60, borderRadius: 14, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, overflow: "hidden", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  avatarImg:      { width: 60, height: 60 },
  avatarInitial:  { fontSize: 24, fontWeight: "700", color: Colors.violet3 },
  avatarOverlay:  { position: "absolute", bottom: 0, left: 0, right: 0, height: 20, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  heroInfo:       { flex: 1, minWidth: 0 },
  heroName:       { fontSize: 16, fontWeight: "700", color: Colors.ink, marginBottom: 2 },
  heroSub:        { fontSize: 12, color: Colors.ink3, marginBottom: 8 },
  progressRow:    { flexDirection: "row", alignItems: "center", gap: 8 },
  progressTrack:  { flex: 1, height: 5, backgroundColor: Colors.bg4, borderRadius: 3, overflow: "hidden" },
  progressFill:   { height: 5, backgroundColor: Colors.violet, borderRadius: 3 },
  progressLabel:  { fontSize: 11, color: Colors.violet3, fontWeight: "600", minWidth: 28 },
  progressMissing:{ fontSize: 10, color: Colors.ink3, marginTop: 4 },
  heroAction:     { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.redD, alignItems: "center", justifyContent: "center", flexShrink: 0 },
});
