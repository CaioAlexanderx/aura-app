-- =====================================================================
-- normalizar-customization-config.sql
-- Normaliza `products.customization_config` para a forma canônica.
-- 19/08/2026 — ver docs/studio/PERSONALIZACAO_CANONICA.md
--
-- CONTEXTO
--   Dois editores gravaram esta coluna em formatos diferentes. O que a
--   lojista alcançava gerava ids `f_<timestamp>`, config `{}` e
--   obrigatoriedade cumulativa em campos que são alternativas entre si.
--   O app já normaliza ao abrir e ao salvar; este script é para o dado
--   que ninguém vai abrir tão cedo — e que hoje renderiza mockup vazio
--   e vitrine sem swatch.
--
-- COMO RODAR — nesta ordem, e não pule a §1.
--   §1  diagnóstico (só leitura). Rode e guarde a saída.
--   §2  a função. Criar não altera nenhuma linha.
--   §3  dry-run: quantas linhas mudariam, e como.
--   §4  o UPDATE, com backup e dentro de transação.
--   §5  verificação: idempotência e contagem final.
--
-- AVISO QUE VALE LER
--   A função abaixo é uma SEGUNDA implementação das regras que vivem em
--   components/studio/customizationConfig.ts (aura-app). A referência é
--   o TypeScript, e quem trava o comportamento é
--   __tests__/studioCustomizationConfig.test.ts. Se as regras mudarem,
--   este arquivo é dado histórico, não fonte.
--   Rode a §3 numa cópia da base antes de rodar a §4 em produção.
-- =====================================================================


-- =====================================================================
-- §1 — DIAGNÓSTICO (só leitura)
-- =====================================================================

-- 1.1 — Panorama: quantos produtos personalizáveis existem e quantos
--       carregam cada sintoma. Um produto pode ter os três.
SELECT
  COUNT(*)                                                              AS personalizaveis,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM jsonb_array_elements(p.customization_config->'fields') f
     WHERE f->>'id' LIKE 'f\_%'
  ))                                                                    AS com_id_volatil,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM jsonb_array_elements(p.customization_config->'fields') f
     WHERE f->'config' IS NULL OR f->'config' = '{}'::jsonb
  ))                                                                    AS com_config_vazio,
  COUNT(*) FILTER (WHERE (
    SELECT COUNT(*) FROM jsonb_array_elements(p.customization_config->'fields') f
     WHERE f->>'type' IN ('image','template')
       AND (f->>'required')::boolean IS TRUE
       AND COALESCE(f->>'side','front') = 'front'
  ) > 1)                                                                AS com_arte_cumulativa,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM jsonb_array_elements(p.customization_config->'fields') f
     WHERE f->>'id' = 'art_service'
  ))                                                                    AS com_servico_de_arte
FROM products p
WHERE p.is_personalizable IS TRUE
  AND p.customization_config IS NOT NULL
  AND jsonb_typeof(p.customization_config->'fields') = 'array';

-- 1.2 — Por empresa, para saber quem sente. `com_arte_cumulativa` é o
--       que trava compra em loja publicada: essa lista tem prioridade.
SELECT
  c.id                                  AS company_id,
  c.name                                AS empresa,
  c.slug,
  COUNT(*)                              AS produtos,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM jsonb_array_elements(p.customization_config->'fields') f
     WHERE f->>'id' LIKE 'f\_%'
  ))                                    AS com_id_volatil,
  COUNT(*) FILTER (WHERE (
    SELECT COUNT(*) FROM jsonb_array_elements(p.customization_config->'fields') f
     WHERE f->>'type' IN ('image','template')
       AND (f->>'required')::boolean IS TRUE
       AND COALESCE(f->>'side','front') = 'front'
  ) > 1)                                AS com_arte_cumulativa
FROM products p
JOIN companies c ON c.id = p.company_id
WHERE p.is_personalizable IS TRUE
  AND p.customization_config IS NOT NULL
  AND jsonb_typeof(p.customization_config->'fields') = 'array'
