// ============================================================
// AURA. — Cadastro do cliente por link (p-210 e p-211, 23/11/2026)
//
// O lojista manda um link pelo WhatsApp (envio MANUAL, wa.me) e o cliente
// preenche o cadastro no celular. Regras puras da página pública e do
// botão do lojista. Backend: Aura-backend, src/routes/customerSignupLinks.js
// e src/routes/cadastroLinkPublic.js.
//
// REGRAS (Caio, 23/11/2026):
//   - A mensagem leva SÓ o link e o nome da loja. Nunca nome completo,
//     CPF, receita ou qualquer dado do cliente.
//   - A página pública só grava; nunca mostra dado já cadastrado.
//   - Receita e dado de saúde ficam fora do formulário.
//   - Nada automático: o WhatsApp oficial da ótica segue em espera.
// ============================================================
import { isValidCpf, maskCpf, maskDateBR, maskPhone, onlyDigits } from "@/utils/mask";

// ── Aviso de privacidade ─────────────────────────────────────
//
// TEXTO JURÍDICO NOVO, DO CAIO. Enquanto ele não mandar, fica null: a
// página mostra o formulário, mas o aceite não aparece e o botão de enviar
// NÃO liga. Para ligar: escrever o texto em AVISO_DE_PRIVACIDADE e trocar
// a versão (vai gravada junto do aceite, em customer_signup_links).
export const AVISO_DE_PRIVACIDADE: string | null = null;
export const VERSAO_DO_AVISO = "pendente";

export function avisoPronto(aviso: string | null | undefined = AVISO_DE_PRIVACIDADE): aviso is string {
  return typeof aviso === "string" && aviso.trim().length > 0;
}

// ── Formulário do cliente ────────────────────────────────────

export type FormularioDoCadastro = {
  name: string;
  birth_date: string; // dd/mm/aaaa
  cpf: string;
  zip_code: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  phone: string;
  email: string;
};

export const FORMULARIO_VAZIO: FormularioDoCadastro = {
  name: "", birth_date: "", cpf: "", zip_code: "", street: "", number: "",
  complement: "", neighborhood: "", city: "", state: "", phone: "", email: "",
};

