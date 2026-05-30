# Fase 0 — Laudo de contraste WCAG AA (Aura Studio redesign)

Gerado em 30/05/2026. Verificador: `scripts/studio-aa-check.js` (composição de alpha + luminância relativa WCAG 2.1).

Critérios: texto de corpo ≥ 4.5:1 · objeto gráfico (ponto/ícone de estado) ≥ 3:1.
Dark é a paleta **principal** (DA-2), projetada e validada primeiro.

```

===== DARK =====
PASS 13.98 (min 4.5) DARK ink/card body
PASS 9.85 (min 4.5) DARK ink2/card body
PASS 5.71 (min 4.5) DARK ink3/card muted
PASS 17.06 (min 4.5) DARK ink/bg body
PASS 6.80 (min 4.5) DARK waiting ink/soft chip text
PASS 8.76 (min 3) DARK waiting base/card dot/icon
PASS 6.33 (min 4.5) DARK art ink/soft chip text
PASS 6.46 (min 3) DARK art base/card dot/icon
PASS 6.60 (min 4.5) DARK approved ink/soft chip text
PASS 7.61 (min 3) DARK approved base/card dot/icon
PASS 5.90 (min 4.5) DARK production ink/soft chip text
PASS 5.75 (min 3) DARK production base/card dot/icon
PASS 6.73 (min 4.5) DARK ready ink/soft chip text
PASS 7.86 (min 3) DARK ready base/card dot/icon
PASS 7.44 (min 4.5) DARK delivered ink/soft chip text
PASS 5.71 (min 3) DARK delivered base/card dot/icon
PASS 5.93 (min 4.5) DARK danger ink/soft chip text
PASS 5.29 (min 3) DARK danger base/card dot/icon
PASS 5.91 (min 4.5) DARK changes ink/soft chip text
PASS 5.44 (min 3) DARK changes base/card dot/icon

===== LIGHT =====
PASS 16.53 (min 4.5) LIGHT ink/card body
PASS 9.59 (min 4.5) LIGHT ink2/card body
PASS 5.09 (min 4.5) LIGHT ink3/card muted
PASS 14.75 (min 4.5) LIGHT ink/bg body
PASS 6.37 (min 4.5) LIGHT waiting ink/soft chip text
PASS 4.65 (min 3) LIGHT waiting base/card dot/icon
PASS 6.38 (min 4.5) LIGHT art ink/soft chip text
PASS 3.30 (min 3) LIGHT art base/card dot/icon
PASS 6.78 (min 4.5) LIGHT approved ink/soft chip text
PASS 3.49 (min 3) LIGHT approved base/card dot/icon
PASS 7.15 (min 4.5) LIGHT production ink/soft chip text
PASS 4.79 (min 3) LIGHT production base/card dot/icon
PASS 6.73 (min 4.5) LIGHT ready ink/soft chip text
PASS 3.47 (min 3) LIGHT ready base/card dot/icon
PASS 6.92 (min 4.5) LIGHT delivered ink/soft chip text
PASS 4.41 (min 3) LIGHT delivered base/card dot/icon
PASS 6.80 (min 4.5) LIGHT danger ink/soft chip text
PASS 4.47 (min 3) LIGHT danger base/card dot/icon
PASS 6.68 (min 4.5) LIGHT changes ink/soft chip text
PASS 4.35 (min 3) LIGHT changes base/card dot/icon

ALL PASS ✓
```

## Ajustes de paleta aplicados pra passar AA

- `StudioColors.ink3` (light): `#64748B` → `#5E6A7A` (era 4.41:1 sobre paperCard; agora 5.09:1).
- `StudioSemantic.waiting.base` (light): `#F59E0B` → `#B45309` (objeto gráfico, era 1.99:1; agora 4.65:1).
- `awaiting_customization` deixou de usar ROSA (#FCE7F3/#9D174D) e passou a `waiting` (âmbar) — guardrail §3.1.2 (nunca magenta pra estado).
