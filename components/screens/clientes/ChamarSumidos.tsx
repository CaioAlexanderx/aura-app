// ============================================================
// ChamarSumidos — a Reativação sem a Meta: um toque por cliente (t3-06)
//
// Tela da Reativação para quem NÃO conecta o número da Meta (Essencial).
// Lista quem sumiu, do que mais gastou para o que menos, e cada linha tem
// "Chamar": abre o WhatsApp da própria loja com a mensagem pronta (wa.me).
// Grátis, sem espera, sem aprovação de template.
//
// Premissa do Caio (16/09): no Essencial o que o plano não tem SOME. Aqui
// não existe botão desabilitado, contagem-isca nem cartão de upgrade: o
// disparo em massa pela API simplesmente não é desenhado nesta tela.
//
// A conta sai da lista que o app já carrega (useCustomers): multi-CNPJ vem
// de graça (no consolidado soma as lojas). Nada de hover (regra 7).
// ============================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { ScreenHero } from "@/components/ScreenHero";
import { useAuthStore } from "@/stores/auth";
import { useCustomers } from "@/hooks/useCustomers";
import { openWhatsApp } from "@/utils/whatsapp";
import { fmt } from "./types";
import { CORTES_DIAS, CORTE_PADRAO } from "./diasSemComprar";
import {
  criarMarcasDeChamado, diaMesBR, listarSumidos, mensagemDeChamado,
} from "@/utils/chamarSumidos";

const POR_PAGINA = 30;

