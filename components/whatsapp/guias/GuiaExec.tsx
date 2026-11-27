// ============================================================
// GuiaExec — o que o balão faz junto com a lojista (artboard GuiaExecucao)
//
// O balão chama as MESMAS ações e guardas da tela:
//   · conectar   — clica o botão real "Conectar" (o Embedded Signup que já existe);
//                  se ele está desabilitado (SDK carregando), o balão não finge.
//   · aniversário/cobrança — hook useWaAutomaticas (ligar com aceite, salvar pontos),
//                  waAutoBlockers, o aceite das novidades e a prévia do servidor.
//   · produto    — a lojista manda o produto na conversa de verdade; o passo
//                  segue quando o envio dá certo (contador do store).
// O passo avança pelo ESTADO (status conectado, automação ligada, produto
// enviado), nunca pelo clique. "Agora não" não liga nada.
// ============================================================
import React, { useState } from "react";
import { useWaPublico } from "@/hooks/useWaAutomatica";
import { waAutoBlockers } from "../waGuards";
import { PONTOS_ROTULO, alternarPonto, lerPontos, nomeDoMes, rotuloDoPresente } from "../waAutomaticaConfig";
import { pluralize } from "@/utils/plural";
import { tourSelector } from "@/utils/tourTarget";
import type { GuiaCtx, PassoGuia } from "./guiasConteudo";

export interface ExecProps {
  passo: PassoGuia;
  ctx: GuiaCtx;
  /** Vai ao passo seguinte (ou fecha, no último). */
  proximo: () => void;
  /** Fecha o guia sem marcar como feito ("Faço depois"). */
  pular: () => void;
  /** Termina este guia e abre o guia n. */
  encadear: (n: 1 | 2 | 3) => void;
  /** O produto foi mandado depois que o passo abriu. */
  produtoFeito: boolean;
}

const Icone = () => (
  <span className="ic" aria-hidden="true">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
  </span>
);

export function BotaoPrincipal({ children, onClick, disabled, seta, wa, testID }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; seta?: boolean; wa?: boolean; testID?: string;
}) {
  return (
    <button type="button" className={"wag-btn1" + (seta ? " seta" : "") + (wa ? " wa" : "")} onClick={onClick} disabled={disabled} data-testid={testID}>
      {children}{seta && <Icone />}
    </button>
  );
}

function Check({ on, onClick, children, testID }: { on: boolean; onClick: () => void; children: React.ReactNode; testID?: string }) {
  return (
    <button type="button" className="wag-chk" role="checkbox" aria-checked={on} onClick={onClick} data-testid={testID}>
      <span className={"wag-box" + (on ? " on" : "")} aria-hidden="true">{on ? "✓" : ""}</span>
      <span>{children}</span>
    </button>
  );
}

const Aviso = ({ children, cor, testID }: { children: React.ReactNode; cor?: string; testID?: string }) => (
  <span data-testid={testID} style={{ fontSize: 13, lineHeight: 1.45, color: cor || "rgba(184,172,223,.86)" }}>{children}</span>
);

/** Motivos que travam o liga da automática (a mesma regra do resto do app), sem o de template. */
export function bloqueiosDoLiga(ctx: GuiaCtx): string[] {
  return waAutoBlockers(ctx.status).filter((b) => b.code !== "TEMPLATE").map((b) => b.label);
}

/** Clica o botão real da tela. Devolve false se ele não está lá ou está desabilitado. */
export function tocaNaTela(chave: string): boolean {
  if (typeof document === "undefined") return false;
  try {
    const el = document.querySelector(tourSelector(chave)) as HTMLElement | null;
    if (!el) return false;
    if (el.getAttribute("aria-disabled") === "true" || (el as any).disabled) return false;
    el.click();
    return true;
  } catch { return false; }
}

// ── Guia 1 ───────────────────────────────────────────────────────────
function Antes({ proximo, pular, ctx }: ExecProps) {
  const [cel, setCel] = useState(false);
  const [fb, setFb] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const bloqueio = ctx.status?.token_expired === true ? "A autorização da Meta expirou: use Reconectar na tela." : null;
  return (
    <>
      <div>
        <Check on={cel} onClick={() => setCel(!cel)} testID="guia-chk-cel">Estou com o celular do WhatsApp da loja</Check>
        <Check on={fb} onClick={() => setFb(!fb)} testID="guia-chk-fb">Sei entrar no Facebook da loja</Check>
      </div>
      {!!bloqueio && <Aviso cor="#fcd34d">{bloqueio}</Aviso>}
      {falhou && <Aviso cor="#fcd34d" testID="guia-conectar-falhou">O botão ainda está carregando. Espere um instante e toque de novo.</Aviso>}
      {/* o botão verde acende com as duas conferências e chama o botão REAL da tela (o Embedded Signup que já existe) */}
      <BotaoPrincipal wa disabled={!(cel && fb)} testID="guia-acao" onClick={() => {
        if (tocaNaTela("wa.conectar")) { setFalhou(false); proximo(); } else setFalhou(true);
      }}>Conectar com o WhatsApp</BotaoPrincipal>
      <button type="button" className="wag-lnk" style={{ alignSelf: "flex-start", paddingLeft: 0 }} onClick={pular} data-testid="guia-faco-depois">Faço depois</button>
    </>
  );
}

