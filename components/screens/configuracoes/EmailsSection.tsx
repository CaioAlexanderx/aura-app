// ============================================================
// AURA. — Configurações › E-mails (tq-89 + parte de app do tq-90, 24/10/2026)
//
// Mock aprovado (Nina, 21/10): https://claude.ai/artifact/1btyhxvVoUqtqqevJSR4TU
// Backend: Aura-backend#896, /companies/:id/emails (services/emailsApi.ts).
//
// Regras da tela:
//   · só o dono vê (company.member_role === "owner") e a equipe Aura (isStaff),
//     como o backend (403 EMAILS_FORBIDDEN para o resto). Se o GET ainda assim
//     voltar 403, a seção some;
//   · vale a empresa ativa (multi-CNPJ): no consolidado quem mostra o aviso de
//     escolher a empresa é a própria tela de Configurações;
//   · é uma seção de Configurações, não tela nova: sem `mod` nem entrada em
//     MODULE_PLAN_MAP (a tela inteira usa o módulo "configuracoes");
//   · o que o plano não tem some, sem cadeado: blocos do relatório pelo
//     `blocos_do_plano` do GET e o cartão "Pedido novo na loja online" só
//     para quem tem a loja online publicada (módulo "canal" + vitrine no ar);
//   · interruptores e escolhas salvam na hora, otimistas: se a API falhar, o
//     valor volta ao que era e aparece um toast;
//   · "Entregue" só quando a API manda (`situacao`); a tela nunca deduz;
//   · tudo funciona no toque: nada aparece só no hover (CLAUDE.md, armadilha 7).
// ============================================================
import { useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Switch, TextInput, ActivityIndicator } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { useVisibleModules } from "@/hooks/useVisibleModules";
import { request } from "@/services/api";
import {
  emailsApi,
  type EstadoEmails, type MudancasEmails, type BlocoRelatorio, type EnderecoEmail,
  type UltimosEmails, type SituacaoEmail,
} from "@/services/emailsApi";
import { tourTarget } from "@/utils/tourTarget";
import { alvoDaSecao } from "@/utils/focoNaSecao";
import { SectionTitle, Card } from "@/components/screens/configuracoes/shared";

// ── Funções puras (testadas sem montar a tela) ─────────────────

/** Mesma regra do backend (routes/companyEmails.js, ehDono). */
export function podeVerEmails(memberRole: string | null | undefined, isStaff: boolean): boolean {
  if (isStaff) return true;
  // Campo ausente = sessão antiga sem o papel: o backend decide (403 esconde).
  return (memberRole || "owner") === "owner";
}

export const ROTULO_BLOCO: Record<BlocoRelatorio, string> = {
  vendas: "Vendas e comparação da semana",
  mais_vendidos: "Mais vendidos e curva ABC",
  pagamentos_estoque: "Pagamentos, contas e estoque",
  crediario: "Crediário da semana",
  equipe_margem: "Equipe e margem",
  clientes: "Clientes e aniversariantes",
  loja_online: "Loja online e meta do mês",
};

const NOME_DIA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

// Escolhas curtas do mock. Sem sábado: o período do relatório fecha no
// sábado, e escolhido o sábado ele sairia com a semana em curso (backend#896).
export const DIAS_DO_RELATORIO = [1, 5, 0];
export const HORAS_DO_RELATORIO = [7, 8, 9, 18];

export function rotuloDia(dia: number): string {
  const n = NOME_DIA[dia] || NOME_DIA[1];
  return n.charAt(0).toUpperCase() + n.slice(1);
}

/** "toda segunda-feira, às 8h" / "todo domingo, às 18h". */
export function textoQuando(dia: number, hora: number): string {
  const d = Number.isInteger(dia) && dia >= 0 && dia <= 6 ? dia : 1;
  const h = Number.isInteger(hora) && hora >= 0 && hora <= 23 ? hora : 8;
  return (d === 0 || d === 6 ? "todo " : "toda ") + NOME_DIA[d] + ", às " + h + "h";
}

/** Opções da tela + o valor salvo, se ele veio de fora das opções curtas. */
export function opcoesComAtual(opcoes: number[], atual: number): number[] {
  return opcoes.includes(atual) || !Number.isInteger(atual) ? opcoes : opcoes.concat([atual]);
}

export const ROTULO_SITUACAO: Record<SituacaoEmail, string> = {
  enviado: "Enviado",
  entregue: "Entregue",
  devolvido: "Devolvido",
  falhou: "Falhou",
};

/**
 * Situação exibida: a da API, sem dedução. Valor que a tela não conhece vira
 * "Enviado" (nunca "Entregue").
 */
