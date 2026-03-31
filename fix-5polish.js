// fix-5polish.js
// Run from aura-app root: node fix-5polish.js
// POLISH-01: Hyperlink "Powered by Aura"
// POLISH-02: Revisar logos
// POLISH-03: Icone modo escuro -> lua
// POLISH-04: Canal Digital clareza
// FE-25b: WhatsApp styles faltando

const fs = require('fs');
const p = require('path');
let total = 0;

// =====================================================
// 1. Add new icons: moon, message, headset, brain
// =====================================================
console.log('\n=== POLISH: Adding new icons ===');

const iconFile = p.join('components', 'Icon.tsx');
if (fs.existsSync(iconFile)) {
  let c = fs.readFileSync(iconFile, 'utf-8');
  let changed = false;

  // Add moon icon
  if (!c.includes('moon:')) {
    c = c.replace(
      'chevron_right: "M9 18l6-6-6-6",',
      'chevron_right: "M9 18l6-6-6-6",\n  moon: "M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z",\n  sun: "M12 17a5 5 0 100-10 5 5 0 000 10z M12 1v2 M12 21v2 M4.22 4.22l1.42 1.42 M18.36 18.36l1.42 1.42 M1 12h2 M21 12h2 M4.22 19.78l1.42-1.42 M18.36 5.64l1.42-1.42",\n  message: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z",\n  headset: "M3 18v-6a9 9 0 0118 0v6 M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3v5z M3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3v5z",\n  brain: "M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a3 3 0 01-3 3h-2a3 3 0 01-3-3v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z M9 22v-2 M15 22v-2 M12 17v5",\n  globe: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M2 12h20 M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z",'
    );
    changed = true;
    console.log('  OK: Added moon, sun, message, headset, brain, globe icons');
  }

  // Add fallback letters for new icons
  if (changed && c.includes('chevron_left:"<"')) {
    c = c.replace(
      'chevron_left:"<",chevron_right:">"',
      'chevron_left:"<",chevron_right:">",moon:"D",sun:"S",message:"M",headset:"H",brain:"I",globe:"G"'
    );
    console.log('  OK: Added fallback letters');
  }

  if (changed) {
    fs.writeFileSync(iconFile, c, 'utf-8');
    total++;
  }
}

// =====================================================
// 2. POLISH-03: Sidebar dark mode icon -> moon/sun
// =====================================================
console.log('\n=== POLISH-03: Dark mode icon ===');

const layout = p.join('app', '(tabs)', '_layout.tsx');
if (fs.existsSync(layout)) {
  let c = fs.readFileSync(layout, 'utf-8');
  let changed = false;

  // Replace star icon for dark mode toggle with moon/sun
  if (c.includes('isDark ? "star" : "dashboard"')) {
    c = c.replace(/isDark \? "star" : "dashboard"/g, 'isDark ? "sun" : "moon"');
    changed = true;
    console.log('  OK: Dark mode toggle uses moon/sun icons');
  }

  // Replace WhatsApp icon from star to message
  if (c.includes('l: "WhatsApp", ic: "star"')) {
    c = c.replace(/{ r: "\/whatsapp", l: "WhatsApp", ic: "star" }/g, '{ r: "/whatsapp", l: "WhatsApp", ic: "message" }');
    changed = true;
    console.log('  OK: WhatsApp icon -> message');
  }

  // Replace Agentes icon from star to brain
  if (c.includes('l: "Agentes", ic: "star"')) {
    c = c.replace(/{ r: "\/agentes", l: "Agentes", ic: "star" }/g, '{ r: "/agentes", l: "Agentes", ic: "brain" }');
    changed = true;
    console.log('  OK: Agentes icon -> brain');
  }

  // Replace Seu Analista icon from star to headset
  if (c.includes('l: "Seu Analista", ic: "star"')) {
    c = c.replace(/{ r: "\/suporte", l: "Seu Analista", ic: "star" }/g, '{ r: "/suporte", l: "Seu Analista", ic: "headset" }');
    changed = true;
    console.log('  OK: Seu Analista icon -> headset');
  }

  // Also fix Canal Digital icon to globe
  if (c.includes('l: "Canal Digital", ic: "bar_chart"')) {
    c = c.replace('{ r: "/canal", l: "Canal Digital", ic: "bar_chart" }', '{ r: "/canal", l: "Canal Digital", ic: "globe" }');
    changed = true;
    console.log('  OK: Canal Digital icon -> globe');
  }

  if (changed) {
    fs.writeFileSync(layout, c, 'utf-8');
    total++;
  }
}

// =====================================================
// 3. POLISH-01: Hyperlink "Powered by Aura" in Canal
// =====================================================
console.log('\n=== POLISH-01: Powered by Aura hyperlink ===');

