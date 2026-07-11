import { Platform, Text } from "react-native";

const PATHS: Record<string, string> = {
  // Migrados de Feather (Studio ficha tecnica)
  layers:         "M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5",
  inbox:          "M22 12h-6l-2 3h-4l-2-3H2 M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z",
  save:           "M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z M17 21v-8H7v8 M7 3v5h8",
  plus_circle:    "M12 22a10 10 0 100-20 10 10 0 000 20z M12 8v8 M8 12h8",
  // Migrados de Ionicons (fix/karate-icons-svg)
  check_circle:   "M22 11.08V12a10 10 0 11-5.93-9.14 M22 4L12 14.01l-3-3",
  mail:           "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6",
  user:           "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z",
  link:           "M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71 M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71",
  send:           "M22 2L11 13 M22 2l-7 20-4-9-9-4 22 2z",
  // ── Layout ──────────────────────────────────────────────────
  dashboard:      "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M9 22V12h6v10",
  settings:       "M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
  logout:         "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4 M16 17l5-5-5-5 M21 12H9",
  chevron_left:   "M15 18l-6-6 6-6",
  chevron_right:  "M9 18l6-6-6-6",
  chevron_up:     "M18 15l-6-6-6 6",
  chevron_down:   "M6 9l6 6 6-6",
  menu:           "M3 12h18 M3 6h18 M3 18h18",
  grid:           "M10 3H3v7h7V3z M21 3h-7v7h7V3z M21 14h-7v7h7v-7z M10 14H3v7h7v-7z",
  // ── Actions ─────────────────────────────────────────────────h
  plus:           "M12 5v14 M5 12h14",
  minus:          "M5 12h14",
  x:              "M18 6L6 18 M6 6l12 12",
  check:          "M20 6L9 17l-5-5",
  edit:           "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  trash:          "M3 6h18 M8 6V4h8v2 M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6 M10 11v6 M14 11v6",
  search:         "M11 19a8 8 0 100-16 8 8 0 000 16z M21 21l-4.35-4.35",
  filter:         "M22 3H2l8 9.46V19l4 2v-8.54L22 3z",
  download:       "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3",
  upload:         "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M17 8l-5-5-5 5 M12 3v12",
  copy:           "M20 9h-9a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-9a2 2 0 00-2-2z M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1",
  refresh:        "M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0114.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0020.49 15",
  repeat:         "M17 1l4 4-4 4 M3 11V9a4 4 0 014-4h14 M7 23l-4-4 4-4 M21 13v2a4 4 0 01-4 4H3",
  // Power / liga-desliga (Feather \"power\") — usado no toggle Suspender/Reativar
  power:          "M18.36 6.64a9 9 0 11-12.73 0 M12 2v10",
  drag_handle:    "M8 6h.01 M8 12h.01 M8 18h.01 M16 6h.01 M16 12h.01 M16 18h.01",
  // Três pontos verticais (kebab de overflow) — mesmo truque de "ponto" do
  // drag_handle acima (linha de comprimento 0 + stroke-linecap round).
  more_vertical:  "M12 6h.01 M12 12h.01 M12 18h.01",
  // Setas direcionais — usadas em CTAs e onboarding do Studio
  arrow_right:    "M5 12h14 M12 5l7 7-7 7",
  arrow_left:     "M19 12H5 M12 19l-7-7 7-7",
  // Link externo — abre em nova aba (storefront, marketplaces)
  external_link:  "M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6 M15 3h6v6 M10 14L21 3",
  // ── Security ────────────────────────────────────────────────
  lock:           "M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z M7 11V7a5 5 0 0110 0v4",
  unlock:         "M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z M7 11V7a5 5 0 019.9-1",
  eye:            "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 12a3 3 0 100-6 3 3 0 000 6z",
  eye_off:        "M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94 M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19 M14.12 14.12a3 3 0 11-4.24-4.24 M1 1l22 22",
  shield:         "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  // ── Finance ─────────────────────────────────────────────────
  wallet:         "M21 12V7H5a2 2 0 010-4h14v4 M3 5v16h18v-8H3 M18 16h.01",
  dollar:         "M12 1v22 M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
  trending_up:    "M23 6l-9.5 9.5-5-5L1 18 M17 6h6v6",
  trending_down:  "M23 18l-9.5-9.5-5 5L1 6 M17 18h6v-6",
  receipt:        "M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z M16 8H8 M16 12H8 M14 16H8",
  calculator:     "M4 2h16a2 2 0 012 2v16a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2z M8 10h.01 M12 10h.01 M16 10h.01 M8 14h.01 M12 14h.01 M16 14h.01 M8 18h.01 M12 18h.01 M16 18h.01 M8 6h8",
  // Cartao de credito — usado na home Studio (venda teste)
  credit_card:    "M3 5h18a2 2 0 012 2v10a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2z M1 10h22 M5 15h4",
  // ── Commerce ────────────────────────────────────────────────
  cart:           "M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6 M9 22a1 1 0 100-2 1 1 0 000 2z M20 22a1 1 0 100-2 1 1 0 000 2z",
  // shopping_cart e' alias canonico de cart (usado pelo Studio shell)
  shopping_cart:  "M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6 M9 22a1 1 0 100-2 1 1 0 000 2z M20 22a1 1 0 100-2 1 1 0 000 2z",
  package:        "M16.5 9.4l-9-5.19 M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z M3.27 6.96L12 12.01l8.73-5.05 M12 22.08V12",
  bag:            "M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z M3 6h18 M16 10a4 4 0 01-8 0",
  // shopping_bag e' usado em produto Studio — bag estilizada com alca completa
  shopping_bag:   "M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z M3 6h18 M16 10a4 4 0 01-8 0",
    percent: "M19 5L5 19 M6.5 7a1.5 1.5 0 100-3 1.5 1.5 0 000 3z M17.5 20a1.5 1.5 0 100-3 1.5 1.5 0 000 3z",
  tag:            "M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z M7 7h.01",
  barcode:        "M3 5v14 M6 5v14 M9 5v14 M12 5v14 M15 5v14 M18 5v14 M21 5v14",
  // QR-Code — 3 cantos (typical finder patterns) + retalho de modulos.
  // Usado em PDV troca v2: Step 1 (QR cupom NFC-e) e Step 3 (QR produto).
  qr_code:        "M3 3h7v7H3z M5 5h3v3H5z M14 3h7v7h-7z M16 5h3v3h-3z M3 14h7v7H3z M5 16h3v3H5z M14 14h3v3h-3z M19 14h2v2h-2z M14 19h2v2h-2z M19 19h2v2h-2z",
  camera:         "M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z M12 17a4 4 0 100-8 4 4 0 000 8z",
  // Caixa 3D (mantido para retrocompatibilidade) — Feather \"box\"
  box:            "M21 8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z M3.27 6.96L12 12.01l8.73-5.05 M12 22.08V12",
  // Caminhao de entrega — logistica/frete no storefront
  truck:          "M1 3h15v13H1z M16 8h4l3 3v5h-7V8z M5.5 18.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z M18.5 18.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
  // Redimensionar / expand — usado em previews e modais de galeria
  resize:         "M15 3h6v6 M9 21H3v-6 M21 3l-7 7 M3 21l7-7",
  // Pin de localizacao — endereco de retirada no storefront
  location:       "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z M12 13a3 3 0 100-6 3 3 0 000 6z",
  // ── People ──────────────────────────────────────────────────
  users:          "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75",
  user_plus:      "M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M8.5 11a4 4 0 100-8 4 4 0 000 8z M20 8v6 M23 11h-6",
  payroll:        "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M23 8v4 M21 10h4",
  // Maleta de trabalho (Gestao no Studio shell)
  briefcase:      "M3 7h18v13a2 2 0 01-2 2H5a2 2 0 01-2-2V7z M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2 M3 13h18",
  // ── Communication ───────────────────────────────────────────
  message:        "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z",
  // Balao circular com cantos arredondados (WhatsApp link na home Studio)
  message_circle: "M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z",
  // WhatsApp — balao com cauda inferior-esquerda + fone dentro. Glifo proprio
  // (stroke feather-style), usado no botao \"Cobrar\" do crediario (16/06).
  whatsapp:       "M21 11.5a8.5 8.5 0 01-12.6 7.45L3.5 20l1.1-4.8A8.5 8.5 0 1121 11.5z M8.7 7.7c.2 0 .45.01.58.28.16.32.5 1.22.55 1.31.05.1.08.21.01.34-.07.13-.1.21-.2.32-.1.11-.21.25-.3.34-.1.1-.2.2-.09.4.11.19.5.83 1.08 1.34.74.66 1.37.86 1.56.96.19.1.3.08.41-.05.11-.13.47-.55.6-.74.13-.19.26-.16.43-.1.18.07 1.12.53 1.31.62.19.1.32.14.37.22.05.08.05.48-.12.94-.17.46-.99.88-1.37.91-.38.04-.74.18-2.5-.54-2.12-.86-3.46-3.05-3.56-3.19-.1-.14-.85-1.13-.85-2.15 0-1.02.53-1.52.72-1.73.19-.21.42-.26.56-.26z",
  headset:        "M3 18v-6a9 9 0 0118 0v6 M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3v5z M3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3v5z",
  // Sino de notificacoes (badge de alerta na topbar da shell de karate)
  bell:           "M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0",
  // ── Content ─────────────────────────────────────────────────
  file_text:      "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
  // Imagem com sol (galeria Studio)
  image:          "M3 5h18a2 2 0 012 2v10a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2z M8.5 11a1.5 1.5 0 100-3 1.5 1.5 0 000 3z M21 15l-5-5L5 21",
  clipboard:      "M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2 M9 2h6a1 1 0 011 1v1a1 1 0 01-1 1H9a1 1 0 01-1-1V3a1 1 0 011-1z",
  bar_chart:      "M12 20V10 M18 20V4 M6 20v-4",
  star:           "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  // Pulse / batimento — usado em \"Saude da Rede\" (dashboard de saude da federacao)
  activity:       "M22 12h-4l-3 9L9 3l-3 9H2",
  // Predio / estabelecimento — usado em \"Dojos\"
  building:       "M3 21h18 M5 21V7l8-4v18 M19 21V11l-6-4 M9 9h.01 M9 12h.01 M9 15h.01 M9 18h.01",
  // Rede de nos conectados — usado em \"Conexoes\" (conectividade dojo↔federacao)
  network:        "M12 8a3 3 0 100-6 3 3 0 000 6z M6 22a3 3 0 100-6 3 3 0 000 6z M18 22a3 3 0 100-6 3 3 0 000 6z M12 8v5 M12 13l-5 4 M12 13l5 4",
  // Medalha / fita — usado em \"Certificados\" (selo/certificado de faixa)
  ribbon:         "M9 11a4 4 0 108 0 4 4 0 00-8 0z M13 14.5L16 22l-3-1.5-3 1.5 3-7.5",
  // Trofeu — usado em \"Competicoes\" (ranking/torneios)
  trophy:         "M8 21h8 M12 17v4 M7 4h10v5a5 5 0 01-10 0V4z M7 4H5a2 2 0 000 4h.5 M17 4h2a2 2 0 010 4h-.5",
  alert:          "M12 9v4 M12 17h.01 M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
  // Circulo com exclamacao (KPI \"aguardando arte\")
  alert_circle:   "M12 22a10 10 0 100-20 10 10 0 000 20z M12 8v4 M12 16h.01",
  info:           "M12 22a10 10 0 100-20 10 10 0 000 20z M12 8h.01 M12 12v4",
  // ── Date / Time ─────────────────────────────────────────────
  calendar:       "M16 2v4 M8 2v4 M3 10h18 M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z",
  clock:          "M12 22a10 10 0 100-20 10 10 0 000 20z M12 6v6l4 2",
  // ── Theme ───────────────────────────────────────────────────
  moon:           "M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z",
  sun:            "M12 17a5 5 0 100-10 5 5 0 000 10z M12 1v2 M12 21v2 M4.22 4.22l1.42 1.42 M18.36 18.36l1.42 1.42 M1 12h2 M21 12h2 M4.22 19.78l1.42-1.42 M18.36 5.64l1.42-1.42",
  // ── Web / Globe ─────────────────────────────────────────────
  globe:          "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M2 12h20 M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z",
  brain:          "M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a3 3 0 01-3 3h-2a3 3 0 01-3-3v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z M9 22v-2 M15 22v-2 M12 17v5",
  // ── Verticals ───────────────────────────────────────────────
  // Dente (odontologia) — duas raizes, coroa arredondada. Baseado em Tabler Icons \"tooth\" (MIT).
  tooth:          "M9 3c-1.66 0-3 1.34-3 3 0 1.46-.91 2.62-1.5 4-.5 1.2-.5 2 .5 3 1 .5 1.5 2 1 4.5C5.5 20 6 22 7 22c1.5 0 2-2 2-4 0-3 2-3 2-3s2 0 2 3c0 2 .5 4 2 4 1 0 1.5-2 1-4.5C14.5 15 15 13.5 16 13c1-1 1-1.8.5-3-.59-1.38-1.5-2.54-1.5-4 0-1.66-1.34-3-3-3-2 0-2 1-3 1s-1-1-3-1z",
  // Tesoura (barbearia) — duas laminas cruzadas
  scissors:       "M6 9a3 3 0 100-6 3 3 0 000 6z M6 21a3 3 0 100-6 3 3 0 000 6z M20 4L8.12 15.88 M14.47 14.48L20 20 M8.12 8.12L12 12",
  // Prato/talheres (food)
  utensils:       "M3 2v7c0 1.66 1.34 3 3 3s3-1.34 3-3V2 M6 2v20 M15 2v20 M18 2c1.66 0 3 1.34 3 3v6h-3",
  // Patinha (pet)
  paw:            "M11 16a3 3 0 10-6 0 3 3 0 006 0z M19 16a3 3 0 10-6 0 3 3 0 006 0z M7 7a2 2 0 10-4 0 2 2 0 004 0z M13 6a2 2 0 10-4 0 2 2 0 004 0z M19 6a2 2 0 10-4 0 2 2 0 004 0z",
  // Halter (academia)
  dumbbell:       "M6 6h2v12H6z M16 6h2v12h-2z M3 9h3v6H3z M18 9h3v6h-3z M8 12h8",
  // Sparkles (estetica)
  sparkles:       "M12 2l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z M19 15l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5z",
};

