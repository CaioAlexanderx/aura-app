// fix-priority1.js
// Run from aura-app root: node fix-priority1.js
// Fixes: WhatsApp missing styles, logo sizing, config tab

const fs = require('fs');
const p = require('path');
let total = 0;

// ═══════════════════════════════════════════════════
// 1. Fix WhatsApp - add missing styles
// ═══════════════════════════════════════════════════
console.log('\n=== Fix WhatsApp styles ===');

const whats = p.join('app', '(tabs)', 'whatsapp.tsx');
if (fs.existsSync(whats)) {
  let c = fs.readFileSync(whats, 'utf-8');

  // Check if supportCard style exists
  if (c.includes('supportCard:')) {
    console.log('  SKIP: styles already exist');
  } else {
    // Add missing styles before the closing of z StyleSheet
    // Find the last style entry and add after it
    const lastStyle = 'infoText: { fontSize: 11, color: Colors.amber, flex: 1, lineHeight: 16 },';
    if (c.includes(lastStyle)) {
      const newStyles = `infoText: { fontSize: 11, color: Colors.amber, flex: 1, lineHeight: 16 },
  // Support CTA
  supportCard: { backgroundColor: Colors.violetD, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", marginTop: 16, gap: 8 },
  supportIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border, marginBottom: 4 },
  supportTitle: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  supportDesc: { fontSize: 12, color: Colors.ink3, textAlign: "center", lineHeight: 18, marginBottom: 4 },
  supportBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24 },
  supportBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  supportHint: { fontSize: 10, color: Colors.ink3, fontStyle: "italic" },
  // Campaign templates
  newCampCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: Colors.border, marginTop: 16, gap: 12 },
  newCampTitle: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  newCampDesc: { fontSize: 12, color: Colors.ink3 },
  campTemplates: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  campTemplate: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg4, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border },
  campTemplateText: { fontSize: 12, color: Colors.ink, fontWeight: "500" },
  newCampBtn: { backgroundColor: Colors.violetD, borderRadius: 10, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: Colors.border2 },
  newCampBtnText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  // Message preview
  msgPreview: { paddingVertical: 12, paddingHorizontal: 4, gap: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  msgPreviewLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "600" },
  msgPreviewBubble: { backgroundColor: Colors.bg4, borderRadius: 14, padding: 14, maxWidth: "85%" },
  msgPreviewText: { fontSize: 12, color: Colors.ink, lineHeight: 18 },`;
      c = c.replace(lastStyle, newStyles);
      fs.writeFileSync(whats, c, 'utf-8');
      console.log('  OK: 18 missing styles added');
      total++;
    } else {
      console.log('  WARN: infoText pattern not found');
    }
  }
}

// ═══════════════════════════════════════════════════
// 2. Fix sidebar logo - read actual content and patch
// ═══════════════════════════════════════════════════
console.log('\n=== Fix sidebar logo ===');

const layout = p.join('app', '(tabs)', '_layout.tsx');
if (fs.existsSync(layout)) {
  let c = fs.readFileSync(layout, 'utf-8');
  
  // Find the actual logo size pattern
  const logoMatch = c.match(/width:\s*(\d+),\s*height:\s*(\d+)\s*\}\s*resizeMode="contain"/);
  if (logoMatch) {
    const oldW = logoMatch[1];
    const oldH = logoMatch[2];
    console.log('  Found sidebar logo: ' + oldW + 'x' + oldH);
    if (parseInt(oldW) < 130) {
      c = c.replace(
        `width: ${oldW}, height: ${oldH} } resizeMode="contain"`,
        'width: 130, height: 48 } resizeMode="contain"'
      );
      fs.writeFileSync(layout, c, 'utf-8');
      console.log('  OK: Sidebar logo -> 130x48');
      total++;
    } else {
      console.log('  SKIP: logo already large enough');
    }
  } else {
    // Try alternate pattern
    const alt = c.match(/style=\{\{ width: (\d+), height: (\d+) \}\} resizeMode/);
    if (alt) {
      console.log('  Found alt pattern: ' + alt[1] + 'x' + alt[2]);
      c = c.replace(
        `style={{ width: ${alt[1]}, height: ${alt[2]} }} resizeMode`,
        'style={{ width: 130, height: 48 }} resizeMode'
      );
      fs.writeFileSync(layout, c, 'utf-8');
      console.log('  OK: Sidebar logo -> 130x48');
      total++;
    } else {
      console.log('  WARN: logo pattern not found, printing context...');
      const idx = c.indexOf('resizeMode="contain"');
      if (idx > -1) console.log('  Context: ...' + c.substring(Math.max(0,idx-80), idx+30) + '...');
    }
  }
}

// ═══════════════════════════════════════════════════
// 3. Fix login/register logo size + background
// ═══════════════════════════════════════════════════
console.log('\n=== Fix login/register logos ===');