export function situacaoExibida(situacao: unknown): SituacaoEmail {
  return situacao === "entregue" || situacao === "devolvido" || situacao === "falhou" ? situacao : "enviado";
}

/** dd/mm e hh:mm no horário de Brasília (sem horário de verão desde 2019). */
export function dataEHora(iso: string | null | undefined): { data: string; hora: string } {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return { data: "—", hora: "" };
  const d = new Date(t - 3 * 3600000);
  const p = (n: number) => (n < 10 ? "0" : "") + n;
  return { data: p(d.getUTCDate()) + "/" + p(d.getUTCMonth() + 1), hora: p(d.getUTCHours()) + ":" + p(d.getUTCMinutes()) };
}

export function mensagemDosEmails(err: any, acao: string): string {
  const status = err && err.status;
  const code = err && err.data && err.data.code;
  if (status === 503 || code === "MIGRATION_PENDING") return "Os ajustes de e-mail ficam disponíveis em breve.";
  if (status === 403 || code === "EMAILS_FORBIDDEN") return "Só o dono da conta mexe nos e-mails.";
  if (err && err.isNetworkError) return "Sem conexão com o servidor. Tente de novo.";
  if (err && err.message && status && status < 500) return err.message;
  return "Não consegui " + acao + ". Tente de novo.";
}

/** Endereços que podem ser marcados (principal e extras já confirmados). */
export function enderecosConfirmados(enderecos: EnderecoEmail[]): string[] {
  return enderecos.filter((e) => e.principal || e.confirmado).map((e) => e.email);
}

// Mudança otimista no estado guardado no cache, espelhando o que o PUT grava.
function aplicar(estado: EstadoEmails, m: MudancasEmails): EstadoEmails {
  const p: any = { ...estado.preferencias };
  for (const tipo of Object.keys(m) as (keyof MudancasEmails)[]) {
    const novo: any = { ...p[tipo], ...(m[tipo] as any) };
    if ((tipo === "relatorio" || tipo === "pedido_loja") && m[tipo] && "destinatarios" in (m[tipo] as any)) {
      const lista = (m[tipo] as any).destinatarios as string[] | null;
      novo.destinatarios_efetivos = lista === null ? enderecosConfirmados(estado.enderecos) : lista;
    }
    p[tipo] = novo;
  }
  return { ...estado, preferencias: p };
}

// ── Peças visuais ───────────────────────────────────────────────

function Interruptor({ id, valor, onChange, rotulo }: { id: string; valor: boolean; onChange: (v: boolean) => void; rotulo: string }) {
  return (
    <Switch
      testID={id}
      value={valor}
      onValueChange={onChange}
      accessibilityLabel={rotulo}
      trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
      thumbColor={valor ? Colors.violet : Colors.ink3}
    />
  );
}

function Chip({ testID, ativo, rotulo, onPress }: { testID: string; ativo: boolean; rotulo: string; onPress: () => void }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: ativo, checked: ativo }}
      style={[s.chip, ativo && s.chipOn]}
    >
      <Text style={[s.chipText, ativo && s.chipTextOn]}>{rotulo}</Text>
    </Pressable>
  );
}

function Marcador({ testID, marcado, rotulo, onPress }: { testID: string; marcado: boolean; rotulo: string; onPress: () => void }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcado }}
      style={s.marcador}
    >
      <View style={[s.caixa, marcado && s.caixaOn]}>
        {marcado ? <Icon name="check" size={12} color="#fff" /> : null}
      </View>
      <Text style={s.marcadorText} numberOfLines={2}>{rotulo}</Text>
    </Pressable>
  );
}

function Etiqueta({ tom, texto, testID }: { tom: "ok" | "aviso" | "erro" | "neutro"; texto: string; testID?: string }) {
  const cor = tom === "ok" ? Colors.green : tom === "aviso" ? Colors.amber : tom === "erro" ? Colors.red : Colors.ink3;
  const fundo = tom === "ok" ? Colors.greenD : tom === "aviso" ? Colors.amberD : tom === "erro" ? Colors.redD : Colors.bg4;
  return (
    <View testID={testID} style={[s.etiqueta, { backgroundColor: fundo }]}>
      <Text style={[s.etiquetaText, { color: cor }]}>{texto}</Text>
    </View>
  );
}

