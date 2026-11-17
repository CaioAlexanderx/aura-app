import { useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { adminApi } from "@/services/api";
import type { EstadoDaCasa } from "@/services/adminApi";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { PERSONALIZADOS_LIBERADO } from "@/utils/personalizados";

// ============================================================
// Gestão Aura › Clientes › Casa no Negócio (p-189, 17/11/2026)
//
// Interruptor da virada do Studio, UMA empresa por vez:
//   GET/PATCH /admin/clients/:cid/casa-negocio (Aura-backend, só equipe).
// Ligar: a empresa sai do /studio e abre no shell Negócio, com a frente
// Personalizados; studio_enabled (a loja online) não muda e a data original
// da frente é gravada. Desligar: volta ao /studio. Cada troca vai ao
// admin_audit_log.
//
// Só aparece com a trava PERSONALIZADOS_LIBERADO ligada E para a equipe
// (is_staff). Com a trava em false o componente não monta nada nem chama
// o backend: a Gestão Aura fica igual.
//
// Confirmação em linha (sem modal): o primeiro toque pede "Confirmar".
// ============================================================

const MOTIVO: Record<string, string> = {
  empresa_nao_encontrada: "Empresa não encontrada.",
  ja_ligada: "A casa já está no Negócio.",
  ja_desligada: "A casa já está no Studio.",
  nao_esta_no_studio: "Só empresa que está no Studio (vertical Studio) muda de casa.",
  studio_desligado: "O Studio desta empresa está desligado. Sem ele, Personalizados some no Negócio.",
  plano: "Personalizados exige plano Negócio ou acima.",
  outra_vertical: "A empresa está com outra vertical ativa. Troque a vertical antes.",
};

function dataCurta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function CasaNegocioSection({ companyId, liberado = PERSONALIZADOS_LIBERADO }: { companyId: string; liberado?: boolean }) {
  const isStaff = useAuthStore((st: any) => !!st.isStaff);
  if (!liberado || !isStaff) return null;
  return <CasaNegocioConteudo companyId={companyId} />;
}

function CasaNegocioConteudo({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const ownCompanyId = useAuthStore((st: any) => st.company?.id);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => { setConfirmando(false); setErro(null); }, [companyId]);

  const { data: estado, isLoading, isError } = useQuery<EstadoDaCasa>({
    queryKey: ["admin-casa-negocio", companyId],
    queryFn: () => adminApi.casaNegocio(companyId),
    staleTime: 15_000,
    retry: 0,
  });

  const mutation = useMutation({
    mutationFn: (ligada: boolean) => adminApi.setCasaNegocio(companyId, ligada),
    onSuccess: (res) => {
      setConfirmando(false);
      setErro(null);
      qc.setQueryData(["admin-casa-negocio", companyId], res.estado);
      qc.invalidateQueries({ queryKey: ["admin-clients"] });
      qc.invalidateQueries({ queryKey: ["admin-clients-360"] });
      if (ownCompanyId === companyId) {
        const st: any = useAuthStore.getState();
        if (typeof st.refreshMe === "function") st.refreshMe().catch(() => {});
      }
      toast.success(res.estado.casa_negocio ? "Casa no Negócio ligada" : "Casa de volta ao Studio");
    },
    onError: (err: any) => {
      const msg = err?.data?.error || "Não deu para trocar a casa";
      setConfirmando(false);
      setErro(msg);
      toast.error(msg);
    },
  });

  const ligada = !!estado?.casa_negocio;
  const pode = estado ? (ligada ? estado.pode_desligar : estado.pode_ligar) : false;
  const motivo = estado ? (ligada ? estado.motivo_desligar : estado.motivo_ligar) : null;
  const rotulo = ligada ? "Voltar para o Studio" : "Ligar a casa no Negócio";

  function tocar() {
    if (!pode || mutation.isPending) return;
    if (!confirmando) { setConfirmando(true); return; }
    mutation.mutate(!ligada);
  }

  return (
    <View style={s.section} testID="casa-negocio-section">
      <View style={s.topo}>
        <Text style={s.sectionTitle}>Casa no Negócio</Text>
        {mutation.isPending && <ActivityIndicator size="small" color={Colors.violet3} />}
      </View>
      <Text style={s.hint}>
        Leva a empresa do Studio para o shell Negócio, com a frente Personalizados. A loja online não muda.
      </Text>

      {isLoading ? (
        <Text style={s.hint}>Carregando…</Text>
      ) : isError || !estado ? (
        <Text style={s.hint} testID="casa-negocio-erro-leitura">Não deu para ler a casa desta empresa.</Text>
      ) : (
        <>
          <View style={s.infoGrid}>
            <Info label="Abre em" value={ligada ? "Negócio" : (estado.vertical_active === "studio" ? "Studio" : "Negócio (sem Studio)")} testID="casa-negocio-abre-em" />
            <Info label="Loja online (studio_enabled)" value={estado.studio_enabled ? "ligada" : "desligada"} />
            <Info label="Personalizados desde" value={dataCurta(estado.personalizados_ativado_em)} />
            <Info label="Casa ligada em" value={ligada ? dataCurta(estado.casa_negocio_em) : "—"} />
          </View>

          {!pode && motivo && motivo !== "ja_ligada" && motivo !== "ja_desligada" && (
            <Text style={s.hint} testID="casa-negocio-motivo">{MOTIVO[motivo] || motivo}</Text>
          )}

          {erro && <Text style={s.erro} testID="casa-negocio-erro">{erro}</Text>}

          <View style={s.botoes}>
            <Pressable
              onPress={tocar}
              disabled={!pode || mutation.isPending}
              style={[s.btn, ligada && s.btnVolta, (!pode || mutation.isPending) && { opacity: 0.5 }]}
              testID="casa-negocio-botao"
              accessibilityRole="button"
            >
              <Text style={[s.btnText, ligada && { color: Colors.ink }]}>{confirmando ? "Confirmar: " + rotulo.toLowerCase() : rotulo}</Text>
            </Pressable>
            {confirmando && (
              <Pressable onPress={() => setConfirmando(false)} style={s.btnCancelar} testID="casa-negocio-cancelar" accessibilityRole="button">
                <Text style={s.btnCancelarText}>Cancelar</Text>
              </Pressable>
            )}
          </View>
          <Text style={s.hint}>Uma empresa por vez. A troca volta pelo mesmo botão e fica registrada em admin_audit_log.</Text>
        </>
      )}
    </View>
  );
}

function Info({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <View style={s.info}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue} testID={testID}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  section: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  topo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10, marginBottom: 4 },
  info: { minWidth: 140, flexGrow: 1, flexBasis: 140, backgroundColor: Colors.bg4, borderRadius: 10, padding: 10 },
  infoLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  infoValue: { fontSize: 13, color: Colors.ink, fontWeight: "600", marginTop: 3 },
  botoes: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  btn: { flexGrow: 1, backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, alignItems: "center" },
  btnVolta: { backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  btnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  btnCancelar: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  btnCancelarText: { color: Colors.ink2, fontSize: 13, fontWeight: "600" },
  erro: { fontSize: 12, color: Colors.red, fontWeight: "600", marginTop: 10 },
  hint: { fontSize: 10, color: Colors.ink3, marginTop: 6, lineHeight: 14 },
});

export default CasaNegocioSection;
