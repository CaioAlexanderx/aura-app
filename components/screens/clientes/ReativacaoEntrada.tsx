// ============================================================
// ReativacaoEntrada — a porta da reativação, com número (Fase 0, I0.2)
//
// O motor de reativação sempre funcionou. A porta é que era muda: um
// card-link "Reativação por WhatsApp →" que não respondia a única
// pergunta capaz de fazer alguém clicar — "tem gente lá dentro?". Um
// lojista de trial que queria ver quem não aparece há 60 ou 90 dias
// olhou para esse card e não clicou.
//
// Agora a porta diz três coisas ANTES do clique:
//   1. quantos clientes estão parados há X dias ou mais;
//   2. quanto esse grupo já gastou na loja (o R$ em jogo);
//   3. qual é o X — em pílulas (30/60/90/120/180) ou digitado.
//
// Três decisões que não são detalhe:
//
// • A conta sai da lista que a tela JÁ carregou (useCustomers). Nenhuma
//   chamada nova, e o multi-CNPJ vem de graça: no consolidado a lista é
//   de todas as lojas, com uma loja selecionada é só dela.
// • A régua é a única (./diasSemComprar). "Parado há 61 dias" significa
//   a mesma coisa aqui, na tag da lista e no motor de reativação.
// • Quem está no Essencial VÊ a contagem. O produto pago é o disparo,
//   não o número — esconder o número é esconder o argumento do upgrade.
//   O botão, aí, leva a /(tabs)/planos.
//
// Nada aqui depende de hover (regra 7 do CLAUDE.md): o estado das
// pílulas é o que informa, e ele é permanente, não revelado no ponteiro.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput } from "react-native";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import type { Customer } from "./types";
import { fmt } from "./types";
import { CORTES_DIAS, CORTE_PADRAO, diasSemComprar } from "./diasSemComprar";

const MAX_DIAS = 999;

export interface ReativacaoEntradaProps {
  /** A lista que a tela já carregou — no consolidado, de todas as lojas. */
  customers: Customer[];
  /** Plano atual. "essencial" = vê o número, mas o botão leva a planos. */
  plan?: string | null;
  /** Enquanto a lista não chegou, o bloco não finge que a base é zero. */
  carregando?: boolean;
  /** Variante do topo do WhatsApp: mesma informação, menos texto. */
  compacto?: boolean;
  /** MULTICNPJ: quantas lojas a contagem está somando (só exibe se > 1). */
  companyCount?: number;
  /** Mantém o testID histórico da porta que este bloco substitui. */
  idBase: string;
}

