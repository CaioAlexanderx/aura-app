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
// ============================================================
import type { CustomizationConfig, CustomizationField } from "./types";

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
  const semGaleria = cfg.fields.filter((f: CustomizationField) => f?.type !== "template");
  if (semGaleria.length === cfg.fields.length) return cfg;
  return { ...cfg, fields: semGaleria } as T;
}
