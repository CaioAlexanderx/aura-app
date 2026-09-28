// ============================================================
// components/studio/storefront/camposDaVitrine.ts
//
// Quais campos do configurador a vitrine mostra de verdade.
//
// O campo "Escolher template da galeria" existe no produto, mas a loja
// pode não ter arte pronta nenhuma cadastrada. Aí a vitrine mostrava o
// título, o asterisco de obrigatório e a frase "Loja não cadastrou
// templates ainda." — recado para a lojista, na tela da cliente. E a
// pendência do rodapé pedia arte em "Foto do cliente" ou "Escolher
// template da galeria", oferecendo um caminho que não existe.
//
// A regra: campo de arte pronta sem arte pronta não é campo, e some da
// lista ANTES de renderizar e de validar — os dois lados leem daqui,
// para o aviso e o botão nunca discordarem.
//
// QA 28/09 (CAMISA A. POLO não podia ser comprada): a peça só tinha a
// galeria como origem da arte, obrigatória, e a galeria da loja estava
// vazia. O campo sumia da página ("Tudo pronto para a sacola"), mas a
// validação do "Adicionar" lia a config crua e barrava com "Envie sua
// arte em 'Escolher template da galeria'", sem lugar para enviar. Agora:
//   - se o lado JÁ tem envio de arquivo, a galeria sai e passa a
//     obrigatoriedade para o envio (o grupo da arte continua exigido);
//   - se a galeria era a ÚNICA origem do lado, ela vira envio de arquivo
//     (mesmo id: o servidor valida o grupo da arte pelo id do campo, e o
//     valor da galeria já era a URL de uma imagem).
// A validação do "Adicionar" (useStorefront.commitConfigure) passa a ler
// esta mesma config.
// ============================================================
import type { CustomizationConfig, CustomizationField } from "./types";
import { sideOf } from "@/components/studio/customizationConfig";

/** O rótulo do envio que ocupa o lugar da galeria vazia. */
export const ROTULO_DO_ENVIO_NO_LUGAR_DA_GALERIA = "Envie sua arte";

/**
 * A configuração com só os campos que a cliente consegue preencher.
 *
 * Devolve o mesmo objeto quando nada muda, para não invalidar memos
 * à toa.
 */
export function configDisponivel<T extends CustomizationConfig | null | undefined>(
  cfg: T,
  templates: Array<{ id?: string }> | null | undefined,
): T {
  if (!cfg || !Array.isArray(cfg.fields)) return cfg;
  const temArtePronta = Array.isArray(templates) && templates.length > 0;
  if (temArtePronta) return cfg;
  const campos = cfg.fields as CustomizationField[];
  if (!campos.some((f) => f?.type === "template")) return cfg;

  // A galeria de cada lado passa a obrigatoriedade ao envio do lado.
  const exigePorLado = new Map<string, boolean>();
  for (const f of campos) {
    if (f?.type === "template" && f.required) exigePorLado.set(sideOf(f as any), true);
  }
  const ladosComEnvio = new Set(campos.filter((f) => f?.type === "image").map((f) => sideOf(f as any)));

  const fields: CustomizationField[] = [];
  const convertido = new Set<string>();
  for (const f of campos) {
    if (!f) continue;
    const lado = sideOf(f as any);
    if (f.type === "image") {
      fields.push(exigePorLado.get(lado) && !f.required ? { ...f, required: true } : f);
      continue;
    }
    if (f.type !== "template") { fields.push(f); continue; }
    // Lado sem envio: a primeira galeria vira o envio de arquivo.
    if (!ladosComEnvio.has(lado) && !convertido.has(lado)) {
      convertido.add(lado);
      fields.push({
        ...f,
        type: "image",
        label: ROTULO_DO_ENVIO_NO_LUGAR_DA_GALERIA,
        required: !!exigePorLado.get(lado),
        config: {},
      } as CustomizationField);
    }
  }
  return { ...cfg, fields } as T;
}
