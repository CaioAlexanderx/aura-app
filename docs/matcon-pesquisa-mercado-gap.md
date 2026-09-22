# Materiais de Construção na Aura — Pesquisa de mercado e análise de gaps

**Data:** 22/09/2026
**Escopo:** o que falta na Aura hoje para atender lojas de material de construção ("matcon")
**Método:** leitura do código atual (estoque, PDV, NF-e, crediário, verticais) + pesquisa de mercado (Anamaco, fornecedores de ERP do setor, práticas operacionais do varejo matcon)

---

## 1. TL;DR — o veredito antes do café esfriar

O mercado é grande e é **exatamente o perfil de cliente da Aura**: 160.627 lojas, R$ 238,9 bi/ano, e **69,5% delas têm até 4 funcionários**. Não é um nicho, é praticamente "o varejo brasileiro de tijolo".

Mas tem um detalhe desconfortável: **a Aura hoje não consegue vender meio metro quadrado de piso.** Literalmente. O estoque é inteiro (`parseInt`), a quantidade no carrinho só aceita dígitos e trava em 999, e a lista de unidades de venda não tem `m`, `m²`, `m³`, `sc` (saco), `br` (barra) nem `ton`. Um depósito que vende 1.200 tijolos ou 12,5 m² de porcelanato não consegue nem registrar a venda.

Ou seja: **o gap número 1 não é uma tela nova de matcon. É um refactor no coração do produto** (estoque fracionado + unidade de medida + fator de conversão). E a boa notícia é que esse refactor **paga para todas as verticais** — Food vende kg, Studio vende metro de tecido, Ótica vende par.

**Minha recomendação (e aqui eu desafio o pedido):** não vá atrás de "atender matcon na totalidade". Veja a seção 7 — "totalidade" significa competir com CISS/GestãoFlex em home center (romaneio, MDF-e, multi-depósito, WMS, força de vendas externa), e isso é um programa de 12+ meses. O dinheiro está no **depósito de bairro com 4 funcionários**, e ele precisa de ~8 coisas, não de 40.

---

## 2. O mercado (números que sustentam a decisão)

| Indicador | Valor | Fonte |
|---|---|---|
| Lojas de material de construção no Brasil | **160.627** | Instituto Anamaco, 2026 |
| Faturamento do varejo matcon | **R$ 238,9 bi** (2025), +2,4% nominal | Anamaco |
| Representatividade no PIB | ~1,88% | Anamaco |
| Lojas com **até 4 funcionários** | **69,5%** (~111.570 lojas) | Anamaco |
| Desempenho 1º sem/2026 | 51% estáveis, 29% pior, 20% melhor | Anamaco |

**Leitura estratégica:**

1. **O ICP da Aura é a maioria do setor.** 111 mil lojas familiares, de bairro, com dono no balcão. Esse público não compra CISS (ERP de home center) nem aguenta implantação de 3 meses. Ele está em planilha, caderno ou num sistema legado de desktop.
2. **Mercado estável, não em boom.** Com 51% das lojas com faturamento parado, o discurso de venda não é "cresça 30%" — é **"pare de perder dinheiro"**: ruptura de estoque, margem errada por ST mal cadastrada, crediário sem controle, entrega esquecida.
3. **É um setor com associativismo forte** (redes/Anamaco). Isso significa canal de distribuição: uma rede regional pode trazer 40 lojas de uma vez. Vale mapear.

---

## 3. Como uma loja de material de construção realmente funciona

Antes dos gaps, o fluxo real — porque é aqui que o software genérico quebra:

```
Cliente chega → ORÇAMENTO (leva pra comparar em 3 lojas, volta em 2 dias)
   ↓ (se voltar)
PEDIDO (não é cupom fiscal ainda — é um pedido com itens reservados)
   ↓
PAGAMENTO (à vista / crediário da loja / faturado p/ construtora)
   ↓
SEPARAÇÃO no pátio/depósito (romaneio, conferência item a item)
   ↓
ENTREGA (caminhão próprio, muitas vezes PARCIAL — "leva o cimento hoje, o piso semana que vem")
   ↓
SALDO A ENTREGAR fica em aberto por semanas
```

Características que quebram um PDV de varejo comum:

- **Unidade de venda ≠ unidade de compra.** Compra porcelanato em caixa (2,32 m²), vende em m², mas só pode entregar caixa fechada. Compra cimento em palete, vende em saco.
- **Quantidade fracionada e alta.** 12,5 m² de piso, 3,5 m³ de areia, 1.200 tijolos, 0,75 kg de prego.
- **Tonalidade e bitola** (cerâmica/porcelanato): caixas do mesmo produto em lotes diferentes têm variação de cor (V1 a V4) e de dimensão. Vender lotes misturados para o mesmo ambiente = troca, frete de volta e cliente furioso. É o "controle de lote" do setor.
- **ICMS-ST em quase tudo.** Cimento, tintas, vernizes, ferragens, revestimentos — o enquadramento depende do NCM e muda por estado. NCM errado em item de giro alto vira prejuízo silencioso na margem.
- **O profissional (pedreiro/arquiteto) é o verdadeiro comprador.** Ele decide a marca e leva o cliente. Por isso todo grande do setor (Leroy Merlin, Ferreira Costa, Maiolini) tem "Clube do Profissional" com pontos/cashback/indicação.
- **Crediário é vida.** Obra é parcelada por natureza; a loja de bairro financia o pedreiro.
- **Devolução de sobra de obra** é rotina — material que volta e precisa reentrar no estoque.

---

## 4. O que a Aura JÁ tem e serve para matcon (inventário honesto)

Boa notícia primeiro: a base é mais forte do que parece.

| Já existe | Onde | Serve para matcon? |
|---|---|---|
| PDV / Caixa | `app/(tabs)/pdv.tsx` | ✅ base do balcão |
| **Crediário completo** (limite de crédito, juros, mora, cobrança, score) | `services/creditApi.ts` | ✅✅ **diferencial forte** — crediário é o oxigênio do setor |
| NFC-e + NF-e B2B + NFS-e (Nuvem Fiscal) | `app/(tabs)/nfe.tsx`, `services/nfceApi.ts` | ✅ base fiscal existe |
| **Importação de XML da nota do fornecedor** | `services/danfeApi.ts` | ✅✅ mata 80% da dor de cadastro de produto |
| Ordem de Serviço | `/os` (módulo próprio) | ✅ vira corte de vidro/madeira, instalação, frete cobrado |
| Cupons / promoções | `/cupons` | ✅ base para clube do profissional |
| Clientes + CRM + Reativação por WhatsApp | `/clientes`, `/clientes/reativacao` | ✅✅ pós-obra é ouro ("faz 6 meses, e o acabamento?") |
| Curva ABC + estoque mínimo + alertas de reposição | `components/screens/estoque/AbcSummary.tsx`, `AlertsList.tsx` | ✅ 5 mil SKUs pedem isso |
| Multi-CNPJ consolidado | `/empresas` | ✅ rede de 2–3 lojas |
| Comissões e metas de vendedor | `components/screens/folha/TabComissoes.tsx` | ✅ balcão trabalha por comissão |
| Entrega/despacho/entregadores | `app/food/(salao)/despacho.tsx`, `motoboys.tsx` | ⚠️ existe, **mas só no Food** — dá pra reaproveitar |
| Orçamento impresso | `components/screens/pdv/buildQuoteHtml.ts` | ⚠️ só gera HTML pra imprimir; **não salva, não vira pedido, não reserva estoque** |
| Padrão de semi-vertical por toggle | Ótica (`otica_enabled` + chaves `otica.*`) | ✅✅ **é o molde exato pra matcon** |

---

## 5. Os GAPS — o que falta, em ordem de dor

### 🔴 P0 — Bloqueadores absolutos (sem isso a loja não opera um dia)

**5.1. Estoque e venda fracionada**
Hoje o estoque é inteiro em todo o caminho:
- `hooks/useProducts.ts:29-31` → `parseInt(p.stock_qty)`
- `components/screens/estoque/ProductTableWeb.tsx:163` → `fmtInt(p.stock)`
- `components/screens/pdv/CartPanel.tsx:670` → `parseInt(inputVal, 10)`
- `components/screens/pdv/CartPanel.tsx:805` → `v.replace(/\D/g, "")` (apaga a vírgula que o cliente digitar)
- `components/screens/pdv/CartPanel.tsx:810` → `maxLength={3}` → **teto de 999 unidades**

Tradução para português de gente: hoje é impossível vender **12,5 m²** de piso e impossível vender **1.200 tijolos**. São duas vendas trivialíssimas de matcon.