export function ReativacaoEntrada({
  customers, plan, carregando, compacto, companyCount, idBase,
}: ReativacaoEntradaProps) {
  const [dias, setDias] = useState<number>(CORTE_PADRAO);
  const [livre, setLivre] = useState(false);
  const [livreTxt, setLivreTxt] = useState<string>(String(CORTE_PADRAO));

  // Armadilha 1 do CLAUDE.md: o plano vem do JWT e nunca revalida
  // sozinho. Como o botão daqui muda conforme o plano, o bloco pede o
  // /auth/me no mount. Best-effort: falhar só mantém o que já havia.
  useEffect(() => {
    const st: any = (useAuthStore as any)?.getState?.();
    st?.refreshMe?.();
  }, []);

  const bloqueado = String(plan || "").toLowerCase() === "essencial";

  const { quantos, total } = useMemo(() => {
    const agora = Date.now();
    let quantos = 0;
    let total = 0;
    for (const c of customers || []) {
      const d = diasSemComprar(c?.lastPurchase, agora);
      // Sem data de compra não há "sumiu": quem nunca comprou é outra
      // conversa, e um cupom de "volte" para ele sairia errado.
      if (d == null || d < dias) continue;
      quantos += 1;
      total += Number(c?.totalSpent) || 0;
    }
    return { quantos, total };
  }, [customers, dias]);

  function escolher(valor: number | "outro") {
    if (valor === "outro") {
      setLivre(true);
      const n = parseInt(livreTxt, 10);
      if (Number.isFinite(n) && n > 0) setDias(Math.min(n, MAX_DIAS));
      return;
    }
    setLivre(false);
    setDias(valor);
  }

  function digitar(txt: string) {
    const limpo = txt.replace(/\D/g, "").slice(0, 3);
    setLivreTxt(limpo);
    const n = parseInt(limpo, 10);
    if (Number.isFinite(n) && n > 0) setDias(Math.min(n, MAX_DIAS));
  }

  function abrir() {
    if (bloqueado) { router.push("/(tabs)/planos"); return; }
    router.push(`/clientes/reativacao?dias=${dias}`);
  }

  const lojas = companyCount || 1;

  return (
    <View style={[s.wrap, compacto && s.wrapCompacto]} testID={`${idBase}-bloco`}>
      <View style={s.topo}>
        <Icon name="whatsapp" size={15} color={Colors.violet3} />
        <Text style={s.titulo}>Reativação por WhatsApp</Text>
      </View>

      {!compacto && (
        <Text style={s.sub}>
          {bloqueado
            ? "Você tem gente parada na base. O disparo do cupom faz parte do plano Negócio."
            : "Um cupom com prazo curto para quem parou de comprar. Mensagem de marketing — paga e só para quem autorizou."}
        </Text>
      )}

      {!compacto && <Text style={s.label}>Sem comprar há</Text>}

      <View style={s.chips}>
        {CORTES_DIAS.map((d) => {
          const on = !livre && dias === d;
          return (
            <Pressable
              key={d}
              onPress={() => escolher(d)}
              accessibilityRole="button"
              style={[s.chip, on && s.chipOn]}
              testID={`${idBase}-dias-${d}`}
            >
              <Text style={[s.chipTxt, on && s.chipTxtOn]}>{compacto ? d : `${d} dias`}</Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => escolher("outro")}
          accessibilityRole="button"
          style={[s.chip, livre && s.chipOn]}
          testID={`${idBase}-dias-outro`}
        >
          <Text style={[s.chipTxt, livre && s.chipTxtOn]}>outro</Text>
        </Pressable>
      </View>

      {livre && (
        <View style={s.livreRow}>
          <TextInput
            value={livreTxt}
            onChangeText={digitar}
            keyboardType="number-pad"
            maxLength={3}
            style={s.livreInput}
            testID={`${idBase}-dias-livre`}
          />
          <Text style={s.livreTxt}>dias ou mais</Text>
        </View>
      )}

      <View style={s.numeros} testID={`${idBase}-numeros`}>
        <View style={s.num}>
          <Text style={s.numBig} testID={`${idBase}-contagem`}>
            {carregando ? "—" : String(quantos)}
          </Text>
          <Text style={s.numTxt}>
            {carregando
              ? "somando sua base…"
              : `${quantos === 1 ? "cliente" : "clientes"} sem comprar há ${dias} dias ou mais`}
          </Text>
        </View>
        <View style={[s.num, s.numDir]}>
          <Text style={s.numMoney} testID={`${idBase}-valor`}>
            {carregando ? "—" : fmt(total)}
          </Text>
          <Text style={s.numTxt}>já gastaram na loja</Text>
        </View>
      </View>

      {lojas > 1 && (
        <Text style={s.lojas} testID={`${idBase}-multi-cnpj`}>
          Somando as {lojas} lojas da visão consolidada.
        </Text>
      )}

      <Pressable
        onPress={abrir}
        accessibilityRole="button"
        style={[s.btn, bloqueado && s.btnGhost]}
        testID={idBase}
      >
        <Text style={[s.btnTxt, bloqueado && s.btnTxtGhost]}>
          {bloqueado ? "Conhecer o plano Negócio" : "Ver e mandar cupom"}
        </Text>
      </Pressable>

      {!compacto && (
        <Text style={s.rodape}>
          {bloqueado
            ? "A contagem é sua e continua aqui. O disparo é que depende do plano."
            : "Abre a lista de quem sumiu, ordenada por quanto gastou. Nada sai sem a prévia."}
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.violetD, borderRadius: 16, borderWidth: 1, borderColor: Colors.border2,
    paddingVertical: 15, paddingHorizontal: 14, marginBottom: 12,
  },
  wrapCompacto: { paddingVertical: 13, paddingHorizontal: 13 },
  topo: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
  titulo: { fontSize: 13.5, fontWeight: "800", color: Colors.ink },
  sub: { fontSize: 11.5, color: Colors.ink3, lineHeight: 16.5, marginBottom: 12 },
  label: {
    fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase",
    color: Colors.ink3, marginBottom: 7,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  chip: {
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999,
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border,
  },
  chipOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  chipTxt: { fontSize: 11.5, color: Colors.ink2, fontWeight: "600" },
  chipTxtOn: { color: "#fff" },
  livreRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: -4, marginBottom: 12 },
  livreInput: {
    width: 82, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10,
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border2,
    color: Colors.ink, fontSize: 13, textAlign: "center",
  },
  livreTxt: { fontSize: 11.5, color: Colors.ink3 },
  numeros: {
    flexDirection: "row", gap: 10, backgroundColor: Colors.bg2, borderRadius: 13,
    borderWidth: 1, borderColor: Colors.border, paddingVertical: 12, paddingHorizontal: 13,
    marginBottom: 12,
  },
  num: { flex: 1, minWidth: 0 },
  numDir: { borderLeftWidth: 1, borderLeftColor: Colors.border, paddingLeft: 12 },
  numBig: { fontSize: 26, lineHeight: 28, fontWeight: "700", color: Colors.ink },
  numMoney: { fontSize: 20, lineHeight: 28, fontWeight: "700", color: Colors.green },
  numTxt: { fontSize: 10.5, color: Colors.ink3, marginTop: 4, lineHeight: 14.5 },
  lojas: { fontSize: 10.5, color: Colors.violet3, fontWeight: "600", marginBottom: 10 },
  btn: {
    backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 11,
    alignItems: "center", justifyContent: "center",
  },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: Colors.border2 },
  btnTxt: { fontSize: 12.5, fontWeight: "700", color: "#fff" },
  btnTxtGhost: { color: Colors.violet3 },
  rodape: { fontSize: 10.5, color: Colors.ink3, lineHeight: 15, marginTop: 9, paddingHorizontal: 2 },
});
