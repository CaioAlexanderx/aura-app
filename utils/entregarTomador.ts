// ============================================================
// AURA. — Rede de segurança: leva o CPF/CNPJ do Caixa até a NFS-e da venda
//
// Desde 10/11/2026 o documento vai JUNTO com a venda (POST /pdv/sale
// nfse_tomador; o backend grava em sales.nfse_tomador e ele vence o cadastro
// do cliente). Com esse backend no ar a nota não fica pendente por falta de
// tomador e este helper só lê a situação e sai sem fazer nada.
//
// Fica para o caso em que o app está à frente do backend (deploy em ordem
// trocada, build pulado, PR revertido): um backend que ignora nfse_tomador
// ainda lê o tomador só do CADASTRO do cliente ou do POST
// /origem/venda/:id/completar. Se a nota ficou 'pendente_dados' por falta de
// tomador, este helper manda o documento (e o nome, quando há) no /completar.
//
// Roda fora do ciclo da tela (a lojista pode apertar "Nova venda" na hora):
// algumas leituras com espera crescente até o gatilho automático decidir
// (ele roda logo depois do COMMIT da venda). Uma vez por venda.
//
// Cliente selecionado com CPF/CNPJ válido no cadastro: o backend já emite
// com ele e o helper não faz nada.
// ============================================================
import { nfseAutomaticaApi, type SituacaoNfse, type TomadorNfse } from "@/services/nfseAutomaticaApi";
import { docValido, faltaTomador } from "@/utils/nfseAutomatica";
import { onlyDigits } from "@/lib/validators";

const ESPERAS = [800, 1500, 2500, 4000, 6000, 8000];
const jaEntregues = new Set<string>();

type Deps = {
  api?: Pick<typeof nfseAutomaticaApi, "situacao" | "completar">;
  esperar?: (ms: number) => Promise<void>;
};

const esperarPadrao = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function entregarTomadorDaVenda(
  p: { companyId: string; saleId: string; tomador: TomadorNfse },
  deps: Deps = {},
): Promise<SituacaoNfse | null> {
  const api = deps.api || nfseAutomaticaApi;
  const esperar = deps.esperar || esperarPadrao;
  const doc = onlyDigits(p.tomador.doc);
  if (!p.companyId || !p.saleId || !docValido(doc)) return null;
  const chave = p.companyId + ":" + p.saleId;
  if (jaEntregues.has(chave)) return null;
  jaEntregues.add(chave);

  for (let i = 0; i < ESPERAS.length; i++) {
    await esperar(ESPERAS[i]);
    let s: SituacaoNfse;
    try {
      s = await api.situacao(p.companyId, "venda", p.saleId);
    } catch (e: any) {
      if (e && e.status === 404) return null; // backend sem a rota ou venda de outra loja
      continue;
    }
    if (faltaTomador(s)) {
      try {
        return await api.completar(p.companyId, "venda", p.saleId, {
          doc,
          nome: (p.tomador.nome || "").trim() || null,
        });
      } catch (_) {
        jaEntregues.delete(chave); // a tela ainda oferece "Completar o cliente"
        return null;
      }
    }
    // Emitida, com erro de outra natureza ou cancelada: nada a levar.
    if (s.estado !== "nenhuma" && s.estado !== "emitindo") return s;
  }
  return null;
}

/** Só para os testes: esquece as vendas já atendidas. */
export function _esquecerEntregas() { jaEntregues.clear(); }