function Aguardar({ ctx }: ExecProps) {
  return (
    <>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }} data-testid="guia-aguardando">
        <span className="wag-spin" aria-hidden="true" />
        <b style={{ fontSize: 16, fontWeight: 800 }}>Esperando o WhatsApp confirmar</b>
      </div>
      <Aviso>Esta tela segue sozinha quando terminar.</Aviso>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="wag-lnk" style={{ paddingLeft: 0 }} onClick={() => { tocaNaTela("wa.conectar"); }}>
          A janela não abriu? Abrir de novo
        </button>
      </div>
      {ctx.conectado && <Aviso cor="#6ee7b7">Conectado.</Aviso>}
    </>
  );
}

function Conectado({ ctx, passo, encadear }: ExecProps) {
  return (
    <>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <span className="wag-okc" aria-hidden="true">✓</span>
        <b style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-.02em" }} data-testid="guia-numero-ligado">{ctx.telefone ? `${ctx.telefone} ligado` : "WhatsApp ligado"}</b>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <BotaoPrincipal seta onClick={() => encadear(2)} testID="guia-acao">{passo.cta || "Ligar as automáticas"}</BotaoPrincipal>
      </div>
    </>
  );
}

// ── Guia 2 ───────────────────────────────────────────────────────────
// ── Prévias com o número REAL (a mesma conta da tela: prévia e público das automáticas) ──
export interface CorteMin { total: number; cabem: number }
const minus = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

/** "Em dezembro são 7 aniversariantes; cabem 4 nas novidades do Aniversário, começando por quem mais compra. Presente: 10% de desconto." */
export function previaAniversario(corte: CorteMin | null, mes: string | null | undefined, presente: string | null): string | null {
  if (!corte) return null;
  const n = corte.total;
  const quem = `${n === 1 ? "é" : "são"} ${pluralize(n, "aniversariante")}`;
  return `Em ${minus(nomeDoMes(mes))} ${quem}; ${corte.cabem === 1 ? "cabe" : "cabem"} ${corte.cabem} nas novidades do Aniversário, começando por quem mais compra.${presente ? ` Presente: ${presente}.` : ""}`;
}
/** "34 clientes não compram há mais de 30 dias. Todo dia 1º, as 4 que mais compravam recebem R$ 20 de desconto. As outras esperam o mês seguinte." */
export function previaVendaMais(corte: CorteMin | null, presente: string | null): string | null {
  if (!corte) return null;
  const n = corte.total, x = corte.cabem;
  const quem = x === 1 ? "a 1 que mais comprava recebe" : `as ${x} que mais compravam recebem`;
  const resto = n - x;
  const fim = resto > 0 ? ` ${resto === 1 ? "A outra espera" : "As outras esperam"} o mês seguinte.` : "";
  return `${n === 1 ? "1 cliente não compra" : `${n} clientes não compram`} há mais de 30 dias. Todo dia 1º, ${quem} ${presente || "a mensagem"}.${fim}`;
}
/** "Amanhã saem 3 avisos. 3 por parcela; ficam 72 de 100 avisos este mês." */
export function previaCobranca(p: { saem: number | null; porParcela: number; restantes: number | null; total: number | null }): string | null {
  if (p.saem == null) return null;
  const a = p.saem === 1 ? "Amanhã sai 1 aviso." : `Amanhã saem ${p.saem} avisos.`;
  const b = `${p.porParcela} por parcela`;
  const c = p.restantes != null && p.total != null
    ? `; ${p.restantes === 1 ? "fica" : "ficam"} ${p.restantes} de ${p.total} avisos este mês.` : ".";
  return `${a} ${b}${c}`;
}

const NOVIDADE = {
  aniversario: { titulo: "Aniversário", ligado: "Aniversário ligado", botao: "Ligar o aniversário", dono: "Aniversário" },
  venda_mais: { titulo: "Venda+", ligado: "Venda+ ligado", botao: "Ligar o Venda+", dono: "Venda+" },
} as const;

