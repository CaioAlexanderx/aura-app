import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { IS_WIDE } from "@/constants/helpers";
import { useAuthStore } from "@/stores/auth";
import { CNAE_PROFILES, detectProfileFromCnae } from "@/constants/obligations";

const STEPS = ["Boas-vindas", "Sua empresa", "Tipo de negocio", "Funcionarios", "Pronto!"];

const BUSINESS_TYPES = [
  { key: "barbearia_salao", label: "Barbearia / Salao", icon: "S" },
  { key: "odontologia", label: "Odontologia", icon: "D" },
  { key: "estetica", label: "Estetica / Bem-estar", icon: "E" },
  { key: "food_service", label: "Alimentacao / Restaurante", icon: "R" },
  { key: "varejo_roupas", label: "Varejo / Roupas", icon: "V" },
  { key: "pet_shop", label: "Pet Shop", icon: "P" },
  { key: "ti_saas", label: "TI / Software", icon: "T" },
  { key: "mei_comercio", label: "Comercio geral", icon: "C" },
  { key: "mei_servicos", label: "Servicos geral", icon: "G" },
];

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <View style={pg.container}>
      <View style={pg.bar}>
        {[...Array(total)].map((_, i) => (
          <View key={i} style={[pg.segment, i <= step && pg.segmentActive]} />
        ))}
      </View>
      <Text style={pg.label}>Passo {step + 1} de {total}</Text>
    </View>
  );
}
const pg = StyleSheet.create({
  container: { marginBottom: 24, gap: 8 },
  bar: { flexDirection: "row", gap: 4 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.bg4 },
  segmentActive: { backgroundColor: Colors.violet },
  label: { fontSize: 11, color: Colors.ink3, textAlign: "center" },
});

