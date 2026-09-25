// ============================================================
// AURA. — components/screens/studio-loja-digital/TabStudioPedidosPelaLoja.tsx
// Aba "Pedidos pela loja" da Loja Digital Studio (Fase 1C, 25/09/2026)
//
// Tela 7 do mockup studio-vitrine-01-alicerce. Aba própria por decisão do
// PO (25/09): mistura duas coisas sem dono comum em "Meu Site" — fechar a
// loja na temporada e medir a venda.
//
// O que a lojista faz aqui:
//   - fecha e abre a loja para pedidos (a vitrine continua inteira; o
//     botão vira "Pedir orçamento") e escreve o recado da cliente;
//   - marca "Aceitar pedidos até" (a loja fecha sozinha depois da data,
//     e a vitrine avisa nos últimos 21 dias);
//   - liga "Retirada por app de entrega" (Uber, 99) no checkout;
//   - cola os IDs do Google Analytics e do Pixel da Meta, validados ao
//     digitar com a mesma régua da vitrine e do servidor.
//
// Identidade do PAINEL Studio (useStudioTokens), não da vitrine — exceto
// a prévia, que É a vitrine e por isso usa a cor da loja e o mesmo
// componente de faixa que a cliente vê (FaixaDaTemporada).
//
// Plano: a Loja Digital não tem gate de plano no app (o backend exige
// negocio/expansao em /digital-channel), então não há plano para
// revalidar no mount. Multi-CNPJ: a configuração é da loja da empresa
// ativa; na visão consolidada não há loja, e a aba diz isso.
// ============================================================
import { createElement, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, Platform,
  ActivityIndicator, useWindowDimensions,
} from "react-native";
import { Icon } from "@/components/Icon";
import type { StudioPalette } from "@/constants/studio-tokens";
import { useStudioTokens, useStudioTheme } from "@/contexts/StudioThemeMode";
import { useAuthStore } from "@/stores/auth";
import { TemaDaVitrine, usePaletaDaVitrine, useTemaDaVitrine } from "@/components/studio/storefront/TemaDaVitrine";
import { FaixaDaTemporada } from "@/components/studio/storefront/FaixaDaTemporada";
import { Texto } from "@/components/studio/storefront/TipografiaVitrine";
import {
  RECADO_MAX, RECADO_PADRAO,
  formDaConfig, corpoDoSalvar, mesmoForm, validarGa4, validarPixel,
  problemaDoForm, previaNaVitrine,
  type FormPedidosPelaLoja, type PreviaNaVitrine, type Validacao,
} from "./pedidosPelaLoja";

type Props = {
  config: any;
  saveConfig: (body: any) => Promise<any>;
  isSaving: boolean;
};