GROUP BY c.id, c.name, c.slug
ORDER BY com_arte_cumulativa DESC, com_id_volatil DESC, produtos DESC;

-- 1.3 — Amostra crua, para conferir a olho antes de escrever qualquer
--       coisa. Trocar o slug pelo da loja que for investigar.
SELECT p.id, p.name, jsonb_pretty(p.customization_config)
FROM products p
JOIN companies c ON c.id = p.company_id
WHERE c.slug = 'sheid-mania'
  AND p.is_personalizable IS TRUE
ORDER BY p.name
LIMIT 5;


-- =====================================================================
-- §2 — A FUNÇÃO (criar não altera linha nenhuma)
-- =====================================================================

CREATE OR REPLACE FUNCTION studio_normalize_customization_config(cfg jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  tipos_validos  text[] := ARRAY['text','image','template','color','option'];
  posicoes       text[] := ARRAY['center','left','right'];
  has_back       boolean;
  f              jsonb;
  campos         jsonb := '[]'::jsonb;
  novo           jsonb;
  cfg_campo      jsonb;
  padrao         jsonb;
  tipo           text;
  lado           text;
  id_orig        text;
  id_novo        text;
  chave          text;
  ordinal        int;
  contadores     jsonb := '{}'::jsonb;
  grupo          jsonb := jsonb_build_object('front', false, 'back', false);
  eh_fixo        boolean;
  obrigatorio    boolean;
  saida          jsonb;
  pa             jsonb;
  num            numeric;
BEGIN
  IF cfg IS NULL OR jsonb_typeof(cfg) <> 'object' THEN
    cfg := '{}'::jsonb;
  END IF;
  has_back := (cfg->>'has_back') = 'true';

  -- ── Passo 1: a obrigatoriedade da origem da arte é do GRUPO ────────
  -- `image` e `template` preenchem o mesmo slot. Se a lojista marcou
  -- qualquer um, o lado inteiro fica marcado — que é como a validação
  -- da vitrine já lê o dado desde o S0. O que muda é o config parar de
  -- afirmar uma condição cumulativa que ninguém satisfaz.
  IF jsonb_typeof(cfg->'fields') = 'array' THEN
    FOR f IN SELECT value FROM jsonb_array_elements(cfg->'fields')
    LOOP
      IF f->>'type' IN ('image','template')
         AND (f->>'required') = 'true'
         AND f->>'id' NOT IN ('art_service','art_service_brief')
      THEN
        lado := CASE WHEN f->>'side' = 'back' AND has_back THEN 'back' ELSE 'front' END;
        grupo := jsonb_set(grupo, ARRAY[lado], 'true'::jsonb);
      END IF;
    END LOOP;
  END IF;

  -- ── Passo 2: um campo de cada vez, na ordem original ───────────────
  IF jsonb_typeof(cfg->'fields') = 'array' THEN
    FOR f IN SELECT value FROM jsonb_array_elements(cfg->'fields') WITH ORDINALITY AS t(value, ord) ORDER BY t.ord
    LOOP
      tipo := f->>'type';
      CONTINUE WHEN NOT (tipo = ANY(tipos_validos));

      id_orig := COALESCE(NULLIF(btrim(COALESCE(f->>'id','')), ''), '_sem_id');
      lado    := CASE WHEN f->>'side' = 'back' AND has_back THEN 'back' ELSE 'front' END;
      eh_fixo := id_orig IN ('art_service','art_service_brief')
                 OR (f->'config'->>'is_art_service') = 'true';

      -- ── id: derivado do tipo e da ordem, nunca do relógio ──────────
      -- O motor visual (compose2d.ts, compose3dMug.ts) lê
      -- `values.text` e `values.image || values.template` por id.
      IF eh_fixo THEN
        id_novo := CASE WHEN id_orig = 'art_service_brief'
                        THEN 'art_service_brief' ELSE 'art_service' END;
      ELSE
        chave   := tipo || '|' || lado;
        ordinal := COALESCE((contadores->>chave)::int, 0);
        contadores := jsonb_set(contadores, ARRAY[chave], to_jsonb(ordinal + 1));
        id_novo := CASE WHEN lado = 'back' THEN tipo || '_back' ELSE tipo END;
        IF ordinal > 0 THEN
          id_novo := id_novo || '_' || (ordinal + 1)::text;
        END IF;
      END IF;

      -- ── config: o padrão do tipo preenche só o que falta ───────────
      cfg_campo := CASE WHEN jsonb_typeof(f->'config') = 'object'
                        THEN f->'config' ELSE '{}'::jsonb END;

      IF eh_fixo AND id_novo = 'art_service' THEN
        cfg_campo := cfg_campo || '{"is_art_service": true}'::jsonb;
        IF jsonb_typeof(cfg_campo->'choices') <> 'array'
           OR jsonb_array_length(cfg_campo->'choices') = 0 THEN
          cfg_campo := jsonb_set(cfg_campo, '{choices}', jsonb_build_array(
            jsonb_build_object('value','none',    'label','Vou enviar minha arte pronta',     'price_delta', 0),
            jsonb_build_object('value','adjust',  'label','Envio minha arte e vocês ajustam', 'price_delta', 0),
            jsonb_build_object('value','designer','label','Criem a arte pra mim',             'price_delta', 0)
          ));
        END IF;
      ELSIF eh_fixo THEN
        IF cfg_campo->'max_chars' IS NULL THEN
          cfg_campo := jsonb_set(cfg_campo, '{max_chars}', '600'::jsonb);
        END IF;
      ELSE
        padrao := CASE tipo
          WHEN 'text' THEN jsonb_build_object(
            'max_chars', 20,
            'fonts',  '["Pacifico","Caveat","Playfair Display","Bebas Neue","Inter"]'::jsonb,
            'colors', '["#0F172A","#BE185D","#7C3AED","#1D4ED8","#D97706","#059669","#EC4899","#FFFFFF"]'::jsonb)
          WHEN 'image' THEN jsonb_build_object(
            'formats', '["png","jpg","jpeg","pdf"]'::jsonb,
            'max_mb',  10,
            'min_dpi', 150)
          WHEN 'template' THEN jsonb_build_object('category_ids', '[]'::jsonb)
          -- 'color' e 'option' NÃO ganham padrão aqui, de propósito.
          -- Paleta e choices são fato do produto (quais cores essa
          -- caneca tem, quais tamanhos essa camisa tem), não decisão de
          -- apresentação. Inventar P/M/G numa caneca porque o campo
          -- estava vazio escreveria numa loja publicada uma informação
          -- que ninguém deu. Fica vazio: é trabalho de conteúdo com a
          -- lojista (S7 da F1). Espelha `normalizationDefaults` no TS.
          ELSE '{}'::jsonb
        END;
        -- Só preenche o que está ausente ou vazio: escolha da lojista
        -- tem precedência sobre padrão, sempre.
        SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb) INTO novo
          FROM jsonb_each(padrao) AS d(k, v)
         WHERE cfg_campo->k IS NULL
            OR cfg_campo->k = 'null'::jsonb
            OR (jsonb_typeof(cfg_campo->k) = 'array' AND jsonb_array_length(cfg_campo->k) = 0);
        cfg_campo := cfg_campo || novo;
      END IF;

      -- ── required ──────────────────────────────────────────────────
      IF eh_fixo THEN
        obrigatorio := false;                       -- quem contrata a arte não tem o que enviar
      ELSIF tipo IN ('image','template') THEN
        obrigatorio := (grupo->>lado) = 'true';     -- do grupo, não do campo
      ELSE
        obrigatorio := (f->>'required') = 'true';
      END IF;

      novo := jsonb_build_object(
        'id',       id_novo,
        'type',     tipo,
        'label',    COALESCE(NULLIF(btrim(COALESCE(f->>'label','')), ''), initcap(tipo)),
        'required', obrigatorio,
        'config',   cfg_campo,
        'side',     lado
      );
      campos := campos || jsonb_build_array(novo);
    END LOOP;
  END IF;

  -- ── print_area ───────────────────────────────────────────────────
  saida := cfg || jsonb_build_object('fields', campos);

  pa  := CASE WHEN jsonb_typeof(cfg->'print_area') = 'object' THEN cfg->'print_area' ELSE '{}'::jsonb END;
  num := CASE WHEN jsonb_typeof(pa->'width_cm')  = 'number' AND (pa->>'width_cm')::numeric  > 0
              THEN (pa->>'width_cm')::numeric  ELSE 10 END;
  pa  := jsonb_set(pa, '{width_cm}', to_jsonb(num));
  num := CASE WHEN jsonb_typeof(pa->'height_cm') = 'number' AND (pa->>'height_cm')::numeric > 0
              THEN (pa->>'height_cm')::numeric ELSE 10 END;
  pa  := jsonb_set(pa, '{height_cm}', to_jsonb(num));
  pa  := jsonb_set(pa, '{position}', to_jsonb(
           CASE WHEN pa->>'position' = ANY(posicoes) THEN pa->>'position' ELSE 'center' END));
  saida := jsonb_set(saida, '{print_area}', pa);

  -- ── verso ────────────────────────────────────────────────────────
  IF has_back THEN
    pa  := CASE WHEN jsonb_typeof(cfg->'back_print_area') = 'object'
                THEN cfg->'back_print_area' ELSE '{}'::jsonb END;
    num := CASE WHEN jsonb_typeof(pa->'width_cm')  = 'number' AND (pa->>'width_cm')::numeric  > 0
                THEN (pa->>'width_cm')::numeric  ELSE 10 END;
    pa  := jsonb_set(pa, '{width_cm}', to_jsonb(num));
    num := CASE WHEN jsonb_typeof(pa->'height_cm') = 'number' AND (pa->>'height_cm')::numeric > 0
                THEN (pa->>'height_cm')::numeric ELSE 10 END;
    pa  := jsonb_set(pa, '{height_cm}', to_jsonb(num));
    pa  := jsonb_set(pa, '{position}', to_jsonb(
             CASE WHEN pa->>'position' = ANY(posicoes) THEN pa->>'position' ELSE 'center' END));
    saida := jsonb_set(saida, '{has_back}', 'true'::jsonb);
    saida := jsonb_set(saida, '{back_print_area}', pa);

    IF (cfg->>'back_charge_enabled') = 'true' THEN
      num := CASE WHEN jsonb_typeof(cfg->'back_price_delta') = 'number'
                   AND (cfg->>'back_price_delta')::numeric >= 0
                  THEN (cfg->>'back_price_delta')::numeric ELSE 0 END;
      saida := jsonb_set(saida, '{back_charge_enabled}', 'true'::jsonb);
      saida := jsonb_set(saida, '{back_price_delta}', to_jsonb(num));
    ELSE
      saida := saida - 'back_charge_enabled' - 'back_price_delta';
    END IF;
  ELSE
    saida := saida - 'has_back' - 'back_print_area'
                   - 'back_charge_enabled' - 'back_price_delta';
  END IF;

  RETURN saida;