**5.2. Unidades de medida do setor**
`components/screens/estoque/types.ts:36`:
```ts
export const UNITS = ["un", "pct", "cx", "kg", "g", "ml", "L", "par", "kit"];
```
Faltam: `m`, `m²`, `m³`, `sc` (saco), `br` (barra), `ton`, `rolo`, `lata`, `balde`, `mlh` (milheiro), `vara`, `pç`. Sem isso o cadastro já nasce errado — e o `unit` vai para a NF-e.

**5.3. Fator de conversão compra ↔ venda**
Não existe nada no modelo de produto. É o conceito central do setor: *compro em caixa, vendo em m², controlo em caixa*. Sem isso:
- a importação de XML do fornecedor entra quantidade errada no estoque;
- o custo unitário sai errado → margem errada;
- não dá para arredondar para caixa fechada na venda.

**5.4. Orçamento que vira pedido**
Hoje o orçamento é um HTML de impressão sem estado (`buildQuoteHtml.ts`). Falta: salvar, numerar, validade real, status (aberto/aprovado/perdido), reserva de estoque, conversão em pedido, e reenvio por WhatsApp. **No matcon, o orçamento É o funil de vendas** — quem não mede orçamento perdido não sabe por que não vende.

**5.5. Pedido ≠ venda: separação, entrega e saldo a entregar**
Não existe no varejo. Faltam: status do pedido (separando/pronto/entregue), romaneio de separação, entrega parcial, e **saldo a entregar** (cliente pagou tudo, levou metade). Hoje, se você fatura a venda inteira, o estoque baixa e ninguém sabe o que ainda está no pátio.
*Atenuante:* o Food já tem `despacho.tsx` e `motoboys.tsx` — há o que reaproveitar.

**5.6. Fiscal: ICMS-ST, CEST e dados de transporte**
`services/nfceApi.ts:16-28` — o item da nota tem `ncm`, `cfop`, `unit`, e **só**. Faltam `cest`, base/valor de ST, FCP, e o bloco de transporte (peso bruto/líquido, volumes, transportadora) que é obrigatório na prática para NF-e com entrega. Como cimento, tintas e ferragens são ST em praticamente todo estado, **esse gap sozinho impede emitir nota certa em matcon**.

### 🟠 P1 — Diferenciais competitivos (é aqui que a Aura ganha, não empata)

**5.7. Clube do Profissional** — cadastro de pedreiro/arquiteto vinculado ao cliente final, pontos/cashback por compra indicada, extrato e resgate via WhatsApp. A Aura já tem cupons + clientes + WhatsApp + reativação: **é a peça que mais se encaixa no que já existe e a que mais diferencia**. Leroy, Ferreira Costa e as redes regionais fazem isso; o depósito de bairro não tem ferramenta nenhuma.

**5.8. Calculadora de ambiente no PDV** — "sala 3,5 × 4,2 m + 10% de perda = 16,17 m² = 7 caixas". Vende mais (o vendedor arredonda pra cima com justificativa), reduz troca, e encanta. Barato de fazer **depois** do 5.1–5.3.

**5.9. Controle de tonalidade/bitola (lote)** — reservar e entregar caixas do mesmo lote. Evita a troca mais cara do setor. Pode ser uma versão simples: campo de lote por entrada + alerta de "lote misturado" na venda.

**5.10. Tabela de preços por perfil** — balcão / profissional / construtora / atacado, com desconto por faixa de quantidade. Hoje não existe nada de `price_table`/atacado no código. Matcon vive de "quanto leva?".

**5.11. Compras de verdade** — hoje só existe importar XML depois da compra. Falta: sugestão de compra a partir do giro/estoque mínimo, pedido de compra, cotação com 2–3 fornecedores, rateio de frete no custo e custo médio. Em loja de 5 mil SKUs, comprar errado é a maior sangria.

**5.12. Devolução e sobra de obra** — devolução parcial com retorno ao estoque e nota de devolução.

### 🟡 P2 — Completam o quadro (só depois de vender e validar)

- Múltiplos depósitos/locais (loja, pátio, galpão) — hoje não existe nenhum conceito de `warehouse`.
- Locação de equipamentos (betoneira, andaime, martelete) — nicho adjacente, público dos Casa do Construtor da vida; virar isso em add-on da OS é plausível.
- Kits/composições (kit churrasqueira, kit hidráulico) — as variantes atuais são cor/tamanho, não composição.
- Inventário cíclico com coletor/leitor; etiquetas de gôndola.
- Vendedor externo/televendas com aprovação de desconto por alçada.
- Vínculo de vendas a uma "obra" do cliente (histórico por obra).
- MDF-e para frota própria (só faz sentido em loja maior).