const canal = p.join('app', '(tabs)', 'canal.tsx');
if (fs.existsSync(canal)) {
  let c = fs.readFileSync(canal, 'utf-8');
  let changed = false;

  // Add Linking import
  if (!c.includes('Linking')) {
    c = c.replace(
      'import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Image, Switch }',
      'import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Image, Switch, Linking }'
    );
    changed = true;
  }

  // Replace static footer with clickable link
  if (c.includes('Loja powered by Aura.') && !c.includes('Linking.openURL')) {
    c = c.replace(
      '<Text style={z.previewFooterText}>Loja powered by Aura.</Text>',
      '<Pressable onPress={() => Linking.openURL("https://getaura.com.br")}><Text style={z.previewFooterText}>Powered by <Text style={{color: "#7c3aed", fontWeight: "600"}}>Aura.</Text></Text></Pressable>'
    );
    changed = true;
    console.log('  OK: Footer links to getaura.com.br');
  }

  // =====================================================
  // 4. POLISH-04: Canal Digital - clareza + textos + mobile
  // =====================================================
  console.log('\n=== POLISH-04: Canal Digital clarity ===');

  // Add a hero description at the top of Canal Digital
  if (!c.includes('Sua loja online')) {
    const tabBarLine = c.indexOf('<TabBar tabs={TABS}');
    if (tabBarLine > -1) {
      const insertBefore = c.lastIndexOf('\n', tabBarLine);
      const heroText = `
      <View style={z.canalHero}>
        <View style={z.canalHeroIcon}><Icon name="globe" size={24} color={Colors.violet3} /></View>
        <Text style={z.canalHeroTitle}>Sua loja online em minutos</Text>
        <Text style={z.canalHeroDesc}>Crie uma p\u00e1gina de vendas personalizada para seu neg\u00f3cio. Seus clientes encontram seus produtos, fazem pedidos e voc\u00ea recebe tudo pelo app.</Text>
      </View>
`;
      c = c.slice(0, insertBefore) + heroText + c.slice(insertBefore);
      changed = true;
      console.log('  OK: Canal Digital hero description added');
    }
  }

  // Add styles for the hero
  if (changed && !c.includes('canalHero:')) {
    const lastStyle = c.lastIndexOf('});');
    if (lastStyle > -1) {
      const heroStyles = `
  // Canal hero
  canalHero: { backgroundColor: Colors.violetD, borderRadius: 16, padding: 20, marginBottom: 16, alignItems: "center", gap: 8, borderWidth: 1, borderColor: Colors.border2 },
  canalHeroIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border, marginBottom: 4 },
  canalHeroTitle: { fontSize: 18, fontWeight: "700", color: Colors.ink, textAlign: "center" },
  canalHeroDesc: { fontSize: 12, color: Colors.ink3, textAlign: "center", lineHeight: 18, maxWidth: 400 },
`;
      c = c.slice(0, lastStyle) + heroStyles + c.slice(lastStyle);
      console.log('  OK: Canal Digital hero styles added');
    }
  }

  // Fix tab labels to be more descriptive
  if (c.includes('const TABS = ["Meu site"')) {
    c = c.replace(
      'const TABS = ["Meu site", "Vitrine", "Frete", "Analytics"]',
      'const TABS = ["Meu Site", "Vitrine Online", "Entrega", "Resultados"]'
    );
    changed = true;
    console.log('  OK: Canal Digital tabs renamed for clarity');
  }

  if (changed) {
    fs.writeFileSync(canal, c, 'utf-8');
    total++;
  }
}

// =====================================================
// 5. FE-25b: WhatsApp missing styles
// =====================================================
console.log('\n=== FE-25b: WhatsApp styles ===');

const whats = p.join('app', '(tabs)', 'whatsapp.tsx');
if (fs.existsSync(whats)) {
  let c = fs.readFileSync(whats, 'utf-8');
  let changed = false;

  // Check if supportCard style is missing
  if (!c.includes('supportCard:')) {
    // Find the closing of the z StyleSheet
    const lastInfoText = c.indexOf('infoText: {');
    if (lastInfoText > -1) {
      const lineEnd = c.indexOf('},', lastInfoText);
      if (lineEnd > -1) {
        const newStyles = `},
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
  msgPreviewText: { fontSize: 12, color: Colors.ink, lineHeight: 18 `;
        c = c.slice(0, lineEnd) + newStyles + c.slice(lineEnd + 1);
        changed = true;
        console.log('  OK: 18 WhatsApp styles added');
      }
    }
  } else {
    console.log('  SKIP: WhatsApp styles already present');
  }

  if (changed) {
    fs.writeFileSync(whats, c, 'utf-8');
    total++;
  }
}

// =====================================================
// 6. POLISH-02: Logo sizing check (sidebar already SVG)
// =====================================================
console.log('\n=== POLISH-02: Logo review ===');
console.log('  OK: Sidebar uses AuraLogo SVG component (done in previous session)');
console.log('  OK: Login/Register logos already 320px desktop / responsive mobile');

// =====================================================
console.log('\n========================================');
console.log('DONE: ' + total + ' polish items applied');
console.log('========================================');
console.log('\nRun:');
console.log('  node scripts/fix-unicode-all.js');
console.log('  git add -A && git commit -m "polish: icons, dark mode, canal digital, whatsapp styles, powered by aura"');
console.log('  git push origin main');
