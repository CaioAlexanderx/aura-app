# MOBILE NATIVE PORT — Backlog Aura

**Status:** Não iniciado · **Prioridade:** Baixa (pós-alpha) · **Estimativa:** 2-4 semanas
**Criado:** 22/04/2026

---

## Visão geral

A Aura hoje é **web-first**. O app já está em `expo-router` + React Native 0.76 e o
`app.json` tem `ios.bundleIdentifier` e `android.package` configurados, mas o
código-fonte usa intensivamente APIs web (`<div>`, `document.*`, `window.*`,
`BarcodeDetector`, `localStorage`) que não existem no iOS/Android nativo.

Rodar `eas build --platform ios` ou `--platform android` hoje **compila sem
erros** (o Metro bundler aceita), mas o app **crasha em runtime** na maioria
das telas.

Este documento mapeia o trabalho de portar de verdade, sprint a sprint.

---

## Alternativa considerada: PWA (plano B)

Antes de decidir portar, pesar: a Aura roda bem em **mobile web** e já está
servida via Cloudflare Pages. Adicionar `manifest.json` + service worker deixa
o app "instalável" na tela inicial do celular via "Adicionar à tela inicial"
do Safari/Chrome, com experiência 80-90% igual a nativa, sem custos de loja,
sem revisão da Apple, sem esforço de port.

**Quando faz sentido ir pra nativo:**

- Push notifications críticas pro negócio (novo pedido, alerta de estoque baixo)
- Scanner de código de barras do PDV usado o dia todo (câmera nativa é mais
  estável que `BarcodeDetector` do browser)
- Biometria (Face ID / Touch ID) como diferencial de login
- Presença nas lojas como sinal de credibilidade pro mercado MEI
- Offline-first robusto (já temos base com `offlineSync`, mas nativo tem
  vantagem em confiabilidade)

**Quando PWA resolve:**

- MVP / validação de mercado inicial
- Base de usuários pequena onde word-of-mouth funciona
- Time pequeno sem banda pra manter builds + updates constantes
- Orçamento limitado

**Recomendação:** PWA primeiro (1-2 dias de trabalho), nativo quando houver
demanda explícita dos usuários ou métrica de retenção que justifique.

---

## Pré-requisitos externos (antes de começar)

| Item | Custo | Tempo | Quando |
|---|---|---|---|
| Apple Developer Program | US$ 99/ano | 24-48h aprovação | Antes de S7 |
| Google Play Console | US$ 25 único | Instantâneo | Antes de S8 |
| Certificados iOS (via EAS) | Grátis | Automático | Durante S5 |
| Google Play signing (via EAS) | Grátis | Automático | Durante S5 |
| Conta EAS (Expo) | Grátis (1 build/mês) ou US$ 29/mês ilimitado | Instantâneo | Antes de S5 |
| PNG 1024×1024 (icon oficial) | — | 30min design | Antes de S4 |
| Screenshots das lojas | — | 1 dia design | Durante S7-S8 |
| Política de privacidade (URL) | — | Já existe em getaura.com.br/privacidade | ✅ |

**Total de investimento inicial:** ~US$ 124 + US$ 29/mês (se build frequente).

---

## SPRINTS

### S1 — Refatoração web-only → cross-platform (2-3 dias)

**Objetivo:** Telas que hoje usam `<div>`, `<img>`, `<span>` inline renderizarem
também em iOS/Android.

**Arquivos afetados:**

- `app/(auth)/login.tsx` — hero desktop com `<div>`, `<img>`, rings, particles,
  grid animada
- `app/(auth)/register.tsx` — idem + `saveCnpjData` usa `localStorage`
- `app/(auth)/forgot-password.tsx` — idem hero
- `app/(auth)/reset-password.tsx` — idem hero
- `app/(auth)/verify-email.tsx` — idem hero
- `app/(tabs)/_layout.tsx` — sidebar tem `<div>`, MBar "Mais" menu overlay
  com `<div>`, favicon setup
- `components/BrandBanner.tsx` — `<img>` inline (já isola com `isWeb`, OK)
- `components/ScannerInput.tsx` — `<div id="aura-scanner-feed">`

**Abordagem recomendada:** isolar blocos web-only em `if (isWeb)` e dar
fallback RN (`<View>`, `<Image>`, `<Text>`) pros outros platforms. Não reescrever
tudo — só os pontos que rodam em native.

