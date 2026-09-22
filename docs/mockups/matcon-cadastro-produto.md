# Cadastro de produto por perfil (Matcon primeiro) — nota do mockup
Mockup: `docs/mockups/matcon-cadastro-produto.html` (A padrão × B Matcon, celular 390px, lote × cor e medida, mecânica). Backend não muda: tudo grava em colunas que já existem (unit, purchase_*, weight_kg, ncm, cest, icms_st_paid, origem, brand, material, medidas, cuidados, product_lots do M4, variações).

**Decisões propostas**
- Um modal, um **perfil de cadastro** por subvertical: `perfilDoCadastro(pdv_settings)` devolve `PERFIL_PADRAO` (o mesmo objeto, testado com `toBe`) ou `PERFIL_MATCON`. As seções recebem `perfil?` opcional. A Ótica usaria o mesmo mecanismo depois.
- Matcon: unidade vira "Vendo por" **antes do preço** (un + `matcon_units`; o resto em "outras"). Preço e custo ficam "por m²".
- "Como chega do fornecedor" sempre visível; "Compro por [cx] de [2,32] m²" com o preço da caixa calculado e o "(≈ 64 caixas)" no estoque.
- A unidade decide o controle de estoque: m²/m³ com lote ligado → "Por lote e tonalidade" (cadastra só as pilhas que já estão na prateleira; depois o lote entra pela nota do fornecedor); nas outras unidades → "Por cor e medida" (a grade de hoje com outro nome).
- Card "Entrega": "Cada m² pesa [21,5] kg", que grava `weight_kg`.
- "Nota fiscal" no topo da coluna direita (no celular, depois do estoque), com as 3 perguntas numeradas e o selo "2 de 3". Os códigos (barras e interno) ganham card próprio.
- Textos neutros nas fotos. A ficha fica Marca · Medidas · Material · Onde usar e rendimento; o tamanho da caixa e o peso aparecem sozinhos na prévia.

**Perguntas para o Caio**
1. "Compro por" também para un/pç (caixa com 100 parafusos)? Hoje só aparece em unidade de material.
2. A 4ª linha da ficha reaproveita a coluna `cuidados` com outro rótulo, ou criamos uma coluna própria?
3. "Salvar e cadastrar outro" mantém categoria, unidade, "compro por" e as respostas fiscais?
4. Se a loja tiver Matcon e Ótica ligados ao mesmo tempo, qual perfil vale?

**Seção do mockup → arquivo React**
- Perfil (novo) → `components/screens/estoque/item-form/perfis.ts` (+ teste de "não vaza") · ordem e colunas → `ItemFormModal.tsx`
- O item / aviso de repetido → `item-form/SecaoItem.tsx` · categorias sugeridas → `item-form/CategorySelector.tsx`
- Vendo por + preço + compra → `item-form/SecaoPreco.tsx` (a unidade e a compra saem de `SecaoEstoque.tsx` só no perfil Matcon)
- Estoque, lote × cor e medida → `item-form/SecaoEstoque.tsx` (lotes via `services/matconApi.ts`, `utils/matconLots.ts`)
- Entrega (peso) → nova `item-form/SecaoEntrega.tsx` · Nota fiscal + Códigos → `item-form/SecaoCodigos.tsx` (dividida em duas)
- Fotos → `item-form/SecaoFotos.tsx` · Descrição e ficha → `item-form/SecaoDescricao.tsx` · rótulos e exemplos → `item-form/types.ts`
