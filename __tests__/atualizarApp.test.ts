// ============================================================
// Botão de atualizar (PWA) — a lógica sem React.
//
// O bug que isto fecha: no app INSTALADO não existe barra de endereço, logo
// não existe F5. Quem abriu o app na segunda podia ficar a semana toda com o
// bundle da segunda, sem nenhum jeito de sair dele. O botão compara o hash
// do entry-<hash>.js que está rodando com o que o servidor serve.
//
// O que aqui segura:
//   1. ler o hash rodando (script tag) e o hash servido (HTML de "/");
//   2. "indisponivel" quando NÃO dá para comparar — sem hash (Expo em dev,
//      nativo), offline, fetch bloqueado, resposta ruim. Nunca inventar um
//      "tem versão nova" e recarregar à toa;
//   3. o reload acontece mesmo quando o service worker dá erro OU trava:
//      rede ruim não pode segurar o que o usuário pediu;
//   4. a leitura de versão é UMA só — o UpdateBanner (o aviso automático,
//      desligado em 11/07/2026) usa este mesmo serviço, e continua
//      desligado: um botão em Configurações não faz ruído nenhum.
// ============================================================
import fs from "fs";
import path from "path";
import {
  atualizarAgora,
  hashCarregado,
  hashServido,
  LIMITE_DO_SW_MS,
  verificarAtualizacao,
} from "@/services/atualizarApp";

const HASH_RODANDO = "aaaa1111";
const HASH_SERVIDO = "bbbb2222";

function htmlServindo(hash: string): string {
  return `<!DOCTYPE html><html><body><script src="/_expo/static/js/web/entry-${hash}.js" defer></script></body></html>`;
}

/** Uma janela de mentira: o serviço só toca no que está aqui. */
function janelaFalsa(opcoes: {
  hashRodando?: string | null;
  semDocumento?: boolean;
  reload?: jest.Mock;
  serviceWorker?: any;
}) {
  const doc = opcoes.semDocumento
    ? undefined
    : {
        querySelectorAll: () => {
          const scripts: any[] = [{ getAttribute: () => "/_expo/static/js/web/runtime.js" }];
          if (opcoes.hashRodando) {
            scripts.push({ getAttribute: () => `/_expo/static/js/web/entry-${opcoes.hashRodando}.js` });
          }
          return scripts;
        },
      };
  return {
    document: doc,
    location: { reload: opcoes.reload || jest.fn() },
    navigator: opcoes.serviceWorker ? { serviceWorker: opcoes.serviceWorker } : {},
  };
}

function respostaOk(html: string) {
  return { ok: true, text: () => Promise.resolve(html) };
}

describe("hashCarregado: a versão que ESTÁ rodando", () => {
  test("acha o hash na script tag, ignorando os outros scripts", () => {
    const w = janelaFalsa({ hashRodando: HASH_RODANDO });
    expect(hashCarregado({ w })).toBe(HASH_RODANDO);
  });

  test("sem entry-<hash>.js na página (Expo em dev) → null", () => {
    expect(hashCarregado({ w: janelaFalsa({ hashRodando: null }) })).toBeNull();
  });

  test("sem documento (nativo) → null, sem explodir", () => {
    expect(hashCarregado({ w: janelaFalsa({ semDocumento: true }) })).toBeNull();
    expect(hashCarregado({ w: null })).toBeNull();
  });

  test("no jsdom de verdade, lê a script tag do documento", () => {
    const sc = document.createElement("script");
    sc.setAttribute("src", `/_expo/static/js/web/entry-${HASH_RODANDO}.js`);
    document.head.appendChild(sc);
    try {
      expect(hashCarregado()).toBe(HASH_RODANDO);
    } finally {
      sc.remove();
    }
  });
});