END;
$fn$;


-- =====================================================================
-- §3 — DRY-RUN (só leitura). Rodar numa cópia da base primeiro.
-- =====================================================================

-- 3.1 — Quantas linhas mudariam.
SELECT
  COUNT(*)                                                    AS avaliados,
  COUNT(*) FILTER (
    WHERE customization_config
       IS DISTINCT FROM studio_normalize_customization_config(customization_config)
  )                                                           AS mudariam
FROM products
WHERE is_personalizable IS TRUE
  AND customization_config IS NOT NULL;

-- 3.2 — Antes e depois, lado a lado, para conferir a olho.
SELECT
  p.id,
  p.name,
  jsonb_pretty(p.customization_config)                                     AS antes,
  jsonb_pretty(studio_normalize_customization_config(p.customization_config)) AS depois
FROM products p
WHERE p.is_personalizable IS TRUE
  AND p.customization_config
   IS DISTINCT FROM studio_normalize_customization_config(p.customization_config)
ORDER BY p.updated_at DESC
LIMIT 3;

-- 3.3 — Idempotência: normalizar duas vezes tem de dar o mesmo. Se esta
--       consulta devolver qualquer linha, NÃO rode a §4.
SELECT p.id, p.name
FROM products p
WHERE p.is_personalizable IS TRUE
  AND p.customization_config IS NOT NULL
  AND studio_normalize_customization_config(p.customization_config)
   IS DISTINCT FROM studio_normalize_customization_config(
        studio_normalize_customization_config(p.customization_config));