function StepCard({ children }: { children: React.ReactNode }) {
  return <View style={sc.card}>{children}</View>;
}
const sc = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 20, padding: IS_WIDE ? 40 : 24, borderWidth: 1, borderColor: Colors.border2, maxWidth: 560, width: "100%", alignSelf: "center" },
});

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, company } = useAuthStore();
  const [step, setStep] = useState(0);
  const [cnpj, setCnpj] = useState("");
  const [cnpjData, setCnpjData] = useState<any>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [businessType, setBusinessType] = useState("");
  const [hasEmployees, setHasEmployees] = useState(false);
  const [employeeCount, setEmployeeCount] = useState("0");

  function formatCnpj(v: string) {
    const nums = v.replace(/\D/g, "").slice(0, 14);
    if (nums.length <= 2) return nums;
    if (nums.length <= 5) return nums.slice(0,2) + "." + nums.slice(2);
    if (nums.length <= 8) return nums.slice(0,2) + "." + nums.slice(2,5) + "." + nums.slice(5);
    if (nums.length <= 12) return nums.slice(0,2) + "." + nums.slice(2,5) + "." + nums.slice(5,8) + "/" + nums.slice(8);
    return nums.slice(0,2) + "." + nums.slice(2,5) + "." + nums.slice(5,8) + "/" + nums.slice(8,12) + "-" + nums.slice(12);
  }

  async function lookupCnpj() {
    const nums = cnpj.replace(/\D/g, "");
    if (nums.length !== 14) { Alert.alert("CNPJ deve ter 14 digitos"); return; }
    setLookingUp(true);
    // Demo: simulate CNPJ lookup
    setTimeout(() => {
      const mockCnae = nums.startsWith("96") ? "9602-5/01" : nums.startsWith("86") ? "8630-5/04" : "6202-3/00";
      setCnpjData({
        razaoSocial: company?.name || "Empresa Demo Ltda",
        cnae: mockCnae,
        regime: mockCnae.startsWith("62") ? "Simples Nacional" : "MEI",
        uf: "SP",
        municipio: "Jacarei",
      });
      // Auto-detect business type
      const prefix = mockCnae.replace(/[^0-9]/g, "").substring(0, 4);
      const detected = detectProfileFromCnae(prefix, false);
      setBusinessType(detected);
      setLookingUp(false);
      setStep(2);
    }, 1500);
  }

  function finish() {
    // In production: PATCH /companies/:id with onboarding data
    router.replace("/");
  }

  const isWeb = Platform.OS === "web";
  const inputStyle = { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.ink };

  return (
    <ScrollView style={z.scr} contentContainerStyle={z.cnt}>
      <ProgressBar step={step} total={STEPS.length} />

      {/* Step 0: Welcome */}
      {step === 0 && (
        <StepCard>
          <Text style={z.emoji}>*</Text>
          <Text style={z.title}>Bem-vindo a Aura, {user?.name?.split(" ")[0] || "empreendedor"}!</Text>
          <Text style={z.sub}>Vamos configurar sua empresa em poucos minutos. Depois disso, a Aura cuida de organizar tudo pra voce.</Text>
          <View style={z.features}>
            {["Obrigacoes contabeis organizadas","Vendas e estoque integrados","Guias passo a passo para cada tarefa","Tudo em um so lugar"].map(f => (
              <View key={f} style={z.featureRow}><View style={z.featureDot} /><Text style={z.featureText}>{f}</Text></View>
            ))}
          </View>
          <Pressable onPress={() => setStep(1)} style={z.primaryBtn}>
            <Text style={z.primaryBtnText}>Vamos comecar</Text>
          </Pressable>
        </StepCard>
      )}

      {/* Step 1: CNPJ */}
      {step === 1 && (
        <StepCard>
          <Text style={z.stepTitle}>Qual o CNPJ da sua empresa?</Text>
          <Text style={z.stepSub}>Vamos buscar as informacoes automaticamente na Receita Federal.</Text>
          <View style={{ marginTop: 20, gap: 12 }}>
            <Text style={z.fieldLabel}>CNPJ</Text>
            <TextInput
              style={inputStyle as any}
              value={cnpj}
              onChangeText={v => setCnpj(formatCnpj(v))}
              placeholder="00.000.000/0000-00"
              placeholderTextColor={Colors.ink3}
              keyboardType="number-pad"
              maxLength={18}
            />
            <Pressable onPress={lookupCnpj} style={[z.primaryBtn, lookingUp && { opacity: 0.6 }]} disabled={lookingUp}>
              <Text style={z.primaryBtnText}>{lookingUp ? "Consultando..." : "Consultar CNPJ"}</Text>
            </Pressable>
            <View style={z.divider} />
            <Pressable onPress={() => { setCnpjData({ razaoSocial: company?.name || "Minha Empresa", cnae: "---", regime: "MEI", uf: "SP", municipio: "---" }); setStep(2); }} style={z.skipBtn}>
              <Text style={z.skipText}>Ainda nao tenho CNPJ - configurar depois</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => setStep(0)} style={z.backBtn}><Text style={z.backText}>Voltar</Text></Pressable>
        </StepCard>
      )}

      {/* Step 2: Business Type */}
      {step === 2 && (
        <StepCard>
          <Text style={z.stepTitle}>Tipo de negocio</Text>
          {cnpjData && cnpjData.cnae !== "---" && (
            <View style={z.detectedCard}>
              <Text style={z.detectedLabel}>Detectado pelo CNPJ</Text>
              <Text style={z.detectedValue}>{cnpjData.razaoSocial}</Text>
              <Text style={z.detectedMeta}>CNAE: {cnpjData.cnae} / {cnpjData.regime} / {cnpjData.municipio}-{cnpjData.uf}</Text>
            </View>
          )}
          <Text style={z.stepSub}>Selecione o tipo que melhor descreve seu negocio:</Text>
          <View style={z.typesGrid}>
            {BUSINESS_TYPES.map(t => (
              <Pressable key={t.key} onPress={() => setBusinessType(t.key)} style={[z.typeCard, businessType === t.key && z.typeCardActive]}>
                <View style={[z.typeIcon, businessType === t.key && z.typeIconActive]}>
                  <Text style={[z.typeIconText, businessType === t.key && { color: "#fff" }]}>{t.icon}</Text>
                </View>
                <Text style={[z.typeLabel, businessType === t.key && z.typeLabelActive]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={z.navRow}>
            <Pressable onPress={() => setStep(1)} style={z.backBtn}><Text style={z.backText}>Voltar</Text></Pressable>
            <Pressable onPress={() => { if (!businessType) { Alert.alert("Selecione um tipo de negocio"); return; } setStep(3); }} style={z.primaryBtn}>
              <Text style={z.primaryBtnText}>Continuar</Text>
            </Pressable>
          </View>
        </StepCard>
      )}

      {/* Step 3: Employees */}
      {step === 3 && (
        <StepCard>
          <Text style={z.stepTitle}>Voce tem funcionarios?</Text>
          <Text style={z.stepSub}>Isso define quais obrigacoes contabeis a Aura vai configurar pra voce.</Text>
          <View style={z.toggleRow}>
            <Pressable onPress={() => setHasEmployees(false)} style={[z.toggleCard, !hasEmployees && z.toggleActive]}>
              <Text style={[z.toggleIcon, !hasEmployees && { color: Colors.green }]}>-</Text>
              <Text style={[z.toggleTitle, !hasEmployees && { color: Colors.ink }]}>Nao tenho</Text>
              <Text style={z.toggleSub}>Trabalho sozinho ou com socios</Text>
            </Pressable>
            <Pressable onPress={() => setHasEmployees(true)} style={[z.toggleCard, hasEmployees && z.toggleActive]}>
              <Text style={[z.toggleIcon, hasEmployees && { color: Colors.violet3 }]}>+</Text>
              <Text style={[z.toggleTitle, hasEmployees && { color: Colors.ink }]}>Sim, tenho</Text>
              <Text style={z.toggleSub}>Funcionarios registrados</Text>
            </Pressable>
          </View>
          {hasEmployees && (
            <View style={{ marginTop: 16, gap: 6 }}>
              <Text style={z.fieldLabel}>Quantos funcionarios?</Text>
              <TextInput style={inputStyle as any} value={employeeCount} onChangeText={setEmployeeCount} keyboardType="number-pad" placeholder="1" placeholderTextColor={Colors.ink3} />
            </View>
          )}
          {hasEmployees && (
            <View style={z.oblPreview}>
              <Text style={z.oblPreviewTitle}>Com funcionarios, a Aura vai gerenciar:</Text>
              <View style={z.oblList}>
                <View style={z.oblItem}><View style={[z.oblDot,{backgroundColor:Colors.green}]} /><Text style={z.oblText}>FGTS mensal (Aura resolve)</Text></View>
                <View style={z.oblItem}><View style={[z.oblDot,{backgroundColor:Colors.amber}]} /><Text style={z.oblText}>eSocial (Aura facilita, voce resolve)</Text></View>
              </View>
            </View>
          )}
          <View style={z.navRow}>
            <Pressable onPress={() => setStep(2)} style={z.backBtn}><Text style={z.backText}>Voltar</Text></Pressable>
            <Pressable onPress={() => setStep(4)} style={z.primaryBtn}><Text style={z.primaryBtnText}>Continuar</Text></Pressable>
          </View>
        </StepCard>
      )}

      {/* Step 4: Done */}
      {step === 4 && (
        <StepCard>
          <View style={z.doneCircle}><Text style={z.doneCheck}>OK</Text></View>
          <Text style={z.title}>Tudo pronto!</Text>
          <Text style={z.sub}>Sua empresa esta configurada. A Aura ja organizou suas obrigacoes contabeis e esta pronta pra voce usar.</Text>
          <View style={z.summaryCard}>
            <Text style={z.summaryTitle}>Resumo</Text>
            <View style={z.summaryRow}><Text style={z.summaryLabel}>Empresa</Text><Text style={z.summaryValue}>{cnpjData?.razaoSocial || company?.name || "---"}</Text></View>
            <View style={z.summaryRow}><Text style={z.summaryLabel}>Regime</Text><Text style={z.summaryValue}>{cnpjData?.regime || "MEI"}</Text></View>
            <View style={z.summaryRow}><Text style={z.summaryLabel}>Tipo</Text><Text style={z.summaryValue}>{CNAE_PROFILES[businessType]?.label || businessType}</Text></View>
            <View style={z.summaryRow}><Text style={z.summaryLabel}>Funcionarios</Text><Text style={z.summaryValue}>{hasEmployees ? employeeCount : "Nenhum"}</Text></View>
          </View>
          <View style={z.oblPreview}>
            <Text style={z.oblPreviewTitle}>Obrigacoes configuradas:</Text>
            <View style={z.oblList}>
              {(CNAE_PROFILES[hasEmployees ? businessType.replace(/_salao$/,"_salao_func").replace(/mei_(comercio|servicos)$/,"mei_com_funcionario") : businessType]?.obligations || CNAE_PROFILES[businessType]?.obligations || []).slice(0, 6).map(o => (
                <View key={o} style={z.oblItem}><View style={[z.oblDot,{backgroundColor:Colors.violet3}]} /><Text style={z.oblText}>{o.replace(/_/g, " ").replace(/^\w/,c=>c.toUpperCase())}</Text></View>
              ))}
            </View>
          </View>
          <Pressable onPress={finish} style={[z.primaryBtn, { backgroundColor: Colors.green }]}>
            <Text style={z.primaryBtnText}>Ir para o painel</Text>
          </Pressable>
        </StepCard>
      )}
    </ScrollView>
  );
}

const z = StyleSheet.create({
  scr: { flex: 1 },
  cnt: { padding: IS_WIDE ? 40 : 20, paddingBottom: 48, justifyContent: "center", minHeight: "100%" as any },
  emoji: { fontSize: 40, textAlign: "center", marginBottom: 16, color: Colors.violet3 },
  title: { fontSize: 24, color: Colors.ink, fontWeight: "800", textAlign: "center", marginBottom: 8 },
  sub: { fontSize: 14, color: Colors.ink3, textAlign: "center", lineHeight: 22, marginBottom: 24 },
  stepTitle: { fontSize: 20, color: Colors.ink, fontWeight: "700", marginBottom: 6 },
  stepSub: { fontSize: 13, color: Colors.ink3, lineHeight: 20, marginBottom: 16 },
  fieldLabel: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  features: { gap: 10, marginBottom: 28 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  featureDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.violet },
  featureText: { fontSize: 14, color: Colors.ink, fontWeight: "500" },
  primaryBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  skipBtn: { alignItems: "center", paddingVertical: 8 },
  skipText: { fontSize: 12, color: Colors.violet3, fontWeight: "500" },
  backBtn: { paddingVertical: 10 },
  backText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  navRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 8 },
  detectedCard: { backgroundColor: Colors.greenD, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.green + "33" },
  detectedLabel: { fontSize: 10, color: Colors.green, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  detectedValue: { fontSize: 15, color: Colors.ink, fontWeight: "700", marginBottom: 2 },
  detectedMeta: { fontSize: 11, color: Colors.ink3 },
  typesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  typeCard: { width: IS_WIDE ? "31%" : "47%", backgroundColor: Colors.bg4, borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: Colors.border, alignItems: "center", gap: 8 },
  typeCardActive: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  typeIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  typeIconActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  typeIconText: { fontSize: 16, fontWeight: "700", color: Colors.ink3 },
  typeLabel: { fontSize: 12, color: Colors.ink3, fontWeight: "500", textAlign: "center" },
  typeLabelActive: { color: Colors.violet3, fontWeight: "600" },
  toggleRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  toggleCard: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 14, padding: 20, borderWidth: 1.5, borderColor: Colors.border, alignItems: "center", gap: 6 },
  toggleActive: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  toggleIcon: { fontSize: 28, fontWeight: "800", color: Colors.ink3 },
  toggleTitle: { fontSize: 14, color: Colors.ink3, fontWeight: "600" },
  toggleSub: { fontSize: 11, color: Colors.ink3, textAlign: "center" },
  oblPreview: { backgroundColor: Colors.bg4, borderRadius: 12, padding: 14, marginTop: 16, borderWidth: 1, borderColor: Colors.border },
  oblPreviewTitle: { fontSize: 12, color: Colors.ink3, fontWeight: "600", marginBottom: 10 },
  oblList: { gap: 6 },
  oblItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  oblDot: { width: 6, height: 6, borderRadius: 3 },
  oblText: { fontSize: 12, color: Colors.ink, fontWeight: "500" },
  doneCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 16, borderWidth: 2, borderColor: Colors.green },
  doneCheck: { fontSize: 20, color: Colors.green, fontWeight: "800" },
  summaryCard: { backgroundColor: Colors.bg4, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  summaryTitle: { fontSize: 13, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  summaryLabel: { fontSize: 13, color: Colors.ink3 },
  summaryValue: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
});
