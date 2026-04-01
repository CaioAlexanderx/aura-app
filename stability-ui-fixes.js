// stability-ui-fixes.js
// Run from aura-app root: node stability-ui-fixes.js
// Fixes: STB-01 extended cleanup, UX-02 inline code validation,
//        UX-04 onboarding phone pre-fill, UI polish

const fs = require('fs');
const p = require('path');
let total = 0;

// ============================================================
// STB-01 EXTENDED: Clean ALL remaining scripts from root
// ============================================================
console.log('=== STB-01: Final cleanup ===');

const toDelete = fs.readdirSync('.').filter(f =>
  f.endsWith('.js') &&
  !f.startsWith('babel') &&
  !f.startsWith('metro') &&
  !f.startsWith('app.') &&
  !['jest.config.js', 'index.js'].includes(f) &&
  (f.includes('fix-') || f.includes('conn-') || f.includes('implement') ||
   f.includes('review-') || f.includes('create-new') || f.includes('audit-') ||
   f.includes('deploy') || f.includes('stability-'))
);

let deleted = 0;
for (const f of toDelete) {
  try { fs.unlinkSync(f); deleted++; } catch {}
}
console.log('  OK: Deleted ' + deleted + ' scripts: ' + toDelete.join(', '));
if (deleted > 0) total++;

// ============================================================
// UX-02: Inline access code validation on blur (register)
// ============================================================
console.log('\n=== UX-02: Inline code validation ===');

const regPath = p.join('app', '(auth)', 'register.tsx');
if (fs.existsSync(regPath)) {
  let c = fs.readFileSync(regPath, 'utf-8');

  if (!c.includes('codeValid')) {
    // Add state for code validation
    c = c.replace(
      'const [showPass, setShowPass] = useState(false);',
      `const [showPass, setShowPass] = useState(false);
  const [codeValid, setCodeValid] = useState<boolean | null>(null);
  const [codeChecking, setCodeChecking] = useState(false);
  const [codePlan, setCodePlan] = useState<string | null>(null);`
    );

    // Add validation function
    c = c.replace(
      '// CNPJ auto-fill via BrasilAPI',
      `// UX-02: Inline access code validation
  async function validateCodeInline(code: string) {
    if (!code || code.length < 4) { setCodeValid(null); setCodePlan(null); return; }
    setCodeChecking(true);
    try {
      const { authApi } = require("@/services/api");
      const result = await authApi.validateCode(code);
      setCodeValid(result.valid);
      setCodePlan(result.valid ? (result.plan || null) : null);
    } catch {
      setCodeValid(false);
      setCodePlan(null);
    } finally {
      setCodeChecking(false);
    }
  }

  // CNPJ auto-fill via BrasilAPI`
    );

    // Update the codigo input to validate on blur and show result
    if (c.includes('value={codigo} onChangeText={v => setCodigo(v.toUpperCase())}')) {
      c = c.replace(
        'value={codigo} onChangeText={v => setCodigo(v.toUpperCase())}',
        'value={codigo} onChangeText={v => { setCodigo(v.toUpperCase()); setCodeValid(null); }} onBlur={() => validateCodeInline(codigo)}'
      );
    }

    // Add validation feedback after the codigo input helper text
    if (c.includes('Recebeu um c')) {
      c = c.replace(
        `Recebeu um c\u00f3digo de indica\u00e7\u00e3o ou trial? Insira aqui.`,
        `Recebeu um c\u00f3digo de indica\u00e7\u00e3o ou trial? Insira aqui.
        </Text>
        {codeChecking && <ActivityIndicator size="small" color={Colors.violet3} style={{ marginTop: 4 }} />}
        {codeValid === true && codePlan && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, backgroundColor: Colors.greenD, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Icon name="check" size={12} color={Colors.green} />
            <Text style={{ fontSize: 11, color: Colors.green, fontWeight: "600" }}>C\u00f3digo v\u00e1lido \u2014 Plano {codePlan === "negocio" ? "Neg\u00f3cio" : codePlan === "expansao" ? "Expans\u00e3o" : "Essencial"}</Text>
          </View>
        )}
        {codeValid === false && (
          <Text style={{ fontSize: 10, color: Colors.red, marginTop: 4 }}>C\u00f3digo inv\u00e1lido ou expirado</Text>
        )}
        <Text style={{ fontSize: 0`  // dummy to close properly
      );
      // Clean up the dummy text close
      c = c.replace('<Text style={{ fontSize: 0', '');
    }

    console.log('  OK: Inline code validation on blur + visual feedback');
    total++;
    fs.writeFileSync(regPath, c, 'utf-8');
  }
}

