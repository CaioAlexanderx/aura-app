# Preço no cartão — nota do mockup
Mockup: `docs/mockups/preco-no-cartao.html` (config, cadastro padrão/Matcon, Caixa desktop, dividido, celular 390px, orçamento/etiqueta, o que não muda). Opção da loja em Políticas do Caixa, todos os planos; desligada = Aura de hoje.

**Decisões de desenho**
- Config: "Cobro mais no cartão" + "No cartão, cobro [11]% a mais", num quadro "Cartão" junto da Taxa da maquininha, com a diferença explicada (a taxa é o que a maquininha fica de você; o acréscimo é o que o cliente paga a mais). Mudar o % avisa quantos produtos acompanham e manda reimprimir etiquetas.
- Cadastro: "Preço no dinheiro e PIX" + "Preço no cartão". O preço no cartão é automático (tracejado violeta, grava `null`) ou ajustado à mão (âmbar, com o % real no selo e "Voltar aos 11%" sempre visível). Aviso se o cartão ficar mais barato. Margem dupla, a do cartão já sem a taxa da maquininha.
- Caixa: o item guarda os dois preços ao entrar no carrinho; o chip escolhe qual somar (trocar de chip não conta como mexer no carrinho e o cupom continua). O topo mostra o total do chip e o par "dinheiro e PIX · cartão" sempre visível. Crediário usa o preço do dinheiro. Desconto em % vale sobre o preço do método; desconto em R$ tira o mesmo valor dos dois; o valor mínimo do cupom é conferido pelo total no dinheiro.
- Dividido: base = total no dinheiro; fator = total no cartão ÷ total no dinheiro (da venda, não da loja). Dinheiro, PIX e crediário abatem o valor da base; o cartão abate valor ÷ fator; a última linha é "o que falta" e se preenche sozinha. PIX 400 + cartão = R$ 666,00, total R$ 1.066,00. Tudo num método só dá o preço daquele método, e a ordem dos pagamentos não muda o total. O acréscimo é rateado entre os itens (nota e troca usam esse preço).
- Celular: só o par no bloco violeta (≈ 36px). Rodapé Limpar · Orçamento / Finalizar intacto. Nenhum hover-reveal no mockup.
- Papel: orçamento com os dois preços por linha e dois totais; WhatsApp do orçamento salvo com os dois; etiqueta sempre com os dois, sem opção de esconder.

**Perguntas para o Caio**
1. "À vista" ou "Dinheiro ou PIX" no papel? (Débito também é "à vista" e paga o preço do cartão.)
2. Arredondar o automático (42,18 → 42,20 / 42,90) ou deixar no centavo?
3. Preço editado no carrinho (lápis do item): o outro preço acompanha na mesma proporção?
4. Frete de entrega (Matcon) e taxas avulsas levam acréscimo?
5. Nota da venda dividida: acréscimo rateado no preço de cada item (proposta) ou em "outras despesas"? Confirmar com o contador.
6. Studio, Food, Odonto e loja online ficam de fora na v1?

**Tela → arquivo**
- Config → `components/screens/configuracoes/PdvSettingsCard.tsx` + nova `CardPriceSection.tsx` (ao lado de `CardFeeSection.tsx`); `PdvSettings` ganha `card_price_enabled`, `card_price_pct` (jsonb, sem migration)
- Cadastro → `estoque/item-form/SecaoPreco.tsx` (PrecoDeHoje e ComoVoceVende), `ItemFormModal.tsx`, `item-form/types.ts`; backend `products.card_price` numeric null (migration)
- Caixa → `pdv/ProductCard.tsx`, `hooks/useCart.ts`, `hooks/usePdvState.ts`, `pdv/CartPanel.tsx`, `app/(tabs)/pdv.tsx`; dividido → `useCart` + `SplitRow` + rateio no `POST /pdv/sale`
- Papel → `pdv/buildQuoteHtml.ts`, orçamento salvo (`services/matconApi.ts`), `estoque/labels/buildLabelHtml.ts`; troca → `pdv/TrocaModal.tsx`, `pdv/troca/`
