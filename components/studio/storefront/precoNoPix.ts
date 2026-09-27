// ============================================================
// components/studio/storefront/precoNoPix.ts
//
// "ou R$ 35,91 no Pix" — no cartão do produto.
//
// As duas referências do mercado (Aqui Tem Caneca, DNA Presentes) mostram
// o preço no Pix em 100% dos cartões. Nós só mostrávamos no total do
// checkout: a cliente descobria o desconto depois de decidir, quando ele
// já não decidia nada.
//
// QA 27/09: a conta mora em precoDaSacola.ts (a regra canônica, em
// centavos, combinada com o backend) e é a MESMA da peça, da sacola e do
// checkout. Este módulo só a reexporta para quem já importava daqui.
// ============================================================
export { precoNoPix } from "./precoDaSacola";