export function TabStudioPedidosPelaLoja({ config, saveConfig, isSaving }: Props) {
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);
  const { width } = useWindowDimensions();
  const largo = width >= 1024;
  const { company, consolidatedView } = useAuthStore();

  const [form, setForm] = useState<FormPedidosPelaLoja>(() => formDaConfig(config));
  // O que está salvo — a referência para "tem alteração?". Quando a
  // config chega de novo (salvou, ou trocou de empresa), o formulário só
  // é substituído se a lojista não estiver no meio de uma edição.
  const salvo = useRef<FormPedidosPelaLoja>(formDaConfig(config));
  // A chave é o CONTEÚDO, não o objeto: o hook devolve `config || {}`, um
  // objeto novo a cada render enquanto não há dado — depender dele faria
  // o efeito rodar em laço.
  const chaveDaConfig = JSON.stringify(corpoDoSalvar(formDaConfig(config)));
  useEffect(() => {
    const novo = formDaConfig(config);
    setForm((atual) => (mesmoForm(atual, salvo.current) ? novo : atual));
    salvo.current = novo;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveDaConfig]);

  const [erroDoServidor, setErroDoServidor] = useState<string | null>(null);
  const [salvouAgora, setSalvouAgora] = useState(false);

  const alterado = !mesmoForm(form, salvo.current);
  const problema = problemaDoForm(form);
  const previa = previaNaVitrine(form);
  const ga4 = validarGa4(form.ga4);
  const pixel = validarPixel(form.pixel);

  function muda(parcial: Partial<FormPedidosPelaLoja>) {
    setForm((f) => ({ ...f, ...parcial }));
    setErroDoServidor(null);
    setSalvouAgora(false);
  }

  async function salvar() {
    if (problema || !alterado || isSaving) return;
    setErroDoServidor(null);
    try {
      await saveConfig(corpoDoSalvar(form));
      // O que está na tela passa a ser o salvo já — sem esperar o GET de
      // volta, que só normaliza (maiúsculas do GA4, data).
      salvo.current = form;
      setSalvouAgora(true);
    } catch (e: any) {
      // 400 do servidor: a mensagem já vem pronta para a lojista
      // (services/pedidosPelaLoja.js) e nada foi salvo pela metade.
      setErroDoServidor(e?.message || "Não foi possível salvar. Tente de novo.");
    }
  }

  // Multi-CNPJ: a loja online é de UMA empresa. Na visão consolidada não
  // existe "a loja" para fechar — escolher a empresa é o primeiro passo.
  if (consolidatedView || !company?.id) {
    return (
      <View style={[s.card, s.vazio]}>
        <Icon name="store" size={22} color={t.ink3} />
        <Text style={s.vazioTitulo}>Escolha uma empresa</Text>
        <Text style={s.sub}>
          Cada empresa tem a própria loja online. Troque para a empresa da loja no seletor do topo para fechar pedidos, marcar a data limite ou mudar a medição.
        </Text>
      </View>
    );
  }

  const temporada = (
    <View style={s.card}>
      <Text style={s.eyebrow}>Temporada</Text>
      <View style={[s.linha, { marginTop: 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.rotulo}>{form.aceitando ? "Aceitando pedidos pela loja" : "Loja fechada para pedidos"}</Text>
          <Text style={s.sub}>
            {form.aceitando
              ? "A vitrine mostra o botão de comprar normalmente."
              : "A vitrine troca o botão de comprar por \"Pedir orçamento\" e mostra o recado abaixo."}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Selo aberta={previa.aberta} t={t} />
          <Interruptor
            ligado={form.aceitando}
            onMudar={(v) => muda({ aceitando: v })}
            rotulo="Aceitando pedidos pela loja"
            corLigado={t.success}
            corDesligado={t.danger}
            t={t}
          />
        </View>
      </View>

      <View style={[s.campo, { marginTop: 16 }]}>
        <Text style={s.label} nativeID="rotulo-ate">Aceitar pedidos até</Text>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <CampoDeData valor={form.ate} onMudar={(v) => muda({ ate: v })} t={t} s={s} />
          </View>
          {form.ate ? (
            <Pressable
              onPress={() => muda({ ate: "" })}
              accessibilityRole="button"
              accessibilityLabel="Limpar a data limite"
              style={s.botaoLeve}
            >
              <Icon name="x" size={14} color={t.ink2} />
              <Text style={s.botaoLeveTxt}>Limpar</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={s.dica}>
          Depois desta data a loja fecha para pedidos sozinha. Deixe em branco se não houver prazo.
        </Text>
      </View>

      {/* O recado vale para os dois jeitos de fechar: na mão (interruptor)
          e pela data. Aparece quando um deles está em jogo. */}
      {!form.aceitando || form.ate ? (
        <View style={[s.campo, { marginTop: 14 }]}>
          <Text style={s.label}>Recado para o cliente</Text>
          <TextInput
            value={form.recado}
            onChangeText={(v) => muda({ recado: v })}
            placeholder={form.aceitando && form.ate ? RECADO_PADRAO.prazo : RECADO_PADRAO.pausado}
            placeholderTextColor={t.ink4}
            accessibilityLabel="Recado para o cliente"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={s.textarea}
          />
          <View style={[s.linha, { alignItems: "flex-start" }]}>
            <Text style={[s.dica, { flex: 1 }]}>
              Aparece no lugar do botão de comprar, em todas as telas, quando a loja estiver fechada. Em branco, vale o texto de exemplo.
            </Text>
            <Text style={[s.dica, form.recado.trim().length > RECADO_MAX && s.dicaErro]}>
              {`${form.recado.trim().length}/${RECADO_MAX}`}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );

  const retirada = (
    <View style={s.card}>
      <View style={s.linha}>
        <View style={{ flex: 1 }}>
          <Text style={s.rotulo}>Retirada por app de entrega</Text>
          <Text style={s.sub}>O cliente pode escolher Uber, 99 ou similar no checkout e informar quem vai buscar.</Text>
        </View>
        <Interruptor
          ligado={form.retiradaPorApp}
          onMudar={(v) => muda({ retiradaPorApp: v })}
          rotulo="Retirada por app de entrega"
          corLigado={t.success}
          corDesligado={t.ink4}
          t={t}
        />
      </View>
    </View>
  );

  const medicao = (
    <View style={s.card}>
      <Text style={s.eyebrow}>Medição</Text>
      <Text style={[s.sub, { marginTop: 4, marginBottom: 12 }]}>
        Os eventos de venda (produto visto, sacola, pedido, compartilhamento) vão para os IDs abaixo — e só depois que o visitante aceitar o aviso de cookies.
      </Text>
      <View style={{ flexDirection: largo ? "row" : "column", gap: 14 }}>
        <CampoDeId
          rotulo="Google Analytics"
          icone="bar_chart"
          valor={form.ga4}
          placeholder="G-XXXXXXXXXX"
          validacao={ga4}
          onMudar={(v) => muda({ ga4: v })}
          maiusculas
          t={t}
          s={s}
        />
        <CampoDeId
          rotulo="Pixel da Meta"
          icone="activity"
          valor={form.pixel}
          placeholder="15 ou 16 dígitos"
          validacao={pixel}
          onMudar={(v) => muda({ pixel: v.replace(/\s/g, "") })}
          teclado="number-pad"
          t={t}
          s={s}
        />
      </View>
    </View>
  );

  const salvarBloco = (
    <View style={{ gap: 8 }}>
      {erroDoServidor ? (
        <View style={s.erro} accessibilityRole="alert">
          <Icon name="alert_circle" size={16} color={t.dangerInk} />
          <Text style={s.erroTxt}>{erroDoServidor}</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Pressable
          onPress={salvar}
          disabled={!alterado || !!problema || isSaving}
          accessibilityRole="button"
          accessibilityState={{ disabled: !alterado || !!problema || isSaving, busy: isSaving }}
          style={[s.salvar, (!alterado || !!problema || isSaving) && { opacity: 0.5 }]}
        >
          {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="save" size={15} color="#fff" />}
          <Text style={s.salvarTxt}>{isSaving ? "Salvando..." : "Salvar alterações"}</Text>
        </Pressable>
        <Text style={[s.dica, problema ? s.dicaErro : null]} accessibilityLiveRegion="polite">
          {problema
            ? problema
            : salvouAgora && !alterado
            ? "Salvo. A vitrine já mostra o que está aqui."
            : alterado
            ? "Alterações ainda não salvas."
            : ""}
        </Text>
      </View>
    </View>
  );

  const previaBloco = <Previa previa={previa} config={config} t={t} s={s} />;

  if (largo) {
    return (
      <View style={{ flexDirection: "row", gap: 20, alignItems: "flex-start", paddingBottom: 32 }}>
        <View style={{ flex: 1.3, gap: 16 }}>
          {temporada}
          {retirada}
          {medicao}
          {salvarBloco}
        </View>
        <View style={{ flex: 1, gap: 10, ...(Platform.OS === "web" ? ({ position: "sticky", top: 20 } as any) : null) }}>
          {previaBloco}
        </View>
      </View>
    );
  }
  return (
    <View style={{ gap: 16, paddingBottom: 32 }}>
      {temporada}
      {previaBloco}
      {retirada}
      {medicao}
      {salvarBloco}
    </View>
  );
}

// ── Peças ─────────────────────────────────────────────────────────────

function Selo({ aberta, t }: { aberta: boolean; t: StudioPalette }) {
  return (
    <View
      style={{
        flexDirection: "row", alignItems: "center", gap: 6,
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
        backgroundColor: aberta ? t.successSoft : t.dangerSoft,
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: aberta ? t.successInk : t.dangerInk }} />
      <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase", color: aberta ? t.successInk : t.dangerInk }}>
        {aberta ? "Aberta" : "Fechada"}
      </Text>
    </View>
  );
}

/** Interruptor do mockup (46×27), com papel de switch e alvo de 44 px. */
function Interruptor({
  ligado, onMudar, rotulo, corLigado, corDesligado, t,
}: {
  ligado: boolean;
  onMudar: (v: boolean) => void;
  rotulo: string;
  corLigado: string;
  corDesligado: string;
  t: StudioPalette;
}) {
  return (
    <Pressable
      onPress={() => onMudar(!ligado)}
      accessibilityRole="switch"
      accessibilityLabel={rotulo}
      accessibilityState={{ checked: ligado }}
      hitSlop={9}
      style={{
        width: 46, height: 27, borderRadius: 999, padding: 2.5,
        backgroundColor: ligado ? corLigado : corDesligado,
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: 22, height: 22, borderRadius: 11, backgroundColor: t.paperCardElev,
          transform: [{ translateX: ligado ? 19 : 0 }],
          ...(Platform.OS === "web" ? ({ boxShadow: "0 1px 3px rgba(0,0,0,.3)" } as any) : { elevation: 2 }),
        }}
      />
    </Pressable>
  );
}

/** Data AAAA-MM-DD: o seletor nativo no navegador, texto no aparelho. */
function CampoDeData({
  valor, onMudar, t, s,
}: {
  valor: string;
  onMudar: (v: string) => void;
  t: StudioPalette;
  s: ReturnType<typeof buildStyles>;
}) {
  // O painel nasce escuro (dark-first): sem color-scheme o ícone do
  // calendário do navegador sai preto sobre o campo escuro.
  const { isDark } = useStudioTheme();
  if (Platform.OS === "web") {
    return createElement("input", {
      type: "date",
      value: valor,
      "aria-labelledby": "rotulo-ate",
      "data-testid": "pedidos-ate",
      onChange: (e: any) => onMudar(e.target.value || ""),
      style: {
        height: 42, width: "100%", boxSizing: "border-box",
        borderRadius: 10, border: `1.5px solid ${t.primaryBorder}`,
        backgroundColor: t.paperCard, color: t.ink,
        padding: "0 12px", fontSize: 14, fontFamily: "inherit",
        colorScheme: isDark ? "dark" : "light",
      },
    });
  }
  return (
    <TextInput
      value={valor}
      onChangeText={(v) => onMudar(v.replace(/[^\d-]/g, "").slice(0, 10))}
      placeholder="AAAA-MM-DD"
      placeholderTextColor={t.ink4}
      accessibilityLabel="Aceitar pedidos até"
      keyboardType="numbers-and-punctuation"
      style={s.input}
    />
  );
}

function CampoDeId({
  rotulo, icone, valor, placeholder, validacao, onMudar, maiusculas, teclado, t, s,
}: {
  rotulo: string;
  icone: string;
  valor: string;
  placeholder: string;
  validacao: Validacao;
  onMudar: (v: string) => void;
  maiusculas?: boolean;
  teclado?: "number-pad";
  t: StudioPalette;
  s: ReturnType<typeof buildStyles>;
}) {
  const cor = validacao.estado === "ok" ? t.successInk : validacao.estado === "erro" ? t.dangerInk : t.ink3;
  const borda = validacao.estado === "ok" ? t.success : validacao.estado === "erro" ? t.danger : t.primaryBorder;
  return (
    <View style={[s.campo, { flex: 1 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon name={icone as any} size={14} color={t.ink2} />
        <Text style={s.label}>{rotulo}</Text>
      </View>
      <TextInput
        value={valor}
        onChangeText={(v) => onMudar(maiusculas ? v.toUpperCase() : v)}
        placeholder={placeholder}
        placeholderTextColor={t.ink4}
        accessibilityLabel={rotulo}
        autoCapitalize={maiusculas ? "characters" : "none"}
        autoCorrect={false}
        keyboardType={teclado}
        style={[s.input, { borderColor: borda }]}
      />
      <Text style={[s.dica, { color: cor, fontWeight: validacao.estado === "vazio" ? "400" : "700" }]}>
        {validacao.mensagem}
      </Text>
    </View>
  );
}

/**
 * A prévia é a vitrine: tema da loja (papel + cor dela) e o MESMO
 * componente de faixa que a cliente vê.
 */
function Previa({
  previa, config, t, s,
}: {
  previa: PreviaNaVitrine;
  config: any;
  t: StudioPalette;
  s: ReturnType<typeof buildStyles>;
}) {
  const endereco = config?.storefront_url
    || (config?.slug ? `loja.getaura.com.br/${config.slug}` : "sua loja");
  return (
    <View style={{ gap: 10 }} testID="previa-pedidos-pela-loja">
      <Text style={s.eyebrow}>Prévia ao vivo na vitrine</Text>
      <View style={s.previaMoldura}>
        <View style={s.previaEndereco}>
          <Text style={s.previaEnderecoTxt} numberOfLines={1}>
            {String(endereco).replace(/^https?:\/\//, "")}
          </Text>
        </View>
        <TemaDaVitrine cor={config?.primary_color}>
          <MioloDaPrevia previa={previa} nome={config?.site_name} />
        </TemaDaVitrine>
      </View>
      <Text style={s.sub}>{previa.legenda}</Text>
    </View>
  );
}

function MioloDaPrevia({ previa, nome }: { previa: PreviaNaVitrine; nome?: string }) {
  const T = usePaletaDaVitrine();
  const tema = useTemaDaVitrine();
  return (
    <View style={{ backgroundColor: T.bg }}>
      <FaixaDaTemporada lugar="topo" faixa={previa.faixa} />
      <View style={{ padding: 18, gap: 12 }}>
        <Texto style={{ fontSize: 12, letterSpacing: 1.6, textTransform: "uppercase", color: tema.marcaTexto }}>
          {nome || "Sua loja"}
        </Texto>
        <View style={{ height: 110, borderRadius: 12, backgroundColor: tema.bg3 }} />
        <View
          style={{
            minHeight: 46, borderRadius: 10, backgroundColor: tema.marcaFill,
            alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8,
          }}
        >
          <Icon name={previa.aberta ? "shopping_bag" : "whatsapp"} size={16} color={tema.sobreMarca} />
          <Texto style={{ color: tema.sobreMarca, fontSize: 14, fontWeight: "800" }}>{previa.botao}</Texto>
        </View>
      </View>
    </View>
  );
}

const buildStyles = (t: StudioPalette) => StyleSheet.create({
  card: {
    backgroundColor: t.paperCardElev,
    borderWidth: 1, borderColor: t.primaryBorder,
    borderRadius: 16, padding: 18,
  },
  vazio: { alignItems: "center", gap: 8, paddingVertical: 32 },
  vazioTitulo: { fontSize: 15, fontWeight: "700", color: t.ink },
  eyebrow: {
    fontSize: 10.5, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase",
    color: t.accentInk,
  },
  linha: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  rotulo: { fontSize: 13.5, fontWeight: "700", color: t.ink, marginBottom: 2 },
  sub: { fontSize: 12.5, lineHeight: 18, color: t.ink3 },
  campo: { gap: 6 },
  label: { fontSize: 12.5, fontWeight: "700", color: t.ink2 },
  input: {
    height: 42, borderRadius: 10, borderWidth: 1.5, borderColor: t.primaryBorder,
    backgroundColor: t.paperCard, paddingHorizontal: 12, fontSize: 14, color: t.ink,
  },
  textarea: {
    minHeight: 84, borderRadius: 10, borderWidth: 1.5, borderColor: t.primaryBorder,
    backgroundColor: t.paperCard, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13.5, lineHeight: 20, color: t.ink,
  },
  dica: { fontSize: 11.5, lineHeight: 16, color: t.ink3 },
  dicaErro: { color: t.dangerInk, fontWeight: "700" },
  botaoLeve: {
    flexDirection: "row", alignItems: "center", gap: 6,
    minHeight: 42, paddingHorizontal: 12, borderRadius: 10,
    backgroundColor: t.paperCard, borderWidth: 1, borderColor: t.ink5,
  },
  botaoLeveTxt: { fontSize: 12.5, fontWeight: "700", color: t.ink2 },
  erro: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: t.dangerSoft, borderRadius: 10, padding: 12,
  },
  erroTxt: { flex: 1, fontSize: 12.5, lineHeight: 18, color: t.dangerInk, fontWeight: "600" },
  salvar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    minHeight: 44, paddingHorizontal: 22, borderRadius: 10,
    backgroundColor: t.primary,
  },
  salvarTxt: { color: "#fff", fontSize: 13.5, fontWeight: "700" },
  previaMoldura: {
    borderRadius: 14, overflow: "hidden",
    borderWidth: 1, borderColor: t.primaryBorder,
  },
  previaEndereco: {
    backgroundColor: t.paperCard, paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: t.primaryBorder,
  },
  previaEnderecoTxt: {
    fontSize: 10.5, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", color: t.ink3,
  },
});

export default TabStudioPedidosPelaLoja;
