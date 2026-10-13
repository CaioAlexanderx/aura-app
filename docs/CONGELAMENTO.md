# Janela de congelamento de deploy

Decisão do plano de 13/10/2026. Na Black Friday e no fim de ano o risco não é
carga, é indisponibilidade pontual num dia em que o lojista não perdoa — e os
incidentes recentes vieram de deploy. Por isso, nas janelas abaixo **não sai
deploy**, salvo hotfix aprovado pelo Caio.

## Datas

Horário de Brasília, primeiro e último dia **inclusivos**.

| Janela | De | Até |
|---|---|---|
| Black Friday | 24/11/2026 | 01/12/2026 |
| Fim de ano | 20/12/2026 | 02/01/2027 |

A fonte única é [`constants/janelasDeCongelamento.json`](../constants/janelasDeCongelamento.json).
Para mudar uma data, edite só esse arquivo: o app
([`utils/janelaDeCongelamento.ts`](../utils/janelaDeCongelamento.ts)) e o CI
([`scripts/congelamento.js`](../scripts/congelamento.js)) leem o mesmo JSON.

## Quem aprova

**Caio.** Ninguém marca hotfix sem a aprovação dele, por escrito (mensagem na
conversa ou no PR). Hotfix é correção de algo que está quebrado em produção
agora; melhoria, ajuste visual e "já que estou aqui" esperam o fim da janela.

## Como marcar um hotfix

Escreva `[hotfix]` na mensagem do commit que vai para a `main` — com squash
merge, o título do PR vira a mensagem, então basta:

```
fix(caixa): [hotfix] bipe não achava produto do grupo
```

Qualquer caixa vale (`[HOTFIX]`). A marca é lida pelo texto inteiro da mensagem
do commit; não escreva `[hotfix]` em PR que **não** seja hotfix, nem como
exemplo, porque ela conta.

Alternativa: variável de ambiente `HOTFIX=1` no build do Cloudflare. Use só se
não der para mexer na mensagem, e **remova depois** — enquanto estiver lá, todo
build novo sai marcado como hotfix.

## O que acontece

| Peça | Fora da janela | Dentro da janela, sem hotfix | Dentro da janela, com hotfix |
|---|---|---|---|
| **CI** (`.github/workflows/congelamento.yml`) | verde | **falha** o push na `main` com a explicação | verde |
| **Build** (`wrangler.jsonc` › `build.command`) | grava `dist/version.json` com `hotfix: false` | idem | grava `hotfix: true` |
| **App aberto** (`services/atualizarApp`) | comportamento de sempre | não troca de bundle, não mostra aviso | troca normalmente |

Pontos que importam:

- O check vermelho do CI **não impede** o Cloudflare de construir: o deploy é
  dele. O que protege o lojista é o app não trocar de bundle sozinho. Quem
  abre o app depois do deploy carrega o bundle novo de qualquer jeito, então o
  congelamento de verdade é **não mergear** na janela.
- `dist/version.json` tem `{ hash, hotfix, sha, builtAt }`. O app só considera
  hotfix quando `hotfix` é `true` **e** o `hash` bate com o `entry-<hash>.js`
  servido em `/`. Arquivo ausente, quebrado ou de outro bundle = não é hotfix
  (na dúvida, congelado).
- **Cada deploy dentro da janela precisa ser `[hotfix]`.** O `version.json` é o
  do último build: um deploy sem marca depois do hotfix "tira" a marca, e os
  aparelhos que ainda não atualizaram ficam esperando o fim da janela.
- O segundo toque em "Recarregar" (quando o app não conseguiu verificar a
  versão) continua recarregando: é pedido explícito de quem está sem saída.

## Para a equipe

Em **Configurações › Aplicativo** (varejo) e na tela de Aplicativo do dojô
(Karatê), quem é staff (`isStaff`) vê, dentro da janela, a linha discreta
"Atualizações pausadas até dd/mm (temporada)". O lojista não vê nada: para ele
o app "já está na versão mais nova".

## Depois de um hotfix, conferir

```bash
curl -s https://app.getaura.com.br/version.json
```

Deve mostrar `"hotfix": true` e o `hash` igual ao `entry-<hash>.js` do HTML de
`/`. Se `hotfix` vier `false`, a marca não chegou ao build (mensagem sem
`[hotfix]`, ou o build rodou numa clonagem sem o histórico) e os aparelhos
abertos não vão trocar.

## Testes

`__tests__/janelaDeCongelamento.test.ts` (bordas das janelas),
`__tests__/congelamento.test.ts` (script do CI e do build, mais a paridade com
o app), `__tests__/atualizarApp.test.ts` e
`__tests__/hooks/useAtualizarApp.test.ts` (dentro e fora da janela, com e sem
hotfix).