export function ChamarSumidos() {
  const company = useAuthStore((s) => s.company);
  const companyId = company?.id || "";
  const { customers, isLoading, isError, refetch } = useCustomers();

  // O corte escolhido na entrada (?dias=90) chega aqui.
  const params = useLocalSearchParams<{ dias?: string | string[] }>();
  const diasParam = useMemo(() => {
    const bruto = Array.isArray(params?.dias) ? params.dias[0] : params?.dias;
    const n = parseInt(String(bruto ?? ""), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [params?.dias]);

  const [corte, setCorte] = useState<number>(diasParam ?? CORTE_PADRAO);
  const [visiveis, setVisiveis] = useState(POR_PAGINA);

  const marcas = useMemo(() => criarMarcasDeChamado(companyId), [companyId]);
  const [chamados, setChamados] = useState<Record<string, number>>({});
  useEffect(() => { setChamados(marcas.ler()); }, [marcas]);

  // Armadilha 1 do CLAUDE.md: revalida o plano no mount.
  useEffect(() => {
    const st: any = (useAuthStore as any)?.getState?.();
    st?.refreshMe?.();
  }, []);

  const sumidos = useMemo(() => listarSumidos(customers as any, corte), [customers, corte]);
  const total = useMemo(() => sumidos.reduce((s, c) => s + c.gasto, 0), [sumidos]);

  const chamar = useCallback((id: string, nome: string, telefone: string | null) => {
    // Síncrono dentro do toque: o navegador bloqueia o pop-up depois de um await.
    const ok = openWhatsApp(telefone, mensagemDeChamado(nome, company?.name));
    if (ok) setChamados(marcas.marcar(id));
  }, [company?.name, marcas]);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} testID="reativacao-essencial">
      <View style={s.headerRow}>
        <Pressable onPress={() => router.push("/(tabs)/clientes")} style={s.backBtn} testID="reativacao-voltar">
          <Icon name="chevron_left" size={16} color={Colors.violet3} />
          <Text style={s.backText}>Clientes</Text>
        </Pressable>
      </View>

      <ScreenHero
        eyebrow="Base de clientes · Reativação"
        title="Chamar quem sumiu"
        subtitle="Quem não compra há um tempo, de quem mais gastou para quem menos. Toque em Chamar: o WhatsApp abre no seu número com a mensagem pronta, e você envia."
      />

      <Text style={s.label}>Sem comprar há</Text>
      <View style={s.chips}>
        {CORTES_DIAS.map((d) => {
          const on = corte === d;
          return (
            <Pressable
              key={d}
              onPress={() => { setCorte(d); setVisiveis(POR_PAGINA); }}
              accessibilityRole="button"
              style={[s.chip, on && s.chipOn]}
              testID={`reativacao-corte-${d}`}
            >
              <Text style={[s.chipTxt, on && s.chipTxtOn]}>{d} dias</Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading && <View style={s.centro}><ActivityIndicator color={Colors.violet3} /></View>}

      {!isLoading && isError && (
        <View style={s.centro}>
          <Text style={s.erro}>Não foi possível carregar seus clientes.</Text>
          <Pressable onPress={() => refetch()} accessibilityRole="button">
            <Text style={s.retry}>Tentar de novo</Text>
          </Pressable>
        </View>
      )}

      {!isLoading && !isError && (
        <>
          <View style={s.numeros} testID="reativacao-essencial-numeros">
            <View style={s.num}>
              <Text style={s.numBig} testID="reativacao-essencial-contagem">{String(sumidos.length)}</Text>
              <Text style={s.numTxt}>
                {sumidos.length === 1 ? "cliente" : "clientes"} sem comprar há {corte} dias ou mais
              </Text>
            </View>
            <View style={[s.num, s.numDir]}>
              <Text style={s.numMoney}>{fmt(total)}</Text>
              <Text style={s.numTxt}>já gastaram na loja</Text>
            </View>
          </View>

          {sumidos.length === 0 && (
            <Text style={s.vazio} testID="reativacao-essencial-vazio">
              Ninguém sumido nesse prazo agora, o que é uma boa notícia.
            </Text>
          )}

          <View style={s.lista} testID="reativacao-essencial-lista">
            {sumidos.slice(0, visiveis).map((c) => {
              const quando = chamados[c.id];
              return (
                <View key={c.id} style={s.linha} testID={`reativacao-essencial-cliente-${c.id}`}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.nome} numberOfLines={1}>{c.nome}</Text>
                    <Text style={s.meta} numberOfLines={1}>
                      há {c.dias} dias sem comprar · {fmt(c.gasto)}
                    </Text>
                    {!!quando && (
                      <Text style={s.chamado} testID={`reativacao-essencial-chamado-${c.id}`}>
                        chamado em {diaMesBR(quando)}
                      </Text>
                    )}
                  </View>
                  {c.telefone ? (
                    <Pressable
                      onPress={() => chamar(c.id, c.nome, c.telefone)}
                      accessibilityRole="button"
                      accessibilityLabel={`Chamar ${c.nome} no WhatsApp`}
                      style={[s.chamar, Platform.OS === "web" && ({ cursor: "pointer" } as any)]}
                      testID={`reativacao-essencial-chamar-${c.id}`}
                    >
                      <Icon name="whatsapp" size={14} color="#fff" />
                      <Text style={s.chamarTxt}>{quando ? "Chamar de novo" : "Chamar"}</Text>
                    </Pressable>
                  ) : (
                    <Text style={s.semTel}>sem telefone</Text>
                  )}
                </View>
              );
            })}
          </View>

          {sumidos.length > visiveis && (
            <Pressable
              onPress={() => setVisiveis((v) => v + POR_PAGINA)}
              accessibilityRole="button"
              style={s.mais}
              testID="reativacao-essencial-mais"
            >
              <Text style={s.maisTxt}>Mostrar mais {Math.min(POR_PAGINA, sumidos.length - visiveis)}</Text>
            </Pressable>
          )}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 56, maxWidth: 720, alignSelf: "center", width: "100%" },
  headerRow: { marginBottom: 4 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  backText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  label: {
    fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase",
    color: Colors.ink3, marginTop: 16, marginBottom: 8,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, minHeight: 40,
    borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2, justifyContent: "center",
  },
  chipOn: { backgroundColor: Colors.violet, borderColor: Colors.violet2 },
  chipTxt: { fontSize: 13, fontWeight: "700", color: Colors.ink2 },
  chipTxtOn: { color: "#fff" },
  centro: { paddingVertical: 28, alignItems: "center", gap: 8 },
  erro: { fontSize: 12.5, color: Colors.red },
  retry: { fontSize: 12.5, fontWeight: "700", color: Colors.violet3 },
  numeros: {
    flexDirection: "row", gap: 10, backgroundColor: Colors.bg2, borderRadius: 13,
    borderWidth: 1, borderColor: Colors.border, paddingVertical: 12, paddingHorizontal: 13,
    marginTop: 16,
  },
  num: { flex: 1, minWidth: 0 },
  numDir: { borderLeftWidth: 1, borderLeftColor: Colors.border, paddingLeft: 12 },
  numBig: { fontSize: 26, lineHeight: 28, fontWeight: "700", color: Colors.ink },
  numMoney: { fontSize: 20, lineHeight: 28, fontWeight: "700", color: Colors.green },
  numTxt: { fontSize: 10.5, color: Colors.ink3, marginTop: 4, lineHeight: 14.5 },
  vazio: { fontSize: 12.5, color: Colors.ink3, marginTop: 16, lineHeight: 18 },
  lista: { gap: 7, marginTop: 14 },
  linha: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.bg3,
    borderRadius: 11, borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 10, paddingHorizontal: 12, minHeight: 56,
  },
  nome: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  meta: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  chamado: { fontSize: 10.5, color: Colors.violet3, fontWeight: "700", marginTop: 3 },
  chamar: {
    flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violet,
    borderRadius: 10, paddingHorizontal: 12, minHeight: 40, justifyContent: "center",
  },
  chamarTxt: { fontSize: 12.5, fontWeight: "700", color: "#fff" },
  semTel: { fontSize: 11, color: Colors.ink3 },
  mais: {
    marginTop: 12, alignSelf: "center", paddingHorizontal: 16, minHeight: 40, justifyContent: "center",
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border2,
  },
  maisTxt: { fontSize: 12.5, fontWeight: "700", color: Colors.violet3 },
} as any);

export default ChamarSumidos;
