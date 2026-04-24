# Aura — Backlog Técnico: Aceite de Termos de Uso (2026-04-24)

> Suporte tecnico pra Termos de Uso v2.0 (publicado em 24/04/2026,
> vigente em 24/05/2026). Duas frentes: checkbox tradicional no
> registro de novas contas + modal nao-fechavel no proximo login
> pra usuarios existentes.

## Contexto e regras de negocio

- **Versao atual:** 2.0 (publicada 24/04/2026)
- **Vigencia:** 24/05/2026 (30 dias apos publicacao, conforme clausula 28.3)
- **Obrigatoriedade:** TODOS os usuarios devem aceitar a v2.0 antes de
  continuar usando a Plataforma a partir de 24/05/2026.
- **Rastreio auditoria:** cada aceite grava `user_id + terms_version +
  accepted_at + ip + user_agent`. Sem esse registro, em caso de disputa
  LGPD/judicial a Aura nao consegue provar que o usuario aceitou.
- **Versionamento:** string semver ("2.0", "2.1" no futuro). Versao MAJOR
  (X.0) exige re-aceite. Versao MINOR (X.1) e so notificacao.
- **Grandfathering:** usuarios que aceitaram v1 continuam "ok" ate
  24/05/2026. Apos essa data, se nao aceitaram v2.0, bloqueio.

---

## TA-01 — Migration + schema de aceites

**Esforco:** 0.5 sessao
**Repo:** aura-backend

### Tabela nova: `terms_acceptance`
```sql
CREATE TABLE terms_acceptance (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id      uuid        REFERENCES companies(id) ON DELETE CASCADE,
  terms_version   varchar(10) NOT NULL,           -- "2.0", "2.1", etc
  accepted_at     timestamptz NOT NULL DEFAULT NOW(),
  ip              inet,                            -- auditoria
  user_agent      text,                            -- auditoria
  acceptance_type varchar(20) NOT NULL,            -- 'registration' | 'forced_relogin' | 'voluntary'
  created_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_terms_acceptance_user_version
  ON terms_acceptance(user_id, terms_version);
CREATE INDEX idx_terms_acceptance_company
  ON terms_acceptance(company_id);
```

### Coluna nova: `users.last_accepted_terms_version`
```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_accepted_terms_version varchar(10);

-- Backfill: todos usuarios existentes marcados como aceitantes da v1
-- (ja que o v1 era o Termos vigente ate agora e eles ja "aceitaram"
-- implicitamente no uso continuado).
UPDATE users SET last_accepted_terms_version = '1.0' WHERE last_accepted_terms_version IS NULL;
```

### Constante server-side: `CURRENT_TERMS_VERSION`
Arquivo `src/config/terms.js`:
```js
module.exports = {
  CURRENT_TERMS_VERSION: '2.0',
  ENFORCEMENT_DATE: '2026-05-24',  // bloqueio ativa nesta data
  TERMS_URL: 'https://getaura.com.br/legal/termos',
  TERMS_VERSION_MAJOR: (v) => v.split('.')[0],  // pra detectar versao major
};
```

**Aceite TA-01:** migration aplicada em prod E arquivo espelho em
`migrations/NNN_terms_acceptance.sql` (regra da sessao 24/04).

---

## TA-02 — Backend: endpoints + middleware

**Esforco:** 1 sessao
**Repo:** aura-backend

### Endpoints novos

**`GET /auth/terms-status`** (requer auth)
Retorna estado atual do aceite pro usuario logado.
```json
{
  "current_version": "2.0",
  "user_accepted_version": "1.0",
  "needs_acceptance": true,
  "enforcement_date": "2026-05-24",
  "terms_url": "https://getaura.com.br/legal/termos"
}
```

**`POST /auth/accept-terms`** (requer auth)
Grava aceite. Body: `{ version: "2.0" }`.
Implementacao:
```js
const ip = req.ip || req.headers['x-forwarded-for'];
const userAgent = req.headers['user-agent'];
await pool.query(`
  INSERT INTO terms_acceptance (user_id, company_id, terms_version, ip, user_agent, acceptance_type)
  VALUES ($1, $2, $3, $4, $5, $6)
