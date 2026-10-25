// ============================================================
// Gestão Aura › Registrar contato — regras do formulário (14/10/2026)
//
// Funções puras, sem React: opções (iguais aos enums do backend, migration
// 383), atalhos de data, validação e montagem do corpo do POST
// /admin/painel/contatos. A tela é RegistrarContatoModal.tsx.
//
// Mockup: docs/mockups/registrar-contato.html. Meta: registrar em 10
// segundos — por isso resultado e canal são toques, a frase é uma linha e o
// próximo passo tem atalhos de +1, +3 e +7 dias.
// ============================================================
import type {
  PainelApiContatoCanal, PainelApiContatoCheckin, PainelApiContatoCorpo, PainelApiContatoMarcador,
  PainelApiContatoMotivo, PainelApiContatoResultado,
} from "@/services/adminApi";

export type Opcao<T extends string> = { id: T; rotulo: string; tom?: "bom" | "risco" };

export var RESULTADOS: Opcao<PainelApiContatoResultado>[] = [
  { id: "respondeu", rotulo: "Respondeu" },
  { id: "sem_resposta", rotulo: "Sem resposta" },
  { id: "pediu_tempo", rotulo: "Pediu um tempo" },
  { id: "combinou_ligacao", rotulo: "Combinou ligação" },
  { id: "quer_assinar", rotulo: "Quer assinar", tom: "bom" },
  { id: "nao_quer", rotulo: "Não quer", tom: "risco" },
];

export var CANAIS: Opcao<PainelApiContatoCanal>[] = [
  { id: "whatsapp", rotulo: "WhatsApp" },
  { id: "ligacao", rotulo: "Ligação" },
  { id: "email", rotulo: "E-mail" },
  { id: "presencial", rotulo: "Presencial" },
];

// "O que pesou": as 9 classes do relatório de perdas (spec da Cassie, 13/10)
// mais "motivo externo" (backend#900, migration 412): o negócio fechou, mudou
// de ramo ou perdeu o ponto. Com "Não quer", a conta guardada recebe o e-mail
// "Sua conta da Aura fica guardada" no fim do teste.
export var MOTIVOS: Opcao<PainelApiContatoMotivo>[] = [
  { id: "estoque_na_entrada", rotulo: "Estoque na entrada" },
  { id: "preco_plano", rotulo: "Preço do plano" },
  { id: "fiscal", rotulo: "Fiscal" },
  { id: "atrito_produto", rotulo: "Atrito no produto" },
  { id: "funcionalidade", rotulo: "Falta funcionalidade" },
  { id: "frente_errada", rotulo: "Frente errada" },
  { id: "ritmo_do_cliente", rotulo: "Ritmo do cliente" },
  { id: "concorrente", rotulo: "Concorrente" },
  { id: "elogio", rotulo: "Elogio" },
  { id: "motivo_externo", rotulo: "Motivo externo (fechou, mudou de ramo, perdeu o ponto)" },
];

export var MARCADORES: Opcao<PainelApiContatoMarcador>[] = [
  { id: "importacao_assistida_pedida", rotulo: "Pedida" },
  { id: "importacao_assistida_entregue", rotulo: "Entregue" },
];

// Check-in da equipe (vai para companies.checkin). como_chegou é a lista da
// Cassie (aprovada pelo Caio em 13/10); fiado e quem decide não tinham opções
// fechadas na spec — o backend aceita texto curto, então ajustar é só aqui.
export var COMO_CHEGOU: Opcao<string>[] = [
  { id: "indicacao", rotulo: "Indicação" },
  { id: "botao_whatsapp_site", rotulo: "Botão WhatsApp do site" },
  { id: "cadastro_direto", rotulo: "Cadastro direto" },
  { id: "ia", rotulo: "IA" },
  { id: "google", rotulo: "Google" },
  { id: "instagram", rotulo: "Instagram" },
  { id: "prospeccao_caio", rotulo: "Prospecção do Caio" },
  { id: "outro", rotulo: "Outro" },
];
export var FIADO: Opcao<string>[] = [
  { id: "sim", rotulo: "Sim" },
  { id: "nao", rotulo: "Não" },
  { id: "as_vezes", rotulo: "Às vezes" },
];
export var QUEM_DECIDE: Opcao<string>[] = [
  { id: "dono", rotulo: "Dono" },
  { id: "socio", rotulo: "Sócio" },
  { id: "gerente", rotulo: "Gerente" },
  { id: "outro", rotulo: "Outro" },
];

// Erro sem mensagem do servidor (rede, timeout): o contato pode ter entrado.
export var MSG_ERRO_PADRAO =
  "Não conseguimos confirmar se o contato foi salvo; confira na ficha antes de tentar de novo.";

export var ATALHOS_DE_DATA = [1, 3, 7];
export var MAX_FRASE = 500;
export var MAX_PROXIMO_PASSO = 120;

