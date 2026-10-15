import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { IS_WIDE } from "@/constants/helpers";
import { Icon } from "@/components/Icon";
import { CompanyPickerModal } from "@/components/CompanyPickerModal";
import { useAuthStore } from "@/stores/auth";
import {
  fiscalCertificateApi,
  type FiscalCertificateUploadResult,
} from "@/services/fiscalCertificateApi";
import {
  estadoDoCertificado, formatarCnpj, periodoDeValidade, textoDoPrazo, textoErroDeCarregamento, titularLegivel,
  type CertInfo, type EstadoCertificado,
} from "@/utils/certificadoA1";
import { CertificadoForm } from "./CertificadoForm";
import { CertificadoAjuda, BotaoAjudaWhatsApp } from "./CertificadoAjuda";

// ============================================================
// Aba "Certificado A1" do painel de Notas fiscais (14/10/2026).
// Mockup aprovado pelo Caio: docs/mockups/certificado-a1-cliente.html.
//
// O dono da empresa cadastra o próprio certificado A1 (mesmo certStore da
// Gestão Aura: components/admin/AuraNotasAdmin.tsx > CertificateBlock) ou
// pede ajuda da Aura pelo WhatsApp. Funcionário vê só a situação.
//
// · O servidor é a autoridade: `pode_enviar` esconde o formulário, mas é o
//   backend que recusa (APENAS_DONO) e que confere o CNPJ do certificado.
// · Não é módulo novo: herda o gate do módulo NF-e (sem `mod`/plano próprio).
// · Multi-CNPJ: a tela NF-e já exige empresa ativa (RequireCompanyScope); a
//   aba mostra qual é e, havendo mais de uma, oferece trocar.
// · Sem hover-reveal: tudo é toque/clique.
// ============================================================

export const fiscalCertKey = (companyId?: string | null) => ["fiscal-certificate", companyId || ""] as const;

/** Situação do certificado da empresa ativa. Também alimenta o ponto da aba. */
export function useFiscalCertificate(companyId?: string | null) {
  return useQuery({
    queryKey: fiscalCertKey(companyId),
    queryFn: () => fiscalCertificateApi.get(companyId as string),
    enabled: !!companyId,
    staleTime: 30_000,
    retry: false,
  });
}

type Props = {
  companyId: string;
  /** Leva para a aba "Emitir NFC-e" (botão do estado de sucesso). */
  onEmitir?: () => void;
};

const TOM: Record<"valido" | "vencendo" | "vencido" | "novo", { cor: string; fundo: string; borda: string; icone: string; titulo: string }> = {
  valido:   { cor: Colors.green, fundo: Colors.greenD, borda: Colors.green + "80", icone: "shield",      titulo: "Certificado válido" },
  vencendo: { cor: Colors.amber, fundo: Colors.amberD, borda: Colors.amber + "8C", icone: "alert",       titulo: "Vence em breve" },
  vencido:  { cor: Colors.red,   fundo: Colors.redD,   borda: Colors.red + "8C",   icone: "x_circle",    titulo: "Certificado vencido" },
  novo:     { cor: Colors.green, fundo: Colors.greenD, borda: Colors.green + "80", icone: "shield",      titulo: "Certificado cadastrado" },
};

const NOTA: Record<"valido" | "vencendo" | "vencido" | "novo", string> = {
  valido: "Tudo certo. Sua empresa pode emitir notas normalmente.",
  vencendo: "Renove antes de vencer. Se o certificado vencer, a emissão de notas fica bloqueada até você enviar o novo.",
  vencido: "Enquanto não enviar um certificado novo, sua empresa não consegue emitir notas fiscais.",
  novo: "",
};

type Empresa = { nome: string; cnpj: string };

