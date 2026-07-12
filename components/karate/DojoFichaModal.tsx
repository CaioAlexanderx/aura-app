// ============================================================
// Ficha do Dojô — MODAL (cadastro + edição) · Aura Karatê (Shoji)
//
// Abre sobre a lista de Dojôs (sem troca de página → navegação fluida).
// Cadastro:  karateApi.createDojo
// Edição:    karateApi.updateDojo  (backend já tem create + PATCH)
//
// Princípios (decisões Caio):
//  - Dado AUSENTE é neutro/opcional ("Completar quando quiser"), NÃO é erro.
//    Só dado INVÁLIDO (CNPJ/data impossível) é sinalizado.
//  - CEP em destaque → preenche o endereço ESTRUTURADO (campos separados,
//    igual à ficha do praticante) via ViaCEP: logradouro, bairro, cidade, UF.
//  - FPKT-ID é gerado no backend — aqui só exibimos.
//  - Modelo de filiação (obrigatório): Anual/Semestral/Trimestral, com os
//    valores vigentes FPKT como referência.
//  - Data validada de verdade: a conversão no envio usa parseBrDate (round-trip
//    de Date → rejeita 31/02). A máscara de digitação continua dd/mm/aaaa.
//  - Feedback de sucesso leve: toast Shoji inline ("Dojô salvo") — o app não
//    tem sistema de toast/snackbar global, então fazemos um mínimo aqui.
//    "Duplicar último" não se aplica ao dojô (decisão Caio).
//
// Status (fix/karate-dojo-edit-delete-ui): em modo EDIÇÃO há um controle
//   segmentado Ativo/Suspenso que envia `is_active` no PATCH (a federação
//   pode suspender/reativar daqui também, além do botão no detalhe). Em
//   cadastro novo o controle não aparece — o dojô nasce ativo.
//
// D3.5.2 (copy coerente): os obrigatórios são Nome e Modelo de filiação. O
//   subtítulo reflete isso e o nudge "Completar quando quiser" lista APENAS
//   campos realmente opcionais — nunca os obrigatórios — para não contradizer
//   a mensagem.
//
// Endereço estruturado (Fix 5): o dojô agora usa os MESMOS campos do praticante
// (street/number/complement/neighborhood/city/state/zip = colunas address_* do
// companies, as mesmas da NF-e). O backend ainda aceita `address` texto legado;
// na edição, se o registro só tiver `address` (sem campos), exibimos o texto
// num campo "Endereço (registro antigo)" read-friendly para não perder o dado.
//
// DJ1 (fix/karate-dojo-regiao-botoes): campo Região vira dropdown com lista
//   canônica de regiões do estado de São Paulo (KARATE_REGIONS). Se o valor
//   salvo no banco não constar na lista, aparece selecionado em "Outra…" e o
//   texto é preservado num campo livre de fallback. Salva sempre a string de
//   texto (coluna `region` — sem quebra de contrato com o backend).
//
// DJ2 (feat/karate-dojo-sensei-autocomplete): campo "CPF do sensei" removido.
//   Substituído por "Sensei responsável" com autocomplete ligado a
//   karateApi.listPractitioners (debounce 300ms, a partir de 2 chars).
//   Permite texto livre (sensei não cadastrado). Envia sensei_name +
//   sensei_practitioner_id no create/patch (sem sensei_cpf).
//
// G2 (feat/karate-dojo-annuity-plan): "Plano de anuidade" — campo NOVO e
//   DISTINTO de "Modelo de filiação" acima. affiliation_model é metadado
//   legado/decorativo (nunca lido por rota de cobrança). karate_annuity_plan
//   é o campo REAL que a campanha e o /charge individual passam a consultar
//   (migration 226, aura-backend) — sem ele, um dojô trimestral era cobrado
//   como anual, sem erro nenhum. OPCIONAL aqui (null = "a federação ainda
//   não definiu", estado normal — nunca forçamos uma escolha no cadastro).
//   Valores/vencimentos exibidos vêm de karateApi.getFeePlans (tabela de
//   anuidades vigente) — NUNCA hardcoded, ao contrário de MODELS acima.
// ============================================================
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Modal, View, Text, TextInput, ScrollView, Pressable, TouchableOpacity,
  ActivityIndicator, useWindowDimensions, StyleSheet, ViewStyle, TextStyle, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { ModalPop } from "@/components/karate/anim/ModalPop";