**Entregáveis:**
- Auth telas abrem em iOS/Android sem crash (visual pode ficar simplificado)
- Sidebar + MBar funcionam em native (hoje já tem fallback native via `MBar()`)
- `BrandBanner` render native já funciona (via `<Image>`)

**Dependências:** Nenhuma.

---

### S2 — DOM / CSS injection → RN nativo (2 dias)

**Objetivo:** Remover injeções de DOM que só funcionam em web.

**Pontos a refatorar:**

1. **`document.createElement("style")`** em várias telas auth
   - Hoje injeta CSS com `@keyframes auraPulse`, `auraDraw`, `fadeUp`, etc
   - Native equivalent: **`react-native-reanimated`** (já é peer-dep do Expo)
   - Envolver animações em `Animated.View` ou `withTiming/withSequence`

2. **Favicon setup** em `_layout.tsx` linha ~40
   - Native não precisa favicon (remove do `if (isWeb)`)

3. **Google Fonts via `<link>`** em `_layout.tsx`
   - Native: usar `useFonts` do `expo-font` + carregar Instrument Serif e
     DM Sans localmente via `assets/fonts/`
   - Baixar `.ttf` / `.otf` dos fonts.google.com e commitar no repo

4. **`window.innerWidth` + resize listener** em `useIsWide`, `useScreenWidth`
   - Native: usar `Dimensions` API com `Dimensions.addEventListener('change', ...)`
   - Criar hook `useScreenSize` platform-agnostic

**Entregáveis:**
- Zero referências a `document.*` e `window.*` fora de blocos `if (isWeb)`
- Fontes carregadas via `expo-font` em native, via `<link>` em web
- Animações usando Reanimated (funciona em ambos)

**Dependências:** S1 concluído.

---

### S3 — APIs nativas (câmera, storage, deep link) (2 dias)

**Objetivo:** Substituir APIs do browser por módulos Expo.

**Substituições:**

| Web API | Expo equivalent | Usado em |
|---|---|---|
| `navigator.mediaDevices.getUserMedia` | `expo-camera` ou `react-native-vision-camera` | `ScannerInput.tsx` |
| `window.BarcodeDetector` | `expo-barcode-scanner` ou vision-camera codeScanner | `ScannerInput.tsx` |
| `localStorage` | `@react-native-async-storage/async-storage` | `register.tsx`, `_layout.tsx`, outros |
| `document.cookie` | `expo-secure-store` (já instalado) | `services/api.ts` (se houver) |
| `window.location` / `history.replaceState` | `expo-router` navigation | `_layout.tsx` |

**Novas capabilities pra adicionar:**

- **Deep linking** configurado em `app.json` (`scheme: "aura"` já existe)
  - Ex: `aura://invite/abc123` pra aceitar convite via SMS/WhatsApp
- **Push notifications** via `expo-notifications`
  - FCM (Android) + APNs (iOS)
  - Use cases: venda cadastrada, cliente no canal digital, obrigação contábil
- **Biometria** via `expo-local-authentication`
  - Login rápido no app sem redigitar senha

**Entregáveis:**
- PDV scanner funciona com câmera nativa em iOS/Android
- Dados de onboarding persistem via AsyncStorage em native
- App registra device pra push notifications (server-side fica pro futuro)

**Dependências:** S1, S2.

---

### S4 — Assets e configuração (1 dia)

**Objetivo:** Ter ícones, splash screen e metadados nativos corretos.

**Tarefas:**

1. **Ícone 1024×1024 PNG** (sem transparência, RGBA flat)
   - Já temos `assets/Icon.png` (352KB, 1024×1024 presumível)
   - Verificar se atende specs da Apple (quadrado exato, sem texto minúsculo)

2. **Splash screen**
   - Criar `assets/splash.png` (2048×2048 recomendado)
   - Configurar em `app.json`:
     ```json
     "splash": {
       "image": "./assets/splash.png",
       "resizeMode": "contain",
       "backgroundColor": "#0a0a0a"
     }
     ```

3. **Adaptive Icon Android**
   - `assets/adaptive-icon.png` (1024×1024, foreground only, safe-zone central)
   - Configurar:
     ```json
     "android": {
       "adaptiveIcon": {
         "foregroundImage": "./assets/adaptive-icon.png",
         "backgroundColor": "#6d28d9"
       }
     }
     ```

4. **Permissions** em `app.json`:
   ```json
   "ios": {
     "infoPlist": {
       "NSCameraUsageDescription": "Aura usa a câmera para ler códigos de barras de produtos no caixa."
     }
   },
   "android": {
     "permissions": ["CAMERA"]
   }
   ```

