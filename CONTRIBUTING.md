# AURA. — Boas Praticas de Desenvolvimento

## Regra #1: Unicode / Acentuacao

O GitHub MCP (push_files e create_or_update_file) escapa caracteres UTF-8
como `\u00e7\u00e3o` ao inves de `ção`. Isso quebra todos os textos em
portugues no app.

### Solucao

**Apos QUALQUER commit via Claude/MCP, rodar:**

```bash
node scripts/fix-unicode-all.js
git add -A && git commit -m "fix: convert Unicode escapes to UTF-8" && git push
```

O script varre todos os .tsx/.ts/.js e converte escapes para caracteres reais.

### Alternativa: Scripts locais

Para arquivos grandes (15KB+), preferir criar scripts Node.js locais
que o Caio roda no terminal. Scripts locais gravam UTF-8 corretamente
porque usam `fs.writeFileSync` direto no disco.

## Regra #2: baseUrl no app.json

- **NUNCA** deixar `baseUrl: "/app"` permanentemente no app.json
- O `deploy.js` injeta temporariamente para build e restaura depois
- baseUrl no app.json quebra `npx expo start --web` (erro 500)
- baseUrl apontando para pasta de source code sobrescreve os fontes

## Regra #3: Caminhos Windows

- Sempre usar `path.join('app', '(tabs)', 'file.tsx')`
- Nunca usar string literal `'app/(tabs)/file.tsx'` em scripts
- Parenteses nos nomes de pasta quebram no Windows

## Regra #4: Deploy

Processo correto:
```bash
cd ~/Documents/Aura/aura-app
node deploy.js
cd ../aura-site
git add -A && git commit -m "deploy: app demo" && git push origin main
```

O deploy.js faz: injetar baseUrl -> build -> restaurar app.json -> copiar dist/ -> aura-site/app/

## Regra #5: StyleSheet.create()

Variaveis de estado (useState) NAO podem ser usadas dentro de
StyleSheet.create() — ele roda no import time, antes do componente.
Usar inline styles para valores dinamicos.
