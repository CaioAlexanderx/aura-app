#!/usr/bin/env bash
# ============================================================
# AURA. -- Deploy FE para Cloudflare Pages
# Expo export -> aura-site/app -> git push -> Pages auto-deploy
# ============================================================
set -euo pipefail

# -------- Cores --------
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${BLUE}▶${NC} $1"; }
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
err()  { echo -e "${RED}✗${NC} $1" >&2; exit 1; }

# -------- Paths (override via env vars) --------
APP_DIR="${AURA_APP_DIR:-$HOME/aura-app}"
SITE_DIR="${AURA_SITE_DIR:-$HOME/aura-site}"
BRANCH="${AURA_BRANCH:-main}"

# -------- Flags --------
SKIP_PULL=false
SKIP_PUSH=false
for arg in "$@"; do
  case $arg in
    --skip-pull)  SKIP_PULL=true ;;
    --skip-push)  SKIP_PUSH=true ;;
    --dry-run)    SKIP_PUSH=true ;;
    -h|--help)
      cat <<EOF
Deploy FE Aura -> Cloudflare Pages

Uso: $0 [opcoes]

Opcoes:
  --skip-pull    Nao fazer git pull (usa estado local atual)
  --skip-push    Gerar build + commit local, sem push (dry-run)
  --dry-run      Alias para --skip-push
  -h, --help     Mostrar esta ajuda

Env vars:
  AURA_APP_DIR   Caminho do aura-app  (default: ~/aura-app)
  AURA_SITE_DIR  Caminho do aura-site (default: ~/aura-site)
  AURA_BRANCH    Branch               (default: main)

Exemplos:
  $0                  # deploy completo
  $0 --dry-run        # testa build sem publicar
  $0 --skip-pull      # deploy do estado local
EOF
      exit 0
      ;;
    *)
      err "Opcao desconhecida: $arg (use --help)"
      ;;
  esac
done

# -------- Validacoes --------
[[ -d "$APP_DIR" ]]  || err "aura-app nao encontrado em $APP_DIR (defina AURA_APP_DIR)"
[[ -d "$SITE_DIR" ]] || err "aura-site nao encontrado em $SITE_DIR (defina AURA_SITE_DIR)"
command -v npx >/dev/null || err "npx nao instalado"
command -v git >/dev/null || err "git nao instalado"

echo
log "Deploy FE Aura"
log "Branch:    $BRANCH"
log "aura-app:  $APP_DIR"
log "aura-site: $SITE_DIR"
echo

# -------- 1. Pull aura-app --------
if [[ "$SKIP_PULL" == "false" ]]; then
  log "[1/5] Atualizando aura-app..."
  (cd "$APP_DIR" && git checkout "$BRANCH" && git pull --ff-only)
  ok "aura-app na $BRANCH atualizada"
else
  warn "[1/5] Pull pulado (--skip-pull)"
fi

# Captura info do commit para mensagem do deploy
COMMIT_SHA=$(cd "$APP_DIR" && git rev-parse --short HEAD)
COMMIT_MSG=$(cd "$APP_DIR" && git log -1 --pretty=%s)
log "HEAD: $COMMIT_SHA \"$COMMIT_MSG\""
echo

# -------- 2. Expo export --------
log "[2/5] Rodando 'expo export' (30-90s)..."
(cd "$APP_DIR" && rm -rf dist && npx expo export --platform web)
[[ -d "$APP_DIR/dist" ]] || err "dist/ nao foi gerado"
FILE_COUNT=$(find "$APP_DIR/dist" -type f | wc -l | tr -d ' ')
ok "Build gerado: $FILE_COUNT arquivos em $APP_DIR/dist"
echo

# -------- 3. Copia dist -> aura-site/app --------
log "[3/5] Copiando dist -> aura-site/app..."
rm -rf "$SITE_DIR/app"
mkdir -p "$SITE_DIR/app"
cp -r "$APP_DIR/dist/." "$SITE_DIR/app/"
COPIED=$(find "$SITE_DIR/app" -type f | wc -l | tr -d ' ')
ok "Copiados $COPIED arquivos"
echo

# -------- 4. Commit --------
log "[4/5] Preparando commit em aura-site..."
cd "$SITE_DIR"
git checkout "$BRANCH"
if [[ "$SKIP_PULL" == "false" ]]; then
  git pull --ff-only
fi
git add app/

if git diff --cached --quiet; then
  warn "Nenhuma mudanca detectada em aura-site/app - build ja esta atualizado"
  ok "Nada a publicar. Saindo."
  exit 0
fi

git commit -m "deploy: $COMMIT_SHA - $COMMIT_MSG"
ok "Commit criado"
echo

# -------- 5. Push --------
if [[ "$SKIP_PUSH" == "false" ]]; then
  log "[5/5] Fazendo push para origin/$BRANCH..."
  git push origin "$BRANCH"
  ok "Push concluido"
  echo
  echo -e "${GREEN}==========================================${NC}"
  ok  "Deploy disparado!"
  echo "  Cloudflare Pages vai atualizar em 1-2 min"
  echo "  URL: https://app.getaura.com.br"
  echo -e "${GREEN}==========================================${NC}"
else
  warn "[5/5] Push pulado (--dry-run/--skip-push)"
  echo "  Commit ficou local em: $SITE_DIR"
  echo "  Para publicar: cd $SITE_DIR && git push"
fi