5. **Plugin list**:
   ```json
   "plugins": [
     "expo-router",
     "expo-secure-store",
     "expo-camera",
     "expo-notifications",
     "expo-local-authentication"
   ]
   ```

**Entregáveis:**
- `app.json` completo com icon, splash, adaptive icon, permissions, plugins
- Assets nativos no repo (`assets/splash.png`, `assets/adaptive-icon.png`)

**Dependências:** Nenhuma (pode rodar em paralelo com S1-S3).

---

### S5 — EAS Build + primeiro build nativo (1 dia)

**Objetivo:** Gerar `.ipa` (iOS) e `.apk`/`.aab` (Android) assinados.

**Tarefas:**

1. **Instalar EAS CLI:** `npm install -g eas-cli`
2. **Login + projeto:** `eas login` + `eas init`
3. **Criar `eas.json`:**
   ```json
   {
     "build": {
       "development": {
         "developmentClient": true,
         "distribution": "internal"
       },
       "preview": {
         "distribution": "internal",
         "ios": { "simulator": true }
       },
       "production": {}
     },
     "submit": {
       "production": {
         "ios": { "ascAppId": "..." },
         "android": { "serviceAccountKeyPath": "./google-play-key.json" }
       }
     }
   }
   ```

4. **Primeiro build iOS simulator:**
   ```bash
   eas build --platform ios --profile preview
   ```
   Baixa `.app` e roda em Xcode Simulator.

5. **Primeiro build Android APK:**
   ```bash
   eas build --platform android --profile preview
   ```
   Baixa `.apk` e instala em device Android ou emulador.

**Entregáveis:**
- App abrindo no iOS Simulator e Android Emulator
- Lista documentada de bugs/crashes pra corrigir em S6

**Dependências:** S1, S2, S3, S4.

---

### S6 — Testes em device real + correções (2-3 dias)

**Objetivo:** App estável em pelo menos 1 iPhone e 1 Android de teste.

**Checklist de teste:**

- [ ] Login funciona (com teclado native, autocompletar, Face ID opcional)
- [ ] Register: CNPJ lookup, validação de senha, persistência
- [ ] Dashboard: KPIs renderizam, scroll horizontal de ações rápidas
- [ ] PDV: busca produto, scanner abre câmera, venda completa
- [ ] Estoque: CRUD, variantes, etiquetas (impressão fica pro futuro)
- [ ] Financeiro: lançamentos, gráficos (Recharts em native? testar)
- [ ] Agenda: calendário native (pode precisar `react-native-calendars`)
- [ ] Canal Digital: lista produtos
- [ ] Configurações: upload de logo, troca de senha
- [ ] Navegação: swipe back iOS, hardware back Android
- [ ] Orientação: portrait only (configurado em `app.json` já)
- [ ] Sem crashes em transições rápidas

**Bugs esperados** (bem comuns em port web→native):

- `flexWrap: 'wrap'` se comporta diferente em `<Text>` aninhado
- `position: 'absolute'` em gradients precisa `pointerEvents="none"`
- Sombras: usar `elevation` (Android) + `shadowOffset/Opacity/Radius` (iOS)
- KeyboardAvoidingView obrigatório em formulários
- SafeAreaView obrigatório pro notch/dynamic island

**Entregáveis:**
- App utilizável end-to-end em iOS e Android
- TestFlight build privado (iOS) + Google Play Internal Track (Android)

**Dependências:** S5.

---

### S7 — Publicação iOS (1 semana, incluindo review) (2-3 dias de trabalho)

**Objetivo:** Aura aprovada na App Store.

**Checklist:**

1. **App Store Connect setup:**
   - [ ] Criar App ID: `com.getaura.app`
   - [ ] Nome: "Aura — Gestão para MEI e ME"
   - [ ] Subtítulo: "Financeiro, NF-e, estoque e caixa"
   - [ ] Categoria primária: Business · secundária: Finance
   - [ ] Classificação etária: 4+

2. **Screenshots** (obrigatório 3 tamanhos):
   - 6.7" (iPhone 15 Pro Max): 1290×2796
   - 6.5" (iPhone 11 Pro Max): 1242×2688
   - 5.5" (iPhone 8 Plus): 1242×2208
   - Tirar 5-8 screenshots: Dashboard, PDV, Estoque, Financeiro, NF-e, Clientes

