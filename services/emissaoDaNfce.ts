// ============================================================
// AURA. — services/emissaoDaNfce.ts (17/11/2026, p-147 / R3b)
//
// A emissão da NFC-e fora do componente. Antes o NfceActions guardava o
// estado (enviando, autorizada, recusada) e a consulta à SEFAZ dentro dele:
// quando a tela de venda concluída saía (Enter, bipe do próximo produto), a
// requisição seguia no servidor, mas o resultado ia para um componente que
// não existia mais. Uma recusa ficava escondida.
//
// Agora o pedido e a consulta moram aqui, por chave:
//   - chave da venda do Caixa (`chaveDaNotaDaVenda`): o estado sobrevive à
//     tela final e a faixa da venda anterior (FaixaDaVendaAnterior) lê o
//     mesmo estado;
//   - sem chave (Troca, Studio): o NfceActions usa uma chave só dele e
//     esquece ao desmontar, como era antes.
//
// Mesmas regras e mesmos avisos do NfceActions de antes (status da SEFAZ,
// consulta de 3 em 3 s até 10 vezes, consulta do PDF de 2 em 2 s até 5).
// ============================================================
import { nfceApi, type EmitBody, type EmitResponse } from "@/services/nfceApi";
import { toast } from "@/components/Toast";
import { nfcePulada } from "@/utils/nfseAutomatica";

export type FaseDaNota = "idle" | "emitting" | "authorized" | "rejected" | "error" | "skipped";

export type EstadoDaNota = {
  fase: FaseDaNota;
  resultado: EmitResponse | null;
  erro: string | null;
  payloadDoErro: any;
  /** Consultas feitas enquanto a SEFAZ processa (0 = nenhuma). */
  tentativas: number;
  /** Quantas vezes a nota foi dada como autorizada (o NfceActions chama o
   *  onEmitted a cada vez que este número sobe). */
  autorizacoes: number;
  /** A consulta desistiu com a nota ainda "processando". */
  esgotou: boolean;
  /** Alguém tocou em "Ver o motivo" da recusa (a faixa ganha o ×). */
  motivoVisto: boolean;
};

export const NOTA_PARADA: EstadoDaNota = Object.freeze({
  fase: "idle", resultado: null, erro: null, payloadDoErro: null,
  tentativas: 0, autorizacoes: 0, esgotou: false, motivoVisto: false,
}) as EstadoDaNota;

type Registro = {
  estado: EstadoDaNota;
  companyId: string;
  corpo: EmitBody | null;
  timer: any;
  /** Sobe a cada emissão: resposta de um pedido antigo não pisa no novo. */
  geracao: number;
};

const registros = new Map<string, Registro>();
const ouvintes = new Map<string, Set<() => void>>();

/** A chave da nota da venda do Caixa (a mesma na tela final e na faixa). */
export function chaveDaNotaDaVenda(saleId: string): string {
  return "venda:" + saleId;
}

function avisar(chave: string) {
  const set = ouvintes.get(chave);
  if (!set) return;
  Array.from(set).forEach(fn => { try { fn(); } catch {} });
}

function mudar(chave: string, parcial: Partial<EstadoDaNota>) {
  const r = registros.get(chave);
  if (!r) return;
  r.estado = { ...r.estado, ...parcial };
  avisar(chave);
}

function pararConsulta(r: Registro) {
  if (r.timer) { clearTimeout(r.timer); r.timer = null; }
}

export function estadoDaNota(chave: string): EstadoDaNota {
  const r = registros.get(chave);
  return r ? r.estado : NOTA_PARADA;
}

export function assinarNota(chave: string, fn: () => void): () => void {
  let set = ouvintes.get(chave);
  if (!set) { set = new Set(); ouvintes.set(chave, set); }
  set.add(fn);
  return () => {
    const s = ouvintes.get(chave);
    if (!s) return;
    s.delete(fn);
    if (s.size === 0) ouvintes.delete(chave);
  };
}

/** Esquece a nota (para a consulta). O NfceActions sem chave chama ao desmontar. */
export function esquecerNota(chave: string) {
  const r = registros.get(chave);
  if (!r) return;
  pararConsulta(r);
  r.geracao++;
  registros.delete(chave);
  avisar(chave);
}

/** "Ver o motivo" da faixa: a recusa foi vista. */
export function marcarMotivoVisto(chave: string) {
  const r = registros.get(chave);
  if (!r || r.estado.motivoVisto) return;
  mudar(chave, { motivoVisto: true });
}