`, [req.user.id, req.user.company_id, '2.0', ip, userAgent, 'forced_relogin']);

await pool.query(
  'UPDATE users SET last_accepted_terms_version = $1 WHERE id = $2',
  ['2.0', req.user.id]
);
```
Retorna `{ ok: true, accepted_version: "2.0", accepted_at: "..." }`.

**`GET /legal/terms/current`** (publico)
Retorna metadados da versao atual (pra site e pra pagina de registro):
```json
{
  "version": "2.0",
  "published_at": "2026-04-24",
  "enforcement_date": "2026-05-24",
  "url": "https://getaura.com.br/legal/termos"
}
```

### Middleware novo: `requireTermsAccepted`
Arquivo `src/middlewares/requireTermsAccepted.js`:
- Aplicado APOS `requireAuth` em todas as rotas autenticadas
- Compara `req.user.last_accepted_terms_version` vs `CURRENT_TERMS_VERSION`
- Se versao major diferente E data atual >= ENFORCEMENT_DATE:
  - Retorna 403 com `{ error: 'terms_acceptance_required', current_version: '2.0', user_version: '1.0' }`
  - Frontend detecta esse erro e redireciona pro modal
- EXCECOES (rotas permitidas mesmo sem aceite):
  - `POST /auth/accept-terms`
  - `GET /auth/me`
  - `GET /auth/terms-status`
  - `POST /auth/logout`
  - `DELETE /account` (opcional — permite cancelar conta sem aceitar)

### Update em `register.js`
Body do registro passa a exigir `accepted_terms_version`:
```js
if (!req.body.accepted_terms_version || req.body.accepted_terms_version !== CURRENT_TERMS_VERSION) {
  throw new AppError('Aceite dos Termos de Uso e obrigatorio', 400);
}
// ... cria user com last_accepted_terms_version = '2.0'
// ... insere registro em terms_acceptance com acceptance_type='registration'
```

### Update em `/auth/me`
Response agora inclui:
```json
{
  "user": {...},
  "terms": {
    "needs_acceptance": false,
    "current_version": "2.0",
    "user_version": "2.0"
  }
}
```

**Aceite TA-02:**
- Tests integracao cobrindo: registro sem aceite (rejeita), login de user com v1 pre-enforcement (passa), login de user com v1 pos-enforcement (bloqueia), POST accept-terms atualiza corretamente
- Middleware aplicado em `src/routes/private.js` antes dos outros routers

---

## TA-03 — Frontend: Modal de aceite forcado (proximo login)

**Esforco:** 1 sessao
**Repo:** aura-app

### Componente novo: `components/auth/TermsAcceptanceModal.tsx`

Modal **nao-fechavel** (Modal com `onRequestClose` no-op, sem botao X
visivel) mostrando:

1. **Header:** "Atualizamos nossos Termos de Uso"
2. **Subtitle:** "Voce precisa revisar e aceitar a nova versao pra continuar"
3. **Resumo das mudancas** (lista de 6-8 pontos principais):
   - Novas secoes cobrindo dados de saude (LGPD Art. 11)
   - Inteligencia artificial (sugestao, nao decisao)
   - Canal Digital e responsabilidade consumerista
   - Pagamentos e repasses operacionais
   - Modulos verticais (Odontologia, Barbearia, Food)
   - Preco atualizado: Negocio R$ 169,90 e Expansao R$ 269,90
   - Retencao de dados apos cancelamento (90 dias)
4. **Link destacado:** "Ler termos completos" -> abre
   `https://getaura.com.br/legal/termos` em webview/navegador externo
5. **Checkbox obrigatorio:** "Li e aceito os Termos de Uso v2.0"
6. **Dois botoes:**
   - **"Aceitar e continuar"** (primary, disabled se checkbox nao marcado)
   - **"Cancelar minha conta"** (secondary, ghost) -> confirma 2x,
     depois chama DELETE /account ou abre email pra suporte@getaura.com.br

### Integracao com AuthGuard
Em `app/_layout.tsx`, apos login bem-sucedido:
```tsx
const { data: termsStatus } = useQuery({
  queryKey: ['terms-status'],
  queryFn: () => api.getTermsStatus(),
  enabled: isAuthenticated,
});

if (termsStatus?.needs_acceptance) {
  return <TermsAcceptanceModal version={termsStatus.current_version} />;
}
```

### Interceptor em services/api.ts
Quando receber 403 com `error: 'terms_acceptance_required'`:
- Nao fazer logout
- Forcar refetch de `/auth/terms-status`
- AuthGuard renderiza o modal