function CartaoCertificado({
  tom, cert, empresa, acoes,
}: { tom: keyof typeof TOM; cert: Pick<CertInfo, "subject_cn" | "not_before" | "not_after" | "days_left">; empresa: Empresa; acoes?: React.ReactNode }) {
  const t = TOM[tom];
  const prazo = textoDoPrazo(cert.days_left);
  const nota = NOTA[tom];
  return (
    <View style={[c.cert, { borderColor: t.borda, backgroundColor: t.fundo }]} testID={"cert-a1-cartao-" + tom}>
      <View style={c.certTop}>
        <View style={c.certHead}>
          <View style={[c.certIco, { backgroundColor: t.cor + "29" }]}>
            <Icon name={t.icone} size={22} color={t.cor} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[c.status, { color: t.cor }]}>{t.titulo.toUpperCase()}</Text>
            <Text style={c.certNome} numberOfLines={2}>{empresa.nome}</Text>
            {!!empresa.cnpj && <Text style={c.certCnpj}>CNPJ {empresa.cnpj}</Text>}
          </View>
        </View>
        {!!acoes && <View style={c.certActions}>{acoes}</View>}
      </View>
      <View style={c.meta}>
        <View style={c.metaI}>
          <Text style={c.metaL}>Titular</Text>
          <Text style={c.metaV} numberOfLines={2}>{titularLegivel(cert.subject_cn)}</Text>
        </View>
        <View style={c.metaI}>
          <Text style={c.metaL}>Validade</Text>
          <Text style={c.metaV}>{periodoDeValidade(cert) || "—"}</Text>
        </View>
        {!!prazo && (
          <View style={c.metaI}>
            <Text style={c.metaL}>Prazo</Text>
            <View style={[c.pill, { backgroundColor: t.cor + "29" }]}>
              <Text style={[c.pillText, { color: t.cor }]}>{prazo}</Text>
            </View>
          </View>
        )}
      </View>
      {!!nota && <Text style={c.nota}>{nota}</Text>}
    </View>
  );
}

function SoODono() {
  return (
    <View style={c.card} testID="cert-a1-so-dono">
      <View style={c.who}>
        <Icon name="user" size={20} color={Colors.ink3} />
        <View style={{ flex: 1 }}>
          <Text style={c.cardTitle}>Só o dono da empresa cadastra o certificado</Text>
          <Text style={c.cardSub}>
            Peça ao dono para abrir esta aba e enviar o certificado, ou para chamar a Aura. Você pode acompanhar a situação aqui.
          </Text>
        </View>
      </View>
    </View>
  );
}

function Faixa({ tom, titulo, texto, icone, testID }: { tom: "amber" | "green" | "red"; titulo: string; texto: string; icone: string; testID?: string }) {
  const cor = tom === "amber" ? Colors.amber : tom === "green" ? Colors.green : Colors.red;
  const fundo = tom === "amber" ? Colors.amberD : tom === "green" ? Colors.greenD : Colors.redD;
  return (
    <View style={[c.banner, { backgroundColor: fundo, borderColor: cor + "66" }]} testID={testID}>
      <Icon name={icone} size={20} color={cor} />
      <View style={{ flex: 1 }}>
        <Text style={c.bannerT}>{titulo}</Text>
        <Text style={c.bannerP}>{texto}</Text>
      </View>
    </View>
  );
}