export const mascaras = {
  cpf: maskCpf,
  birth_date: maskDateBR,
  phone: maskPhone,
  zip_code: (v: string) => {
    const d = onlyDigits(v).slice(0, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  },
  state: (v: string) => v.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase(),
};

/** dd/mm/aaaa com ano, data que existe, entre 1900 e hoje. */
export function dataDeNascimentoValida(br: string, hoje: Date = new Date()): boolean {
  const m = String(br || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return false;
  const d = Number(m[1]), mes = Number(m[2]), a = Number(m[3]);
  const dt = new Date(a, mes - 1, d);
  if (dt.getFullYear() !== a || dt.getMonth() !== mes - 1 || dt.getDate() !== d) return false;
  return a >= 1900 && dt.getTime() <= hoje.getTime();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ErrosDoFormulario = Partial<Record<keyof FormularioDoCadastro, string>>;

/** Os mesmos limites do servidor, para o erro aparecer ao lado do campo. */
export function errosDoFormulario(f: FormularioDoCadastro): ErrosDoFormulario {
  const e: ErrosDoFormulario = {};
  const nome = f.name.trim().replace(/\s+/g, " ");
  if (!nome) e.name = "Escreva o seu nome completo.";
  else if (nome.split(" ").length < 2) e.name = "Escreva o nome completo, com sobrenome.";
  if (!dataDeNascimentoValida(f.birth_date)) e.birth_date = "Confira a data de nascimento (dia, mês e ano).";
  if (!isValidCpf(f.cpf)) e.cpf = "Confira o CPF: os números não batem.";
  const cep = onlyDigits(f.zip_code);
  if (cep && cep.length !== 8) e.zip_code = "O CEP precisa ter 8 números.";
  if (f.state.trim() && !/^[A-Za-z]{2}$/.test(f.state.trim())) e.state = "A UF precisa ter 2 letras.";
  const tel = onlyDigits(f.phone);
  if (tel && tel.length < 10) e.phone = "Confira o telefone, com DDD.";
  if (f.email.trim() && !EMAIL_RE.test(f.email.trim())) e.email = "Confira o e-mail.";
  return e;
}

/** Corpo do POST público. Campo vazio não vai. */
export function corpoDoEnvio(f: FormularioDoCadastro, versaoDoAviso: string = VERSAO_DO_AVISO) {
  const corpo: Record<string, unknown> = {
    name: f.name.trim().replace(/\s+/g, " "),
    birth_date: f.birth_date,
    cpf: onlyDigits(f.cpf),
    consent: { accepted: true, version: versaoDoAviso },
  };
  const opcionais: (keyof FormularioDoCadastro)[] = ["zip_code", "street", "number", "complement", "neighborhood", "city", "state", "phone", "email"];
  for (const k of opcionais) {
    const v = f[k].trim();
    if (!v) continue;
    corpo[k] = k === "zip_code" ? onlyDigits(v) : k === "state" ? v.toUpperCase() : v;
  }
  return corpo;
}

/**
 * O botão de enviar só liga com o aviso pronto, o aceite marcado e o
 * formulário sem erro. Sem o texto do Caio, não liga nunca.
 */
export function podeEnviar(f: FormularioDoCadastro, aceite: boolean, aviso: string | null | undefined = AVISO_DE_PRIVACIDADE): boolean {
  return avisoPronto(aviso) && aceite && Object.keys(errosDoFormulario(f)).length === 0;
}

// ── Lado do lojista ──────────────────────────────────────────

const APP_URL = "https://app.getaura.com.br";

/** Endereço completo do link, na origem em que o app está aberto. */
export function urlDoLink(path: string, origem?: string | null): string {
  let base = origem;
  if (!base && typeof window !== "undefined" && window.location && /^https?:/.test(window.location.origin || "")) {
    base = window.location.origin;
  }
  return String(base || APP_URL).replace(/\/+$/, "") + path;
}

/**
 * A mensagem pronta (mockup aprovado, seção 5). Só o nome da LOJA e o
 * link: o nome do cliente fica de fora de propósito (a regra é a
 * mensagem não levar dado pessoal nenhum).
 */
export function mensagemDoLink(nomeDaLoja: string, url: string): string {
  const loja = String(nomeDaLoja || "").trim() || "a loja";
  return `Oi! Aqui é da ${loja}. Para agilizar a sua compra, preencha o seu cadastro neste link, leva 1 minuto: ${url}\n\nO link é só seu e vale por 7 dias.`;
}

export type EstadoDoLink = "enviado" | "recebido" | "vencido" | "substituido";

/** Texto do estado na ficha e no Caixa. */
export function rotuloDoEstado(status: EstadoDoLink | null | undefined, quando?: string | null): string | null {
  const data = quando ? dataCurta(quando) : "";
  switch (status) {
    case "enviado": return "Link enviado";
    case "recebido": return data ? `Cadastro recebido em ${data}` : "Cadastro recebido";
    case "vencido": return "O link venceu sem resposta";
    default: return null;
  }
}

function dataCurta(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export type Pendencia = { field: string; label: string; current: any; received: any };

/** Como mostrar o valor de uma pendência ao lojista (tela autenticada). */
export function valorDaPendencia(field: string, v: any): string {
  if (v === null || v === undefined || v === "") return "vazio";
  if (field === "cpf_cnpj") return maskCpf(String(v));
  if (field === "birth_date") {
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v);
  }
  if (field === "phone") return maskPhone(String(v));
  if (field === "address" && typeof v === "object") {
    const rua = [v.street, v.number].filter(Boolean).join(", ");
    const resto = [v.complement, v.neighborhood, [v.city, v.state].filter(Boolean).join("/")].filter(Boolean).join(" · ");
    const cep = v.zip_code ? `CEP ${mascaras.zip_code(String(v.zip_code))}` : "";
    return [rua, resto, cep].filter(Boolean).join(" · ") || "vazio";
  }
  return String(v);
}
