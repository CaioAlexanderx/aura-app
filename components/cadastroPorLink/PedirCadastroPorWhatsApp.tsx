// ============================================================
// components/cadastroPorLink/PedirCadastroPorWhatsApp.tsx  (p-211, 23/11/2026)
//
// Lado do lojista do cadastro por link: o botão "Pedir cadastro por
// WhatsApp", o estado do link (enviado · recebido · vencido) e o que o
// cliente mandou DIFERENTE do cadastro, com Aceitar / Manter por campo.
// Mockup aprovado: otica-pacote/mockup-cadastro-link.html, seção 5.
// Aparece na ficha do cliente, no Caixa (cliente da venda) e na nova OS
// de ótica.
//
// SÓ APARECE QUANDO (as três coisas):
//   1. a ótica está ligada nesta loja (primeira entrega; estender a outras
//      frentes é decisão do Caio);
//   2. o aviso de privacidade do Caio já está no app (avisoPronto): sem
//      ele o cliente não consegue enviar, então o link não sai;
//   3. o servidor tem a rota (GET devolve available: true).
// Fora disso, nada é desenhado: a ficha e o Caixa ficam como eram.
//
// ENVIO MANUAL: o toque abre o WhatsApp do lojista com a mensagem pronta;
// nada é enviado pela Aura. A mensagem leva só o nome da loja e o link.
// No web, a aba precisa abrir no MESMO tick do clique (utils/whatsapp.ts),
// mas o link só existe depois da resposta do servidor: abrimos uma aba em
// branco no toque e só então apontamos para o wa.me. Se o navegador
// bloquear, sobra um botão "Abrir WhatsApp" com o link já pronto.
//
// MULTI-CNPJ: o link nasce na loja ATUAL da sessão (é o nome e o logo dela
// que a página mostra). O cliente é do dono: qualquer loja dele vê o
// estado e resolve as diferenças.
// ============================================================
import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { nomeDaLojaDe } from "@/utils/nomeDaLoja";
import { buildWhatsAppUrl, openWhatsApp } from "@/utils/whatsapp";
import { cadastroLinkApi } from "@/services/cadastroLinkApi";
import {
  avisoPronto, mensagemDoLink, rotuloDoEstado, urlDoLink, valorDaPendencia,
  AVISO_DE_PRIVACIDADE, type Pendencia,
} from "@/utils/cadastroPorLink";

type Props = {
  customerId: string | null | undefined;
  phone: string | null | undefined;
  /** Para teste: o texto do aviso (padrão: o do app). */
  aviso?: string | null;
  testID?: string;
};

export const chaveDoEstado = (companyId: string | undefined, customerId: string | null | undefined) =>
  ["cadastro-link", companyId, customerId] as const;

