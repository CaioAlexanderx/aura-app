// priority1-fixes.js
// Run from aura-app root: node priority1-fixes.js
// FE-BUG-01: Fix modal overlay fullscreen
// FE-POLISH-01: Hyperlink "Powered by Aura"
// FE-POLISH-02: Logo sizing improvements
// FE-25b: WhatsApp CTA suporte + melhorias

const fs = require('fs');
const p = require('path');
let total = 0;

// ═══════════════════════════════════════════════════
// FE-BUG-01: Modal financeiro overlay fullscreen
// Problem: position "absolute" only covers the ScrollView parent
// Fix: Use position "fixed" on web for true fullscreen
// ═══════════════════════════════════════════════════
console.log('\n=== FE-BUG-01: Modal overlay fullscreen ===');

const fin = p.join('app', '(tabs)', 'financeiro.tsx');
if (fs.existsSync(fin)) {
  let c = fs.readFileSync(fin, 'utf-8');
  // Change position absolute to fixed on web
  if (c.includes('overlay: { position: "absolute" as any')) {
    c = c.replace(
      'overlay: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", zIndex: 100 }',
      'overlay: { position: "fixed" as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", zIndex: 100 }'
    );
    fs.writeFileSync(fin, c, 'utf-8');
    console.log('  OK: overlay position fixed (fullscreen)');
    total++;
  } else {
    console.log('  SKIP: pattern not found');
  }
}

// ═══════════════════════════════════════════════════
// FE-POLISH-01: Hyperlink "Powered by Aura"
// ═══════════════════════════════════════════════════
console.log('\n=== FE-POLISH-01: Hyperlink Powered by Aura ===');

const canal = p.join('app', '(tabs)', 'canal.tsx');
if (fs.existsSync(canal)) {
  let c = fs.readFileSync(canal, 'utf-8');

  // Add Linking import if not present
  if (!c.includes('Linking')) {
    c = c.replace(
      'import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Image, Switch }',
      'import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Image, Switch, Linking }'
    );
  }

  // Replace static text with Pressable hyperlink
  if (c.includes('<Text style={z.previewFooterText}>Loja powered by Aura.</Text>')) {
    c = c.replace(
      '<Text style={z.previewFooterText}>Loja powered by Aura.</Text>',
      '<Pressable onPress={() => Linking.openURL("https://getaura.com.br")}><Text style={z.previewFooterText}>Loja powered by <Text style={{color: Colors.violet3, fontWeight: "600"}}>Aura.</Text></Text></Pressable>'
    );
    fs.writeFileSync(canal, c, 'utf-8');
    console.log('  OK: "Powered by Aura" now links to getaura.com.br');
    total++;
  } else {
    console.log('  SKIP: footer pattern not found');
  }
}

// ═══════════════════════════════════════════════════
// FE-POLISH-02: Logo sizing in sidebar + login
// ═══════════════════════════════════════════════════
console.log('\n=== FE-POLISH-02: Logo sizing ===');

const layout = p.join('app', '(tabs)', '_layout.tsx');
if (fs.existsSync(layout)) {
  let c = fs.readFileSync(layout, 'utf-8');

  // Increase sidebar logo size from 100x36 to 120x44 for better visibility
  if (c.includes('width: 100, height: 36')) {
    c = c.replace(
      'width: 100, height: 36',
      'width: 120, height: 44'
    );
    fs.writeFileSync(layout, c, 'utf-8');
    console.log('  OK: Sidebar logo 100x36 -> 120x44');
    total++;
  } else {
    console.log('  SKIP: sidebar logo pattern not found');
  }
}

// Also improve login/register logo size
const loginFile = p.join('app', '(auth)', 'login.tsx');
if (fs.existsSync(loginFile)) {
  let c = fs.readFileSync(loginFile, 'utf-8');
  if (c.includes('width: 260')) {
    c = c.replace(/width: 260/g, 'width: 300');
    fs.writeFileSync(loginFile, c, 'utf-8');
    console.log('  OK: Login logo 260 -> 300');
    total++;
  }
}

const regFile = p.join('app', '(auth)', 'register.tsx');
if (fs.existsSync(regFile)) {
  let c = fs.readFileSync(regFile, 'utf-8');
  if (c.includes('width: 260')) {
    c = c.replace(/width: 260/g, 'width: 300');
    fs.writeFileSync(regFile, c, 'utf-8');
    console.log('  OK: Register logo 260 -> 300');
    total++;
  }
}

// ═══════════════════════════════════════════════════
// FE-25b: WhatsApp improvements
// - Replace "Criar automacao" with CTA to suporte Aura
// - Add editable "fora do horario" message
// - Add message templates section
// ═══════════════════════════════════════════════════
console.log('\n=== FE-25b: WhatsApp melhorias ===');