function Linha({ titulo, desc, children }: { titulo: string; desc?: string; children?: React.ReactNode }) {
  return (
    <View style={s.linha}>
      <View style={s.linhaTexto}>
        <Text style={s.rotulo}>{titulo}</Text>
        {desc ? <Text style={s.desc}>{desc}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function CabecaDoCartao({ titulo, desc, children }: { titulo: string; desc?: string; children?: React.ReactNode }) {
  return (
    <View style={s.linha}>
      <View style={s.linhaTexto}>
        <Text style={s.titulo}>{titulo}</Text>
        {desc ? <Text style={s.desc}>{desc}</Text> : null}
      </View>
      {children}
    </View>
  );
}

// ── Loja online ─────────────────────────────────────────────────

/**
 * A loja tem loja online? Plano com o módulo "canal" (Negócio ou override) e
 * vitrine publicada (GET /digital-channel: exists + is_published). Sem o
 * módulo, nem consulta (o backend responderia 403 no Essencial).
 */
function useTemLojaOnline(companyId: string): boolean {
  const visiveis = useVisibleModules();
  const temCanal = visiveis.has("canal");
  const q = useQuery<any>({
    // Mesma queryKey do useDigitalChannel: divide o cache com o Canal Digital.
    queryKey: ["digitalChannel", companyId],
    queryFn: () => request<any>("/companies/" + companyId + "/digital-channel"),
    enabled: temCanal && !!companyId,
    staleTime: 60_000,
    retry: false,
  });
  return temCanal && !!(q.data && q.data.exists !== false && q.data.is_published === true);
}

// ── Seção ───────────────────────────────────────────────────────

/** Usada em Configurações: decide quem vê e passa a empresa ativa. */
export function SecaoEmails() {
  const { company, isStaff, consolidatedView } = useAuthStore() as any;
  if (consolidatedView || !company?.id) return null;
  if (!podeVerEmails(company.member_role, !!isStaff)) return null;
  return <EmailsSection companyId={company.id} />;
}

export function EmailsSection({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const chave = ["emails", companyId];
  const q = useQuery<EstadoEmails>({
    queryKey: chave,
    queryFn: () => emailsApi.get(companyId),
    staleTime: 30_000,
    retry: false,
  });
  const ultimosQ = useQuery<UltimosEmails>({
    queryKey: ["emails-ultimos", companyId],
    queryFn: () => emailsApi.ultimos(companyId),
    enabled: !!q.data,
    staleTime: 60_000,
    retry: false,
  });
  const temLojaOnline = useTemLojaOnline(companyId);

  const emVoo = useRef(0);
  const [adicionando, setAdicionando] = useState(false);
  const [novoEmail, setNovoEmail] = useState("");
  const [enviandoEndereco, setEnviandoEndereco] = useState(false);
  const [avisoEndereco, setAvisoEndereco] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [confirmarRemocao, setConfirmarRemocao] = useState<string | null>(null);
  const [enviandoAgora, setEnviandoAgora] = useState(false);
  const [agora, setAgora] = useState<{ restantes: number | null; limite: string | null; para: string | null }>({ restantes: null, limite: null, para: null });
  const [verTodos, setVerTodos] = useState(false);

  const erroStatus = q.error ? (q.error as any).status : null;
  // Funcionário que passou pelo gate do app (papel ausente na sessão): some.
  if (erroStatus === 403) return null;

  async function salvar(mudancas: MudancasEmails) {
    const antes = qc.getQueryData<EstadoEmails>(chave);
    if (!antes) return;
    qc.setQueryData<EstadoEmails>(chave, aplicar(antes, mudancas));
    emVoo.current += 1;
    try {
      const novo = await emailsApi.salvar(companyId, mudancas);
      emVoo.current -= 1;
      // Com outra mudança no ar, quem grava o estado final é a última resposta.
      if (emVoo.current === 0 && novo && novo.preferencias) qc.setQueryData(chave, novo);
    } catch (e: any) {
      emVoo.current -= 1;
      // Volta só o tipo que falhou ao que era antes.
      const atual = qc.getQueryData<EstadoEmails>(chave);
      if (atual) {
        const p: any = { ...atual.preferencias };
        for (const tipo of Object.keys(mudancas)) p[tipo] = (antes.preferencias as any)[tipo];
        qc.setQueryData<EstadoEmails>(chave, { ...atual, preferencias: p });
      }
      toast.error(mensagemDosEmails(e, "salvar a mudança"));
      if (emVoo.current === 0) qc.invalidateQueries({ queryKey: chave });
    }
  }

  async function adicionarEndereco() {
    const email = novoEmail.trim();
    if (!email || enviandoEndereco) return;
    setEnviandoEndereco(true); setAvisoEndereco(null);
    try {
      const r = await emailsApi.adicionarEndereco(companyId, email);
      if (r && r.estado) qc.setQueryData(chave, r.estado);
      const quem = (r && r.endereco && r.endereco.email) || email;
      const texto = r && r.confirmacao === "ja_confirmado"
        ? quem + " já está confirmado."
        : r && r.confirmacao === "duplicate"
          ? "O link para " + quem + " saiu há pouco. Confira a caixa de entrada e o spam."
          : "Enviamos um link para " + quem + ". Só passa a receber depois de confirmar.";
      setAvisoEndereco({ tom: "ok", texto });
      setNovoEmail("");
      setAdicionando(false);
    } catch (e: any) {
      setAvisoEndereco({ tom: "erro", texto: mensagemDosEmails(e, "adicionar o e-mail") });
    } finally {
      setEnviandoEndereco(false);
    }
  }

  async function reenviarLink(email: string) {
    setAvisoEndereco(null);
    try {
      const r = await emailsApi.adicionarEndereco(companyId, email);
      if (r && r.estado) qc.setQueryData(chave, r.estado);
      setAvisoEndereco({
        tom: "ok",
        texto: r && r.confirmacao === "duplicate"
          ? "O link para " + email + " saiu há pouco. Confira a caixa de entrada e o spam."
          : r && r.confirmacao === "ja_confirmado"
            ? email + " já está confirmado."
            : "Mandamos o link de novo para " + email + ".",
      });
    } catch (e: any) {
      setAvisoEndereco({ tom: "erro", texto: mensagemDosEmails(e, "reenviar o link") });
    }
  }

  async function removerEndereco(id: string) {
    setRemovendo(id); setAvisoEndereco(null);
    try {
      const r = await emailsApi.removerEndereco(companyId, id);
      if (r && r.estado) qc.setQueryData(chave, r.estado);
      else qc.invalidateQueries({ queryKey: chave });
      setConfirmarRemocao(null);
    } catch (e: any) {
      toast.error(mensagemDosEmails(e, "remover o e-mail"));
    } finally {
      setRemovendo(null);
    }
  }

  async function enviarAgora() {
    if (enviandoAgora) return;
    setEnviandoAgora(true);
    try {
      const r = await emailsApi.enviarAgora(companyId);
      toast.success("Pronto. Mandamos o relatório da última semana para " + r.para + ".");
      setAgora({ restantes: typeof r.restantes === "number" ? r.restantes : null, limite: null, para: r.para });
      qc.invalidateQueries({ queryKey: ["emails-ultimos", companyId] });
    } catch (e: any) {
      if (e && (e.status === 429 || (e.data && e.data.code === "LIMITE_DIARIO"))) {
        setAgora({ restantes: 0, limite: mensagemDosEmails(e, "enviar o relatório"), para: null });
      } else {
        toast.error(mensagemDosEmails(e, "enviar o relatório"));
      }
    } finally {
      setEnviandoAgora(false);
    }
  }

  const d = q.data;
  let corpo: React.ReactNode;

  if (q.isLoading) {
    corpo = (
      <Card>
        <View style={s.carregando}>
          <ActivityIndicator testID="emails-carregando" color={Colors.violet3} />
          <Text style={s.desc}>Carregando seus e-mails...</Text>
        </View>
      </Card>
    );
  } else if (erroStatus === 503 || (q.error && (q.error as any).data?.code === "MIGRATION_PENDING")) {
    corpo = <Card><Text testID="emails-em-breve" style={[s.desc, { paddingBottom: 8 }]}>Os ajustes de e-mail ficam disponíveis em breve.</Text></Card>;
  } else if (q.isError || !d) {
    corpo = (
      <Card>
        <View testID="emails-erro" style={s.erroBox}>
          <Text style={s.desc}>Não consegui carregar seus e-mails.</Text>
          <Pressable testID="emails-tentar-de-novo" onPress={() => q.refetch()} accessibilityRole="button" style={s.btnSec}>
            <Text style={s.btnSecText}>Tentar de novo</Text>
          </Pressable>
        </View>
      </Card>
    );
  } else {
    const rel = d.preferencias.relatorio;
    const pedido = d.preferencias.pedido_loja;
    const principal = d.enderecos.find((e) => e.principal) || null;
    const extras = d.enderecos.filter((e) => !e.principal);
    const confirmados = enderecosConfirmados(d.enderecos);
    const faltamConfirmar = extras.some((e) => !e.confirmado);
    const marcados = new Set(rel.destinatarios_efetivos || []);
    const blocosVisiveis = (d.blocos || []).filter((b) => (d.blocos_do_plano || []).includes(b));
    const blocosLigados = new Set(rel.blocos || []);
    const limiteExtras = d.limites?.enderecos_extras ?? 5;
    const limiteAgora = d.limites?.relatorio_agora_por_dia ?? 3;
    const agoraEsgotado = agora.restantes === 0;
    const msgLimite = agora.limite || (agoraEsgotado ? "Dá para pedir até " + limiteAgora + " relatórios por dia. Tente amanhã." : null);

    function alternarDestinatario(email: string) {
      const atual = rel.destinatarios_efetivos || [];
      const marcado = atual.includes(email);
      if (marcado && atual.length <= 1) {
        toast.info("Deixe pelo menos um e-mail marcado. Para não receber, desligue o relatório.");
        return;
      }
      const lista = marcado ? atual.filter((x) => x !== email) : confirmados.filter((x) => x === email || atual.includes(x));
      // Todos marcados = null: quem confirmar depois também passa a receber.
      const todos = confirmados.every((x) => lista.includes(x));
      salvar({ relatorio: { destinatarios: todos ? null : lista } });
    }

    function alternarBloco(b: BlocoRelatorio) {
      const ligado = blocosLigados.has(b);
      if (ligado && blocosVisiveis.filter((x) => blocosLigados.has(x)).length <= 1) {
        toast.info("Deixe pelo menos um bloco. Para não receber, desligue o relatório.");
        return;
      }
      // Guarda também os blocos que o plano não mostra (voltam se o plano mudar).
      const todos = (d!.blocos || []) as BlocoRelatorio[];
      const novos = todos.filter((x) => (x === b ? !ligado : blocosLigados.has(x)));
      salvar({ relatorio: { blocos: novos } });
    }

    const emails = ultimosQ.data?.emails || [];
    const algumDevolvido = emails.some((e) => situacaoExibida(e.situacao) === "devolvido");
    const listaVisivel = verTodos ? emails : emails.slice(0, 8);

    corpo = (
      <>
        <Text style={s.legenda}>
          Os e-mails da Aura saem de {d.remetente || "contato@getaura.com.br"}. Se você responder, quem lê é o Caio.
        </Text>

        {/* ── Para onde vão os avisos ── */}
        <Card style={s.cartao}>
          <CabecaDoCartao
            titulo="Para onde vão os avisos"
            desc="O relatório da semana chega nos e-mails que você marcar. Cobrança e segurança da conta vão sempre para o principal."
          />
          {principal ? (
            <View testID="emails-endereco-principal" style={s.campo}>
              <View style={s.campoTexto}>
                <Text style={s.campoEmail} numberOfLines={1}>{principal.email}</Text>
                <Text style={s.campoNota}>principal</Text>
              </View>
              <Etiqueta tom="ok" texto="Confirmado" />
            </View>
          ) : null}
          {extras.map((e) => (
            <View key={e.id || e.email} testID={"emails-endereco-" + e.email} style={s.campoBloco}>
              <View style={s.campo}>
                <View style={s.campoTexto}>
                  <Text style={s.campoEmail} numberOfLines={1}>{e.email}</Text>
                </View>
                {e.confirmado
                  ? <Etiqueta tom="ok" texto="Confirmado" />
                  : <Etiqueta tom="aviso" texto="Falta confirmar" testID={"emails-falta-confirmar-" + e.email} />}
              </View>
              {/* Ações sempre à vista (sem hover-reveal: funciona no toque). */}
              {confirmarRemocao === e.id ? (
                <View style={s.acoes}>
                  <Text style={s.desc}>Remover este e-mail?</Text>
                  <Pressable testID={"emails-remover-sim-" + e.email} onPress={() => e.id && removerEndereco(e.id)} disabled={removendo === e.id} accessibilityRole="button" style={s.btnPerigo}>
                    <Text style={s.btnPerigoText}>{removendo === e.id ? "Removendo..." : "Remover"}</Text>
                  </Pressable>
                  <Pressable onPress={() => setConfirmarRemocao(null)} accessibilityRole="button" style={s.btnSec}>
                    <Text style={s.btnSecText}>Manter</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={s.acoes}>
                  {!e.confirmado ? (
                    <Pressable testID={"emails-reenviar-" + e.email} onPress={() => reenviarLink(e.email)} accessibilityRole="button" style={s.btnLink}>
                      <Text style={s.btnLinkText}>Mandar o link de novo</Text>
                    </Pressable>
                  ) : null}
                  <Pressable testID={"emails-remover-" + e.email} onPress={() => setConfirmarRemocao(e.id)} accessibilityRole="button" style={s.btnLink}>
                    <Text style={[s.btnLinkText, { color: Colors.ink3 }]}>Remover</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}

          {adicionando ? (
            <View style={s.novoBox}>
              <TextInput
                testID="emails-novo-input"
                value={novoEmail}
                onChangeText={setNovoEmail}
                placeholder="financeiro@sualoja.com.br"
                placeholderTextColor={Colors.ink3}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={adicionarEndereco}
                style={s.input}
              />
              <View style={s.acoes}>
                <Pressable testID="emails-novo-enviar" onPress={adicionarEndereco} disabled={enviandoEndereco || !novoEmail.trim()} accessibilityRole="button" style={[s.btn, (enviandoEndereco || !novoEmail.trim()) && { opacity: 0.5 }]}>
                  <Text style={s.btnText}>{enviandoEndereco ? "Enviando..." : "Enviar link de confirmação"}</Text>
                </Pressable>
                <Pressable onPress={() => { setAdicionando(false); setNovoEmail(""); }} accessibilityRole="button" style={s.btnSec}>
                  <Text style={s.btnSecText}>Cancelar</Text>
                </Pressable>
              </View>
            </View>
          ) : extras.length < limiteExtras ? (
            <Pressable testID="emails-adicionar" onPress={() => { setAdicionando(true); setAvisoEndereco(null); }} accessibilityRole="button" style={[s.btnSec, { alignSelf: "flex-start" }]}>
              <Text style={s.btnSecText}>+ Adicionar outro e-mail</Text>
            </Pressable>
          ) : (
            <Text style={s.desc}>Dá para cadastrar até {limiteExtras} e-mails além do principal.</Text>
          )}
          {avisoEndereco ? (
            <Text testID="emails-aviso-endereco" style={[s.desc, { color: avisoEndereco.tom === "erro" ? Colors.red : Colors.ink2 }]}>
              {avisoEndereco.texto}
            </Text>
          ) : null}
        </Card>

        {/* ── Relatório da semana ── */}
        <Card style={s.cartao}>
          <CabecaDoCartao
            titulo="Relatório da semana"
            desc={"Um resumo da sua loja, " + textoQuando(rel.dia, rel.hora) + ". Chega para quem está em teste ou com assinatura ativa."}
          >
            <Interruptor id="emails-relatorio" rotulo="Relatório da semana" valor={rel.ligado} onChange={(v) => salvar({ relatorio: { ligado: v } })} />
          </CabecaDoCartao>

          {rel.ligado ? (
            <View testID="emails-relatorio-corpo" style={s.relCorpo}>
              <View style={s.grupo}>
                <Text style={s.rotulo}>Quando</Text>
                <View style={s.chips}>
                  {opcoesComAtual(DIAS_DO_RELATORIO, rel.dia).map((dia) => (
                    <Chip key={dia} testID={"emails-dia-" + dia} ativo={rel.dia === dia} rotulo={rotuloDia(dia)} onPress={() => { if (rel.dia !== dia) salvar({ relatorio: { dia } }); }} />
                  ))}
                </View>
              </View>
              <View style={s.grupo}>
                <Text style={s.rotulo}>Horário</Text>
                <View style={s.chips}>
                  {opcoesComAtual(HORAS_DO_RELATORIO, rel.hora).map((hora) => (
                    <Chip key={hora} testID={"emails-hora-" + hora} ativo={rel.hora === hora} rotulo={hora + "h"} onPress={() => { if (rel.hora !== hora) salvar({ relatorio: { hora } }); }} />
                  ))}
                </View>
              </View>
              <View style={s.grupo}>
                <Text style={s.rotulo}>Quem recebe</Text>
                {confirmados.map((email) => (
                  <Marcador key={email} testID={"emails-destinatario-" + email} marcado={marcados.has(email)} rotulo={email} onPress={() => alternarDestinatario(email)} />
                ))}
                {faltamConfirmar ? <Text style={s.desc}>Os e-mails que faltam confirmar aparecem aqui depois da confirmação.</Text> : null}
              </View>
              {blocosVisiveis.length > 0 ? (
                <View style={s.grupo}>
                  <Text style={s.rotulo}>O que aparece</Text>
                  <Text style={s.desc}>Os blocos que seu plano tem. Desligue os que você não quer ver.</Text>
                  {blocosVisiveis.map((b) => (
                    <Marcador key={b} testID={"emails-bloco-" + b} marcado={blocosLigados.has(b)} rotulo={ROTULO_BLOCO[b] || b} onPress={() => alternarBloco(b)} />
                  ))}
                </View>
              ) : null}
              <View style={s.grupo}>
                <Pressable
                  testID="emails-enviar-agora"
                  onPress={enviarAgora}
                  disabled={enviandoAgora || agoraEsgotado}
                  accessibilityRole="button"
                  style={[s.btn, { alignSelf: "flex-start" }, (enviandoAgora || agoraEsgotado) && { opacity: 0.5 }]}
                >
                  <Text style={s.btnText}>{enviandoAgora ? "Enviando..." : "Me enviar um agora"}</Text>
                </Pressable>
                {msgLimite ? (
                  <Text testID="emails-agora-limite" style={s.desc}>{msgLimite}</Text>
                ) : agora.para && typeof agora.restantes === "number" ? (
                  <Text testID="emails-agora-restantes" style={s.desc}>
                    {"Mandamos para " + agora.para + ". Dá para pedir mais " + agora.restantes + " hoje."}
                  </Text>
                ) : (
                  <Text style={s.desc}>Chega no e-mail principal, com a última semana fechada. Até {limiteAgora} por dia.</Text>
                )}
              </View>
            </View>
          ) : null}
        </Card>

        {/* ── Cobrança e conta ── */}
        <Card style={s.cartao}>
          <CabecaDoCartao titulo="Cobrança e conta" desc="Estes sempre chegam, porque tratam da sua assinatura e da sua segurança." />
          <Linha titulo="Lembrete de fatura" desc="2 dias antes e no dia do vencimento, com o Pix pronto."><Etiqueta tom="neutro" texto="Sempre enviamos" /></Linha>
          <Linha titulo="Pagamento recebido" desc="O recibo, na hora."><Etiqueta tom="neutro" texto="Sempre enviamos" /></Linha>
          <Linha titulo="Atraso e cartão que não passou" desc="Quando algo não deu certo com o pagamento."><Etiqueta tom="neutro" texto="Sempre enviamos" /></Linha>
          <Linha titulo="Segurança da conta" desc="Confirmação de e-mail e redefinição de senha."><Etiqueta tom="neutro" texto="Sempre enviamos" /></Linha>
        </Card>

        {/* ── Ajuda, acompanhamento e novidades ── */}
        <Card style={s.cartao}>
          <CabecaDoCartao titulo="Ajuda e acompanhamento" />
          <Linha titulo="Ajuda para começar" desc="Quando a primeira venda demora e quando o teste está terminando.">
            <Interruptor id="emails-ajuda" rotulo="Ajuda para começar" valor={d.preferencias.ajuda.ligado} onChange={(v) => salvar({ ajuda: { ligado: v } })} />
          </Linha>
          <Linha titulo="Faz uns dias que você não aparece" desc="Um e-mail do Caio para saber se está tudo bem.">
            <Interruptor id="emails-acompanhamento" rotulo="Acompanhamento" valor={d.preferencias.acompanhamento.ligado} onChange={(v) => salvar({ acompanhamento: { ligado: v } })} />
          </Linha>
          <Linha titulo="Novidades da Aura" desc="Quando lançamos uma função nova que pode te ajudar.">
            <Interruptor id="emails-novidades" rotulo="Novidades da Aura" valor={d.preferencias.novidades.ligado} onChange={(v) => salvar({ novidades: { ligado: v } })} />
          </Linha>
        </Card>

        {/* ── Pedido novo na loja online (só quem tem loja online) ── */}
        {temLojaOnline ? (
          <View testID="emails-pedido-loja">
            <Card style={s.cartao}>
              <CabecaDoCartao titulo="Pedido novo na loja online" desc="Aviso quando um cliente faz um pedido.">
                <Interruptor id="emails-pedido" rotulo="Pedido novo" valor={pedido.ligado} onChange={(v) => salvar({ pedido_loja: { ligado: v } })} />
              </CabecaDoCartao>
              {pedido.ligado ? (
                <View style={s.grupo}>
                  <Text style={s.rotulo}>Quem recebe</Text>
                  <Text style={s.desc}>
                    {pedido.pedido_destino === "enderecos"
                      ? "Vai para os e-mails confirmados acima."
                      : "Vai para todas as pessoas da equipe."}
                  </Text>
                  <View style={s.chips}>
                    <Chip testID="emails-pedido-equipe" ativo={pedido.pedido_destino !== "enderecos"} rotulo="Todos da equipe" onPress={() => { if (pedido.pedido_destino === "enderecos") salvar({ pedido_loja: { pedido_destino: "equipe" } }); }} />
                    <Chip testID="emails-pedido-enderecos" ativo={pedido.pedido_destino === "enderecos"} rotulo="Só os e-mails acima" onPress={() => { if (pedido.pedido_destino !== "enderecos") salvar({ pedido_loja: { pedido_destino: "enderecos" } }); }} />
                  </View>
                </View>
              ) : null}
            </Card>
          </View>
        ) : null}

        {/* ── Últimos e-mails enviados ── */}
        <Card style={s.cartao}>
          <CabecaDoCartao titulo="Últimos e-mails enviados" />
          {ultimosQ.isLoading ? (
            <ActivityIndicator color={Colors.violet3} style={{ alignSelf: "flex-start" }} />
          ) : ultimosQ.isError ? (
            <View style={s.erroBox}>
              <Text style={s.desc}>Não consegui carregar a lista.</Text>
              <Pressable onPress={() => ultimosQ.refetch()} accessibilityRole="button" style={s.btnSec}>
                <Text style={s.btnSecText}>Tentar de novo</Text>
              </Pressable>
            </View>
          ) : emails.length === 0 ? (
            <Text testID="emails-ultimos-vazio" style={s.desc}>Nenhum e-mail da Aura nos últimos {ultimosQ.data?.dias ?? 30} dias.</Text>
          ) : (
            <View testID="emails-ultimos">
              {listaVisivel.map((e, i) => {
                const sit = situacaoExibida(e.situacao);
                const quando = dataEHora(e.data);
                return (
                  <View key={e.id || i} style={[s.item, i === listaVisivel.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={s.itemQuando}>
                      <Text style={s.itemData}>{quando.data}</Text>
                      {quando.hora ? <Text style={s.campoNota}>{quando.hora}</Text> : null}
                    </View>
                    <View style={s.itemTexto}>
                      <Text style={s.itemAssunto} numberOfLines={2}>{e.assunto || "E-mail da Aura"}</Text>
                      {e.destinatario ? <Text style={s.campoNota} numberOfLines={1}>{e.destinatario}</Text> : null}
                    </View>
                    <Etiqueta
                      testID={"emails-situacao-" + (e.id || i)}
                      tom={sit === "entregue" ? "ok" : sit === "devolvido" ? "aviso" : sit === "falhou" ? "erro" : "neutro"}
                      texto={ROTULO_SITUACAO[sit]}
                    />
                  </View>
                );
              })}
              {emails.length > 8 ? (
                <Pressable onPress={() => setVerTodos(!verTodos)} accessibilityRole="button" style={[s.btnLink, { marginTop: 6 }]}>
                  <Text style={s.btnLinkText}>{verTodos ? "Ver menos" : "Ver todos (" + emails.length + ")"}</Text>
                </Pressable>
              ) : null}
            </View>
          )}
          <Text testID="emails-ultimos-nota" style={s.desc}>
            {"Aparece só o que a Aura enviou para você nos últimos " + (ultimosQ.data?.dias ?? 30) + " dias."
              + (ultimosQ.data?.webhook_ligado ? " \"Entregue\" e \"Devolvido\" vêm do aviso do serviço de envio." : "")
              + (algumDevolvido ? " Se um e-mail voltou, confira se o endereço está certo." : "")}
          </Text>
        </Card>
      </>
    );
  }

  return (
    <View testID="emails-secao" {...tourTarget(alvoDaSecao("emails"))}>
      <SectionTitle title="E-mails" />
      {corpo}
    </View>
  );
}

const s = StyleSheet.create({
  legenda: { fontSize: 12, color: Colors.ink3, lineHeight: 17, marginBottom: 10 },
  cartao: { gap: 12, paddingBottom: 16, marginBottom: 10 },
  carregando: { flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 8 },
  erroBox: { gap: 8, alignItems: "flex-start", paddingBottom: 4 },
  titulo: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  rotulo: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  desc: { fontSize: 12, color: Colors.ink3, lineHeight: 17 },
  linha: { flexDirection: "row", alignItems: "center", gap: 12 },
  linhaTexto: { flex: 1, minWidth: 0, gap: 2 },
  campoBloco: { gap: 6 },
  campo: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  campoTexto: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "baseline", gap: 6, flexWrap: "wrap" },
  campoEmail: { fontSize: 13.5, color: Colors.ink, flexShrink: 1 },
  campoNota: { fontSize: 11, color: Colors.ink3 },
  etiqueta: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  etiquetaText: { fontSize: 11, fontWeight: "700" },
  acoes: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  novoBox: { gap: 8 },
  input: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: Colors.ink },
  relCorpo: { gap: 14, paddingTop: 2 },
  grupo: { gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3, minHeight: 36, justifyContent: "center" },
  chipOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  chipText: { fontSize: 13, color: Colors.ink2, fontWeight: "500" },
  chipTextOn: { color: "#fff", fontWeight: "700" },
  marcador: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 32 },
  caixa: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  caixaOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  marcadorText: { fontSize: 13.5, color: Colors.ink, flex: 1 },
  btn: { backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  btnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  btnSec: { borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  btnSecText: { fontSize: 13, fontWeight: "600", color: Colors.ink2 },
  btnLink: { paddingVertical: 6, paddingHorizontal: 2 },
  btnLinkText: { fontSize: 12.5, fontWeight: "600", color: Colors.violet3 },
  btnPerigo: { borderWidth: 1, borderColor: Colors.red + "55", backgroundColor: Colors.redD, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  btnPerigoText: { fontSize: 13, fontWeight: "700", color: Colors.red },
  item: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemQuando: { width: 52 },
  itemData: { fontSize: 12.5, color: Colors.ink2, fontWeight: "600" },
  itemTexto: { flex: 1, minWidth: 0, gap: 2 },
  itemAssunto: { fontSize: 13, color: Colors.ink },
});