export function PedirCadastroPorWhatsApp({ customerId, phone, aviso = AVISO_DE_PRIVACIDADE, testID = "cadastro-link" }: Props) {
  const { company } = useAuthStore();
  const { settings } = usePdvSettings();
  const qc = useQueryClient();
  const companyId = company?.id;
  const ligado = settings.otica_enabled === true && avisoPronto(aviso) && !!customerId && !!companyId;

  const { data } = useQuery({
    queryKey: chaveDoEstado(companyId, customerId),
    queryFn: () => cadastroLinkApi.estado(companyId!, customerId!),
    enabled: ligado,
    staleTime: 30_000,
    retry: 0,
  });

  const [gerando, setGerando] = useState(false);
  const [linkPronto, setLinkPronto] = useState<string | null>(null);
  const [resolvendo, setResolvendo] = useState<string | null>(null);

  if (!ligado || !data || !data.available) return null;

  const temTelefone = !!buildWhatsAppUrl(phone);
  const estado = rotuloDoEstado(data.link?.status, data.link?.status === "recebido" ? data.link?.used_at : null);

  function pedir() {
    if (gerando || !companyId || !customerId) return;
    if (!temTelefone) { toast.error("O cliente não tem um telefone válido para o WhatsApp"); return; }
    // No mesmo tick do toque: a aba em branco que vai virar o wa.me.
    let janela: Window | null = null;
    if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.open === "function") {
      janela = window.open("", "_blank");
      try { if (janela) janela.opener = null; } catch { /* navegador sem acesso */ }
    }
    setGerando(true);
    setLinkPronto(null);
    cadastroLinkApi.criar(companyId, { customer_id: customerId })
      .then((r) => {
        const texto = mensagemDoLink(nomeDaLojaDe(company as any) || "", urlDoLink(r.path));
        const wa = buildWhatsAppUrl(phone, texto);
        if (janela && wa) {
          janela.location.href = wa;
        } else if (Platform.OS !== "web") {
          openWhatsApp(phone, texto);
        } else {
          // Pop-up bloqueado: o próximo toque abre direto (síncrono).
          setLinkPronto(texto);
        }
        qc.invalidateQueries({ queryKey: ["cadastro-link"] });
        if (r.customer_created) qc.invalidateQueries({ queryKey: ["customers"] });
      })
      .catch((e: any) => {
        try { janela?.close(); } catch { /* já fechada */ }
        toast.error(e?.data?.error || "Não deu para gerar o link agora");
      })
      .finally(() => setGerando(false));
  }

  async function resolver(p: Pendencia, aceitar: boolean) {
    if (!companyId || !data?.pending_link_id || resolvendo) return;
    setResolvendo(p.field);
    try {
      await cadastroLinkApi.resolver(companyId, data.pending_link_id, aceitar ? { accept: [p.field], keep: [] } : { accept: [], keep: [p.field] });
      qc.invalidateQueries({ queryKey: ["cadastro-link"] });
      if (aceitar) qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success(aceitar ? `${p.label} atualizado no cadastro` : `${p.label} mantido como estava`);
    } catch (e: any) {
      if (e?.status === 409) qc.invalidateQueries({ queryKey: ["cadastro-link"] });
      toast.error(e?.data?.error || "Não deu para salvar agora");
    } finally {
      setResolvendo(null);
    }
  }

  const corDoEstado = data.link?.status === "recebido" ? Colors.green : data.link?.status === "vencido" ? Colors.ink3 : Colors.violet3;

  return (
    <View style={s.caixa} testID={testID}>
      <View style={s.linha}>
        <Pressable
          onPress={pedir}
          disabled={gerando || !temTelefone}
          style={[s.botao, (gerando || !temTelefone) && s.botaoDesligado]}
          testID={`${testID}-pedir`}
        >
          {gerando ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.botaoTexto}>Pedir cadastro por WhatsApp</Text>}
        </Pressable>
        {!temTelefone && <Text style={s.dica}>sem telefone</Text>}
        {!!estado && <Text style={[s.estado, { color: corDoEstado }]} testID={`${testID}-estado`}>{estado}</Text>}
      </View>

      {linkPronto && (
        <Pressable
          onPress={() => { openWhatsApp(phone, linkPronto); setLinkPronto(null); }}
          style={[s.botao, s.botaoSecundario]}
          testID={`${testID}-abrir`}
        >
          <Text style={[s.botaoTexto, { color: Colors.violet3 }]}>Abrir WhatsApp</Text>
        </Pressable>
      )}

      {data.pending.length > 0 && (
        <View style={s.pendencias} testID={`${testID}-pendencias`}>
          <Text style={s.pendTitulo}>O cliente enviou dados diferentes</Text>
          {data.pending.map((p) => (
            <View key={p.field} style={s.pend} testID={`${testID}-pend-${p.field}`}>
              <Text style={s.pendCampo}>{p.label}</Text>
              <Text style={s.pendValor}>No cadastro: {valorDaPendencia(p.field, p.current)}</Text>
              <Text style={s.pendValor}>O cliente enviou: <Text style={{ fontWeight: "700", color: Colors.ink }}>{valorDaPendencia(p.field, p.received)}</Text></Text>
              <View style={s.pendAcoes}>
                <Pressable onPress={() => resolver(p, true)} disabled={!!resolvendo} style={[s.mini, s.miniPrimario]} testID={`${testID}-aceitar-${p.field}`}>
                  <Text style={[s.miniTexto, { color: "#fff" }]}>Aceitar</Text>
                </Pressable>
                <Pressable onPress={() => resolver(p, false)} disabled={!!resolvendo} style={s.mini} testID={`${testID}-manter-${p.field}`}>
                  <Text style={s.miniTexto}>Manter</Text>
                </Pressable>
                {resolvendo === p.field && <ActivityIndicator size="small" color={Colors.violet3} />}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  caixa: { marginTop: 10, gap: 8 },
  linha: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  botao: { backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, minHeight: 40, alignItems: "center", justifyContent: "center" },
  botaoDesligado: { opacity: 0.5 },
  botaoSecundario: { backgroundColor: "transparent", borderWidth: 1, borderColor: Colors.violet3, alignSelf: "flex-start" },
  botaoTexto: { color: "#fff", fontSize: 13, fontWeight: "700" },
  dica: { fontSize: 11, color: Colors.ink3 },
  estado: { fontSize: 12, fontWeight: "700" },
  pendencias: { borderWidth: 1, borderColor: Colors.amber + "55", backgroundColor: Colors.amberD, borderRadius: 10, padding: 10, gap: 10 },
  pendTitulo: { fontSize: 12, fontWeight: "800", color: Colors.amber },
  pend: { gap: 2 },
  pendCampo: { fontSize: 12, fontWeight: "700", color: Colors.ink },
  pendValor: { fontSize: 12, color: Colors.ink2 },
  pendAcoes: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 4 },
  mini: { borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg4, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  miniPrimario: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  miniTexto: { fontSize: 12, fontWeight: "700", color: Colors.ink },
});
