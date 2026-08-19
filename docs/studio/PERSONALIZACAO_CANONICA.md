# Personalização do Studio — o editor canônico e a forma do `customization_config`

**Decisão de 19/08/2026.** Fecha a pendência registrada na §7 de `docs/F1_CONTEUDO_STUDIO.md` (aura-backend): *"dois editores de personalização gravam o mesmo `customization_config` em formatos diferentes"*.

---

## A decisão, em uma linha

**O painel `StudioPersonalizacaoPanel` é o editor canônico; a forma que o wizard gravava é o dado canônico; e quem sabe qual é essa forma passa a ser um módulo só, `components/studio/customizationConfig.ts`.** O wizard `app/studio/(estudio)/produtos/[id]/personalizacao.tsx` virou redirect.

Não foi (a) *nem* (b) da pergunta original — foi o cruzamento: a UI que fica é a de um lado, o formato que fica é o do outro.

---

## Por que o painel, se era ele que gravava errado

A investigação virou a resposta óbvia do avesso. O wizard tinha o formato certo — ids estáveis, config rico, campos de arte nunca obrigatórios. Mas:

| | Wizard `produtos/[id]/personalizacao.tsx` | Painel `StudioPersonalizacaoPanel` |
|---|---|---|
| Alcançável pela lojista | **Não.** Zero navegação: nenhum `router.push`, nenhum link, nenhuma entrada de `NAV` ou `MODULE_PLAN_MAP` | Sim — Estoque › produto › seção Personalização |
| Verso (`has_back`, cobrança) | Não | Sim |
| Campos livres (vários textos, cor, opção) | Não — três toggles fixos | Sim |
| Preview vivo do motor | Sim (`PersonalizacaoLivePreview`) | Sim (`EnginePreview`, o mesmo da vitrine) |
| Sugestões IA de template, preview WhatsApp | Não | Sim |
| Serviço de arte, guia de medidas | Sim | Não |

Eleger o wizard significaria reimplementar verso, campos livres e as duas ferramentas — e ainda assim dar à lojista uma tela que ela nunca viu. Eleger o painel custa duas seções portadas e a troca do gerador de forma. A conta não é próxima.

A conclusão desagradável é que **o formato bom nunca chegou a produção porque a tela que o produzia não existia para o usuário**. Todo `customization_config` real do banco veio do painel.

### O rastro que isso deixou

O desencontro não ficou contido no editor. Duas correções já nasceram dele, cada uma tratando um sintoma:

- **S0** (`aura-backend#521`, `aura-app#707`) — `validateRequiredFields` passou a tratar `image`/`template` como grupo, porque o painel deixava marcar os dois como obrigatórios e a compra travava na `sheid-mania`, loja publicada.
- **S1** (`aura-app#708`) — `transportarValores` casa campos **por tipo** ao trocar de modelo, com a justificativa literal *"porque os ids não são estáveis entre produtos"*.

Nenhuma das duas era errada. As duas eram defesa contra um dado que o próprio app produzia.

---

## A forma canônica

Três regras. Cada uma existe por um bug que já aconteceu.

### 1. O id vem do tipo, nunca do relógio

O motor visual lê valor por id — `values.text`, e `values.image || values.template` (`compose2d.ts:209`, `compose3dMug.ts:81`). Com `f_1747000000002` não há o que ler: o mockup 3D sai vazio na vitrine **e** no preview do próprio painel, que monta `previewValues` pelo mesmo id.

```
text  text_2  text_3        image  image_back        color_back_2
└─ tipo       └─ 2º+ do mesmo tipo   └─ verso
```

`art_service` e `art_service_brief` têm id fixo, fora da numeração — são contrato com `FieldArtService` e com a validação dos dois lados.

Consequência prática: reordenar, remover ou trocar de lado renumera. É por isso que todo mutator do painel passa por `comIdsCanonicos`.

### 2. Config vazio não é config

`{}` significa sem swatch, sem `price_delta`, sem limite de upload. É a §3.2 da F1: *"o motor está inteiro; falta dado"*. Todo campo nasce com o padrão do tipo (`defaultFieldConfig`) e a lojista edita a partir dali. A normalização preenche só o que falta — escolha da lojista tem precedência sobre padrão, sempre.

**Com uma fronteira, que o dado de produção obrigou a desenhar.** `max_chars`, fontes, formatos aceitos e DPI mínimo são decisão de **apresentação**: preencher sozinho é favor. A paleta de um campo de cor e as choices de um campo de opção são **fato do produto** — quais cores essa caneca tem, quais tamanhos essa camisa tem. Havia uma caneca com um campo "Opções" vazio; dar-lhe P/M/G porque o padrão do tipo diz P/M/G escreveria numa loja publicada uma informação que ninguém deu, e isso vira preço e expectativa errados na vitrine.

Então são duas funções, e a diferença é deliberada: `defaultFieldConfig` (campo novo no editor, com alguém olhando) semeia paleta e choices; `normalizationDefaults` (migração, sem ninguém olhando) não. Campo de cor ou opção sem valor continua vazio — é trabalho de conteúdo com a lojista, o S7 da F1.

### 3. O impossível não é representável

