// ============================================================
// AURA. — Registro de telas visitadas (a lógica, sem React)
//
// Criado: 13/10/2026
//
// POR QUE EXISTE: o uso do produto era inferido pelas tabelas de cada
// módulo, e as telas só de leitura (Relatórios, Painel, Etiquetas,
// Configurações) ficavam invisíveis para a Gestão Aura. Aqui o app conta
// quantas vezes cada tela foi aberta e manda o acumulado ao backend em
// lote (POST /usage/screens).
//
// O QUE ESTE ARQUIVO GARANTE:
//   1. nome da tela = nome da ROTA do expo-router (grupos "(x)" e
//      parâmetros "[x]" saem), no máximo 64 caracteres;
//   2. o lote é amarrado ao TOKEN em que foi acumulado. Trocar de empresa
//      troca o token: o lote da empresa anterior sai com o token dela,
//      nunca é atribuído à nova;
//   3. falha de envio (404 — endpoint ainda não existe —, 5xx, rede) é
//      descartada em silêncio: sem retry, sem fila, um único console.debug;
//   4. nada aqui lança exceção para fora nem espera resposta de ninguém.
//
// Na saída da página (aba escondida / pagehide) o envio usa fetch com
// keepalive e o Authorization de sempre, e NÃO navigator.sendBeacon: o
// beacon não aceita header e o contrato do endpoint não prevê token no
// corpo, então só o fetch consegue autenticar.
// ============================================================
import { AppState, Platform } from "react-native";
import { BASE_URL, request } from "@/services/api";

export const MAX_NOME_DA_TELA = 64;
export const MAX_TELAS_POR_LOTE = 50;
export const INTERVALO_DO_LOTE_MS = 60_000;
// Teto de telas distintas guardadas em memória. As rotas do app são
// poucas dezenas; isto só impede crescimento sem limite se algo gerar
// nomes novos sem parar.
const MAX_TELAS_EM_MEMORIA = 200;
const ROTA_DO_LOTE = "/usage/screens";
const TIMEOUT_DO_ENVIO_MS = 8000;

export type VisitaDeTela = {
  screen: string;
  count: number;
  first_at: string;
  last_at: string;
  /**
   * 17/10/2026 (t2-14) — quantas das `count` visitas foram a primeira tela
   * aberta logo depois de um login/cadastro (e não um retorno). Só vai no
   * lote quando > 0: sem login, o item tem exatamente o formato de antes.
   * `count` segue sendo o total.
   */
  apos_login?: number;
};

const ehGrupo = (s: string) => /^\(.*\)$/.test(s);
const ehParametro = (s: string) => /^\[.*\]$/.test(s);

/**
 * Nome da tela a partir dos segmentos do expo-router (`useSegments`).
 * Devolve null para o que não deve ser contado: telas de autenticação,
 * rota não encontrada e rotas que são só parâmetro (ex.: a vitrine
 * pública `/[slug]`).
 */
export function nomeDaTela(segments: readonly string[] | null | undefined): string | null {
  if (!segments || segments.length === 0) return null;
  if (segments[0] === "(auth)") return null;
  if (segments.some((s) => s.startsWith("+"))) return null; // +not-found

  const partes = segments.filter((s) => s && !ehGrupo(s) && !ehParametro(s));
  if (partes.length === 0) {
    // A raiz do shell (app/(tabs)/index.tsx) chega como ["(tabs)"] e é o Painel.
    return segments.length === 1 && segments[0] === "(tabs)" ? "painel" : null;
  }
  const nome = partes.join("/").slice(0, MAX_NOME_DA_TELA).replace(/\/+$/, "");
  return nome || null;
}

type EnviarFn = (token: string, views: VisitaDeTela[], aoSair: boolean) => Promise<unknown>;

/** Envio de verdade. Na saída da página, fetch keepalive (sobrevive ao unload). */
async function enviarAoBackend(token: string, views: VisitaDeTela[], aoSair: boolean): Promise<unknown> {
  if (aoSair && Platform.OS === "web" && typeof fetch === "function") {
    return fetch(BASE_URL + ROTA_DO_LOTE, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ views }),
    });
  }
  // `token` explícito: o request() não tenta refresh nem desloga num 401
  // deste envio (a sessão que o lote pertence pode já nem ser a atual).
  return request(ROTA_DO_LOTE, {
    method: "POST",
    body: { views },
    token,
    retry: 0,
    timeout: TIMEOUT_DO_ENVIO_MS,
  });
}

