# Matcon — QA em produção, 22/09/2026 (tarde)

Conta de teste (`testeaura01@gmail.com`, loja "Aura", Simples Nacional, plano Expansão), Chrome real do Caio, `app.getaura.com.br` em `main` (#936). Matcon e Ótica ligados na conta. Backend só tem M0: toda rota `/matcon/*` responde 404.

Persona pedida pelo Caio: lojista sem intimidade com tecnologia, aprendendo do zero.

## O que funcionou

- Cadastro "Piso Cerâmico 60x60 Bege", m², R$ 89,90, compra por caixa de 2,5 m², 120 m² em estoque (hint "≈ 48 caixas"). Salvou; a lista mostra "120 m²".
- Caixa: 12,5 m² → R$ 1.123,75; hint "= 5 caixas · 12,5 m²". Calculadora de ambiente 4 × 3,5 m + 10% → 15,40 m² → 7 caixas, sobra 2,1 m²; "Usar 15,40 m²" atualizou o carrinho (R$ 1.384,46).
- "Salvar orçamento" dispara `POST /matcon/quotes` (404 hoje → toast "Rota nao encontrada"). Chip "+ indicar profissional" abre "Quem indicou este cliente?" com busca, "Cadastrar profissional" e "Marcar um cliente que já existe".
- Ficha do cliente: "Marcar como profissional" → modal com os ofícios (pedreiro, mestre de obras, …) — texto vira "Marcar como parceiro" no PR #937.
- `/matcon/config`: frases no lugar de campos; "Tudo salvo".

## Achados (ordem de gravidade)

1. **Milheiro cobra 1.000× errado.** Produto em `mlh` (tijolo R$ 890/mlh) cai no stepper inteiro. Lojista digita "0,5" → o campo tira a vírgula (`replace(/\D/g,"")`, `CartPanel.tsx` ~linha 998) e vira **5 mlh = R$ 4.450**. Digita "500" (pensando em 500 tijolos) → **500 mlh = R$ 445.000**. Nenhum aviso de estoque (20 mlh). Decisão do Caio (22/09): vender tijolo por unidade com preço por milheiro — o Caixa pergunta "quantos tijolos?" e converte. Correção em andamento (branch `matcon-milheiro-por-unidade`).
2. **Rodapé do Caixa com quatro botões** ("Salvar orç…" truncado). Aprovado pelo Caio: volta a três, "Orçamento" salva com Matcon ligado, card salvo ganha Imprimir / WhatsApp / Ver orçamentos. PR #938.
3. **Cadastro de produto fala moda** para o lojista de matcon: placeholder "Vestido midi floral", ficha "Material / Medidas / Cuidados", "Por cor e tamanho", categoria padrão "Calçados (última usada)", SKU "VES-001", sem campo de peso. Mockup por subvertical em andamento (`docs/mockups/matcon-cadastro-produto.html`).
4. **Esteiras giram >10 s** com o backend 404 ("Carregando a esteira…") antes de mostrar vazio. Resolve-se com o backend M1, mas vale tratar 404 como vazio na hora.
5. **"= 1 caixas"** no hint do carrinho; **linha largura × comprimento quebra** na calculadora. branch `matcon-qa-caixa-plural-calculadora`.
6. **Card de Configurações**: descrição "estoque fracionado e conversão de caixa para m²" é jargão para o lojista. Sugestão: "Compra em caixa, vende em m², sem fazer conta." (o PR #937 já troca o link para "Unidades, entrega e parceiros").
7. Fora do Matcon: lista de estoque ordenada por "últimos adicionados" não mostrou o produto novo no topo depois de salvar (só na busca); `/caixa` → `POST /caixa/abrir` 403 para esta conta (permissão de membro).

## Produtos de teste criados

- Piso Cerâmico 60x60 Bege (m², cx de 2,5 m²) — custo salvo como R$ 0,55 (digitação do robô no campo mascarado).
- Tijolo 6 furos 9x14x19 (mlh, R$ 890, 20 mlh).