3. **Metadata:**
   - Descrição PT-BR (4000 chars)
   - Keywords: MEI, gestão, contabilidade, NF-e, PDV, caixa, pequeno negócio
   - URL suporte: getaura.com.br/contato
   - URL marketing: getaura.com.br
   - URL privacidade: getaura.com.br/privacidade ✅

4. **Build submission:**
   ```bash
   eas submit --platform ios --profile production
   ```

5. **Review Apple** (5-7 dias típico):
   - Comum rejeitar 1-2x por questões de clareza, funcionalidades incompletas,
     ou uso ambíguo de permissions
   - Apple valoriza: app funcional 100% (não pode ter "em breve"), políticas
     de privacidade claras, justificativa de câmera/notifications

**Entregáveis:**
- Aura na App Store, downloadable

**Dependências:** S6 + Apple Developer Program ativo.

---

### S8 — Publicação Android (3-5 dias) (1-2 dias de trabalho)

**Objetivo:** Aura no Google Play Store.

**Checklist:**

1. **Google Play Console setup:**
   - [ ] Criar app com package `com.getaura.app`
   - [ ] Preencher Store Listing (descrição, screenshots, ícone 512×512)
   - [ ] Data safety form (dados coletados, uso, compartilhamento)
   - [ ] Classificação etária via questionário IARC

2. **Screenshots Android:**
   - Phone: 1080×1920 mínimo, 8 screenshots
   - 7" tablet: opcional mas bom ter
   - 10" tablet: opcional

3. **Build submission:**
   ```bash
   eas submit --platform android --profile production
   ```

4. **Tracks:**
   - Internal testing primeiro (100 testers)
   - Closed testing (beta externo)
   - Open testing
   - Production

5. **Review Google** (1-3 dias típico):
   - Muito mais rápido que Apple
   - Menos rejeições, mas se rejeitar é drástico (suspensão de conta)

**Entregáveis:**
- Aura no Google Play Store, downloadable

**Dependências:** S6 + Google Play Console ativo.

---

## RESUMO DE ESFORÇO

| Sprint | Dias de trabalho | Bloqueado por |
|---|---|---|
| S1 — Refactor web-only | 2-3 | — |
| S2 — DOM/CSS → RN | 2 | S1 |
| S3 — APIs nativas | 2 | S1, S2 |
| S4 — Assets/config | 1 | — |
| S5 — EAS Build | 1 | S1-S4 |
| S6 — Testes + bugs | 2-3 | S5 |
| S7 — Publicação iOS | 2-3 (+ 5-7d review) | S6 |
| S8 — Publicação Android | 1-2 (+ 1-3d review) | S6 |
| **TOTAL** | **13-17 dias** + revisões | |

**Calendário realista:** 3-4 semanas considerando uma pessoa dedicada
(~50% do tempo em outras coisas = 6-8 semanas efetivas).

---

## DECISÕES PENDENTES

Antes de iniciar, decidir:

- [ ] Vai ser PWA primeiro ou direto nativo?
- [ ] Features nativas v1: push? biometria? deep link?
  (recomendo push + deep link; biometria v2)
- [ ] Plano EAS: free tier (1 build/mês) ou Production ($29/mês)?
- [ ] Quem fará o design dos screenshots das lojas?
- [ ] Nome comercial final: "Aura" ou "Aura — Gestão de Negócios"?
- [ ] Versionamento: começar em 1.0.0 ou alinhado com web (ex: 1.1.0)?

---

## RISCOS

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Apple rejeita por "funcionalidade incompleta" | Alta | Testar em TestFlight externo antes de submeter review |
| Gráficos Recharts não renderizam em native | Média | Trocar por `react-native-chart-kit` ou `victory-native` |
| Scanner QR custa muito na bateria | Baixa | Usar `vision-camera` com frame processor on-demand |
| Logos cliente (`BrandBanner`) lentas via CDN | Baixa | Cache em FileSystem do Expo |
| Updates OTA via Expo conflitam com builds nativos | Média | Usar EAS Update com branches dev/staging/prod |

---

## REFERÊNCIAS

- Expo Router docs: https://docs.expo.dev/router/introduction/
- EAS Build: https://docs.expo.dev/build/introduction/
- Apple Human Interface: https://developer.apple.com/design/human-interface-guidelines/
- Material You: https://m3.material.io/
- App Store Review Guidelines: https://developer.apple.com/app-store/review/guidelines/

---

**Última revisão:** 22/04/2026 — Caio
