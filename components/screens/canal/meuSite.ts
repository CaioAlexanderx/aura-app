// ============================================================
// Canal digital · aba Meu Site — as regras puras do formulário
//
// Saíram da tela para serem testadas: o QA de 26/09 achou campo apagado
// que não apagava, desconto do Pix que mostrava 35 depois de o servidor
// gravar 30 e o teclado numérico abrindo para chave Pix de e-mail.
// ============================================================
import { maskPhone } from "@/utils/masks";

export type TipoDaChavePix = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "RANDOM";

/** O que a lojista vê e edita na aba — texto como está no campo. */
export type FormDoMeuSite = {
  siteName: string;
  tagline: string;
  description: string;
  phone: string;
  whatsapp: string;
  instagram: string;
  tiktok: string;
  facebook: string;
  address: string;
  color: string;
  published: boolean;
  pixKey: string;
  pixKeyType: TipoDaChavePix;
  pixHolderName: string;
  pixHolderCity: string;
  payOnDelivery: boolean;
  cardEnabled: boolean;
  parcelas: number | null;
  politica: string;
  pixPct: string;
};

/**
 * As chaves de TEXTO que o formulário manda. Todas vão SEMPRE no corpo do
 * PUT: o backend (PR paralelo) passa a tratar "chave presente com null"
 * como "apagar" e "chave ausente" como "não mexer". Se uma delas faltasse,
 * apagar o campo e salvar deixaria o texto antigo na loja.
 */
export const CHAVES_DE_TEXTO = [
  "site_name", "tagline", "description", "phone", "whatsapp",
  "instagram", "tiktok", "facebook", "address",
  "pix_key", "pix_holder_name", "pix_holder_city", "politica_troca",
] as const;

/** Teto do desconto no Pix — o mesmo do servidor (migration 309). */
export const PIX_PCT_MAX = 30;

/**
 * O desconto digitado, como número. Aceita vírgula ("7,5"), apara entre
 * 0 e 30 e arredonda em duas casas — a mesma trava do servidor, para a
 * tela não prometer um valor que não vai ser gravado.
 */
export function lerPct(texto: string | number | null | undefined): number {
  const n = Number(String(texto ?? "").trim().replace(",", "."));
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.min(PIX_PCT_MAX, Math.max(0, n)) * 100) / 100;
}

/** O desconto como a lojista lê: "7,5", "30", "0". */
export function formatarPct(valor: string | number | null | undefined): string {
  const n = lerPct(valor);
  return String(n).replace(".", ",");
}

/** O formulário a partir do GET. `nomeDaEmpresa` preenche o nome vazio. */
export function formDoMeuSite(config: any, nomeDaEmpresa?: string | null): FormDoMeuSite {
  const c = config || {};
  return {
    siteName: c.site_name || nomeDaEmpresa || "",
    tagline: c.tagline || "",
    description: c.description || "",
    phone: maskPhone(c.phone || ""),
    whatsapp: maskPhone(c.whatsapp || ""),
    instagram: c.instagram || "",
    tiktok: c.tiktok || "",
    facebook: c.facebook || "",
    address: c.address || "",
    color: c.primary_color || "#7c3aed",
    published: c.is_published ?? false,
    pixKey: c.pix_key || "",
    pixKeyType: (c.pix_key_type as TipoDaChavePix) || "CPF",
    pixHolderName: c.pix_holder_name || "",
    pixHolderCity: c.pix_holder_city || "",
    payOnDelivery: c.pay_on_delivery_enabled === true,
    cardEnabled: c.card_enabled !== false,
    parcelas: c.card_max_installments ?? null,
    politica: c.politica_troca || "",
    pixPct: formatarPct(c.pix_discount_pct ?? 0),
  };
}

/**
 * O corpo do PUT. Campo vazio vai como `null` (= apagar) e TODAS as
 * chaves de texto estão presentes, sempre — ver CHAVES_DE_TEXTO.
 */
export function corpoDoMeuSite(f: FormDoMeuSite, politicaPadrao = "") {
  const t = (v: string) => (v || "").trim() || null;
  const politica = (f.politica || "").trim();
  return {
    site_name: t(f.siteName),
    tagline: t(f.tagline),
    description: t(f.description),
    phone: t(f.phone),
    whatsapp: t(f.whatsapp),
    instagram: t(f.instagram),
    tiktok: t(f.tiktok),
    facebook: t(f.facebook),
    address: t(f.address),
    primary_color: f.color,
    is_published: f.published,
    pix_key: t(f.pixKey),
    pix_key_type: (f.pixKey || "").trim() ? f.pixKeyType : null,
    pix_holder_name: t(f.pixHolderName),
    pix_holder_city: t(f.pixHolderCity),
    pay_on_delivery_enabled: f.payOnDelivery,
    card_enabled: f.cardEnabled,
    card_max_installments: f.parcelas,
    // Campo em branco volta ao padrao — e assim que ela desfaz uma edicao
    // sem ter que recopiar o texto de lugar nenhum. Texto igual ao padrao
    // tambem salva vazio: melhora do padrao continua chegando em quem
    // nunca escreveu nada proprio.
    politica_troca: politica && politica !== (politicaPadrao || "").trim() ? politica : null,
    pix_discount_pct: lerPct(f.pixPct),
  };
}

/** A tela tem alteração que ainda não foi para o servidor? */
export function meuSiteAlterado(atual: FormDoMeuSite, salvo: FormDoMeuSite, politicaPadrao = ""): boolean {
  return JSON.stringify(corpoDoMeuSite(atual, politicaPadrao)) !== JSON.stringify(corpoDoMeuSite(salvo, politicaPadrao));
}

/**
 * O teclado do campo "Chave". Antes era numérico para todo tipo: quem
 * tinha chave de e-mail não achava o @ no celular.
 */
export function tecladoDaChavePix(tipo: TipoDaChavePix): {
  inputMode: "numeric" | "email" | "text";
  keyboardType: "number-pad" | "email-address" | "default";
  autoCapitalize: "none";
} {
  if (tipo === "EMAIL") return { inputMode: "email", keyboardType: "email-address", autoCapitalize: "none" };
  if (tipo === "RANDOM") return { inputMode: "text", keyboardType: "default", autoCapitalize: "none" };
  return { inputMode: "numeric", keyboardType: "number-pad", autoCapitalize: "none" };
}

/**
 * A dica embaixo de "Site publicado". Com o interruptor diferente do que
 * está salvo, avisa: sem isso ela desligava, trocava de aba e achava que
 * a loja tinha saído do ar.
 */
export function dicaDoPublicado(ligado: boolean, salvo: boolean): string {
  const base = ligado ? "Visível para clientes" : "Site oculto";
  return ligado === salvo ? base : `${base} · alteração não salva`;
}