---

## 6. Concorrência e onde a Aura se encaixa

| Camada | Quem está lá | Preço típico | Fraqueza que abre espaço |
|---|---|---|---|
| **ERP de home center** | CISS, GestãoFlex, Soften, Lundi, CIGAM, Trido | alto, implantação longa | pesado, caro, desktop-first, não serve loja de 4 pessoas |
| **ERP SMB genérico** | Bling, Tiny, Omie, GestãoClick | R$ 55–299/mês | **genéricos**: não têm m²/conversão de unidade nativa boa, não têm clube do profissional, crediário fraco, zero WhatsApp de verdade |
| **Planilha / caderno / legado** | a maioria das 111 mil lojinhas | R$ 0 | é o concorrente real |

**Posicionamento que eu defenderia:** *"o sistema do depósito de bairro — vende por m², controla o crediário do pedreiro e fala por WhatsApp"*. Não é "ERP completo de matcon". É a combinação **crediário nativo + WhatsApp + PDV simples + unidade de medida certa**, que é precisamente onde Bling/Tiny são fracos e CISS é caro demais.

---

## 7. Onde eu discordo do pedido (e por quê)

Você pediu "atender materiais de construção **na totalidade**". Eu acho que "totalidade" é a armadilha, por três razões:

1. **"Totalidade" = escopo de home center.** Romaneio de carga, MDF-e, multi-depósito, WMS, força de vendas externa, bloco fiscal completo. É 12+ meses de time. E entrega valor para as ~5% de lojas grandes, que já são clientes de CISS e não trocam.
2. **O gargalo real não é matcon, é a fundação.** Estoque fracionado + unidade de medida + conversão é um refactor transversal que toca estoque, variantes, PDV, NF-e e relatórios. Se fizer isso bem, **as outras verticais ganham junto** (Food em kg, Studio em metro). Se fizer só as telas de matcon por cima do estoque inteiro, você cria dívida técnica em cima de dívida técnica.
3. **Mercado estável pede prova, não aposta.** Com 51% das lojas com faturamento parado, o jeito certo é: fundação + 3 features matadoras, colocar em 5 lojas piloto, e deixar as 5 lojas dizerem o que falta. Elas vão pedir coisas que nenhum blog de ERP lista.

**O que eu faria no lugar de "totalidade":**

| Fase | O que entra | Por quê |
|---|---|---|
| **F0 — Fundação (transversal)** | estoque decimal ponta a ponta; `UNITS` do setor; fator de conversão compra↔venda; quantidade fracionada no PDV (tirar `replace(/\D/g,"")` e `maxLength=3`) | sem isso, nada funciona — e serve todas as verticais |
| **F1 — Fiscal matcon** | CEST + ICMS-ST + FCP no item; bloco de transporte (peso, volumes, transportadora) na NF-e | sem isso a loja emite nota errada e você vira problema fiscal dela |
| **F2 — Ciclo de venda** | orçamento persistido → pedido → separação → entrega (com parcial e saldo a entregar), reaproveitando o despacho do Food | é o fluxo que o setor usa todo dia |
| **F3 — Diferenciação** | Clube do Profissional + calculadora de ambiente + tabela de preço por perfil | é o que faz a loja escolher Aura e não Bling |
| **F4 — Profundidade** | lote/tonalidade, compras (sugestão/pedido/cotação), devolução, multi-depósito | só depois de 5 pilotos pedindo |

**Formato técnico:** seguir o **padrão Ótica** — semi-vertical sobre o shell de varejo, com toggle `matcon_enabled` em `pdv_settings` e chaves próprias (`matcon.orcamento`, `matcon.entrega`, `matcon.profissional`, `matcon.config`) em `MODULE_PLAN_MAP` e `PERM_TO_MODULES`. Nada de shell dedicado como o Food/Dental: matcon **é** varejo, com temperos. Isso economiza meses.

E, pela regra 4 do CLAUDE.md: qualquer tela nova aqui (orçamento, entrega, clube) pede **mockup HTML antes do código**.

---

## 8. Resumo em uma tabela: o que falta