/** Pede a NFC-e. Com um pedido em andamento para a mesma chave, o novo vale. */
export function emitirNota(chave: string, companyId: string, corpo: EmitBody): Promise<void> {
  let r = registros.get(chave);
  if (!r) {
    r = { estado: NOTA_PARADA, companyId, corpo, timer: null, geracao: 0 };
    registros.set(chave, r);
  }
  pararConsulta(r);
  r.companyId = companyId;
  r.corpo = corpo;
  const geracao = ++r.geracao;
  mudar(chave, { fase: "emitting", erro: null, payloadDoErro: null, tentativas: 0, esgotou: false, motivoVisto: false });

  const vivo = () => {
    const atual = registros.get(chave);
    return !!atual && atual === r && atual.geracao === geracao;
  };

  let pedido: Promise<EmitResponse>;
  try {
    if (!companyId) throw new Error("Empresa não identificada");
    pedido = nfceApi.emit(companyId, corpo);
  } catch (e) {
    pedido = Promise.reject(e);
  }

  return pedido.then((res) => {
    if (!vivo()) return;
    // Venda só de serviço: não há mercadoria para o cupom fiscal. Não é
    // erro nem sucesso — e nada de "NFC-e #undefined autorizada".
    if (nfcePulada(res)) { mudar(chave, { fase: "skipped", resultado: res }); return; }
    const status = res?.nfce?.status;
    if (status === "autorizada") {
      mudar(chave, { fase: "authorized", resultado: res, autorizacoes: estadoDaNota(chave).autorizacoes + 1 });
      toast.success(`NFC-e #${res.nfce.numero} autorizada!`);
      if (!res.pdf_url && !res.nfce.pdf_url) consultarPdf(chave, res.nfce.id);
    } else if (status === "rejeitada") {
      mudar(chave, { fase: "rejected", resultado: res, erro: res.nfce.error_message || "Nota rejeitada pela SEFAZ" });
    } else if (status === "processando") {
      mudar(chave, { fase: "authorized", resultado: res });
      consultarAutorizacao(chave, res.nfce.id);
    } else {
      mudar(chave, { fase: "authorized", resultado: res });
    }
  }, (err: any) => {
    if (!vivo()) return;
    mudar(chave, {
      fase: "error",
      erro: err?.message || "Erro ao emitir NFC-e",
      payloadDoErro: err?.data?.payload || null,
    });
  });
}

/** "Tentar de novo" fora da tela final: o mesmo pedido da última vez. */
export function tentarDeNovo(chave: string): Promise<void> | null {
  const r = registros.get(chave);
  if (!r || !r.corpo) return null;
  return emitirNota(chave, r.companyId, r.corpo);
}

function juntarEmissao(prev: EmitResponse | null, emission: any): EmitResponse {
  return {
    ...(prev as EmitResponse),
    nfce: emission,
    pdf_url: emission.pdf_url,
    xml_url: emission.xml_url,
    qr_code: emission.qr_code,
    url_consulta: emission.url_consulta,
  };
}

function consultarAutorizacao(chave: string, emissionId: string) {
  const r = registros.get(chave);
  if (!r || !r.companyId || r.timer) return;
  const geracao = r.geracao;
  let tentativa = 0;
  const maximo = 10;
  const vivo = () => registros.get(chave) === r && r.geracao === geracao;
  const tique = async () => {
    if (!vivo()) return;
    tentativa++;
    mudar(chave, { tentativas: tentativa });
    try {
      const { emission } = await nfceApi.get(r.companyId, emissionId);
      if (!vivo()) return;
      if (emission.status === "autorizada") {
        r.timer = null;
        mudar(chave, { resultado: juntarEmissao(r.estado.resultado, emission), autorizacoes: r.estado.autorizacoes + 1 });
        toast.success(`NFC-e #${emission.numero} autorizada!`);
        return;
      }
      if (emission.status === "rejeitada" || emission.status === "erro") {
        r.timer = null;
        mudar(chave, { fase: "rejected", erro: emission.error_message || "Nota rejeitada" });
        return;
      }
      if (tentativa >= maximo) {
        r.timer = null;
        mudar(chave, { esgotou: true });
        toast.info("SEFAZ ainda processando a nota — acompanhe na aba Notas.");
        return;
      }
      r.timer = setTimeout(tique, 3000);
    } catch { if (vivo()) r.timer = null; }
  };
  r.timer = setTimeout(tique, 3000);
}

function consultarPdf(chave: string, emissionId: string) {
  const r = registros.get(chave);
  if (!r || !r.companyId || r.timer) return;
  const geracao = r.geracao;
  let tentativa = 0;
  const vivo = () => registros.get(chave) === r && r.geracao === geracao;
  const tique = async () => {
    if (!vivo()) return;
    tentativa++;
    try {
      const { emission } = await nfceApi.get(r.companyId, emissionId);
      if (!vivo()) return;
      if (emission.pdf_url) {
        r.timer = null;
        mudar(chave, { resultado: juntarEmissao(r.estado.resultado, emission) });
        return;
      }
      if (tentativa >= 5) { r.timer = null; return; }
      r.timer = setTimeout(tique, 2000);
    } catch { if (vivo()) r.timer = null; }
  };
  r.timer = setTimeout(tique, 2000);
}

/** Só para testes. */
export function __zerarNotasParaTestes() {
  registros.forEach(r => pararConsulta(r));
  registros.clear();
  ouvintes.clear();
}
