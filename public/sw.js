// ============================================================
// AURA. — Service worker do painel: aviso de pedido (Web Push)
// Criado: 10/09/2026
//
// Faz tres coisas, e so elas:
//   1. mostra o aviso que o backend manda (services/webPush.js), com o
//      painel fechado ou em segundo plano;
//   2. avisa as abas abertas do painel, para tocarem o som na hora em vez de
//      esperar o proximo poll do sino (hooks/useNotifications.ts);
//   3. no clique, abre o painel na tela do pedido.
//
// SEM CACHE OFFLINE, de proposito: o painel nao funciona sem rede, e cache
// de service worker mal invalidado serve bundle velho depois do deploy.
// ============================================================
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
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