| # | Gap | Severidade | Existe hoje? |
|---|---|---|---|
| 1 | Estoque/venda fracionada (decimal) | 🔴 bloqueador | ❌ inteiro em todo o caminho |
| 2 | Unidades do setor (m, m², m³, sc, br, ton…) | 🔴 bloqueador | ❌ 9 unidades genéricas |
| 3 | Fator de conversão compra↔venda | 🔴 bloqueador | ❌ inexistente |
| 4 | Teto de 999 na quantidade do PDV | 🔴 bloqueador | ❌ `maxLength={3}` |
| 5 | ICMS-ST / CEST / FCP na nota | 🔴 bloqueador | ❌ item só tem NCM/CFOP |
| 6 | Transporte na NF-e (peso, volumes, transportadora) | 🔴 bloqueador | ❌ |
| 7 | Orçamento persistido que vira pedido | 🔴 crítico | ⚠️ só HTML de impressão |
| 8 | Separação, entrega e saldo a entregar | 🔴 crítico | ⚠️ só no Food |
| 9 | Clube do Profissional (pedreiro/arquiteto) | 🟠 diferencial | ❌ |
| 10 | Calculadora de ambiente (m² → caixas + perda) | 🟠 diferencial | ❌ |
| 11 | Tabela de preços por perfil / faixa de quantidade | 🟠 diferencial | ❌ |
| 12 | Lote / tonalidade / bitola | 🟠 diferencial | ❌ |
| 13 | Compras (sugestão, pedido, cotação, rateio de frete) | 🟠 importante | ⚠️ só import de XML |
| 14 | Devolução parcial / sobra de obra | 🟠 importante | ❌ |
| 15 | Multi-depósito / local de estoque | 🟡 depois | ❌ |
| 16 | Kits e composições | 🟡 depois | ❌ (variantes são cor/tamanho) |
| 17 | Locação de equipamentos | 🟡 add-on | ❌ |
| 18 | Inventário cíclico com coletor | 🟡 depois | ❌ |

---

## Fontes

- [Varejo da construção alcança marca de 158 mil lojas — ANAMACO](https://anamaco.com.br/post/varejo-da-construcao-alcanca-marca-de-158-mil-lojas-e-ganha-forca-com-associativismo-do-sistema-anamaco/)
- [Estudo Anamaco revela cenário do varejo de material de construção no Brasil](https://anamaco.com.br/post/estudo-cenario-varejo-material-construcao-brasil/)
- [A dimensão do varejo de material de construção e o papel dos pequenos negócios — ANAMACO](https://anamaco.com.br/post/dimensao-varejo-material-construcao-pequenos-negocios-2025-anamaco/)
- [Varejo de material de construção no 1º semestre de 2026 — ANAMACO](https://anamaco.com.br/post/varejo-material-construcao-primeiro-semestre-2026/)
- [Home center: o que é e como gerenciar — TOTVS](https://www.totvs.com/blog/gestao-varejista/home-center/)
- [Sistema completo para Loja de Material de Construção — CISS](https://ciss.com.br/segmentos/sistema-material-de-construcao)
- [Sistema para loja de material de construção — GestãoClick](https://gestaoclick.com.br/programa-para-loja-de-material-de-construcao/)
- [Controle de entregas em loja de material de construção — CB Sistemas](https://www.cbsistemas.com.br/controle-de-entregas-em-loja-de-material-de-construcao/)
- [Compro o produto por uma unidade de medida e consumo por outra — Nomus](https://www.nomus.com.br/blog-industrial/compro-o-produto-por-uma-unidade-de-medida-e-consumo-por-outra/)
- [Lote de revestimento: o que pode vir diferente? — Biancogres](https://www.biancogres.com.br/pt_BR/blog/lote-de-revestimento-o-que-pode-vir-diferente)
- [Piso de cerâmica: tonalidade e bitola — FazFácil](https://www.fazfacil.com.br/reforma-construcao/ceramica-tonalidade-bitola/)
- [Tabela NCM na construção civil — Mais Controle](https://maiscontroleerp.com.br/tabela-ncm-na-construcao-civil/)
- [Substituição Tributária — material de construção (SEFAZ/PB)](https://www.sefaz.pb.gov.br/legislacao/99-regulamentos/anexos-icms/8983-produtos-substituicao-tributaria-17)
- [Programa Leroy Merlin Com Você (profissionais)](https://blog.leroymerlin.com.br/desconto-leroy-merlin-profissionais/)
- [Clube do Profissional — Maiolini](https://maiolini.com.br/clube-profissional)
- [ERP 2026: Conta Azul vs Omie vs Bling vs Tiny](https://dinheirodaminhaempresa.com/comparativos/erp-conta-azul-omie-bling-tiny-2026/)