// ============================================================
// UX-04: Onboarding pre-fills phone from auth store
// ============================================================
console.log('\n=== UX-04: Onboarding phone pre-fill ===');

const onbPath = p.join('app', '(tabs)', 'onboarding.tsx');
if (fs.existsSync(onbPath)) {
  let c = fs.readFileSync(onbPath, 'utf-8');

  // Check if user phone is used in the perfil step
  if (c.includes('step/perfil') && !c.includes('user?.phone')) {
    // In the finish function, pass user phone
    if (c.includes("trade_name: cnpjData?.razaoSocial || company?.name,")) {
      c = c.replace(
        "trade_name: cnpjData?.razaoSocial || company?.name,",
        "trade_name: cnpjData?.razaoSocial || company?.name,\n            phone: user?.phone || undefined,\n            email: user?.email || undefined,"
      );
      console.log('  OK: Onboarding passes user phone + email to perfil step');
      total++;
      fs.writeFileSync(onbPath, c, 'utf-8');
    }
  }
}

// ============================================================
// UI-POLISH: Fix static Dimensions in remaining screens
// ============================================================
console.log('\n=== UI: Fix remaining static Dimensions ===');

const screens = [
  p.join('app', '(tabs)', 'estoque.tsx'),
  p.join('app', '(tabs)', 'folha.tsx'),
  p.join('app', '(tabs)', 'contabilidade.tsx'),
  p.join('app', '(tabs)', 'nfe.tsx'),
  p.join('app', '(tabs)', 'whatsapp.tsx'),
  p.join('app', '(tabs)', 'canal.tsx'),
  p.join('app', '(tabs)', 'agentes.tsx'),
];

for (const screen of screens) {
  if (!fs.existsSync(screen)) continue;
  let c = fs.readFileSync(screen, 'utf-8');
  const name = p.basename(screen);

  // Replace static Dimensions with window.innerWidth
  if (c.includes('const { width: W } = Dimensions.get("window");\nconst IS = W > 768;') ||
      c.includes("const { width: SCREEN_W } = Dimensions.get(\"window\");\nconst IS_WIDE = SCREEN_W > 768;")) {

    c = c.replace(
      /const \{ width: (?:W|SCREEN_W) \} = Dimensions\.get\("window"\);\nconst (?:IS|IS_WIDE) = (?:W|SCREEN_W) > 768;/,
      "const IS_WIDE = typeof window !== 'undefined' ? window.innerWidth > 768 : Dimensions.get('window').width > 768;"
    );

    // Also fix references from IS to IS_WIDE if needed
    if (c.includes('const IS = typeof')) {
      c = c.replace('const IS = typeof', 'const IS_WIDE = typeof');
    }

    console.log('  OK: ' + name + ' — reactive width');
    total++;
    fs.writeFileSync(screen, c, 'utf-8');
  }
}

// ============================================================
// UI-POLISH: Ensure all screens have transparent bg (gradient)
// ============================================================
console.log('\n=== UI: Background consistency ===');

for (const screen of screens) {
  if (!fs.existsSync(screen)) continue;
  let c = fs.readFileSync(screen, 'utf-8');
  const name = p.basename(screen);

  if (c.includes('backgroundColor: Colors.bg') && c.includes('style={s.screen}')) {
    // Check if screen style has explicit bg color
    const hasTransparent = c.includes('backgroundColor: "transparent"') || c.includes("backgroundColor: 'transparent'");
    if (!hasTransparent && c.includes('screen: {')) {
      c = c.replace(
        /screen:\s*\{\s*flex:\s*1\s*,\s*backgroundColor:\s*Colors\.bg\s*\}/,
        'screen: { flex: 1, backgroundColor: "transparent" }'
      );
      if (c.includes('backgroundColor: Colors.bg }')) {
        console.log('  OK: ' + name + ' — transparent background (uses gradient from layout)');
        total++;
        fs.writeFileSync(screen, c, 'utf-8');
      }
    }
  }
}

// ============================================================
console.log('\n========================================');
console.log('DONE: ' + total + ' fixes applied');
console.log('========================================');
console.log('\nRun:');
console.log('  git add -A && git commit -m "fix: stability + UI polish - cleanup scripts, inline code validation, reactive dimensions, phone pre-fill" && git push');
