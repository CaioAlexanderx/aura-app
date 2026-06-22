// ============================================================
// Microsite core — mapeamento host ↔ slug para {slug}.getaura.com.br
//
// Módulo PURO (sem React Native): seguro de requerer bem cedo no boot
// (micrositeBootstrap) e também pelos helpers tipados (utils/microsite.ts).
//
// Ideia: o microsite serve a MESMA SPA Expo. O slug vem do subdomínio, então
// o link divulgado é limpo (fpkt.getaura.com.br/dojo). Como o Expo Router é
// client-side e as telas vivem em /karate/[slug]/*, reescrevemos o caminho
// para a forma interna ANTES do router ler a URL (ver micrositeBootstrap).
// ============================================================
'use strict';

var ROOT_DOMAIN = 'getaura.com.br';

// Subdomínios reservados — NÃO são slugs de federação.
var RESERVED = ['app', 'www', 'api', 'loja', 'admin', 'assets', 'cdn', 'static', 'mail'];

// hostname → slug da federação (ou null). Só aceita 1 nível de subdomínio.
function slugFromHost(hostname) {
  if (!hostname || typeof hostname !== 'string') return null;
  var suffix = '.' + ROOT_DOMAIN;
  if (hostname.slice(-suffix.length) !== suffix) return null;
  var sub = hostname.slice(0, hostname.length - suffix.length);
  if (!sub || sub.indexOf('.') !== -1) return null;          // só 1 nível
  if (RESERVED.indexOf(sub) !== -1) return null;
  if (!/^[a-z0-9-]+$/.test(sub)) return null;
  return sub;
}

// caminho LIMPO do microsite (ex.: "/dojo", "/verify/X", "/") → caminho INTERNO
// que o Expo Router conhece (/karate/{slug}/* ou /karate/verify/*).
function micrositeTargetPath(slug, pathname) {
  if (!slug) return pathname;
  if (!pathname || pathname === '/' || pathname === '') return '/karate/' + slug;
  if (pathname.indexOf('/karate/') === 0) return pathname;     // já interno
  // verify é global por token (não escopado ao slug)
  if (pathname.indexOf('/verify') === 0) return '/karate' + pathname;
  return '/karate/' + slug + pathname;
}

// Monta a URL LIMPA do microsite p/ divulgação (ex.: link do dojô).
function buildMicrositeUrl(slug, path) {
  var p = '';
  if (path && path !== '/') p = path.charAt(0) === '/' ? path : '/' + path;
  return 'https://' + slug + '.' + ROOT_DOMAIN + p;
}

module.exports = {
  ROOT_DOMAIN: ROOT_DOMAIN,
  RESERVED: RESERVED,
  slugFromHost: slugFromHost,
  micrositeTargetPath: micrositeTargetPath,
  buildMicrositeUrl: buildMicrositeUrl,
};