- **Origem da arte é grupo, não campo.** `image` e `template` preenchem o mesmo slot; obrigatoriedade é uma pergunta por lado, não uma por campo. Na UI é um checkbox só, no fim da lista.
- **`art_service` e o briefing nunca são obrigatórios.** Quem contrata a criação não tem arquivo para enviar.
- **Verso desligado rebaixa todo campo para a frente.** `side:'back'` sem `has_back` é 400 no backend (`studio.js`).

---

## O que mudou no código

| Arquivo | O quê |
|---|---|
| `components/studio/customizationConfig.ts` | **Novo.** Ids, padrões por tipo, regras de obrigatoriedade, `normalizeCustomizationConfig`, `isCanonicalConfig` |
| `components/studio/StudioPersonalizacaoPanel.tsx` | Usa o módulo em vez de gerar forma inline; ganhou serviço de arte, guia de medidas, `price_delta` em opção e cor, e o toggle de grupo da origem da arte |
| `app/studio/(estudio)/produtos/[id]/personalizacao.tsx` | Wizard → redirect para `/studio/estoque` |
| `components/studio/storefront/useStorefront.ts` | `ART_SOURCE_TYPES` deixou de ser cópia local e passou a vir do módulo |
| `app/studio/(estudio)/estoque.tsx` | O chip de status lia `cfg.zones`, chave que nenhum editor jamais gravou — todo produto aparecia "Incompleto". Agora lê `fields` e distingue config canônica de config antiga |
| `__tests__/studioCustomizationConfig.test.ts` | **Novo.** 27 casos, incluindo três formas tiradas do banco de produção e a config da Sheid ponta a ponta |
| `scripts/normalizar-customization-config.sql` | **Novo.** Diagnóstico, função de normalização, dry-run, update e verificação |

O par `art_service` + briefing não aparece na lista de campos editáveis: quem o liga é o card *Serviço premium*. Deixar a lojista renomear ou apagar `art_service` solto quebraria `FieldArtService`, que procura o campo por `config.is_art_service`.

### O que a normalização **não** toca

`size_guide` e `qty_multiplier_by_option` atravessam intactos. São chaves de raiz de outros donos, e não é aqui que se decide sobre elas.

---

## Migração de dados

O app normaliza ao abrir e ao salvar, então toda config se cura quando a lojista mexe no produto. Isso não basta: até lá a vitrine renderiza mockup vazio e sem swatch, e é justamente o dado que ninguém abre que fica quebrado por mais tempo.

`scripts/normalizar-customization-config.sql` faz a passagem em lote, em cinco etapas — diagnóstico, função, dry-run, update com backup, verificação.

### O tamanho do problema, medido em produção (19/08/2026)

| | |
|---|---|
| Produtos personalizáveis com `fields` | **29** |
| Com id `f_<timestamp>` | **29** — 100% |
| Com ao menos um `config: {}` | **26** |
| Com origem de arte cumulativa (`image` **e** `template` obrigatórios) | **18** |
| Com `art_service` configurado | **0** |
| Empresas afetadas | **1** — Sheid Mania |

Duas leituras. A boa: o raio é uma loja só, a do piloto, então a migração é de baixo risco. A ruim: **não existe nenhuma config canônica no banco**, e nenhuma lojista jamais precificou criação de arte — o motor do `FieldArtService` está pronto desde junho e nunca teve dado, porque a única tela que o alimentava não era alcançável.

### Verificação do script contra o dado real

A função da §2 foi criada em produção, exercitada em modo leitura sobre as 29 linhas e derrubada em seguida — nenhuma linha de `products` foi escrita. Resultado:

| Invariante | |
|---|---|
| Linhas que mudariam | 29 de 29 |
| Não idempotentes | 0 |
| Ids duplicados dentro de um produto | 0 |
| Id volátil restante | 0 |
| Origem de arte ainda cumulativa | 0 |
| Produtos que perderam campo | 0 |

E os dois lados concordam: `Adesivo Premium` (dois campos de texto) sai `text, image, text_2, color, template` no SQL, exatamente o que o teste de TypeScript afirma; `CAMISA Algodão SUEDINI` (dois campos de imagem) sai `text, image, image_2, color` nos dois. Campo de cor e de opção continuam sem valor nos dois — a fronteira da regra 2.

**Ressalva que fica de pé:** a função SQL é uma segunda implementação das mesmas regras. A referência é o TypeScript; quem trava o comportamento é `__tests__/studioCustomizationConfig.test.ts`. Se as regras mudarem, este arquivo é dado histórico, não fonte.

### Ordem de execução

A migração roda **depois** do deploy deste PR, não antes. Enquanto o painel antigo estiver no ar, salvar um produto reescreve id volátil por cima do dado migrado — normalizar primeiro seria trabalho que a próxima edição desfaz.

---

## O que fica registrado

- **`components/studio/visualEngine/PersonalizacaoLivePreview.tsx` ficou órfão** com o fim do wizard. Não foi apagado neste trabalho; é o único uso que existia dele.
- **A §7 do `F1_CONTEUDO_STUDIO.md` (aura-backend) precisa apontar para cá.** O arquivo não está no `main` daquele repositório — vive nas worktrees da fase —, então a edição não coube nesta mudança.
- **O backend continua aceitando qualquer id.** `validateCustomizationConfig` em `src/routes/studio.js` exige `id` string e nada mais. Fechar a porta lá dentro é a defesa que sobra contra um terceiro editor aparecer; não é urgente enquanto só existir um cliente, mas é o próximo passo natural.