export type FormContato = {
  resultado: PainelApiContatoResultado | null;
  canal: PainelApiContatoCanal | null;
  frase: string;
  motivo: PainelApiContatoMotivo | null;
  proximoPasso: string;
  dias: number | null;                 // atalho escolhido (+1, +3, +7); null = sem data
  marcador: PainelApiContatoMarcador | null;
  comoChegou: string | null;
  fiado: string | null;
  quemDecide: string | null;
};

// WhatsApp já marcado: é o canal da maioria dos contatos.
export function formVazio(): FormContato {
  return {
    resultado: null, canal: "whatsapp", frase: "", motivo: null, proximoPasso: "", dias: null,
    marcador: null, comoChegou: null, fiado: null, quemDecide: null,
  };
}

// Dia de hoje em Brasília, 'YYYY-MM-DD'.
export function hojeBRT(agora: number = Date.now()): string {
  return new Date(agora - 3 * 3600000).toISOString().slice(0, 10);
}

export function somarDias(ymd: string, dias: number): string {
  var [a, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

var SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

// "sexta, 16/10": o dia da semana evita marcar o retorno no domingo sem ver.
export function rotuloDaData(ymd: string): string {
  var [a, m, d] = ymd.split("-").map(Number);
  var dia = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return SEMANA[dia] + ", " + String(d).padStart(2, "0") + "/" + String(m).padStart(2, "0");
}

export type ErrosDoForm = Partial<Record<"resultado" | "canal" | "frase" | "motivo" | "proximoPasso", string>>;

// Mesmas regras do POST: resultado, canal e frase obrigatórios; motivo
// obrigatório quando o resultado é "não quer".
export function validar(f: FormContato): { ok: boolean; erros: ErrosDoForm } {
  var erros: ErrosDoForm = {};
  if (!f.resultado) erros.resultado = "Escolha como foi o contato.";
  if (!f.canal) erros.canal = "Escolha o canal.";
  var frase = f.frase.trim();
  if (!frase) erros.frase = "Escreva uma frase do que aconteceu.";
  else if (frase.length > MAX_FRASE) erros.frase = "Até " + MAX_FRASE + " caracteres.";
  if (f.resultado === "nao_quer" && !f.motivo) erros.motivo = "Diga o que pesou.";
  if (f.proximoPasso.trim().length > MAX_PROXIMO_PASSO) erros.proximoPasso = "Até " + MAX_PROXIMO_PASSO + " caracteres.";
  return { ok: Object.keys(erros).length === 0, erros: erros };
}

export type AlvoDoContato = { company_id: string } | { lead_id: string };

// Corpo do POST. Só vai o que foi preenchido; o motivo de quem não é "não
// quer" também vai (elogio, por exemplo), e `checkin` só com algum chip.
export function montarCorpo(f: FormContato, alvo: AlvoDoContato, hoje: string = hojeBRT()): PainelApiContatoCorpo {
  var corpo: PainelApiContatoCorpo = {
    ...(alvo as object),
    canal: f.canal as PainelApiContatoCanal,
    resultado: f.resultado as PainelApiContatoResultado,
    body: f.frase.trim(),
  } as PainelApiContatoCorpo;
  var proximo = f.proximoPasso.trim();
  if (proximo) corpo.proximo_passo = proximo;
  if (f.dias) corpo.proximo_passo_em = somarDias(hoje, f.dias);
  if (f.motivo) corpo.motivo = f.motivo;
  if (f.marcador) corpo.marcador = f.marcador;
  var checkin: PainelApiContatoCheckin = {};
  if (f.comoChegou) checkin.como_chegou = f.comoChegou;
  if (f.fiado) checkin.fiado = f.fiado;
  if (f.quemDecide) checkin.quem_decide = f.quemDecide;
  if (Object.keys(checkin).length) corpo.checkin = checkin;
  return corpo;
}

export function rotuloDoResultado(id: string | null | undefined): string {
  var o = RESULTADOS.filter(function(r) { return r.id === id; })[0];
  return o ? o.rotulo : "";
}
export function rotuloDoCanal(id: string | null | undefined): string {
  var o = CANAIS.filter(function(r) { return r.id === id; })[0];
  return o ? o.rotulo : "";
}
export function rotuloDoMotivo(id: string | null | undefined): string {
  var o = MOTIVOS.filter(function(r) { return r.id === id; })[0];
  return o ? o.rotulo : "";
}

// Verbos do painel que são, na prática, "fiz um contato": o botão abre o
// Registrar contato. "WhatsApp" abre o wa.me direto (nunca chega aqui).
export function ehVerboDeContato(verbo: string | null | undefined): boolean {
  var v = String(verbo || "").trim().toLowerCase();
  if (!v) return false;
  return v === "registrar contato" || v === "ligar" || v.indexOf("oferecer") === 0 || v.indexOf("chamar") === 0;
}

// "+7 dias": estender o teste (rota extend-trial, com confirmação).
export function ehVerboDeTrial(verbo: string | null | undefined): boolean {
  return /^\+\s*7\s*dias$/i.test(String(verbo || "").trim());
}
