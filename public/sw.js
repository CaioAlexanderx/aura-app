// ============================================================
// AURA. — Service worker do painel: aviso de pedido (Web Push) + página
// "sem conexão"
// Criado: 10/09/2026 · Página offline: 22/09/2026 (PWA Fase 2)
//
// Faz quatro coisas, e só elas:
//   1. mostra o aviso que o backend manda (services/webPush.js), com o
//      painel fechado ou em segundo plano;
//   2. avisa as abas abertas do painel, para tocarem o som na hora em vez de
//      esperar o proximo poll do sino (hooks/useNotifications.ts);
//   3. no clique, abre o painel na tela do pedido;
//   4. quando uma NAVEGAÇÃO falha por falta de rede, responde com
//      /offline.html em vez do erro do navegador.
//
// SEM CACHE DO PAINEL, de proposito: o painel nao funciona sem rede, e cache
// de service worker mal invalidado serve bundle velho depois do deploy. A
// UNICA coisa em cache e a pagina offline e o icone que ela mostra
// (ARQUIVOS_OFFLINE). O handler de fetch so olha navegacoes e so age quando
// a rede falha: requisicao que da certo passa reto, sem tocar em cache.
// ============================================================
var CACHE_OFFLINE = 'aura-offline-v1';
var ARQUIVOS_OFFLINE = ['/offline.html', '/aura-icone-192.png'];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_OFFLINE)
      .then(function (cache) { return cache.addAll(ARQUIVOS_OFFLINE); })
      .catch(function () { /* sem a pagina offline em cache o resto segue funcionando */ })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (chaves) {
        // So limpa caches DESTE service worker (prefixo aura-offline-); versao
        // nova da pagina offline = nome novo em CACHE_OFFLINE.
        return Promise.all(chaves
          .filter(function (k) { return k.indexOf('aura-offline-') === 0 && k !== CACHE_OFFLINE; })
          .map(function (k) { return caches.delete(k); }));
      })
      .catch(function () {})
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  // Somente navegacao (abrir/recarregar uma tela). Fetch de API, imagem,
  // fonte e bundle passam reto pelo navegador, sem passar por aqui.
  if (event.request.mode !== 'navigate') return;

  event.respondWith(
    fetch(event.request).catch(function () {
      // Rede falhou de verdade (offline, DNS, timeout). Resposta HTTP de erro
      // NAO cai aqui: 404/500 sao respostas, nao falhas.
      var de = '';
      try { var u = new URL(event.request.url); de = u.pathname + u.search; } catch (_) {}
      return caches.match('/offline.html').then(function (pagina) {
        if (!pagina) return Response.error();
        if (!de || de === '/') return pagina;
        // Passa a tela de origem para a pagina offline voltar para ela.
        return pagina.text().then(function (html) {
          var destino = '/offline.html?de=' + encodeURIComponent(de);
          return new Response(html.replace('<head>', '<head><base href="' + destino + '">'), {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        });
      });
    })
  );
});

self.addEventListener('push', function (event) {
  var aviso = {};
  try {
    aviso = event.data ? event.data.json() : {};
  } catch (_) {
    aviso = { title: 'Aura', body: event.data ? event.data.text() : '' };
  }

  var titulo = aviso.title || 'Aura';
  var opcoes = {
    body: aviso.body || '',
    // A mesma tag para "pedido novo" e "pagamento confirmado" do mesmo
    // pedido: o segundo substitui o primeiro em vez de empilhar.
    tag: aviso.tag || 'aura',
    renotify: true,
    icon: '/aura-icone-192.png',
    badge: '/aura-icone-72.png',
    data: { url: aviso.url || '/', type: aviso.type || null, tag: aviso.tag || null },
  };

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (abas) {
      abas.forEach(function (aba) {
        aba.postMessage({ tipo: 'aura-push', aviso: aviso });
      });
      return self.registration.showNotification(titulo, opcoes);
    })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var caminho = (event.notification.data && event.notification.data.url) || '/';
  var destino = new URL(caminho, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (abas) {
      for (var i = 0; i < abas.length; i++) {
        var aba = abas[i];
        if (new URL(aba.url).origin !== self.location.origin) continue;
        return aba.focus().then(function (focada) {
          var alvo = focada || aba;
          // navigate() so vale para aba controlada por este service worker;
          // na que nao for, a propria pagina troca de endereco.
          if ('navigate' in alvo) {
            return alvo.navigate(destino).catch(function () {
              alvo.postMessage({ tipo: 'aura-abrir', url: destino });
            });
          }
          alvo.postMessage({ tipo: 'aura-abrir', url: destino });
        });
      }
      return self.clients.openWindow(destino);
    })
  );
});