function Novidade({ ctx, proximo, chave }: ExecProps & { chave: "aniversario" | "venda_mais" }) {
  const t = NOVIDADE[chave];
  const info = ctx.auto.info;
  const cfg = info?.autos[chave];
  const ligada = cfg?.ligada === true;
  const precisaAceite = !!info && !info.aceiteEm;
  const [aceite, setAceite] = useState(false);
  const [ligando, setLigando] = useState(false);
  const segmento = chave === "venda_mais" ? (typeof (cfg?.config as any)?.segmento === "string" ? (cfg!.config as any).segmento : "sumindo") : undefined;
  const pub = useWaPublico(ctx.companyId, chave, segmento, cfg?.livres ?? null, !!cfg && !ligada, JSON.stringify(cfg?.config || {}));
  const bloqueios = bloqueiosDoLiga(ctx);
  const presente = rotuloDoPresente((cfg?.config as any)?.presente);
  const corte = pub.corte;

  if (!info || !cfg) {
    return <Aviso cor="#fcd34d" testID="guia-auto-indisponivel">Não consegui ler as mensagens automáticas agora. Por segurança, nada é ligado nem alterado até eu conseguir.</Aviso>;
  }
  if (ligada) {
    return (
      <>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span className="wag-okc" aria-hidden="true">✓</span>
          <b style={{ fontSize: 16, fontWeight: 800 }} data-testid={chave === "aniversario" ? "guia-aniv-ligado" : "guia-venda-ligado"}>{t.ligado}</b>
        </div>
        <Aviso>Desligar é a qualquer hora, no próprio cartão.</Aviso>
        <div><BotaoPrincipal seta onClick={proximo} testID="guia-proximo-exec">Próximo</BotaoPrincipal></div>
      </>
    );
  }
  const pode = !ligando && !ctx.auto.salvando && bloqueios.length === 0 && (!precisaAceite || aceite);
  const previa = chave === "aniversario"
    ? previaAniversario(corte, info.mes, presente)
    : previaVendaMais(corte, presente);
  return (
    <>
      {!!previa && (
        <Aviso testID={chave === "aniversario" ? "guia-aniv-previa" : "guia-venda-previa"}>
          {previa}
        </Aviso>
      )}
      {precisaAceite && (
        <Check on={aceite} onClick={() => setAceite(!aceite)} testID="guia-chk-aceite">Meus clientes aceitaram receber novidades da loja pelo WhatsApp</Check>
      )}
      {bloqueios.length > 0 && <Aviso cor="#fcd34d" testID="guia-auto-bloqueio">{bloqueios[0]}</Aviso>}
      {!!ctx.auto.erro && <Aviso cor="#fca5a5">{ctx.auto.erro}</Aviso>}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <BotaoPrincipal disabled={!pode} testID="guia-acao" onClick={async () => {
          setLigando(true);
          try { await ctx.auto.ligar(chave, true, precisaAceite ? true : undefined); } finally { setLigando(false); }
        }}>{t.botao}</BotaoPrincipal>
        <button type="button" className="wag-lnk" onClick={proximo} data-testid="guia-agora-nao">Agora não</button>
      </div>
    </>
  );
}

function Pronto({ ctx, passo, encadear, proximo }: ExecProps) {
  const autos = ctx.auto.info?.autos || {};
  const liga: string[] = [];
  if (autos.aniversario?.ligada) liga.push("Aniversário");
  if (autos.crediario_cobrar?.ligada) liga.push("cobrança do crediário");
  if (autos.venda_mais?.ligada) liga.push("Venda+");
  const resumo = liga.length ? `Ligado: ${liga.join(", ")}.` : "Nada foi ligado. Os cartões ficam aqui para quando quiser.";
  return (
    <>
      <p className="wag-p" data-testid="guia-resumo">{resumo} Desligar é a qualquer hora, no próprio cartão.</p>
      <div>
        {ctx.hubVisible
          ? <BotaoPrincipal seta onClick={() => encadear(3)} testID="guia-acao">{passo.cta || "Ver como usar a conversa"}</BotaoPrincipal>
          : <BotaoPrincipal seta onClick={proximo} testID="guia-acao">Entendi</BotaoPrincipal>}
      </div>
    </>
  );
}

