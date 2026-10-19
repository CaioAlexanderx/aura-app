// ============================================================
// AURA. -- Tamanhos digitados em lista no cadastro (p-35, 18/10/2026)
// "P, M, G" entrava como UM tamanho chamado "P, M, G". Agora o texto do
// campo vira vários tamanhos.
//
// Regra de divisão (aprovada pela frente de Produto):
//  - perfil padrão: vírgula, ponto e vírgula e quebra de linha separam.
//    Exceção: um pedaço que é um decimal com unidade ("1,200L", "1,5 mm",
//    "2,5kg") fica inteiro.
//  - perfil Matcon: só ";", quebra de linha e "vírgula + espaço" separam,
//    para "1,5 mm, 2,5 mm" dar duas medidas e "1,5mm" continuar uma só.
// ============================================================
import { ordenarTamanhos } from "@/utils/ordemDeTamanhos";

export type PerfilDosTamanhos = "padrao" | "matcon";

// Número com vírgula decimal seguido de unidade: "1,200L", "1,5 mm", "2,5kg".
var DECIMAL_COM_UNIDADE = /^\d+,\d+\s*[^\d\s,;]+$/;

/** Divide o texto digitado em tamanhos, sem vazios e sem duplicados. */
export function dividirTamanhos(texto: string, perfil: PerfilDosTamanhos = "padrao"): string[] {
  var bruto = String(texto == null ? "" : texto);
  var pedacos: string[];
  if (perfil === "matcon") {
    pedacos = bruto.split(/;|\r?\n|\r|,\s+/);
  } else {
    pedacos = [];
    bruto.split(/;|\r?\n|\r/).forEach(function(parte) {
      var t = parte.trim();
      if (DECIMAL_COM_UNIDADE.test(t)) pedacos.push(t);
      else pedacos.push.apply(pedacos, t.split(","));
    });
  }
  return semRepetir(pedacos.map(function(x) { return x.trim(); }).filter(Boolean));
}

/**
 * Junta os tamanhos novos aos que já existem, sem duplicar (sem diferenciar
 * maiúscula: o que já existe vale) e na ordem PP, P, M, G... (ordenarTamanhos).
 */
export function juntarTamanhos(existentes: string[], novos: string[]): string[] {
  return ordenarTamanhos(semRepetir((existentes || []).concat(novos || [])));
}

function semRepetir(lista: string[]): string[] {
  var vistos = new Set<string>();
  var out: string[] = [];
  lista.forEach(function(t) {
    var k = t.trim().toLocaleUpperCase("pt-BR");
    if (!k || vistos.has(k)) return;
    vistos.add(k);
    out.push(t);
  });
  return out;
}
