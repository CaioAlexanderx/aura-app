'use strict';
// ============================================================================
// AURA. — Fila para o cache de transformação do Metro (04/11/2026)
//
// O build do Cloudflare (Workers Builds, `npx expo export -p web`) passou a
// morrer com "EMFILE: too many open files" (#1179, #1180 e #1181 ficaram 2h30
// fora do ar). Medido localmente com o mesmo cenário (limite de 1024 arquivos,
// cache frio, 1 worker): no pico, 1023 descritores abertos e quase todos eram
// gravações do cache em /tmp/metro-cache. O FileStore do metro-cache 0.81 faz
// `fs.promises.writeFile` para cada módulo transformado, todos ao mesmo tempo,
// sem fila; num build frio são milhares de arquivos abertos de uma vez.
// (graceful-fs não resolve: ele não cobre fs.promises.)
//
// Este módulo embrulha get/set de um cache store numa fila com limite de
// operações simultâneas. É puro (sem Metro, sem Expo) para o jest testar.
// metro.config.js aplica nos stores do getDefaultConfig do Expo.
// ============================================================================

const LIMITE_PADRAO = 128;

/** Semáforo simples: no máximo `limite` tarefas rodando; o resto espera. */
function criarFila(limite = LIMITE_PADRAO) {
  if (!Number.isInteger(limite) || limite < 1) throw new Error(`limite inválido: ${limite}`);
  let rodando = 0;
  const espera = [];
  const proxima = () => {
    if (rodando >= limite || espera.length === 0) return;
    rodando += 1;
    const { tarefa, resolve, reject } = espera.shift();
    // Baixa o contador ANTES de avisar quem chamou: quem faz `await` e olha
    // `rodando` em seguida vê a conta certa.
    const terminou = () => {
      rodando -= 1;
      proxima();
    };
    Promise.resolve()
      .then(tarefa)
      .then(
        (valor) => { terminou(); resolve(valor); },
        (erro) => { terminou(); reject(erro); },
      );
  };
  const executar = (tarefa) =>
    new Promise((resolve, reject) => {
      espera.push({ tarefa, resolve, reject });
      proxima();
    });
  return { executar, get rodando() { return rodando; }, get esperando() { return espera.length; }, limite };
}

/**
 * Faz get/set do store passarem pela fila. Mexe no próprio objeto (mantém
 * instanceof, clear() e o que mais o Expo espera) e devolve o mesmo store.
 */
function comFila(store, limite = LIMITE_PADRAO) {
  if (!store || typeof store.set !== 'function' || typeof store.get !== 'function') return store;
  if (store.__filaDoCache) return store;
  const fila = criarFila(limite);
  const get = store.get.bind(store);
  const set = store.set.bind(store);
  store.get = (key) => fila.executar(() => get(key));
  store.set = (key, value) => fila.executar(() => set(key, value));
  Object.defineProperty(store, '__filaDoCache', { value: fila, enumerable: false });
  return store;
}

module.exports = { criarFila, comFila, LIMITE_PADRAO };