function Cobranca({ ctx, proximo }: ExecProps) {
  const info = ctx.auto.info;
  const cobrar = info?.autos.crediario_cobrar;
  const ligada = cobrar?.ligada === true;
  const pontos = lerPontos(cobrar?.config?.pontos);
  const [ligando, setLigando] = useState(false);
  const pub = useWaPublico(ctx.companyId, "crediario_cobrar", undefined, null, !!cobrar, JSON.stringify(cobrar?.config || {}));
  const bloqueios = bloqueiosDoLiga(ctx);
  const saem = typeof pub.publico?.amanha?.saem === "number" ? pub.publico!.amanha!.saem! : null;
  const algum = !!pontos && PONTOS_ROTULO.some((p) => pontos[p.k]);

  if (!info || !cobrar) {
    return <Aviso cor="#fcd34d" testID="guia-auto-indisponivel">Não consegui ler o Crediário agora. Por segurança, nada é ligado nem alterado até eu conseguir.</Aviso>;
  }
  if (ligada) {
    return (
      <>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span className="wag-okc" aria-hidden="true">✓</span>
          <b style={{ fontSize: 16, fontWeight: 800 }} data-testid="guia-cobr-ligada">Cobrança ligada</b>
        </div>
        <Aviso>Desligar é a qualquer hora, no próprio cartão.</Aviso>
        <div><BotaoPrincipal seta onClick={proximo} testID="guia-proximo-exec">Próximo</BotaoPrincipal></div>
      </>
    );
  }
  const pode = !ligando && !ctx.auto.salvando && bloqueios.length === 0 && algum;
  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }} role="group" aria-label="Quando cobrar">
        {PONTOS_ROTULO.map((p) => {
          const on = !!pontos?.[p.k];
          return (
            <button
              key={p.k} type="button" className={"wag-pill" + (on ? " on" : "")} role="checkbox" aria-checked={on}
              disabled={!pontos || ctx.auto.salvando} data-testid={`guia-ponto-${p.k}`}
              onClick={() => { if (pontos) ctx.auto.salvarConfig("crediario_cobrar", { pontos: alternarPonto(pontos, p.k) }); }}
            >{p.rotulo}</button>
          );
        })}
      </div>
      {(() => {
        const t = previaCobranca({
          saem, porParcela: pontos ? PONTOS_ROTULO.filter((p) => pontos[p.k]).length : 0,
          restantes: ctx.saldo ? ctx.saldo.avisos.restante : null, total: ctx.saldo ? ctx.saldo.avisos.total : null,
        });
        return t ? <Aviso testID="guia-cobr-previa">{t}</Aviso> : null;
      })()}
      {bloqueios.length > 0 && <Aviso cor="#fcd34d" testID="guia-auto-bloqueio">{bloqueios[0]}</Aviso>}
      {!!ctx.auto.erro && <Aviso cor="#fca5a5">{ctx.auto.erro}</Aviso>}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <BotaoPrincipal disabled={!pode} testID="guia-acao" onClick={async () => {
          setLigando(true);
          try { await ctx.auto.ligar("crediario_cobrar", true); } finally { setLigando(false); }
        }}>Ligar a cobrança</BotaoPrincipal>
        <button type="button" className="wag-lnk" onClick={proximo} data-testid="guia-agora-nao">Agora não</button>
      </div>
    </>
  );
}

// ── Guia 3 ───────────────────────────────────────────────────────────
function Produto({ produtoFeito, proximo }: ExecProps) {
  if (produtoFeito) {
    return (
      <>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span className="wag-okc" aria-hidden="true">✓</span>
          <b style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-.02em" }} data-testid="guia-produto-feito">Foi, e de graça<span style={{ color: "#9a6cf7" }}>.</span></b>
        </div>
        <p className="wag-p">Orçamento, Pix, link da loja, foto e áudio funcionam do mesmo jeito. Quando a conversa fechar, a Aura mostra o convite pronto e quanto ele custa antes de mandar.</p>
        <div><BotaoPrincipal seta onClick={proximo} testID="guia-proximo-exec">Próximo</BotaoPrincipal></div>
      </>
    );
  }
  return (
    <>
      <p className="wag-p">Toque em Produto e escolha um. Nada que você mandar agora gasta saldo.</p>
      <Aviso testID="guia-produto-espera">O guia segue quando o produto chegar na conversa.</Aviso>
      <div><button type="button" className="wag-lnk" style={{ paddingLeft: 0 }} onClick={proximo} data-testid="guia-pular-passo">Pular este passo</button></div>
    </>
  );
}

export function ExecBloco(p: ExecProps) {
  switch (p.passo.exec) {
    case "antes": return <Antes {...p} />;
    case "aguardar": return <Aguardar {...p} />;
    case "conectado": return <Conectado {...p} />;
    case "aniversario": return <Novidade {...p} chave="aniversario" />;
    case "venda": return <Novidade {...p} chave="venda_mais" />;
    case "pronto": return <Pronto {...p} />;
    case "cobranca": return <Cobranca {...p} />;
    case "produto": return <Produto {...p} />;
    default: return null;
  }
}