import { ShojiPalette as P, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { karateApi, AffiliationModel, AnnuityFeePlan, AnnuityPlan, DojoInput, PractitionerListItem } from "@/services/karateApi";
import { parseBrDate } from "@/components/inputs/DateInput";
import { KARATE_REGIONS, KARATE_REGIONS_VALUES, REGION_OTHER } from "@/constants/karateRegions";

interface Props {
  federationId: string;
  visible: boolean;
  dojoId?: string | null; // ausente = cadastro; presente = edição
  onClose: () => void;
  onSaved: () => void;
}

const MODELS: { key: AffiliationModel; label: string; detail: string }[] = [
  { key: "annual", label: "Anual", detail: "R$ 500 · vence em Maio" },
  { key: "biannual", label: "Semestral", detail: "R$ 280 · Maio e Novembro" },
  { key: "quarterly", label: "Trimestral", detail: "R$ 150 · Fev / Mai / Ago / Nov" },
];

const EMPTY = {
  name: "", affiliation_model: "" as AffiliationModel | "", region: "",
  // região: valor do dropdown (um dos KARATE_REGIONS ou REGION_OTHER)
  region_pick: "" as string,
  // fallback de texto livre quando region_pick === REGION_OTHER
  region_custom: "",
  cnpj: "",
  // sensei: nome (texto livre ou selecionado do autocomplete) + uuid do praticante vinculado
  sensei_name: "",
  sensei_practitioner_id: null as string | null,
  affiliation_since: "", dojo_founded_year: "",
  phone: "", email: "",
  // endereço estruturado (igual ao praticante)
  zip_code: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "",
  // só leitura: texto legado de registros antigos que ainda não migraram p/ campos
  legacy_address: "",
  // status (edição): true = Ativo, false = Suspenso. Cadastro novo nasce ativo.
  active: true,
  // Plano de anuidade REAL do dojô (migration 226) — null = "ainda não
  // definido" (estado normal, não é erro; ver comentário G2 no topo do arquivo).
  karate_annuity_plan: null as AnnuityPlan | null,
};
type Form = typeof EMPTY;

// Nomes por extenso dos meses de vencimento (due_months vem como [5], [5,11]
// etc. da tabela de anuidades vigente) — só formatação, nada hardcoded aqui,
// os NÚMEROS dos meses vêm sempre da API.
const MONTH_NAMES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function fmtDueMonths(months: number[] | null | undefined): string {
  if (!months || months.length === 0) return "";
  return months.map((m) => MONTH_NAMES[m - 1] ?? "?").join("/");
}
function fmtMoneyBRL(v: number): string {
  return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
const ANNUITY_PLAN_LABELS: Record<AnnuityPlan, string> = {
  anual: "Anual", semestral: "Semestral", trimestral: "Trimestral",
};

// ── máscaras / validações BR ─────────────────────────────────
const onlyD = (v: string) => (v || "").replace(/\D/g, "");
function maskCNPJ(v: string) {
  return onlyD(v).slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}
function maskCEP(v: string) {
  const d = onlyD(v).slice(0, 8);
  return d.length > 5 ? d.replace(/(\d{5})(\d+)/, "$1-$2") : d;
}
function maskPhone(v: string) {
  const d = onlyD(v).slice(0, 11);
  if (d.length > 10) return d.replace(/(\d{2})(\d{5})(\d+)/, "($1) $2-$3");
  if (d.length > 6) return d.replace(/(\d{2})(\d{4})(\d+)/, "($1) $2-$3");
  if (d.length > 2) return d.replace(/(\d{2})(\d+)/, "($1) $2");
  return d;
}
function cnpjValido(v: string) {
  const c = onlyD(v);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (len: number) => {
    let sum = 0, pos = len - 7;
    for (let i = len; i >= 1; i--) { sum += +c[len - i] * pos--; if (pos < 2) pos = 9; }
    const r = sum % 11; return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === +c[12] && calc(13) === +c[13];
}
function fromISO(v: string | null | undefined): string {
  if (!v) return "";
  const m = String(v).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}
function maskDate(v: string) {
  const d = onlyD(v).slice(0, 8);
  if (d.length > 4) return d.replace(/(\d{2})(\d{2})(\d+)/, "$1/$2/$3");
  if (d.length > 2) return d.replace(/(\d{2})(\d+)/, "$1/$2");
  return d;
}

// ── Helpers do dropdown de região ──────────────────────────────
// Dado o valor salvo no banco, devolve { region_pick, region_custom }.
function resolveRegionPick(saved: string | null | undefined): { region_pick: string; region_custom: string } {
  if (!saved) return { region_pick: "", region_custom: "" };
  if (KARATE_REGIONS_VALUES.has(saved)) return { region_pick: saved, region_custom: "" };
  // valor não está na lista → cai em "Outra…" e guarda o texto no custom
  return { region_pick: REGION_OTHER, region_custom: saved };
}

// Resolve a string final de região para envio (o que vai para `region` no back).
function resolveRegionValue(pick: string, custom: string): string | undefined {
  if (!pick) return undefined;
  if (pick === REGION_OTHER) return custom.trim() || undefined;
  return pick;
}

export function DojoFichaModal({ federationId, visible, dojoId, onClose, onSaved }: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cardW = Math.min(720, width - 24);
  const isEdit = !!dojoId;

  const [form, setForm] = useState<Form>(EMPTY);
  const [fpkt, setFpkt] = useState<string | null>(null);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cepStatus, setCepStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // toast de sucesso (inline, sem sistema global)
  const [toast, setToast] = useState<string | null>(null);
  // b5: id do dojô recém-criado (só no fluxo CREATE) — usado para oferecer
  // "Ir para o dojô" no toast de sucesso, sem fechar o modal automaticamente
  // até o usuário decidir (ir para o dojô, ou fechar/continuar cadastrando).
  const [createdDojoId, setCreatedDojoId] = useState<string | null>(null);
  // dropdown de região: estado aberto/fechado
  const [regionOpen, setRegionOpen] = useState(false);

  // Plano de anuidade (G2) — tabela de fees vigente (fee_type='dojo'), para
  // mostrar valor/vencimento REAIS de cada plano no seletor. Nunca hardcoded.
  const [feePlans, setFeePlans] = useState<AnnuityFeePlan[]>([]);
  const [feePlansLoading, setFeePlansLoading] = useState(false);

  // ── Autocomplete de sensei ────────────────────────────────────
  // suggestions: lista de praticantes retornados pela busca
  // suggestionsOpen: dropdown visível
  // senseiLoading: spinner de busca
  const [suggestions, setSuggestions] = useState<PractitionerListItem[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [senseiLoading, setSenseiLoading] = useState(false);
  // ref para cancelar a busca anterior (debounce manual)
  const senseiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // flag: praticante foi SELECIONADO pelo usuário (vinculado)
  const senseiLinked = !!form.sensei_practitioner_id;

  // refs p/ Enter avançar os campos de texto
  const nameRef = useRef<TextInput>(null);
  const regionCustomRef = useRef<TextInput>(null);
  const cnpjRef = useRef<TextInput>(null);
  const senseiRef = useRef<TextInput>(null);
  const sinceRef = useRef<TextInput>(null);
  const foundedRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!visible) return;
    setFeePlansLoading(true);
    karateApi.getFeePlans(federationId)
      .then((rows) => setFeePlans(rows.filter((f) => f.fee_type === "dojo")))
      .catch(() => setFeePlans([]))
      .finally(() => setFeePlansLoading(false));
  }, [visible, federationId]);

  useEffect(() => {
    if (!visible) return;
    setErrorMsg(null); setCepStatus(null); setToast(null); setRegionOpen(false);
    setSuggestions([]); setSuggestionsOpen(false);
    setCreatedDojoId(null); // b5: reseta o estado de sucesso do create a cada abertura
    if (!dojoId) { setForm(EMPTY); setFpkt(null); setStatusLabel(null); return; }
    setLoading(true);
    karateApi.getDojo(federationId, dojoId)
      .then((d: any) => {
        // Se o registro tem campos estruturados, usa-os; senão guarda o texto
        // legado p/ não perder o dado (campo read-friendly).
        const hasStructured = !!(d.address_street || d.address_city || d.address_zip ||
          d.address_neighborhood || d.address_number || d.address_state);
        // Status: o detalhe traz `status` (DojoStatus). b1: o backend agora manda
        // "inactive" (baseado em is_active) em vez de "suspended" — tratamos os
        // dois como "não ativo" por compatibilidade retroativa.
        // Se o backend expuser is_active, ele tem precedência.
        const active = d.is_active !== undefined ? !!d.is_active : (d.status !== "inactive");
        const { region_pick, region_custom } = resolveRegionPick(d.region);
        setForm({
          name: d.name || "", affiliation_model: d.affiliation_model || "", region: d.region || "",
          region_pick, region_custom,
          cnpj: d.cnpj ? maskCNPJ(d.cnpj) : "",
          sensei_name: d.sensei_name || "",
          sensei_practitioner_id: d.sensei_practitioner_id || null,
          affiliation_since: fromISO(d.affiliation_since), dojo_founded_year: d.dojo_founded_year ? String(d.dojo_founded_year) : "",
          phone: d.phone ? maskPhone(d.phone) : "", email: d.email || "",
          zip_code: d.address_zip ? maskCEP(d.address_zip) : "",
          street: d.address_street || "", number: d.address_number || "",
          complement: d.address_complement || "", neighborhood: d.address_neighborhood || "",
          city: d.address_city || "", state: d.address_state || "",
          legacy_address: hasStructured ? "" : (d.address || ""),
          active,
          karate_annuity_plan: (d.karate_annuity_plan as AnnuityPlan | null) || null,
        });
        setFpkt(d.fpkt_affiliation_id || null);
        setStatusLabel(d.status || null);
      })
      .catch(() => setErrorMsg("Não foi possível carregar o dojô."))
      .finally(() => setLoading(false));
  }, [visible, dojoId, federationId]);

  // autofocus no Nome ao abrir (cadastro novo, após render)
  useEffect(() => {
    if (visible && !dojoId && !loading) {
      const t = setTimeout(() => nameRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [visible, dojoId, loading]);

  // animação do toast (slide + fade)
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    toastAnim.setValue(0);
    Animated.timing(toastAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true })
        .start(() => setToast(null));
    }, 2400);
  }, [toastAnim]);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  // CEP autofill (ViaCEP) — preenche os campos ESTRUTURADOS, igual ao praticante.
  const onCep = useCallback(async (raw: string) => {
    set("zip_code", maskCEP(raw));
    const d = onlyD(raw);
    if (d.length !== 8) { setCepStatus(null); return; }
    setCepStatus({ msg: "Buscando endereço…", ok: true });
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const j = await r.json();
      if (j?.erro) { setCepStatus({ msg: "CEP não encontrado — preencha o endereço manualmente.", ok: false }); return; }
      setForm((p) => ({
        ...p,
        street: j.logradouro || p.street, neighborhood: j.bairro || p.neighborhood,
        city: j.localidade || p.city, state: j.uf || p.state,
        legacy_address: "", // CEP preenchido → substitui qualquer texto legado
      }));
      setCepStatus({ msg: "Endereço preenchido — confira o número.", ok: true });
    } catch { setCepStatus({ msg: "Falha ao buscar o CEP — preencha manualmente.", ok: false }); }
  }, []);

  // ── Sensei autocomplete handlers ─────────────────────────────
  // Chamado a cada keystroke no campo de sensei.
  // • Se há praticante vinculado e o usuário edita → desvincula (sensei_practitioner_id = null).
  // • Debounce 300 ms → busca listPractitioners com q=termo.
  // • Menos de 2 chars → fecha dropdown sem buscar.
  const onSenseiChange = useCallback((text: string) => {
    setForm((p) => ({
      ...p,
      sensei_name: text,
      // editar o texto desvincula qualquer praticante previamente selecionado
      sensei_practitioner_id: p.sensei_practitioner_id ? null : p.sensei_practitioner_id,
    }));

    // cancela debounce anterior
    if (senseiDebounceRef.current) clearTimeout(senseiDebounceRef.current);

    if (text.trim().length < 2) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      setSenseiLoading(false);
      return;
    }

    setSenseiLoading(true);
    senseiDebounceRef.current = setTimeout(async () => {
      try {
        const res = await karateApi.listPractitioners(federationId, { q: text.trim(), pageSize: 8 });
        setSuggestions(res.data ?? []);
        setSuggestionsOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setSenseiLoading(false);
      }
    }, 300);
  }, [federationId]);

  // Limpa o debounce ao desmontar
  useEffect(() => () => {
    if (senseiDebounceRef.current) clearTimeout(senseiDebounceRef.current);
  }, []);

  // Selecionar uma sugestão: vincula o praticante e fecha o dropdown.
  const onSelectSuggestion = useCallback((item: PractitionerListItem) => {
    setForm((p) => ({
      ...p,
      sensei_name: item.full_name,
      sensei_practitioner_id: item.id,
    }));
    setSuggestions([]);
    setSuggestionsOpen(false);
    setSenseiLoading(false);
  }, []);

  const cnpjBad = form.cnpj.length > 0 && !cnpjValido(form.cnpj);
  // data "Filiado desde": ISO validado (parseBrDate rejeita 31/02). Completo mas inválido = sinaliza.
  const sinceIso = parseBrDate(form.affiliation_since);
  const sinceBad = form.affiliation_since.length === 10 && sinceIso === null;

  // D3.5.2: NÃO listamos os obrigatórios (Nome, Modelo de filiação) aqui — o
  // "Completar quando quiser" é só para opcionais, sem contradizer o subtítulo.
  const empties = useMemo(() => {
    const e: string[] = [];
    const regionFinal = resolveRegionValue(form.region_pick, form.region_custom);
    if (!regionFinal) e.push("Região");
    if (!form.sensei_name) e.push("Sensei");
    if (!form.phone) e.push("Telefone");
    return e;
  }, [form.region_pick, form.region_custom, form.sensei_name, form.phone]);

  async function handleSave() {
    if (!form.name.trim()) { setErrorMsg("Informe o nome do dojô."); return; }
    if (!form.affiliation_model) { setErrorMsg("Escolha o modelo de filiação."); return; }
    if (cnpjBad) { setErrorMsg("O CNPJ informado é inválido. Corrija ou deixe em branco."); return; }
    if (sinceBad) { setErrorMsg("A data \"Filiado desde\" é inválida. Corrija ou deixe em branco."); return; }
    setErrorMsg(null); setSaving(true);
    // Endereço: envia campos estruturados (address_*). Mantém compat com o texto
    // legado — se o registro só tinha `address` e o usuário não tocou nos campos,
    // reenviamos o texto p/ não apagá-lo silenciosamente.
    const hasStructured = !!(form.street || form.number || form.complement ||
      form.neighborhood || form.city || form.state || form.zip_code);
    // Região: resolve o valor final (string do picker ou texto livre de "Outra…")
    const regionFinal = resolveRegionValue(form.region_pick, form.region_custom);
    // O backend já aceita sensei_name + sensei_practitioner_id; o tipo DojoInput
    // ainda não reflete (será atualizado em follow-up), então usamos `as any`.
    const body: (DojoInput & { is_active?: boolean; sensei_name?: string | null; sensei_practitioner_id?: string | null }) = {
      name: form.name.trim(),
      affiliation_model: form.affiliation_model as AffiliationModel,
      cnpj: onlyD(form.cnpj) || null,
      sensei_name: form.sensei_name.trim() || null,
      sensei_practitioner_id: form.sensei_practitioner_id || null,
      region: regionFinal || undefined,
      affiliation_since: sinceIso || undefined,
      dojo_founded_year: form.dojo_founded_year ? parseInt(form.dojo_founded_year, 10) : null,
      phone: onlyD(form.phone) || null,
      email: form.email || null,
      // endereço estruturado
      address_street: form.street || null,
      address_number: form.number || null,
      address_complement: form.complement || null,
      address_neighborhood: form.neighborhood || null,
      address_city: form.city || null,
      address_state: form.state ? form.state.toUpperCase().slice(0, 2) : null,
      address_zip: onlyD(form.zip_code) || null,
      // texto legado: só preserva se NÃO houver estruturado preenchido
      address: hasStructured ? null : (form.legacy_address || null),
      // Plano de anuidade REAL do dojô (G2/migration 226) — sempre enviado
      // (mesmo null) para que limpar a seleção no formulário efetivamente
      // limpe o campo salvo (PATCH trata `undefined` como "não mexer" e
      // `null` como "limpar" — ver karateDojos.js). Campo OPCIONAL: nunca
      // bloqueia o cadastro/edição do dojô.
      karate_annuity_plan: form.karate_annuity_plan || null,
    } as any;
    // Status: só envia is_active na EDIÇÃO (cadastro novo nasce ativo no back).
    if (isEdit) body.is_active = form.active;
    try {
      if (isEdit) {
        await karateApi.updateDojo(federationId, dojoId!, body);
        setSaving(false);
        showToast("Alterações salvas");
        onSaved();
        // dá um instante p/ o toast aparecer antes de fechar
        setTimeout(() => onClose(), 480);
      } else {
        // b5: CREATE — captura o dojô criado (tem `id`) e OFERECE ir direto
        // para a página dele, em vez de fechar o modal na hora. O toast fica
        // sem auto-dismiss enquanto o painel de sucesso está visível; o
        // usuário decide entre "Ir para o dojô" ou "Continuar" (fecha aqui).
        const created = await karateApi.createDojo(federationId, body);
        setSaving(false);
        setCreatedDojoId(created?.id ?? null);
        showToast("Dojô salvo");
        onSaved();
      }
    } catch (e: any) {
      setSaving(false); setErrorMsg(e?.message || "Erro ao salvar. Tente novamente.");
    }
  }

  // b5: navega para o detalhe do dojô recém-criado e fecha o modal.
  const goToCreatedDojo = useCallback(() => {
    if (!createdDojoId) return;
    onClose();
    router.push(("/karate/dojos/" + encodeURIComponent(createdDojoId)) as any);
  }, [createdDojoId, onClose, router]);

  // Rótulo exibido no botão do dropdown de região
  const regionLabel = form.region_pick === REGION_OTHER
    ? (form.region_custom.trim() || REGION_OTHER)
    : (form.region_pick || "Selecionar região…");

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => { setRegionOpen(false); setSuggestionsOpen(false); onClose(); }} />
        <ModalPop visible={visible} style={[styles.card, { width: cardW }]}>
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>空  FPKT · {isEdit ? "Editar dojô" : "Novo dojô"}</Text>
              <Text style={styles.title}>{isEdit ? (form.name || "Dojô") : "Novo dojô"}<Text style={{ color: P.red }}>.</Text></Text>
              {isEdit && fpkt ? (
                <Text style={styles.subMono}>{fpkt}{statusLabel ? `  ·  ${statusLabel}` : ""}</Text>
              ) : (
                <Text style={styles.sub}>Só o nome e o modelo de filiação são obrigatórios — o resto você completa quando quiser. O código FPKT é gerado automaticamente ao salvar.</Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.close}><Icon name="x" size={20} color={P.ink2} /></TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator style={{ paddingVertical: 48 }} color={P.red} />
          ) : (
            <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ padding: 20, paddingTop: 6 }} keyboardShouldPersistTaps="handled">
              {empties.length > 0 && (
                <View style={styles.completar}>
                  <Icon name="edit" size={14} color={P.ink3} />
                  <Text style={styles.completarTtl}>Completar quando quiser:</Text>
                  <Text style={styles.completarList}>{empties.join("  ·  ")}</Text>
                </View>
              )}

              {/* Status (Ativo/Inativo) — só na edição, envia is_active no PATCH.
                  b1: rótulo "Suspenso" virou "Inativo" (mesmo campo is_active). */}
              {isEdit && (
                <View style={styles.statusBox}>
                  <Text style={styles.statusLabel}>Status</Text>
                  <View style={styles.segment}>
                    <TouchableOpacity
                      style={[styles.segBtn, form.active && styles.segBtnOn]}
                      onPress={() => set("active", true)}
                      activeOpacity={0.85}
                      accessibilityLabel="Status Ativo"
                    >
                      <Text style={[styles.segTxt, form.active && styles.segTxtOn]}>Ativo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.segBtn, !form.active && styles.segBtnOnRed]}
                      onPress={() => set("active", false)}
                      activeOpacity={0.85}
                      accessibilityLabel="Status Inativo"
                    >
                      <Text style={[styles.segTxt, !form.active && styles.segTxtOnRed]}>Inativo</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <SectionTitle>Identidade</SectionTitle>
              <Field label="Nome do dojô" req value={form.name} onChangeText={(v) => set("name", v)} placeholder="Ex.: Associação Shobu-Kan Karatê-Dô"
                inputRef={nameRef} returnKeyType="next" onSubmitEditing={() => cnpjRef.current?.focus()} />

              {/* Modelo de filiação (obrigatório) */}
              <Text style={styles.label}>Modelo de filiação <Text style={{ color: P.red }}>*</Text></Text>
              <View style={styles.models}>
                {MODELS.map((m) => {
                  const on = form.affiliation_model === m.key;
                  return (
                    <TouchableOpacity key={m.key} style={[styles.model, on && styles.modelOn]} onPress={() => set("affiliation_model", m.key)} activeOpacity={0.8} accessibilityLabel={`Modelo ${m.label}`}>
                      <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.modelLabel, on && { color: P.ink }]}>{m.label}</Text>
                        <Text style={styles.modelDetail}>{m.detail}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Plano de anuidade (G2 — migration 226, OPCIONAL) — plano
                  REAL de cobrança do dojô. Valores/vencimentos vêm da tabela
                  de fees vigente (karateApi.getFeePlans), nunca hardcoded.
                  Tocar no plano já selecionado desmarca (volta a "indefinido"). */}
              <Text style={styles.label}>Plano de anuidade <Text style={styles.optionalHint}>(opcional — a federação pode definir depois)</Text></Text>
              {feePlansLoading ? (
                <Text style={styles.feePlanLoadingTxt}>Carregando valores vigentes…</Text>
              ) : (
                <View style={styles.models}>
                  {(["anual", "semestral", "trimestral"] as AnnuityPlan[]).map((planKey) => {
                    const fee = feePlans.find((f) => f.plan === planKey);
                    const on = form.karate_annuity_plan === planKey;
                    const detail = fee
                      ? `${fmtMoneyBRL(fee.amount)} · ${fee.due_months && fee.due_months.length > 1 ? `${fee.due_months.length}x` : "1x"} · vence ${fmtDueMonths(fee.due_months)}`
                      : "valor não configurado em Valores e planos";
                    return (
                      <TouchableOpacity
                        key={planKey}
                        style={[styles.model, on && styles.modelOn]}
                        onPress={() => set("karate_annuity_plan", on ? null : planKey)}
                        activeOpacity={0.8}
                        accessibilityLabel={`Plano de anuidade ${ANNUITY_PLAN_LABELS[planKey]}`}
                        accessibilityRole="button"
                      >
                        <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.modelLabel, on && { color: P.ink }]}>{ANNUITY_PLAN_LABELS[planKey]}</Text>
                          <Text style={styles.modelDetail}>{detail}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              {!form.karate_annuity_plan && (
                <Text style={styles.feePlanUndefinedNote}>
                  Sem plano definido, a campanha de anuidades vai sinalizar este dojô antes de cobrar — nunca lança como Anual sem confirmação.
                </Text>
              )}

              {/* ── Região — dropdown canônico ──────────────────────────────── */}
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Região</Text>
                  {/* Botão que abre/fecha o picker inline */}
                  <TouchableOpacity
                    style={[styles.input, styles.dropBtn]}
                    onPress={() => setRegionOpen((o) => !o)}
                    activeOpacity={0.8}
                    accessibilityLabel="Selecionar região"
                    accessibilityRole="button"
                  >
                    <Text
                      style={[
                        styles.dropBtnTxt,
                        !form.region_pick && { color: P.ink4 },
                      ]}
                      numberOfLines={1}
                    >
                      {regionLabel}
                    </Text>
                    <Icon name={regionOpen ? "chevron-up" : "chevron-down"} size={16} color={P.ink3} />
                  </TouchableOpacity>

                  {/* Lista de opções — inline (sem portal/overlay, pois o modal já tem foco) */}
                  {regionOpen && (
                    <View style={styles.dropList}>
                      {KARATE_REGIONS.map((r) => {
                        const selected = form.region_pick === r;
                        return (
                          <TouchableOpacity
                            key={r}
                            style={[styles.dropItem, selected && styles.dropItemOn]}
                            onPress={() => {
                              setForm((p) => ({ ...p, region_pick: r, region_custom: r === REGION_OTHER ? p.region_custom : "" }));
                              setRegionOpen(false);
                              if (r === REGION_OTHER) {
                                setTimeout(() => regionCustomRef.current?.focus(), 80);
                              }
                            }}
                            activeOpacity={0.75}
                            accessibilityRole="menuitem"
                            accessibilityLabel={r}
                          >
                            <Text style={[styles.dropItemTxt, selected && styles.dropItemTxtOn]}>{r}</Text>
                            {selected && <Icon name="check" size={14} color={P.red} />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  {/* Campo de texto livre — só visível quando "Outra…" está selecionado */}
                  {form.region_pick === REGION_OTHER && (
                    <TextInput
                      ref={regionCustomRef}
                      style={[styles.input, { marginTop: 8 }]}
                      value={form.region_custom}
                      onChangeText={(v) => set("region_custom", v)}
                      placeholder="Digite a região…"
                      placeholderTextColor={P.ink4}
                      returnKeyType="next"
                      onSubmitEditing={() => cnpjRef.current?.focus()}
                      accessibilityLabel="Região (texto livre)"
                    />
                  )}
                </View>

                <Field flex label="CNPJ" hint="opcional" mono value={form.cnpj} onChangeText={(v) => set("cnpj", maskCNPJ(v))} keyboardType="numeric" placeholder="00.000.000/0000-00" bad={cnpjBad}
                  inputRef={cnpjRef} returnKeyType="next" onSubmitEditing={() => senseiRef.current?.focus()}
                  note={cnpjBad ? "CNPJ inválido" : undefined} />
              </View>

              {/* ── Sensei & fundação ──────────────────────────────────────── */}
              <SectionTitle>Sensei &amp; fundação</SectionTitle>

              {/* Autocomplete de sensei responsável */}
              <View style={styles.field}>
                <Text style={styles.label}>
                  Sensei responsável
                  <Text style={styles.labelHint}>  · opcional</Text>
                </Text>
                {/* Wrapper com zIndex alto para o dropdown flutuar sobre campos abaixo */}
                <View style={styles.senseiWrap}>
                  <View style={[
                    styles.input,
                    styles.senseiInputRow,
                    senseiLinked && styles.senseiInputLinked,
                  ]}>
                    <TextInput
                      ref={senseiRef}
                      style={styles.senseiTextInput}
                      value={form.sensei_name}
                      onChangeText={onSenseiChange}
                      onFocus={() => {
                        if (suggestions.length > 0) setSuggestionsOpen(true);
                      }}
                      onBlur={() => {
                        // pequeno delay para permitir que o tap na sugestão seja registrado
                        setTimeout(() => setSuggestionsOpen(false), 160);
                      }}
                      placeholder="Nome do sensei…"
                      placeholderTextColor={P.ink4}
                      returnKeyType="next"
                      onSubmitEditing={() => sinceRef.current?.focus()}
                      accessibilityLabel="Sensei responsável"
                      autoCorrect={false}
                    />
                    {senseiLoading ? (
                      <ActivityIndicator size="small" color={P.red} style={styles.senseiIcon} />
                    ) : senseiLinked ? (
                      <TouchableOpacity
                        style={styles.senseiIcon}
                        onPress={() => {
                          setForm((p) => ({ ...p, sensei_name: "", sensei_practitioner_id: null }));
                          setSuggestions([]);
                          setSuggestionsOpen(false);
                          senseiRef.current?.focus();
                        }}
                        hitSlop={8}
                        accessibilityLabel="Limpar sensei"
                      >
                        <Icon name="x" size={15} color={P.ink3} />
                      </TouchableOpacity>
                    ) : (
                      <Icon name="search" size={15} color={P.ink4} style={styles.senseiIcon} />
                    )}
                  </View>

                  {/* Badge de praticante vinculado */}
                  {senseiLinked && (
                    <Text style={styles.senseiLinkedNote}>
                      <Icon name="check" size={11} color={P.ok} />{"  "}Praticante vinculado
                    </Text>
                  )}

                  {/* Dropdown de sugestões */}
                  {suggestionsOpen && suggestions.length > 0 && (
                    <View style={styles.senseiDropList}>
                      {suggestions.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={styles.senseiDropItem}
                          onPress={() => onSelectSuggestion(item)}
                          activeOpacity={0.75}
                          accessibilityRole="menuitem"
                          accessibilityLabel={item.full_name}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.senseiDropName}>{item.full_name}</Text>
                            {(item.dojo_name || item.karate_registration_number) ? (
                              <Text style={styles.senseiDropSub} numberOfLines={1}>
                                {[item.dojo_name, item.karate_registration_number].filter(Boolean).join("  ·  ")}
                              </Text>
                            ) : null}
                          </View>
                          <Icon name="user" size={14} color={P.ink4} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Nenhuma sugestão encontrada */}
                  {suggestionsOpen && !senseiLoading && suggestions.length === 0 && form.sensei_name.trim().length >= 2 && (
                    <View style={styles.senseiDropList}>
                      <View style={styles.senseiDropEmpty}>
                        <Text style={styles.senseiDropEmptyTxt}>Nenhum praticante encontrado — o nome será salvo como texto livre.</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.row2}>
                <Field flex label="Filiado desde" hint="dd/mm/aaaa" mono value={form.affiliation_since} onChangeText={(v) => set("affiliation_since", maskDate(v))} keyboardType="numeric" placeholder="dd/mm/aaaa"
                  inputRef={sinceRef} returnKeyType="next" onSubmitEditing={() => foundedRef.current?.focus()}
                  bad={sinceBad} note={sinceBad ? "Data inválida" : undefined} />
                <Field flex label="Ano de fundação" mono value={form.dojo_founded_year} onChangeText={(v) => set("dojo_founded_year", onlyD(v).slice(0, 4))} keyboardType="numeric" placeholder="1996" maxLength={4}
                  inputRef={foundedRef} returnKeyType="next" onSubmitEditing={() => phoneRef.current?.focus()} />
              </View>

              <SectionTitle>Contato &amp; endereço</SectionTitle>
              <View style={styles.row2}>
                <Field flex label="Telefone" mono value={form.phone} onChangeText={(v) => set("phone", maskPhone(v))} keyboardType="numeric" placeholder="(00) 00000-0000"
                  inputRef={phoneRef} returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} />
                <Field flex label="E-mail" value={form.email} onChangeText={(v) => set("email", v)} keyboardType="email-address" autoCapitalize="none" placeholder="dojo@exemplo.com"
                  inputRef={emailRef} returnKeyType="done" onSubmitEditing={handleSave} />
              </View>

              {/* CEP destacado — preenche os campos estruturados (igual praticante) */}
              <View style={styles.cepBox}>
                <Text style={styles.cepLabel}>CEP <Text style={styles.cepHint}>· preenche o endereço automaticamente</Text></Text>
                <View style={styles.cepRow}>
                  <TextInput style={[styles.input, styles.mono, { flex: 1, fontSize: 16 }]} value={form.zip_code} onChangeText={onCep} keyboardType="numeric" placeholder="00000-000" placeholderTextColor={P.ink4} maxLength={9} accessibilityLabel="CEP" />
                  {cepStatus?.msg === "Buscando endereço…" ? <ActivityIndicator color={P.red} style={{ width: 36 }} /> : <Icon name="search" size={18} color={P.ink3} style={{ width: 36, alignSelf: "center" }} />}
                </View>
                {cepStatus ? <Text style={[styles.note, cepStatus.ok ? styles.noteOk : styles.noteBad]}>{cepStatus.msg}</Text> : null}
              </View>

              <View style={styles.row2}>
                <Field flex2 label="Logradouro" value={form.street} onChangeText={(v) => set("street", v)} placeholder="Rua, avenida…" />
                <Field flex label="Número" mono value={form.number} onChangeText={(v) => set("number", v)} placeholder="000" keyboardType="numeric" />
              </View>
              <View style={styles.row2}>
                <Field flex label="Complemento" value={form.complement} onChangeText={(v) => set("complement", v)} placeholder="Sala, bloco…" />
                <Field flex label="Bairro" value={form.neighborhood} onChangeText={(v) => set("neighborhood", v)} />
              </View>
              <View style={styles.row2}>
                <Field flex2 label="Cidade" value={form.city} onChangeText={(v) => set("city", v)} />
                <Field flex label="UF" mono value={form.state} onChangeText={(v) => set("state", v.toUpperCase().slice(0, 2))} maxLength={2} placeholder="SP" />
              </View>

              {/* Texto legado: só aparece em registros antigos que ainda não têm campos.
                  Editável, mas ao preencher o CEP/campos ele é substituído. */}
              {form.legacy_address ? (
                <View style={styles.field}>
                  <Text style={styles.label}>Endereço (registro antigo)<Text style={styles.labelHint}>  · preencha os campos acima para estruturar</Text></Text>
                  <TextInput style={[styles.input, { minHeight: 52, textAlignVertical: "top" }]} value={form.legacy_address} onChangeText={(v) => set("legacy_address", v)}
                    placeholder="Endereço em texto livre" placeholderTextColor={P.ink4} multiline accessibilityLabel="Endereço (registro antigo)" />
                </View>
              ) : null}

              {errorMsg ? (
                <View style={styles.errBox}><Icon name="alert_circle" size={15} color={P.red} /><Text style={styles.errTxt}>{errorMsg}</Text></View>
              ) : null}
            </ScrollView>
          )}

          {/* b5: CREATE bem-sucedido — troca o footer padrão por um convite
              claro para ir direto ao dojô recém-criado, em vez de fechar
              silenciosamente. */}
          {createdDojoId ? (
            <View style={styles.successBar}>
              <View style={styles.successMsg}>
                <Icon name="check_circle" size={18} color={P.ok} />
                <Text style={styles.successTxt}>Dojô salvo com sucesso.</Text>
              </View>
              <View style={styles.successActions}>
                <TouchableOpacity onPress={onClose} style={styles.btnGhost}>
                  <Text style={styles.btnGhostTxt}>Continuar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={goToCreatedDojo} style={styles.btnPrimary} accessibilityRole="button" accessibilityLabel="Ir para o dojô">
                  <Text style={styles.btnPrimaryTxt}>Ir para o dojô</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.footer}>
              <TouchableOpacity onPress={onClose} style={styles.btnGhost}><Text style={styles.btnGhostTxt}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleSave} disabled={saving || loading} style={[styles.btnPrimary, (saving || loading) && { opacity: 0.6 }]}>
                {saving ? <ActivityIndicator color="#fdf8f2" size="small" /> : <Text style={styles.btnPrimaryTxt}>{isEdit ? "Salvar alterações" : "Salvar dojô"}</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* toast de sucesso (inline) — na edição (auto-some); no create o
              feedback vira a barra de ações acima (createdDojoId), então o
              toast some antes dela renderizar de fato (mesma msg "Dojô salvo"
              some rápido e a successBar assume o protagonismo). */}
          {toast && !createdDojoId ? (
            <Animated.View pointerEvents="none" style={[styles.toast, {
              opacity: toastAnim,
              transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
            }]}>
              <Icon name="check" size={16} color="#bfe3c4" />
              <Text style={styles.toastTxt}>{toast}</Text>
            </Animated.View>
          ) : null}
        </ModalPop>
      </View>
    </Modal>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <View style={styles.sectionH}><Text style={styles.sectionTtl}>{children}</Text><View style={styles.sectionRule} /></View>;
}
function Row2({ children }: { children: React.ReactNode }) { return <View style={styles.row2}>{children}</View>; }
function Field(props: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string;
  hint?: string; req?: boolean; mono?: boolean; flex?: boolean; flex2?: boolean; bad?: boolean;
  note?: string; noteOk?: boolean; keyboardType?: any; autoCapitalize?: any; maxLength?: number;
  inputRef?: React.RefObject<TextInput>; returnKeyType?: any; onSubmitEditing?: () => void;
}) {
  return (
    <View style={[styles.field, props.flex && { flex: 1 }, props.flex2 && { flex: 2 }]}>
      <Text style={styles.label}>{props.label}{props.req ? <Text style={{ color: P.red }}> *</Text> : null}{props.hint ? <Text style={styles.labelHint}>  · {props.hint}</Text> : null}</Text>
      <TextInput
        ref={props.inputRef}
        style={[styles.input, props.mono && styles.mono, props.bad && styles.inputBad]} value={props.value} onChangeText={props.onChangeText}
        placeholder={props.placeholder} placeholderTextColor={P.ink4} keyboardType={props.keyboardType} autoCapitalize={props.autoCapitalize} maxLength={props.maxLength}
        accessibilityLabel={props.label}
        returnKeyType={props.returnKeyType} onSubmitEditing={props.onSubmitEditing} blurOnSubmit={props.returnKeyType === "done"} />
      {props.note ? <Text style={[styles.note, props.noteOk ? styles.noteOk : props.bad ? styles.noteBad : null]}>{props.note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 12 } as ViewStyle,
  card: { backgroundColor: P.paper, borderRadius: R.xl, overflow: "hidden", maxHeight: "92%", borderWidth: 1, borderColor: P.line2 } as ViewStyle,
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: P.line, backgroundColor: P.glassHi } as ViewStyle,
  eyebrow: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700", letterSpacing: 1.4, color: P.ink3, textTransform: "uppercase" } as TextStyle,
  title: { fontFamily: F.heading, fontSize: 24, color: P.ink, marginTop: 2 } as TextStyle,
  sub: { fontFamily: F.body, fontSize: 12.5, color: P.ink2, marginTop: 3 } as TextStyle,
  subMono: { fontFamily: F.mono, fontSize: 12, color: P.red, marginTop: 4 } as TextStyle,
  close: { padding: 4, borderRadius: 999 } as ViewStyle,

  completar: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7, backgroundColor: P.paper3, borderWidth: 1, borderColor: P.line, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12, marginBottom: 6 } as ViewStyle,
  completarTtl: { fontFamily: F.body, fontSize: 12, fontWeight: "700", color: P.ink2 } as TextStyle,
  completarList: { fontFamily: F.body, fontSize: 12, color: P.ink3, flex: 1 } as TextStyle,

  // Status segmentado (edição)
  statusBox: { marginTop: 6, marginBottom: 4 } as ViewStyle,
  statusLabel: { fontFamily: F.body, fontSize: 11, fontWeight: "700", letterSpacing: 0.3, color: P.ink2, marginBottom: 6 } as TextStyle,
  segment: { flexDirection: "row", gap: 8 } as ViewStyle,
  segBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: R.md, borderWidth: 1, borderColor: P.line2, backgroundColor: P.glassHi } as ViewStyle,
  segBtnOn: { borderColor: P.ok, backgroundColor: P.okWash } as ViewStyle,
  segBtnOnRed: { borderColor: P.redLine, backgroundColor: P.redWash } as ViewStyle,
  segTxt: { fontFamily: F.body, fontSize: 13, fontWeight: "600", color: P.ink3 } as TextStyle,
  segTxtOn: { color: P.ok } as TextStyle,
  segTxtOnRed: { color: P.red } as TextStyle,

  sectionH: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16, marginBottom: 6 } as ViewStyle,
  sectionTtl: { fontFamily: F.heading, fontSize: 16, color: P.ink } as TextStyle,
  sectionRule: { height: 1, flex: 1, backgroundColor: P.redLine, opacity: 0.4 } as ViewStyle,

  row2: { flexDirection: "row", gap: 12 } as ViewStyle,
  field: { marginBottom: 11 } as ViewStyle,
  label: { fontFamily: F.body, fontSize: 11, fontWeight: "700", letterSpacing: 0.3, color: P.ink2, marginBottom: 5 } as TextStyle,
  labelHint: { fontWeight: "500", color: P.ink4 } as TextStyle,
  input: { fontFamily: F.body, fontSize: 14, color: P.ink, backgroundColor: P.glassHi, borderWidth: 1, borderColor: P.line2, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 11 } as TextStyle,
  mono: { fontFamily: F.mono, letterSpacing: 0.5 } as TextStyle,
  inputBad: { borderColor: P.red } as ViewStyle,
  note: { fontFamily: F.body, fontSize: 11, color: P.ink3, marginTop: 4 } as TextStyle,
  noteOk: { color: P.ok } as TextStyle,
  noteBad: { color: P.red } as TextStyle,

  // Dropdown de região
  dropBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 11, paddingHorizontal: 12 } as ViewStyle,
  dropBtnTxt: { fontFamily: F.body, fontSize: 14, color: P.ink, flex: 1 } as TextStyle,
  dropList: { marginTop: 4, backgroundColor: P.paper, borderWidth: 1, borderColor: P.line2, borderRadius: R.md, overflow: "hidden", zIndex: 100 } as ViewStyle,
  dropItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: P.line } as ViewStyle,
  dropItemOn: { backgroundColor: P.redWash } as ViewStyle,
  dropItemTxt: { fontFamily: F.body, fontSize: 14, color: P.ink2 } as TextStyle,
  dropItemTxtOn: { color: P.ink, fontWeight: "600" } as TextStyle,

  models: { gap: 8, marginBottom: 11 } as ViewStyle,
  model: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: P.glassHi, borderWidth: 1, borderColor: P.line2, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 14 } as ViewStyle,
  modelOn: { borderColor: P.red, backgroundColor: P.redWash } as ViewStyle,
  radio: { width: 18, height: 18, borderRadius: 999, borderWidth: 1.5, borderColor: P.line2, alignItems: "center", justifyContent: "center" } as ViewStyle,
  radioOn: { borderColor: P.red } as ViewStyle,
  radioDot: { width: 9, height: 9, borderRadius: 999, backgroundColor: P.red } as ViewStyle,
  modelLabel: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: P.ink2 } as TextStyle,
  modelDetail: { fontFamily: F.body, fontSize: 11, color: P.ink3, marginTop: 1 } as TextStyle,

  optionalHint: { fontFamily: F.body, fontSize: 10.5, fontWeight: "400", color: P.ink4 } as TextStyle,
  feePlanLoadingTxt: { fontFamily: F.body, fontSize: 12, color: P.ink3, marginBottom: 11 } as TextStyle,
  feePlanUndefinedNote: { fontFamily: F.body, fontSize: 11, color: P.ink3, marginTop: -4, marginBottom: 11, fontStyle: "italic" } as TextStyle,

  cepBox: { backgroundColor: P.glass, borderWidth: 1, borderColor: P.redLine, borderRadius: R.lg, padding: 14, marginBottom: 12 } as ViewStyle,
  cepLabel: { fontFamily: F.body, fontSize: 12, fontWeight: "700", color: P.ink, marginBottom: 7 } as TextStyle,
  cepHint: { fontWeight: "500", color: P.ink3 } as TextStyle,
  cepRow: { flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,

  // Autocomplete de sensei
  senseiWrap: { position: "relative", zIndex: 200 } as ViewStyle,
  senseiInputRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 0, paddingHorizontal: 0,
    paddingRight: 8,
  } as ViewStyle,
  senseiInputLinked: { borderColor: P.ok } as ViewStyle,
  senseiTextInput: {
    flex: 1, fontFamily: F.body, fontSize: 14, color: P.ink,
    paddingHorizontal: 12, paddingVertical: 11,
  } as TextStyle,
  senseiIcon: { width: 28, alignItems: "center", justifyContent: "center" } as ViewStyle,
  senseiLinkedNote: {
    fontFamily: F.body, fontSize: 11, color: P.ok, marginTop: 4,
  } as TextStyle,
  senseiDropList: {
    // In-flow (não-absolute): dentro do ScrollView, um dropdown absolute é
    // recortado no web (overflow do ScrollView). Renderizar em fluxo empurra os
    // campos abaixo e evita o clip/z-index — mesmo padrão do dropdown de região.
    backgroundColor: P.paper, borderWidth: 1, borderColor: P.line2,
    borderRadius: R.md, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 8,
    marginTop: 3,
  } as ViewStyle,
  senseiDropItem: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 11, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: P.line,
  } as ViewStyle,
  senseiDropName: { fontFamily: F.body, fontSize: 14, color: P.ink, fontWeight: "600" } as TextStyle,
  senseiDropSub: { fontFamily: F.mono, fontSize: 11, color: P.ink3, marginTop: 1 } as TextStyle,
  senseiDropEmpty: { paddingVertical: 14, paddingHorizontal: 14 } as ViewStyle,
  senseiDropEmptyTxt: { fontFamily: F.body, fontSize: 12.5, color: P.ink3 } as TextStyle,

  errBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(184,70,58,0.08)", borderWidth: 1, borderColor: P.redLine, borderRadius: 12, padding: 11, marginTop: 12 } as ViewStyle,
  errTxt: { fontFamily: F.body, fontSize: 12.5, color: P.red2, flex: 1 } as TextStyle,

  footer: { flexDirection: "row", justifyContent: "flex-end", gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: P.line, backgroundColor: P.glassHi } as ViewStyle,
  // b5: barra de sucesso do CREATE (substitui o footer padrão) — mensagem +
  // "Continuar" (fecha) + "Ir para o dojô" (navega e fecha).
  successBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: P.line, backgroundColor: P.glassHi, flexWrap: "wrap" } as ViewStyle,
  successMsg: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  successTxt: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: P.ink } as TextStyle,
  successActions: { flexDirection: "row", gap: 10 } as ViewStyle,
  btnGhost: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: R.md, borderWidth: 1, borderColor: P.line2 } as ViewStyle,
  btnGhostTxt: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: P.ink } as TextStyle,
  btnPrimary: { paddingVertical: 11, paddingHorizontal: 22, borderRadius: R.md, backgroundColor: P.ink, minWidth: 150, alignItems: "center" } as ViewStyle,
  btnPrimaryTxt: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: "#fdf8f2" } as TextStyle,

  // toast de sucesso (inline, ancorado no rodapé do card)
  toast: { position: "absolute", left: 16, right: 16, bottom: 74, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: P.ink, borderRadius: R.md, paddingVertical: 11, paddingHorizontal: 14 } as ViewStyle,
  toastTxt: { fontFamily: F.body, fontSize: 13, fontWeight: "600", color: "#fdf8f2", flex: 1 } as TextStyle,
});

export default DojoFichaModal;