-- 3.4 — Nenhum id pode ficar duplicado dentro do mesmo produto: id é
--       chave dos valores do cliente. Também tem de vir vazio.
SELECT p.id, p.name, f->>'id' AS id_repetido, COUNT(*)
FROM products p,
     jsonb_array_elements(studio_normalize_customization_config(p.customization_config)->'fields') f
WHERE p.is_personalizable IS TRUE
  AND p.customization_config IS NOT NULL
GROUP BY p.id, p.name, f->>'id'
HAVING COUNT(*) > 1;


-- =====================================================================
-- §4 — O UPDATE. Backup primeiro, transação sempre.
-- =====================================================================

-- 4.1 — Backup das linhas que serão tocadas. Guardar até a vitrine do
--       piloto ser conferida a olho; depois, dropar.
CREATE TABLE IF NOT EXISTS products_customization_config_bkp_20260819 AS
SELECT id, company_id, customization_config, NOW() AS backed_up_at
FROM products
WHERE is_personalizable IS TRUE
  AND customization_config
   IS DISTINCT FROM studio_normalize_customization_config(customization_config);

-- 4.2 — A escrita.
BEGIN;

UPDATE products p
   SET customization_config = studio_normalize_customization_config(p.customization_config),
       updated_at = NOW()
 WHERE p.is_personalizable IS TRUE
   AND p.customization_config
    IS DISTINCT FROM studio_normalize_customization_config(p.customization_config);