// ── Aliases kebab-case → snake_case ────────────────────────────
// Muitas telas (especialmente Studio) referenciam icones em kebab-case por
// influencia de lucide-react. Sem aliases, retornavam null e quebravam UI.
// Mantemos snake_case como canonico mas resolvemos kebab tambem.
const ALIASES: Record<string, string> = {
  "trash-2": "trash",
  "alert-triangle": "alert",
  "plus-circle": "plus_circle",
  // Variantes Ionicons -> glifos SVG (fix/karate-icons-svg)
  "arrow-forward": "arrow_right",
  "copy-outline": "copy",
  "download-outline": "download",
  "eye-off-outline": "eye_off",
  "eye-outline": "eye",
  "globe-outline": "globe",
  "link-outline": "link",
  "lock-closed": "lock",
  "lock-closed-outline": "lock",
  "logo-whatsapp": "whatsapp",
  "paper-plane-outline": "send",
  "podium-outline": "trophy",
  "pricetag-outline": "tag",
  "shopping-bag":    "shopping_bag",
  "shopping-cart":   "shopping_cart",
  "credit-card":     "credit_card",
  "message-circle":  "message_circle",
  "alert-circle":    "alert_circle",
  "file-text":       "file_text",
  "dollar-sign":     "dollar",
  "bar-chart":       "bar_chart",
  "chevron-left":    "chevron_left",
  "chevron-right":   "chevron_right",
  "chevron-up":      "chevron_up",
  "chevron-down":    "chevron_down",
  "trending-up":     "trending_up",
  "trending-down":   "trending_down",
  "user-plus":       "user_plus",
  "eye-off":         "eye_off",
  "qr-code":         "qr_code",
  "drag-handle":     "drag_handle",
  // Novos aliases (fix/studio-icons)
  "refresh-cw":      "refresh",
  "arrow-right":     "arrow_right",
  "arrow-left":      "arrow_left",
  "external-link":   "external_link",
  "map-pin":         "location",
  "create":          "edit",
  "add":             "plus",
  "layout-grid":     "grid",
  // WhatsApp (16/06) — aceita variacoes comuns de nome.
  "whats-app":       "whatsapp",
  "whatsApp":        "whatsapp",
  // Karate shell (fix/karate-shell-logos-icones) — variantes Ionicons-style
  // (-outline) e nomes alternativos mapeados pros glifos canonicos. A shell
  // de karate usava @expo/vector-icons (fonte nunca carregada → retangulo);
  // agora renderiza via este componente SVG-inline.
  "bell-outline":         "bell",
  "notifications":        "bell",
  "notifications-outline": "bell",
  "activity-outline":     "activity",
  "pulse":                "activity",
  "pulse-outline":        "activity",
  "building-outline":     "building",
  "business":             "building",
  "business-outline":     "building",
  "network-outline":      "network",
  "git-network":          "network",
  "git-network-outline":  "network",
  "ribbon-outline":       "ribbon",
  "trophy-outline":       "trophy",
  "grid-outline":         "grid",
  "people":               "users",
  "people-outline":       "users",
  "cash":                 "wallet",
  "cash-outline":         "wallet",
  "calendar-outline":     "calendar",
  "cloud-upload":         "upload",
  "cloud-upload-outline": "upload",
  "settings-outline":     "settings",
  "search-outline":       "search",
  "log-out":              "logout",
  "log-out-outline":      "logout",
  "chevron-forward":      "chevron_right",
  // Power / liga-desliga (toggle Suspender/Reativar — dojo karate)
  "power-outline":        "power",
  "power-off":            "power",
  // Kebab / overflow menu — variantes Ionicons/lucide comuns.
  "ellipsis-vertical":    "more_vertical",
  "ellipsis-vertical-outline": "more_vertical",
  "more-vertical":        "more_vertical",
  "more-horiz":           "more_vertical",
  // ── Ionicons karate status maps (fix/karate-icon-aliases) ───
  // checkmark / check variants
  "checkmark-circle":         "check_circle",
  "checkmark":                "check",
  "checkmark-outline":        "check",
  "checkmark-circle-outline": "check",
  // close / x variants
  "close-circle":             "x",
  "close":                    "x",
  "close-outline":            "x",
  "close-circle-outline":     "x",
  // warning / alert variants
  "warning":                  "alert",
  "warning-outline":          "alert",
  // ban variants
  "ban":                      "x",
  "ban-outline":              "x",
  // time / clock variants
  "time":                     "clock",
  "time-outline":             "clock",
  "hourglass":                "clock",
  "hourglass-outline":        "clock",
  // ellipse → info
  "ellipse":                  "info",
  "ellipse-outline":          "info",
  // person → users
  "person":                   "user",
  "person-outline":           "users",
  "person-circle":            "users",
  "person-circle-outline":    "user",
  // pencil → edit
  "pencil":                   "edit",
  "pencil-outline":           "edit",
  // trash variants
  "trash-outline":            "trash",
  "trash-bin":                "trash",
  "trash-bin-outline":        "trash",
  // add/remove circle variants
  "add-circle":               "plus",
  "add-circle-outline":       "plus",
  "remove-circle":            "minus",
  "remove-circle-outline":    "minus",
  // information-circle → info
  "information-circle":       "info",
  "information-circle-outline": "info",
  // card → credit_card
  "card":                     "credit_card",
  "card-outline":             "credit_card",
  // wallet variant
  "wallet-outline":           "wallet",
  // school → users
  "school":                   "users",
  "school-outline":           "users",
  // medal → ribbon
  "medal":                    "ribbon",
  "medal-outline":            "ribbon",
  // document variants → file_text
  "document-text":            "file_text",
  "document-text-outline":    "file_text",
  "document":                 "file_text",
  "document-outline":         "file_text",
  // print → download
  "print":                    "download",
  "print-outline":            "download",
  // location variants
  "location-outline":         "location",
  "pin":                      "location",
  // mail / chat → message
  "mail":                     "message",
  "mail-outline":             "mail",
  "chatbubble-ellipses":      "message",
  "chatbubble-ellipses-outline": "message",
  // call → headset
  "call":                     "headset",
  "call-outline":             "headset",
  // swap → repeat
  "swap-horizontal":          "repeat",
  "swap-horizontal-outline":  "repeat",
  // cloud-offline → alert_circle
  "cloud-offline":            "alert_circle",
  "cloud-offline-outline":    "alert_circle",
  // hand-left → info
  "hand-left":                "info",
  "hand-left-outline":        "info",
  // folder-open → package
  "folder-open":              "package",
  "folder-open-outline":      "package",
  // home → dashboard
  "home":                     "dashboard",
  "home-outline":             "dashboard",
  // chevron-back → chevron_left; chevron-down-outline → chevron_down
  "chevron-back":             "chevron_left",
  "chevron-down-outline":     "chevron_down",
  // calendar-clear → calendar
  "calendar-clear":           "calendar",
  "calendar-clear-outline":   "calendar",
};