export function TabCertificado({ companyId, onEmitir }: Props) {
  const qc = useQueryClient();
  const { company, availableCompanies, switchCompany } = useAuthStore();
  const { data, isLoading, isError, error, refetch, isFetching } = useFiscalCertificate(companyId);
  const [formAberto, setFormAberto] = useState(false);
  const [sucesso, setSucesso] = useState<FiscalCertificateUploadResult | null>(null);
  const [seletorAberto, setSeletorAberto] = useState(false);

  const empresa: Empresa = {
    nome: company?.name || "Sua empresa",
    cnpj: formatarCnpj(data?.empresa_cnpj || (company as any)?.cnpj || ""),
  };
  const maisDeUma = (availableCompanies || []).length > 1;

  function aoEnviar(r: FiscalCertificateUploadResult) {
    setSucesso(r);
    setFormAberto(false);
    qc.invalidateQueries({ queryKey: fiscalCertKey(companyId) });
  }

  function trocarEmpresa(id: string) {
    setSeletorAberto(false);
    if (Platform.OS === "web" && typeof window !== "undefined") {
      try {
        const path = window.location.pathname + window.location.search;
        if (path && path !== "/") window.sessionStorage.setItem("aura_post_switch_redirect", path);
      } catch {}
    }
    switchCompany(id).catch(() => {});
  }

  const cabecalho = (
    <View style={c.empresaRow}>
      <View style={c.empresaChip}>
        <Icon name="store" size={14} color={Colors.ink3} />
        <Text style={c.empresaText} numberOfLines={1}>
          Empresa ativa: <Text style={c.empresaB}>{empresa.nome}</Text>
          {empresa.cnpj ? "  ·  " + empresa.cnpj : ""}
        </Text>
        {maisDeUma && (
          <Pressable
            onPress={() => setSeletorAberto(true)}
            accessibilityRole="button"
            accessibilityLabel="Trocar empresa"
            style={c.trocar}
            testID="cert-a1-trocar-empresa"
          >
            <Text style={c.trocarText}>Trocar empresa</Text>
            <Icon name="chevron_down" size={14} color={Colors.violet3} />
          </Pressable>
        )}
      </View>
      {maisDeUma && (
        <Text style={c.help}>Cada empresa tem o seu próprio certificado. O que você vê abaixo vale só para a empresa ativa.</Text>
      )}
      {maisDeUma && (
        <CompanyPickerModal
          visible={seletorAberto}
          context="nfe"
          actionLabel="ver o certificado digital"
          onPick={trocarEmpresa}
          onCancel={() => setSeletorAberto(false)}
        />
      )}
    </View>
  );

  // ── carregando ──
  if (isLoading) {
    return (
      <View testID="cert-a1-tab">
        {cabecalho}
        <View style={c.loading} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={Colors.violet3} />
          <Text style={c.help}>Carregando a situação do certificado…</Text>
        </View>
      </View>
    );
  }

  // ── falha ao carregar (backend fora do ar, sem rede, rota ainda não implantada) ──
  if (isError || !data) {
    return (
      <View testID="cert-a1-tab">
        {cabecalho}
        <View style={c.card} testID="cert-a1-erro-carregar" accessibilityRole="alert">
          <View style={c.who}>
            <Icon name="alert" size={20} color={Colors.amber} />
            <View style={{ flex: 1 }}>
              <Text style={c.cardTitle}>Não deu para ver o certificado agora</Text>
              <Text style={c.cardSub}>{textoErroDeCarregamento(error as any)}</Text>
              <View style={c.rowA}>
                <Pressable
                  onPress={() => refetch()}
                  disabled={isFetching}
                  accessibilityRole="button"
                  style={[c.btnSec, isFetching && { opacity: 0.6 }]}
                  testID="cert-a1-tentar-de-novo"
                >
                  <Text style={c.btnSecText}>{isFetching ? "Tentando…" : "Tentar de novo"}</Text>
                </Pressable>
                <BotaoAjudaWhatsApp empresa={empresa} tipo="cadastrar" rotulo="Chamar a Aura" />
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  }

  const cert = data.cert;
  const podeEnviar = !!data.pode_enviar;
  const estado: EstadoCertificado = estadoDoCertificado(cert);

  // ── logo depois de enviar ──
  if (sucesso) {
    return (
      <View testID="cert-a1-tab">
        {cabecalho}
        <Faixa
          tom="green" icone="check_circle" testID="cert-a1-sucesso"
          titulo="Certificado cadastrado com sucesso"
          texto="Pronto! Sua empresa já pode emitir notas fiscais. A senha não ficou salva."
        />
        <CartaoCertificado tom="novo" cert={sucesso} empresa={empresa} />
        <View style={c.rowA}>
          {!!onEmitir && (
            <Pressable onPress={onEmitir} accessibilityRole="button" style={c.btnPri} testID="cert-a1-emitir">
              <Text style={c.btnPriText}>Emitir uma nota agora</Text>
            </Pressable>
          )}
          <Pressable onPress={() => setSucesso(null)} accessibilityRole="button" style={c.btnGhost} testID="cert-a1-ver">
            <Text style={c.btnGhostText}>Ver certificado</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── sem certificado ──
  if (estado === "sem") {
    return (
      <View testID="cert-a1-tab">
        {cabecalho}
        <Faixa
          tom="amber" icone="alert"
          titulo="Nenhum certificado cadastrado"
          texto="Sem o certificado digital A1, a emissão de notas fiscais fica bloqueada. Cadastre agora para liberar."
        />
        {podeEnviar ? (
          <View style={c.duas}>
            <CertificadoForm companyId={companyId} empresa={empresa} modo="novo" onEnviado={aoEnviar} />
            <CertificadoAjuda empresa={empresa} tipo="cadastrar" />
          </View>
        ) : (
          <SoODono />
        )}
      </View>
    );
  }

  // ── com certificado: válido, vencendo ou vencido ──
  const vencido = estado === "vencido";
  const mostrarForm = podeEnviar && (formAberto || vencido);
  const tipoAjuda = estado === "valido" ? "cadastrar" : "renovar";

  let acoes: React.ReactNode = null;
  if (podeEnviar) {
    if (estado === "valido") {
      acoes = (
        <Pressable onPress={() => setFormAberto(true)} accessibilityRole="button" style={c.btnSec} testID="cert-a1-trocar">
          <Text style={c.btnSecText}>Trocar certificado</Text>
        </Pressable>
      );
    } else if (estado === "vencendo") {
      acoes = (
        <>
          <Pressable onPress={() => setFormAberto(true)} accessibilityRole="button" style={c.btnPri} testID="cert-a1-enviar-renovado">
            <Text style={c.btnPriText}>Enviar o certificado renovado</Text>
          </Pressable>
          <BotaoAjudaWhatsApp empresa={empresa} tipo="renovar" rotulo="Quero ajuda para renovar" />
        </>
      );
    } else {
      acoes = <BotaoAjudaWhatsApp empresa={empresa} tipo="renovar" rotulo="Quero ajuda para renovar" />;
    }
  }

  return (
    <View testID="cert-a1-tab">
      {cabecalho}
      <CartaoCertificado tom={estado} cert={cert as CertInfo} empresa={empresa} acoes={acoes} />
      {mostrarForm && (
        <View style={c.duas}>
          <CertificadoForm
            companyId={companyId}
            empresa={empresa}
            modo={vencido ? "renovar" : "troca"}
            podeCancelar={!vencido}
            onCancelar={() => setFormAberto(false)}
            onEnviado={aoEnviar}
          />
          <CertificadoAjuda
            empresa={empresa}
            tipo={tipoAjuda}
            titulo={estado === "valido" ? "Prefere ajuda da Aura?" : "Quero ajuda para renovar"}
          />
        </View>
      )}
      {!podeEnviar && <SoODono />}
    </View>
  );
}

const c = StyleSheet.create({
  empresaRow: { marginBottom: 14, gap: 6 },
  empresaChip: {
    flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", maxWidth: "100%",
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6, flexWrap: "wrap",
  },
  empresaText: { fontSize: 12, color: Colors.ink3, flexShrink: 1 },
  empresaB: { color: Colors.ink, fontWeight: "600" },
  trocar: { flexDirection: "row", alignItems: "center", gap: 3, minHeight: 32, paddingHorizontal: 4 },
  trocarText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  help: { fontSize: 12, color: Colors.ink3 },
  loading: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 24 },

  banner: { flexDirection: "row", gap: 12, alignItems: "flex-start", borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 16 },
  bannerT: { fontSize: 14, fontWeight: "700", color: Colors.ink, marginBottom: 1 },
  bannerP: { fontSize: 13, color: Colors.ink3, lineHeight: 19 },

  duas: { flexDirection: IS_WIDE ? "row" : "column", gap: 16, alignItems: "stretch" },
  card: { backgroundColor: Colors.bg3, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 18 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: Colors.ink, marginBottom: 2 },
  cardSub: { fontSize: 13, color: Colors.ink3, lineHeight: 19 },
  who: { flexDirection: "row", gap: 12, alignItems: "flex-start" },

  cert: { borderWidth: 1, borderRadius: 14, padding: 18, marginBottom: 16 },
  certTop: { flexDirection: IS_WIDE ? "row" : "column", gap: 16, justifyContent: "space-between", alignItems: IS_WIDE ? "flex-start" : "stretch" },
  certHead: { flexDirection: "row", gap: 12, alignItems: "flex-start", flex: 1, minWidth: 0 },
  certIco: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  status: { fontSize: 12, fontWeight: "700", letterSpacing: 0.7 },
  certNome: { fontSize: 17, fontWeight: "700", color: Colors.ink, marginTop: 2 },
  certCnpj: { fontSize: 13, color: Colors.ink3 },
  certActions: { gap: 8, alignItems: IS_WIDE ? "flex-end" : "stretch" },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: 12, columnGap: 24, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.border },
  metaI: { gap: 2, flexShrink: 1 },
  metaL: { fontSize: 12, color: Colors.ink3 },
  metaV: { fontSize: 14, fontWeight: "600", color: Colors.ink },
  pill: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  pillText: { fontSize: 13, fontWeight: "700" },
  nota: { marginTop: 14, fontSize: 13, color: Colors.ink3, lineHeight: 19 },

  rowA: { flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center", marginTop: 14 },
  btnPri: {
    minHeight: 44, paddingHorizontal: 18, borderRadius: 10, backgroundColor: Colors.violet,
    alignItems: "center", justifyContent: "center",
  },
  btnPriText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  btnSec: {
    minHeight: 44, paddingHorizontal: 18, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2,
    alignItems: "center", justifyContent: "center",
  },
  btnSecText: { fontSize: 14, fontWeight: "600", color: Colors.ink },
  btnGhost: { minHeight: 44, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  btnGhostText: { fontSize: 14, fontWeight: "600", color: Colors.ink3 },
});