-- Confira o número contra o que a §3.1 disse antes de commitar.
-- ROLLBACK;  -- se divergir
COMMIT;


-- =====================================================================
-- §5 — VERIFICAÇÃO (depois do commit)
-- =====================================================================

-- 5.1 — Nada mais a normalizar.
SELECT COUNT(*) AS ainda_fora_do_padrao
FROM products
WHERE is_personalizable IS TRUE
  AND customization_config
   IS DISTINCT FROM studio_normalize_customization_config(customization_config);

-- 5.2 — Nenhum id volátil sobrando.
SELECT COUNT(*) AS produtos_com_id_volatil
FROM products p
WHERE p.is_personalizable IS TRUE
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(p.customization_config->'fields') f
     WHERE f->>'id' LIKE 'f\_%'
  );

-- 5.3 — Nenhum produto com origem de arte cumulativa.
SELECT COUNT(*) AS produtos_com_arte_cumulativa
FROM products p
WHERE p.is_personalizable IS TRUE
  AND (
    SELECT COUNT(DISTINCT f->>'required')
    FROM jsonb_array_elements(p.customization_config->'fields') f
    WHERE f->>'type' IN ('image','template')
      AND COALESCE(f->>'side','front') = 'front'
  ) > 1;

-- Para reverter tudo:
-- UPDATE products p SET customization_config = b.customization_config
--   FROM products_customization_config_bkp_20260819 b WHERE b.id = p.id;