[p.join('app', '(auth)', 'login.tsx'), p.join('app', '(auth)', 'register.tsx')].forEach(f => {
  if (!fs.existsSync(f)) { console.log('  SKIP: ' + f + ' not found'); return; }
  let c = fs.readFileSync(f, 'utf-8');

  // Find and increase the img width
  const imgMatch = c.match(/width:\s*(\d+),\s*height:\s*["']auto["']/);
  if (imgMatch) {
    const oldW = imgMatch[1];
    console.log('  Found ' + p.basename(f) + ' logo: width=' + oldW);
    if (parseInt(oldW) < 320) {
      // Replace all occurrences of the old width for img tags
      c = c.replace(
        new RegExp('width: ' + oldW + ', height: "auto"', 'g'),
        'width: 320, height: "auto"'
      );
      // Also replace any height: auto without quotes
      c = c.replace(
        new RegExp("width: " + oldW + ", height: 'auto'", 'g'),
        "width: 320, height: 'auto'"
      );
    }
  }

  // Fix logo background - make the img display with no background
  // The issue is the JPEG has a colored background. Add borderRadius and ensure proper display
  // Add object-fit and background transparent to img style
  if (c.includes('display: "block"') && !c.includes('borderRadius: 16')) {
    c = c.replace(
      /style=\{\{ width: \d+, height: "auto", display: "block" \} as any\}/,
      'style={{ width: 320, height: "auto", display: "block", borderRadius: 16 } as any}'
    );
  }

  fs.writeFileSync(f, c, 'utf-8');
  console.log('  OK: ' + p.basename(f) + ' logo updated');
  total++;
});

// ═══════════════════════════════════════════════════
// 4. Fix WhatsApp config - add editable message
// ═══════════════════════════════════════════════════
console.log('\n=== Fix WhatsApp config tab ===');

if (fs.existsSync(whats)) {
  let c = fs.readFileSync(whats, 'utf-8');

  // Check if the message preview already exists
  if (c.includes('msgPreviewBubble') && c.includes('<View style={z.msgPreview}>')) {
    console.log('  SKIP: config already has message preview');
  } else if (c.includes('msgPreviewBubble') && !c.includes('<View style={z.msgPreview}>')) {
    // Styles exist but JSX not injected - add the message preview
    const oldConfig = `<View style={z.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={z.settingLabel}>Respostas autom\u00e1ticas fora do hor\u00e1rio</Text>
              <Text style={z.settingHint}>Envia mensagem informando hor\u00e1rio de funcionamento</Text>
            </View>
            <Switch value={true} trackColor={{ true: Colors.green, false: Colors.bg4 }} />
          </View>
          <View style={z.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={z.settingLabel}>Hor\u00e1rio</Text>
              <Text style={z.settingHint}>Segunda a s\u00e1bado, 8h \u00e0s 18h</Text>
            </View>
            <Pressable onPress={() => toast.info("Editar hor\u00e1rio")} style={z.editBtn}><Text style={z.editBtnText}>Editar</Text></Pressable>
          </View>`;

    // Try with actual UTF-8 characters (after fix-unicode-all)
    const oldConfigUtf = c.includes('Respostas automáticas fora do horário');
    
    if (oldConfigUtf) {
      c = c.replace(
        `<View style={z.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={z.settingLabel}>Respostas automáticas fora do horário</Text>
              <Text style={z.settingHint}>Envia mensagem informando horário de funcionamento</Text>
            </View>
            <Switch value={true} trackColor={{ true: Colors.green, false: Colors.bg4 }} />
          </View>
          <View style={z.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={z.settingLabel}>Horário</Text>
              <Text style={z.settingHint}>Segunda a sábado, 8h às 18h</Text>
            </View>
            <Pressable onPress={() => toast.info("Editar horário")} style={z.editBtn}><Text style={z.editBtnText}>Editar</Text></Pressable>
          </View>`,
        `<View style={z.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={z.settingLabel}>Respostas automáticas fora do horário</Text>
              <Text style={z.settingHint}>Envia mensagem personalizada fora do expediente</Text>
            </View>
            <Switch value={true} trackColor={{ true: Colors.green, false: Colors.bg4 }} />
          </View>
          <View style={z.msgPreview}>
            <Text style={z.msgPreviewLabel}>Mensagem fora do horário:</Text>
            <View style={z.msgPreviewBubble}>
              <Text style={z.msgPreviewText}>Olá! Obrigado pela mensagem. Nosso horário de atendimento é de segunda a sábado, das 8h às 18h. Retornaremos assim que possível!</Text>
            </View>
            <Pressable onPress={() => toast.info("Editar mensagem")} style={z.editBtn}><Text style={z.editBtnText}>Editar mensagem</Text></Pressable>
          </View>
          <View style={z.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={z.settingLabel}>Horário de atendimento</Text>
              <Text style={z.settingHint}>Segunda a sábado, 8h às 18h</Text>
            </View>
            <Pressable onPress={() => toast.info("Editar horário")} style={z.editBtn}><Text style={z.editBtnText}>Editar</Text></Pressable>
          </View>`
      );
      fs.writeFileSync(whats, c, 'utf-8');
      console.log('  OK: Config tab - message preview added');
      total++;
    } else {
      console.log('  SKIP: config pattern not matched (check encoding)');
    }
  }
}

// ═══════════════════════════════════════════════════
console.log('\n========================================');
console.log('DONE: ' + total + ' changes applied');
console.log('========================================');
console.log('\nRun:');
console.log('  git add -A && git commit -m "fix: WhatsApp styles + logo sizing + config preview" && git push');
