// ============================================================
// AURA. — Aviso de NCM que não existe na tabela da Receita (18/10/2026, t3-05)
//
// 3 de 3 rejeições de NFC-e em 30 dias foram a 778 (NCM inexistente): o código
// errado entrava no cadastro sem ninguém avisar e só estourava na emissão.
//
// Devolve o texto do aviso quando o NCM tem 8 números e a Receita não o
// conhece; senão null. NUNCA bloqueia nada: é só texto para mostrar. Se a
// consulta falhar (rede, servidor), não mostra aviso — melhor calar do que
// acusar um NCM bom.
//
// Dispara quando o campo chega a 8 números (digitou o último, tocou em
// "Sugerir" ou abriu um produto já cadastrado), com 400 ms de espera.
// ============================================================
import { useEffect, useState } from "react";
import { fiscalApi } from "@/services/fiscalApi";

// Texto PROPOSTO (aguarda aprovação do Caio). O servidor manda o mesmo texto;
// este é só a reserva caso a resposta venha sem `mensagem`.
export const AVISO_NCM_INEXISTENTE =
  "Este NCM não existe na tabela da Receita. A nota fiscal com ele é recusada. Confira o código na nota do fornecedor.";

// Uma consulta por código por sessão (a tabela só muda por resolução da Gecex).
const respostas = new Map<string, string | null>();

/** Só para os testes. */
export function __limparCacheDeNcm() { respostas.clear(); }

export function useAvisoDeNcm(ncm: string | null | undefined): string | null {
  var digitos = String(ncm || "").replace(/\D/g, "");
  var [aviso, setAviso] = useState<string | null>(null);

  useEffect(function () {
    if (digitos.length !== 8) { setAviso(null); return; }
    if (respostas.has(digitos)) { setAviso(respostas.get(digitos) as string | null); return; }
    var vivo = true;
    var espera = setTimeout(function () {
      // Promise.resolve().then: um erro síncrono ou uma resposta fora do esperado
      // (mock, cliente antigo) nunca pode derrubar o formulário.
      Promise.resolve().then(function () { return fiscalApi.ncm(digitos); }).then(function (r) {
        var msg = r && r.existe === false ? (r.mensagem || AVISO_NCM_INEXISTENTE) : null;
        respostas.set(digitos, msg);
        if (vivo) setAviso(msg);
      }).catch(function () {
        if (vivo) setAviso(null);
      });
    }, 400);
    return function () { vivo = false; clearTimeout(espera); };
  }, [digitos]);

  return aviso;
}
