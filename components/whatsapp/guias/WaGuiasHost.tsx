// ============================================================
// WaGuiasHost — liga o menu de guias e os três guias à tela do WhatsApp
//
// Fica na tela (só quando a tela nova está liberada: equipe Aura e empresa
// sandbox). Lê o store (o que está aberto, o que já foi visto), abre o menu
// sozinho na primeira visita e entrega ao motor o contexto da tela (status,
// automáticas, troca de aba).
// ============================================================
import React, { useCallback, useEffect, useRef } from "react";
import { findTourTarget } from "@/components/onboarding/SpotlightTour";
import { tourSelector } from "@/utils/tourTarget";
import { useWaGuias } from "@/stores/waGuias";
import { WEB } from "./guiaVisual";
import { guiaDe, type GuiaCtx } from "./guiasConteudo";
import { GuiaMenu, devolveFocoAoBotao } from "./GuiaMenu";
import { GuiaTour, type FimDoGuia } from "./GuiaTour";

interface Props {
  ctx: Omit<GuiaCtx, "produtosEnviados">;
  userId: string | null | undefined;
}

export function WaGuiasHost({ ctx, userId }: Props) {
  const aberto = useWaGuias((s) => s.aberto);
  const vistos = useWaGuias((s) => s.vistos);
  const produtosEnviados = useWaGuias((s) => s.produtosEnviados);
  const carregar = useWaGuias((s) => s.carregar);
  const marcar = useWaGuias((s) => s.marcar);
  const abrirMenu = useWaGuias((s) => s.abrirMenu);
  const abrirGuia = useWaGuias((s) => s.abrirGuia);
  const fechar = useWaGuias((s) => s.fechar);
  const tentouAuto = useRef(false);

  useEffect(() => { carregar(userId); }, [carregar, userId]);

  // O menu aberto (por onde for: botão, anúncio, primeira visita) conta como visto.
  useEffect(() => { if (aberto === "menu" && !vistos.menu) marcar("menu"); }, [aberto, vistos.menu, marcar]);

  // Primeira visita: o menu abre sozinho, a partir do botão Guias (quando ele está na tela).
  useEffect(() => {
    if (!WEB || !userId || tentouAuto.current || vistos.menu) return;
    if (useWaGuias.getState().userId !== userId) return; // vistos ainda não carregaram
    let cancelado = false;
    let t: any = null;
    const limite = Date.now() + 3000;
    const tenta = () => {
      if (cancelado) return;
      if (useWaGuias.getState().aberto || useWaGuias.getState().vistos.menu) return; // alguém já abriu (anúncio, botão) ou já foi visto
      if (findTourTarget([tourSelector("wa.guias")])) { tentouAuto.current = true; abrirMenu(); return; }
      if (Date.now() < limite) t = setTimeout(tenta, 150); else tentouAuto.current = true;
    };
    t = setTimeout(tenta, 600);
    return () => { cancelado = true; clearTimeout(t); };
  }, [userId, vistos.menu, abrirMenu]);

  const aoFecharMenu = useCallback(() => { fechar(); devolveFocoAoBotao(); }, [fechar]);

  const aoTerminar = useCallback((n: 1 | 2 | 3, f: FimDoGuia) => {
    if (f.feito) marcar(("g" + n) as "g1" | "g2" | "g3");
    if (f.depois) abrirGuia(f.depois); else { fechar(); devolveFocoAoBotao(); }
  }, [marcar, abrirGuia, fechar]);

  if (!WEB) return null;
  const full: GuiaCtx = { ...ctx, produtosEnviados };

  if (aberto === "menu") {
    return (
      <GuiaMenu
        conectado={ctx.conectado} vistos={vistos} hubVisible={ctx.hubVisible} celular={ctx.celular}
        onEscolher={(n) => abrirGuia(n)} onFechar={aoFecharMenu}
      />
    );
  }
  if (aberto === 1 || aberto === 2 || aberto === 3) {
    const n = aberto;
    return <GuiaTour key={n} guia={guiaDe(n, ctx.celular)} ctx={full} onFim={(f) => aoTerminar(n, f)} />;
  }
  return null;
}

export default WaGuiasHost;