describe("hashServido: a versão que o servidor SERVE", () => {
  test("lê o hash do HTML de '/' e pede sem cache", async () => {
    const buscar = jest.fn().mockResolvedValue(respostaOk(htmlServindo(HASH_SERVIDO)));
    await expect(hashServido({ w: janelaFalsa({}), buscar })).resolves.toBe(HASH_SERVIDO);
    expect(buscar).toHaveBeenCalledWith("/", { cache: "no-store" });
  });

  test("resposta ruim, HTML sem hash ou fetch que rejeita → null", async () => {
    const w = janelaFalsa({});
    await expect(hashServido({ w, buscar: jest.fn().mockResolvedValue({ ok: false, text: () => Promise.resolve("") }) })).resolves.toBeNull();
    await expect(hashServido({ w, buscar: jest.fn().mockResolvedValue(respostaOk("<html></html>")) })).resolves.toBeNull();
    await expect(hashServido({ w, buscar: jest.fn().mockRejectedValue(new Error("offline")) })).resolves.toBeNull();
  });

  test("sem fetch nenhum → null, sem lançar", async () => {
    await expect(hashServido({ w: janelaFalsa({}), buscar: undefined })).resolves.toBeNull();
  });
});

describe("verificarAtualizacao", () => {
  test("hashes iguais → atualizado", async () => {
    const w = janelaFalsa({ hashRodando: HASH_RODANDO });
    const buscar = jest.fn().mockResolvedValue(respostaOk(htmlServindo(HASH_RODANDO)));
    await expect(verificarAtualizacao({ w, buscar })).resolves.toBe("atualizado");
  });

  test("hashes diferentes → nova", async () => {
    const w = janelaFalsa({ hashRodando: HASH_RODANDO });
    const buscar = jest.fn().mockResolvedValue(respostaOk(htmlServindo(HASH_SERVIDO)));
    await expect(verificarAtualizacao({ w, buscar })).resolves.toBe("nova");
  });

  test("sem hash rodando → indisponivel, e nem chega a bater no servidor", async () => {
    const buscar = jest.fn();
    const w = janelaFalsa({ hashRodando: null });
    await expect(verificarAtualizacao({ w, buscar })).resolves.toBe("indisponivel");
    expect(buscar).not.toHaveBeenCalled();
  });

  test("offline → indisponivel (não é 'nova': recarregar aqui daria a página offline)", async () => {
    const w = janelaFalsa({ hashRodando: HASH_RODANDO });
    const buscar = jest.fn().mockRejectedValue(new Error("offline"));
    await expect(verificarAtualizacao({ w, buscar })).resolves.toBe("indisponivel");
  });
});