export type RegistroDeTelas = {
  /**
   * Conta uma entrada na tela, no lote do token informado. `aposLogin: true`
   * marca esta entrada como a abertura que veio do login (t2-14).
   */
  registrar: (tela: string, token: string, opcoes?: { aposLogin?: boolean }) => void;
  /** Manda o lote pendente (se houver) e zera o acumulado. */
  descarregar: (aoSair?: boolean) => void;
  /** Quantas telas distintas esperam envio. */
  pendentes: () => number;
  /** Liga o timer de 60 s e os gatilhos de saída. Devolve o desligamento. */
  iniciar: () => () => void;
};

export function criarRegistroDeTelas(
  enviar: EnviarFn = enviarAoBackend,
  agora: () => Date = () => new Date(),
): RegistroDeTelas {
  let lote: { token: string; telas: Map<string, VisitaDeTela> } | null = null;
  let jaAvisou = false;

  function falhou(erro: unknown) {
    if (jaAvisou) return;
    jaAvisou = true;
    try {
      const status = (erro as any)?.status;
      console.debug("[telas] lote descartado" + (status ? " (HTTP " + status + ")" : ""));
    } catch {
      /* nada a fazer */
    }
  }

  function despachar(token: string, views: VisitaDeTela[], aoSair: boolean) {
    for (let i = 0; i < views.length; i += MAX_TELAS_POR_LOTE) {
      const parte = views.slice(i, i + MAX_TELAS_POR_LOTE);
      try {
        Promise.resolve(enviar(token, parte, aoSair)).catch(falhou);
      } catch (e) {
        falhou(e);
      }
    }
  }

  function descarregar(aoSair = false) {
    try {
      if (!lote || lote.telas.size === 0) return;
      const { token, telas } = lote;
      lote = null; // zera já: o que falhar depois não volta
      despachar(token, Array.from(telas.values()), aoSair);
    } catch (e) {
      falhou(e);
    }
  }

  function registrar(tela: string, token: string, opcoes?: { aposLogin?: boolean }) {
    try {
      if (!tela || !token) return;
      const aposLogin = opcoes?.aposLogin === true;
      // Outra empresa/sessão: o que ficou pendente sai com o token antigo.
      if (lote && lote.token !== token) descarregar();
      if (!lote) lote = { token, telas: new Map() };
      const agoraISO = agora().toISOString();
      const atual = lote.telas.get(tela);
      if (atual) {
        atual.count += 1;
        atual.last_at = agoraISO;
        if (aposLogin) atual.apos_login = (atual.apos_login ?? 0) + 1;
      } else if (lote.telas.size < MAX_TELAS_EM_MEMORIA) {
        const nova: VisitaDeTela = { screen: tela, count: 1, first_at: agoraISO, last_at: agoraISO };
        if (aposLogin) nova.apos_login = 1;
        lote.telas.set(tela, nova);
      }
    } catch (e) {
      falhou(e);
    }
  }

  function iniciar(): () => void {
    const desligar: Array<() => void> = [];
    try {
      const timer = setInterval(() => descarregar(false), INTERVALO_DO_LOTE_MS);
      desligar.push(() => clearInterval(timer));

      if (Platform.OS === "web") {
        if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
          const aoEsconder = () => {
            if (document.visibilityState === "hidden") descarregar(true);
          };
          document.addEventListener("visibilitychange", aoEsconder);
          desligar.push(() => document.removeEventListener("visibilitychange", aoEsconder));
        }
        if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
          const aoSair = () => descarregar(true);
          window.addEventListener("pagehide", aoSair);
          desligar.push(() => window.removeEventListener("pagehide", aoSair));
        }
      } else {
        const sub = AppState.addEventListener("change", (estado) => {
          if (estado === "background" || estado === "inactive") descarregar(false);
        });
        desligar.push(() => sub.remove());
      }
    } catch (e) {
      falhou(e);
    }
    return () => {
      for (const fn of desligar) {
        try {
          fn();
        } catch {
          /* nada a fazer */
        }
      }
      descarregar(false);
    };
  }

  return { registrar, descarregar, pendentes: () => lote?.telas.size ?? 0, iniciar };
}
