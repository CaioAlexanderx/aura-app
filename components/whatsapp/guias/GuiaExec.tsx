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
import { PONTOS_ROTULO, alternarPonto, lerPontos, rotuloDoPresente } from "../waAutomaticaConfig";
import { tourSelector } from "@/utils/tourTarget";
import type { GuiaCtx, PassoGuia } from "./guiasConteudo";

export interface ExecProps {
  passo: PassoGuia;
  ctx: GuiaCtx;
  /** Vai ao passo seguinte (ou fecha, no último). */
  proximo: () => void;
  /** Termina este guia e abre o 2. */
  encadear: () => void;
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
function Antes({ proximo, passo }: ExecProps) {
  const [cel, setCel] = useState(false);
  const [fb, setFb] = useState(false);
  return (
    <>
      <div>
        <Check on={cel} onClick={() => setCel(!cel)} testID="guia-chk-cel">Estou com o celular do WhatsApp da loja</Check>
        <Check on={fb} onClick={() => setFb(!fb)} testID="guia-chk-fb">Sei entrar no Facebook da loja</Check>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <BotaoPrincipal seta onClick={proximo} disabled={!(cel && fb)} testID="guia-acao">{passo.cta || "Próximo"}</BotaoPrincipal>
      </div>
    </>
  );
}

function Conectar({ passo, ctx, proximo }: ExecProps) {
  const [falhou, setFalhou] = useState(false);
  const bloqueio = ctx.status?.token_expired === true ? "A autorização da Meta expirou: use Reconectar na tela." : null;
  return (
    <>
      {!!bloqueio && <Aviso cor="#fcd34d">{bloqueio}</Aviso>}
      {falhou && <Aviso cor="#fcd34d" testID="guia-conectar-falhou">O botão ainda está carregando. Espere um instante e toque de novo.</Aviso>}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <BotaoPrincipal wa testID="guia-acao" onClick={() => {
          // o gesto do toque passa direto para o botão real: a janela do Facebook abre como se tivesse sido tocado ali
          if (tocaNaTela("wa.conectar")) { setFalhou(false); proximo(); } else setFalhou(true);
        }}>{passo.cta || "Conectar"}</BotaoPrincipal>
      </div>
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
        <BotaoPrincipal seta onClick={encadear} testID="guia-acao">{passo.cta || "Ligar as automáticas"}</BotaoPrincipal>
      </div>
    </>
  );
}

// ── Guia 2 ───────────────────────────────────────────────────────────
function Aniversario({ ctx, proximo }: ExecProps) {
  const info = ctx.auto.info;
  const cfg = info?.autos.aniversario;
  const ligada = cfg?.ligada === true;
  const precisaAceite = !!info && !info.aceiteEm;
  const [aceite, setAceite] = useState(false);
  const [ligando, setLigando] = useState(false);
  const pub = useWaPublico(ctx.companyId, "aniversario", undefined, cfg?.livres ?? null, !!cfg && !ligada, JSON.stringify(cfg?.config || {}));
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
          <b style={{ fontSize: 16, fontWeight: 800 }} data-testid="guia-aniv-ligado">Aniversário ligado</b>
        </div>
        <Aviso>Desligar é a qualquer hora, no próprio cartão.</Aviso>
        <div><BotaoPrincipal seta onClick={proximo} testID="guia-proximo-exec">Próximo</BotaoPrincipal></div>
      </>
    );
  }
  const pode = !ligando && !ctx.auto.salvando && bloqueios.length === 0 && (!precisaAceite || aceite);
  return (
    <>
      {!!corte && (
        <Aviso testID="guia-aniv-previa">
          {`${corte.total === 1 ? "1 aniversariante" : `${corte.total} aniversariantes`}; cabem ${corte.cabem} nas novidades do Aniversário${corte.ordem ? `, ${corte.ordem}` : ""}.`}
          {presente ? ` Presente: ${presente}.` : ""}
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
          try { await ctx.auto.ligar("aniversario", true, precisaAceite ? true : undefined); } finally { setLigando(false); }
        }}>Ligar o aniversário</BotaoPrincipal>
        <button type="button" className="wag-lnk" onClick={proximo} data-testid="guia-agora-nao">Agora não</button>
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
  const saem = pub.publico?.amanha?.saem;
  const avisos = ctx.saldo?.avisos.restante;
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
      <Aviso testID="guia-cobr-previa">
        {typeof saem === "number" ? `Amanhã, às 9h, ${saem === 1 ? "sai 1 aviso" : `saem ${saem} avisos`}. ` : ""}
        {typeof avisos === "number" ? `Cada aviso usa 1 dos ${avisos} avisos que restam do mês.` : "Cada aviso usa 1 dos avisos do mês."}
      </Aviso>
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
    case "conectar": return <Conectar {...p} />;
    case "aguardar": return <Aguardar {...p} />;
    case "conectado": return <Conectado {...p} />;
    case "aniversario": return <Aniversario {...p} />;
    case "cobranca": return <Cobranca {...p} />;
    case "produto": return <Produto {...p} />;
    default: return null;
  }
}