**Aceite TA-03:**
- Usuario logado com v1 ve modal no proximo acesso (pos-enforcement)
- Checkbox desabilita botao "Aceitar" quando nao marcado
- Botao aceitar chama POST /accept-terms e fecha modal
- Botao cancelar abre fluxo de cancelamento
- Modal nao fecha ao tocar fora (nem pelo back button Android)

---

## TA-04 — Frontend: checkbox no registro

**Esforco:** 0.5 sessao
**Repo:** aura-app

### Update em `app/(auth)/register.tsx`

Adicionar abaixo do campo de senha, antes do botao "Criar conta":

```tsx
<TouchableOpacity
  onPress={() => setAcceptedTerms(!acceptedTerms)}
  style={styles.termsRow}
>
  <Checkbox checked={acceptedTerms} onPress={() => setAcceptedTerms(!acceptedTerms)} />
  <Text style={styles.termsText}>
    Li e aceito os{' '}
    <Text style={styles.termsLink} onPress={() => Linking.openURL(TERMS_URL)}>
      Termos de Uso
    </Text>
    {' '}e a{' '}
    <Text style={styles.termsLink} onPress={() => Linking.openURL(PRIVACY_URL)}>
      Politica de Privacidade
    </Text>
    .
  </Text>
</TouchableOpacity>
```

- Botao "Criar conta" fica disabled quando `!acceptedTerms`
- Request body passa a incluir `accepted_terms_version: '2.0'`
- Apos registro bem-sucedido, backend ja gravou aceite — frontend nao
  precisa chamar `/accept-terms` de novo

**Aceite TA-04:**
- Nao consegue criar conta sem marcar checkbox
- Link abre os Termos (webview interna ou browser externo)
- Backend recebe `accepted_terms_version` e rejeita se faltar

---

## TA-05 — Site publico: pagina de Termos

**Esforco:** 0.5 sessao
**Repo:** aura-site

### Nova rota: `app/legal/termos/page.html`

Opcoes de implementacao (escolher 1):

**Opcao A (recomendada):** renderizar o .docx como HTML usando mammoth.js ou
pandoc no build do site. Gera `legal/termos/index.html` estatico
deployado em Cloudflare Pages. Facil de versionar no git.

**Opcao B:** hospedar o .docx direto em `/legal/termos.docx` e fazer
pagina HTML simples que incorpora Google Docs Viewer ou link de download.

**Opcao C:** reescrever manualmente os termos em HTML com mesma estrutura.
Mais trabalho, mas melhor pra SEO e acessibilidade.

### Content flow
1. Cabecalho getaura.com.br padrao (navbar + footer)
2. H1 "Termos de Uso da Aura"
3. Subtitle com versao + data de atualizacao + botao "Baixar PDF"
4. Corpo dos termos v2.0
5. Rodape com link pra Politica de Privacidade + DPA + Contato

### SEO
- `<title>Termos de Uso | Aura</title>`
- `<meta name="description" content="Termos de Uso da plataforma Aura...">`
- Schema.org LegalService

**Aceite TA-05:**
- Pagina publica acessivel em `getaura.com.br/legal/termos`
- Links do app e do site apontam corretamente pra la
- Download de PDF funciona
- Responsivo mobile

---

## TA-06 — Comunicacao previa (email 30 dias antes)

**Esforco:** 0.5 sessao
**Repo:** aura-backend + template email

### Email broadcast pra usuarios ativos
Disparar em 24/04/2026 (30 dias antes da vigencia 24/05/2026).

**Subject:** "Aura: atualizamos nossos Termos de Uso — entra em vigor em 24/05"

**Body (resumo):**
- Saudacao personalizada (nome)
- Explicacao: "Atualizamos os Termos pra cobrir novas funcionalidades
  que lancamos (IA, Canal Digital, modulos verticais) e pra alinhar com
  LGPD e CDC"
- Principais mudancas (mesma lista do modal TA-03)
- Call-to-action: "Ler termos completos" -> link pra getaura.com.br/legal/termos
- Nota: "No proximo acesso a partir de 24/05 voce sera solicitado a
  confirmar o aceite. Caso nao concorde, voce pode cancelar sua conta
  sem custo nesse periodo."