function resolveName(name: string): string {
  return ALIASES[name] || name;
}

type IconName = keyof typeof PATHS;

type IconProps = {
  name: IconName | string;
  size?: number;
  color?: string;
};

export function Icon({ name, size = 20, color = "#a0a0b8" }: IconProps) {
  const resolved = resolveName(name as string);
  const path = PATHS[resolved];

  // Nao renderiza nada se o icone nao existir (sem "?")
  if (!path) {
    if (__DEV__) console.warn(`[Icon] icone nao encontrado: "${name}" (resolvido: "${resolved}")`);
    return null;
  }

  if (Platform.OS === "web") {
    const segments = path
      .split(" M")
      .map((d, i) => `<path d="${i === 0 ? d : "M" + d}"/>`)
      .join("");
    return (
      <span
        style={{ width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } as any}
        aria-hidden="true"
        dangerouslySetInnerHTML={{
          __html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${segments}</svg>`,
        }}
      />
    );
  }

  // Native fallback — letras simples mas sem "?"
  const fallback: Record<string, string> = {
    dashboard: "P", wallet: "W", file_text: "N", calculator: "C", cart: "C",
    package: "E", users: "U", dollar: "$", trending_up: "+", trending_down: "-",
    receipt: "R", user_plus: "+", bag: "B", bar_chart: "B", clipboard: "D",
    star: "*", settings: "S", logout: "X", check: "V", alert: "!", info: "i",
    calendar: "C", payroll: "F", chevron_left: "<", chevron_right: ">",
    chevron_up: "^", chevron_down: "v", moon: "D", sun: "S", message: "M",
    headset: "H", brain: "I", globe: "G", lock: "L", unlock: "L", plus: "+",
    minus: "-", x: "X", edit: "E", trash: "T", search: "Q", filter: "F",
    download: "D", upload: "U", copy: "C", refresh: "R", repeat: "T", eye: "O", menu: "=",
    grid: "#", clock: "T", tag: "#", barcode: "|||", qr_code: "[#]", camera: "O",
    drag_handle: "=", eye_off: "O", shield: "U", power: "O", more_vertical: ":",
    tooth: "D", scissors: "X", utensils: "Y", paw: "P", dumbbell: "H", sparkles: "*",
    // Novos (25/05)
    shopping_bag: "B", shopping_cart: "C", credit_card: "$",
    message_circle: "M", alert_circle: "!", briefcase: "B", image: "I",
    whatsapp: "W",
    // Novos (fix/studio-icons)
    arrow_right: ">", arrow_left: "<", external_link: "^", box: "B",
    truck: "T", resize: "R", location: "P",
    // Novos (fix/karate-shell) — glifos da shell de karate
    bell: "N", activity: "~", building: "D", network: "C", ribbon: "M", trophy: "T",
  };

  return (
    <Text style={{ fontSize: size * 0.6, fontWeight: "700", color, textAlign: "center" }}>
      {fallback[resolved] ?? ""}
    </Text>
  );
}

export default Icon;
