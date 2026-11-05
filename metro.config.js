// Config do Metro = a padrão do Expo + fila no cache de transformação.
// Por quê: scripts/filaDoCacheDoMetro.js (EMFILE no build do Cloudflare).
const { getDefaultConfig } = require('expo/metro-config');
const { comFila } = require('./scripts/filaDoCacheDoMetro');

const config = getDefaultConfig(__dirname);
config.cacheStores = (config.cacheStores || []).map((store) => comFila(store));

module.exports = config;