- Assinatura: Equipe Aura

### Implementacao
- Usar Resend (ja configurado pra holerite)
- Fila: Bull/BullMQ ou processamento batch via script one-shot
- Rate limit: 10 emails/seg pra nao triggerar spam filters
- Tracking: salvar `terms_v2_email_sent_at` em users

**Aceite TA-06:**
- Todos usuarios ativos recebem email em 24/04
- Tracking de envio funcionando
- Bounces tratados (email_verified fica false pra usuarios que rejeitaram)

---

## Ordem de execucao recomendada

```
Sem 1  (24/04 - 01/05):
  TA-01 migration + schema              [0.5 sessao]
  TA-02 endpoints + middleware          [1.0 sessao]
  TA-06 email broadcast (disparar 24/04) [0.5 sessao]

Sem 2 (02/05 - 08/05):
  TA-04 checkbox registro               [0.5 sessao]
  TA-05 pagina publica site             [0.5 sessao]
  TA-03 modal de aceite forcado         [1.0 sessao]

Sem 3 (09/05 - 15/05):
  Testes E2E + QA interna + Eryca UAT   [0.5 sessao]
  Deploy producao                       [0.0]

Sem 4 (16/05 - 23/05):
  Buffer pra imprevistos + monitoramento

24/05/2026: ENFORCEMENT ATIVA
  Middleware requireTermsAccepted comeca a bloquear v1
```

**Total: ~4 sessoes spread em 4 semanas**

---

## Edge cases e decisoes importantes

### 1. Usuario que criou conta entre 24/04 e 24/05
- Criou conta APOS publicacao dos termos v2 -> ja aceita v2 no registro
- Checkbox TA-04 ja esta implementado quando ele se cadastra

### 2. Usuario que NAO aceitar ate 24/05
- Middleware bloqueia ele em qualquer rota autenticada exceto
  `/auth/me`, `/auth/accept-terms`, `/auth/logout`, `/account`
- Se ele fizer login, vai cair direto no modal TA-03 sem conseguir
  acessar dashboard/financeiro/etc
- Apos X dias (proposta: 30 dias) sem aceitar, Aura pode considerar
  a conta abandonada e iniciar processo de cancelamento

### 3. Usuario menor de idade ou sem capacidade
- Tratado pela clausula 2.1 dos Termos, nao e problema tecnico
- Frontend pode adicionar campo "Declaro ter maioridade" no registro
  (nao-critico pro P0)

### 4. Multi-usuario (empresa com membros)
- Cada `user` aceita individualmente
- Titular da conta (company owner) aceita pela empresa tambem
- Membros precisam aceitar individualmente quando acessarem

### 5. Alteracao MINOR futura (v2.1)
- Nao triggera modal
- Apenas email notificacao + update de `CURRENT_TERMS_VERSION`
- `last_accepted_terms_version` continua '2.0' — comparacao e por MAJOR

### 6. "Cancelar minha conta" no modal
- Fluxo: confirma 2x, backend marca `deletion_requested_at`,
  trigger email com link de revogacao por 30 dias
- Durante 30 dias acesso fica suspenso
- Apos 30 dias, dados deletados conforme clausula 27

### 7. Token JWT expirado enquanto modal esta aberto
- Se expirar, proximo request retorna 401
- Frontend redireciona pra login, pos-login volta pro modal
- Nao perde contexto do aceite pendente

---

## Criterios de sucesso (KPIs pos-launch)

- > 80% dos usuarios ativos aceitam v2 dentro de 7 dias pos-enforcement
- < 5% de tickets de suporte relacionados a "nao consigo entrar"
- 100% dos novos registros entre 24/04-24/05 ja possuem aceite v2
- Zero incidentes LGPD com alegacao de "nao aceitei nada"

---

## Notas finais

- **NAO** implementar aceite de DPA e Politica de Privacidade junto
  neste backlog. Esses tres documentos devem ser aceites em conjunto
  mas por enquanto so os Termos foram reescritos pra v2.
- **DPA e Politica de Privacidade** provavelmente precisam de update
  similar — criar backlog separado quando a versao v2 desses
  documentos estiver pronta.
- Se advogado LGPD/tributarista revisar os Termos e sugerir mudancas
  materiais antes de 24/05, incrementar pra v2.1 ou v2.0-rc conforme
  peso da mudanca.
