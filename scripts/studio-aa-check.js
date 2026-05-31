function hexToRgb(h){h=h.replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
function parse(c){const m=c.match(/rgba?\(([^)]+)\)/);if(m){const p=m[1].split(',').map(s=>parseFloat(s.trim()));return {r:p[0],g:p[1],b:p[2],a:p[3]??1};}const [r,g,b]=hexToRgb(c);return {r,g,b,a:1};}
function over(fg,bg){const a=fg.a;return {r:fg.r*a+bg.r*(1-a),g:fg.g*a+bg.g*(1-a),b:fg.b*a+bg.b*(1-a),a:1};}
function lum({r,g,b}){const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b);}
function ratio(c1,c2){const L1=lum(c1),L2=lum(c2);const a=Math.max(L1,L2),b=Math.min(L1,L2);return (a+0.05)/(b+0.05);}
function R(fg,bg,under){let bgC=parse(bg); if(under)bgC=over(parse(bg),parse(under)); const fgC=over(parse(fg),bgC); return ratio(fgC,bgC);}

// ===== DARK (principal) =====
const D={ bg:"#0F172A", card:"#1E293B", cardElev:"#334155",
  ink:"#F8FAFC", ink2:"#CBD5E1", ink3:"#94A3B8" };
// ===== LIGHT =====
const L={ bg:"#E8E9F0", card:"#F5F6FA", cardElev:"#FFFFFF",
  ink:"#0F172A", ink2:"#334155", ink3:"#5E6A7A" };

// Semantic candidate: {base, softA(alpha over card), ink}
const SEM_DARK={
  waiting:   {base:"#FBBF24", soft:"rgba(251,191,36,0.18)", ink:"#FCD34D"},
  art:       {base:"#FB923C", soft:"rgba(251,146,60,0.18)", ink:"#FDBA74"},
  approved:  {base:"#34D399", soft:"rgba(52,211,153,0.18)", ink:"#6EE7B7"},
  production:{base:"#60A5FA", soft:"rgba(96,165,250,0.18)", ink:"#93C5FD"},
  ready:     {base:"#2DD4BF", soft:"rgba(45,212,191,0.18)", ink:"#5EEAD4"},
  delivered: {base:"#94A3B8", soft:"rgba(148,163,184,0.16)", ink:"#CBD5E1"},
  danger:    {base:"#F87171", soft:"rgba(248,113,113,0.18)", ink:"#FCA5A5"},
  changes:   {base:"#FB7185", soft:"rgba(251,113,133,0.18)", ink:"#FDA4AF"},
};
const SEM_LIGHT={
  waiting:   {base:"#B45309", soft:"#FEF3C7", ink:"#92400E"},
  art:       {base:"#EA580C", soft:"#FFEDD5", ink:"#9A3412"},
  approved:  {base:"#059669", soft:"#D1FAE5", ink:"#065F46"},
  production:{base:"#2563EB", soft:"#DBEAFE", ink:"#1E40AF"},
  ready:     {base:"#0D9488", soft:"#CCFBF1", ink:"#115E59"},
  delivered: {base:"#64748B", soft:"#F1F5F9", ink:"#475569"},
  danger:    {base:"#DC2626", soft:"#FEE2E2", ink:"#991B1B"},
  changes:   {base:"#E11D48", soft:"#FFE4E6", ink:"#9F1239"},
};

let fails=0;
function check(name, fg, bg, under, min, label){ const r=R(fg,bg,under); const ok=r>=min; if(!ok)fails++; console.log(`${ok?'PASS':'FAIL'} ${r.toFixed(2)} (min ${min}) ${name} ${label}`);}

for(const [mode,T,SEM] of [["DARK",D,SEM_DARK],["LIGHT",L,SEM_LIGHT]]){
  console.log(`\n===== ${mode} =====`);
  // text tokens on surfaces
  check(`${mode} ink/card`, T.ink, T.card, null,4.5,"body");
  check(`${mode} ink2/card`, T.ink2, T.card, null,4.5,"body");
  check(`${mode} ink3/card`, T.ink3, T.card, null,4.5,"muted");
  check(`${mode} ink/bg`, T.ink, T.bg, null,4.5,"body");
  // semantic: ink on soft(over card), base on card
  for(const k of Object.keys(SEM)){
    const s=SEM[k];
    check(`${mode} ${k} ink/soft`, s.ink, s.soft, T.card, 4.5, "chip text");
    check(`${mode} ${k} base/card`, s.base, T.card, null, 3.0, "dot/icon");
  }
}
console.log(`\n${fails===0?'ALL PASS ✓':fails+' FAILURES'}`);