describe("atualizarAgora: recarrega, doa a quem doer", () => {
  test("pede update() ao service worker antes de recarregar", async () => {
    const reload = jest.fn();
    const update = jest.fn().mockResolvedValue(undefined);
    const w = janelaFalsa({ reload, serviceWorker: { getRegistration: jest.fn().mockResolvedValue({ update }) } });
    await atualizarAgora({ w });
    expect(update).toHaveBeenCalled();
    expect(reload).toHaveBeenCalled();
  });

  test("sem service worker, recarrega do mesmo jeito", async () => {
    const reload = jest.fn();
    await atualizarAgora({ w: janelaFalsa({ reload }) });
    expect(reload).toHaveBeenCalled();
  });

  test("service worker que rejeita não segura o reload", async () => {
    const reload = jest.fn();
    const w = janelaFalsa({ reload, serviceWorker: { getRegistration: jest.fn().mockRejectedValue(new Error("nope")) } });
    await atualizarAgora({ w });
    expect(reload).toHaveBeenCalled();
  });

  test("update() que TRAVA não segura o reload (limite de tempo)", async () => {
    jest.useFakeTimers();
    try {
      const reload = jest.fn();
      const update = jest.fn().mockReturnValue(new Promise(() => {})); // nunca resolve
      const w = janelaFalsa({ reload, serviceWorker: { getRegistration: jest.fn().mockResolvedValue({ update }) } });
      const p = atualizarAgora({ w });
      // deixa os micro-tasks andarem até o update() ser chamado
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      jest.advanceTimersByTime(LIMITE_DO_SW_MS + 10);
      await p;
      expect(reload).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("uma leitura de versão só, e o aviso automático segue desligado", () => {
  const RAIZ = path.join(__dirname, "..");
  const ler = (...p: string[]) => fs.readFileSync(path.join(RAIZ, ...p), "utf8");
  const BANNER = ler("components", "UpdateBanner.tsx");

  test("UpdateBanner consome o serviço e não tem uma segunda cópia da leitura", () => {
    expect(BANNER).toMatch(/import \{ hashCarregado, hashServido \} from "@\/services\/atualizarApp";/);
    expect(BANNER).not.toMatch(/function (loadedEntryHash|servedEntryHash)/);
    expect(BANNER).not.toMatch(/_expo\/static/);
  });

  test("o aviso automático continua DESLIGADO (decisão de 11/07/2026: bundle único)", () => {
    // Um deploy do Karatê muda o hash do lojista de varejo também; reativar
    // isto traz de volta o toast o dia inteiro. O botão não tem esse custo.
    expect(BANNER).toMatch(/const ENABLED = false;/);
  });

  test("as duas Configurações montam a linha, com o mesmo hook e o mesmo texto", () => {
    for (const arq of [
      ["components", "screens", "configuracoes", "AuraNoCelularCard.tsx"],
      ["components", "karate", "AuraNoCelularKarateCard.tsx"],
    ]) {
      const src = ler(...arq);
      expect(src).toMatch(/import \{ detalheDaAtualizacao, rotuloDaAtualizacao, useAtualizarApp \} from "@\/hooks\/useAtualizarApp";/);
      expect(src).toMatch(/<LinhaDeAtualizacao \/>/);
      expect(src).toMatch(/Vers[aã]o do app/);
      // A frase é do hook; nenhuma cópia de texto solta no card.
      expect(src).toMatch(/\{detalheDaAtualizacao\(estado\)\}/);
      expect(src).toMatch(/\{rotuloDaAtualizacao\(estado\)\}/);
    }
  });

  test("a linha fica FORA do estado de instalação: a aba do navegador também envelhece", () => {
    const varejo = ler("components", "screens", "configuracoes", "AuraNoCelularCard.tsx");
    // Um <Card> só, com a linha depois do conteúdo dos quatro estados.
    expect(varejo).toMatch(/\{conteudo\}/);
    expect(varejo.match(/<LinhaDeAtualizacao \/>/g)).toHaveLength(1);
    const karate = ler("components", "karate", "AuraNoCelularKarateCard.tsx");
    expect(karate.match(/<LinhaDeAtualizacao \/>/g)).toHaveLength(1);
    expect(karate.indexOf("<LinhaDeAtualizacao />")).toBeGreaterThan(karate.indexOf("podeInstalar || ehIphone"));
  });

  test("o Karatê não importa os tokens violeta do painel para a linha nova", () => {
    const karate = ler("components", "karate", "AuraNoCelularKarateCard.tsx");
    expect(karate).not.toMatch(/from "@\/constants\/colors"/);
  });

  test("ninguém promete mais que 'atualizações chegam sozinhas'", () => {
    // Elas chegam, mas só na próxima abertura de verdade — e é exatamente o
    // que o botão existe para resolver.
    for (const arq of [
      ["components", "screens", "configuracoes", "AuraNoCelularCard.tsx"],
      ["components", "karate", "AuraNoCelularKarateCard.tsx"],
    ]) {
      // Só o JSX: o cabeçalho do arquivo CITA a frase para explicar por que
      // ela saiu, e essa citação tem de continuar valendo.
      const jsx = ler(...arq).split("export function")[1] || "";
      expect(jsx).toBeTruthy();
      expect(jsx).not.toMatch(/Atualiza[cç][oõ]es chegam sozinhas/);
    }
  });
});