const whats = p.join('app', '(tabs)', 'whatsapp.tsx');
if (fs.existsSync(whats)) {
  let c = fs.readFileSync(whats, 'utf-8');
  let changes = 0;

  // 1. Replace "Criar automacao" CTA with suporte CTA
  if (c.includes('"Criar nova automa')) {
    c = c.replace(
      `<Pressable onPress={() => toast.info("Criar nova automa\u00e7\u00e3o")} style={z.createBtn}>
        <Icon name="star" size={16} color={Colors.violet3} />
        <Text style={z.createBtnText}>Criar automa\u00e7\u00e3o</Text>
      </Pressable>`,
      `<View style={z.supportCard}>
        <View style={z.supportIcon}><Icon name="star" size={22} color={Colors.violet3} /></View>
        <Text style={z.supportTitle}>Automa\u00e7\u00e3o personalizada</Text>
        <Text style={z.supportDesc}>Precisa de uma automa\u00e7\u00e3o diferente? Nosso time cria fluxos sob medida para o seu neg\u00f3cio.</Text>
        <Pressable onPress={() => toast.success("Redirecionando para o suporte Aura...")} style={z.supportBtn}>
          <Icon name="users" size={16} color="#fff" />
          <Text style={z.supportBtnText}>Falar com meu Analista de Neg\u00f3cios</Text>
        </Pressable>
        <Text style={z.supportHint}>Resposta em at\u00e9 2h \u00fateis</Text>
      </View>`
    );
    changes++;
    console.log('  OK: "Criar automacao" -> CTA suporte Aura');
  }

  // 2. Replace "Criar campanha" with richer campaign creation
  if (c.includes('"Criar nova campanha"')) {
    c = c.replace(
      `<Pressable onPress={() => toast.info("Criar nova campanha")} style={z.createBtn}>
        <Icon name="star" size={16} color={Colors.violet3} />
        <Text style={z.createBtnText}>Nova campanha</Text>
      </Pressable>`,
      `<View style={z.newCampCard}>
        <Text style={z.newCampTitle}>Criar nova campanha</Text>
        <Text style={z.newCampDesc}>Envie mensagens personalizadas para grupos de clientes.</Text>
        <View style={z.campTemplates}>
          <Pressable onPress={() => toast.info("Template: Promo\u00e7\u00e3o")} style={z.campTemplate}>
            <Icon name="cart" size={16} color={Colors.green} />
            <Text style={z.campTemplateText}>Promo\u00e7\u00e3o</Text>
          </Pressable>
          <Pressable onPress={() => toast.info("Template: Novidade")} style={z.campTemplate}>
            <Icon name="star" size={16} color={Colors.amber} />
            <Text style={z.campTemplateText}>Novidade</Text>
          </Pressable>
          <Pressable onPress={() => toast.info("Template: Reativa\u00e7\u00e3o")} style={z.campTemplate}>
            <Icon name="trending_up" size={16} color={Colors.violet3} />
            <Text style={z.campTemplateText}>Reativa\u00e7\u00e3o</Text>
          </Pressable>
          <Pressable onPress={() => toast.info("Template: Evento")} style={z.campTemplate}>
            <Icon name="users" size={16} color={Colors.red} />
            <Text style={z.campTemplateText}>Evento</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => toast.info("Iniciando nova campanha...")} style={z.newCampBtn}>
          <Text style={z.newCampBtnText}>Criar campanha em branco</Text>
        </Pressable>
      </View>`
    );
    changes++;
    console.log('  OK: Campaign creation enriched with templates');
  }

  // 3. Make "fora do horario" message editable in config
  if (c.includes('"Envia mensagem informando hor')) {
    c = c.replace(
      `<View style={z.settingRow}>
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
          </View>`,
      `<View style={z.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={z.settingLabel}>Respostas autom\u00e1ticas fora do hor\u00e1rio</Text>
              <Text style={z.settingHint}>Envia mensagem personalizada quando o cliente entra em contato fora do expediente</Text>
            </View>
            <Switch value={true} trackColor={{ true: Colors.green, false: Colors.bg4 }} />
          </View>
          <View style={z.msgPreview}>
            <Text style={z.msgPreviewLabel}>Mensagem fora do hor\u00e1rio:</Text>
            <View style={z.msgPreviewBubble}>
              <Text style={z.msgPreviewText}>Ol\u00e1! Obrigado pela mensagem. Nosso hor\u00e1rio de atendimento \u00e9 de segunda a s\u00e1bado, das 8h \u00e0s 18h. Retornaremos assim que poss\u00edvel!</Text>
            </View>
            <Pressable onPress={() => toast.info("Editar mensagem")} style={z.editBtn}><Text style={z.editBtnText}>Editar mensagem</Text></Pressable>
          </View>
          <View style={z.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={z.settingLabel}>Hor\u00e1rio de atendimento</Text>
              <Text style={z.settingHint}>Segunda a s\u00e1bado, 8h \u00e0s 18h</Text>
            </View>
            <Pressable onPress={() => toast.info("Editar hor\u00e1rio")} style={z.editBtn}><Text style={z.editBtnText}>Editar</Text></Pressable>
          </View>`
    );
    changes++;
    console.log('  OK: Out-of-hours message preview + editable');
  }

  // 4. Add new styles for the enhancements
  if (c.includes('infoText: {') && !c.includes('supportCard')) {
    c = c.replace(
      'infoText: { fontSize: 11, color: Colors.amber, flex: 1, lineHeight: 16 },',
      `infoText: { fontSize: 11, color: Colors.amber, flex: 1, lineHeight: 16 },
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
  msgPreviewText: { fontSize: 12, color: Colors.ink, lineHeight: 18 },`
    );
    changes++;
    console.log('  OK: New styles added');
  }

  if (changes > 0) {
    fs.writeFileSync(whats, c, 'utf-8');
    total += changes;
  }
}

// ═══════════════════════════════════════════════════
console.log('\n========================================');
console.log('DONE: ' + total + ' changes applied');
console.log('========================================');
console.log('\nRun:');
console.log('  node scripts/fix-unicode-all.js');
console.log('  git add -A && git commit -m "fix: FE-BUG-01 overlay + POLISH-01 link + POLISH-02 logos + FE-25b WhatsApp melhorias"');
console.log('  git push origin main');
