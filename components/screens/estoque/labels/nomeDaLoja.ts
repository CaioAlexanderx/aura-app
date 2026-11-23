// ============================================================================
// AURA. — Etiquetas: nome da loja no topo (24/10/2026)
//
// Até aqui o nome nunca saía: a tela lia company.trade_name / legal_name, que
// o login e o /auth/me não mandavam (só `name`). Com o backend mandando os
// dois campos, o nome passaria a sair em TODAS as etiquetas, porque o toggle
// "Incluir nome da loja no topo" nascia ligado. Isso mudaria a etiqueta de
// todas as lojas — proibido (etiquetas: HTML idêntico para quem não pediu).
//
// Regra:
//   - nome = nome da loja pela regra única (utils/nomeDaLoja.ts);
//   - o toggle nasce DESLIGADO em todos os modelos e medidas;
//   - exceção: o desenho "tag vertical" (Minha medida em pé, ehTagVertical),
//     que foi desenhado com a loja no topo — lá nasce LIGADO;
//   - a lojista pode ligar ou desligar em qualquer modelo; a escolha vale
//     para a visita (não é guardada, como antes) e volta ao padrão quando
//     ela troca de modelo ou de medida.
//
// Para desfazer: nomeDaLojaLigadoPorPadrao devolver false (nenhuma etiqueta
// sai com o nome sem a lojista marcar), ou reverter o PR.
// ============================================================================
import { customLabelPreset, type CustomLabelSpec } from "./customLabel";
import { nomeDaLojaDe, type EmpresaComNome } from "@/utils/nomeDaLoja";

/** Nome que vai no topo da etiqueta: a regra única do app
 *  (utils/nomeDaLoja.ts, 21/11/2026) — nome fantasia > razão social > name.
 *  Para toda empresa que o app guarda, sai o mesmo texto de antes
 *  (__tests__/nomeDaLojaUnico.test.ts, byte a byte). */
export function nomeDaLojaDaEmpresa(company: EmpresaComNome): string {
  return nomeDaLojaDe(company);
}

/** Padrão do toggle: ligado só quando a impressão sai no desenho tag vertical
 *  (medida própria em pé + código de barras; no QR a medida em pé usa o
 *  editorial, então segue desligado). */
export function nomeDaLojaLigadoPorPadrao(medida: CustomLabelSpec | null | undefined, mode: "barcode" | "qr"): boolean {
  if (!medida || mode !== "barcode") return false;
  return customLabelPreset(medida).design === "tagVertical";
}

/** null = a lojista ainda não mexeu no toggle neste modelo: vale o padrão. */
export function mostrarNomeDaLoja(escolha: boolean | null, medida: CustomLabelSpec | null | undefined, mode: "barcode" | "qr"): boolean {
  return escolha === null ? nomeDaLojaLigadoPorPadrao(medida, mode) : escolha;
}
