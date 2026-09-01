// ============================================================
// AURA. — Gaveta de notificações (slide da direita)
// Criado: 13/06/2026
//
// Web:    position:fixed overlay + painel deslizante via CSS transition
// Native: Modal com Animated.spring
// Banners HTML renderizados via <iframe srcDoc> (web) — conteúdo admin = trusted
// 16/06/2026: banner escalonado (BannerFrame) — a peça 3:2 de tamanho fixo
//   (1080x720) é renderizada no tamanho nativo e reduzida via transform:scale
//   pra caber na largura do card, sem corte e sem altura fixa.
// 17/06/2026: drawer web mais largo (440) pra o banner respirar; rótulo
//   "NOVIDADES" (antes "ENDOMARKETING", termo interno). Nativo mantém 380.
//
// 01/09/2026 — de lista de pedidos para FEED DE EVENTOS da loja.
//   A gaveta antiga era uma lista plana de pedidos das últimas 24h. Com os
//   eventos `loja_*` (pago, comprovante enviado, PIX expirado, entregue,
//   estoque baixo, loja sem meio de pagamento) uma loja movimentada vira um
//   paredão. Três cortes resolvem isso:
//
//   1. "Precisa de você" no topo — só o que exige mão humana e ainda está
//      aberto. Resolveu, desce pro dia. O resto é histórico, não fila.
//   2. Resto fatiado por dia (Hoje / Ontem / dd/mm), com corte em 8 cards e
//      "Mostrar mais"; dentro do dia, 2+ eventos do MESMO pedido colapsam
//      num card só (acordeão) — 200 pedidos/dia não viram 600 linhas.
//   3. Severidade legível SEM DEPENDER DE COR: faixa lateral cheia (crítico),
//      tracejada (atenção), ausente (info) + ícone próprio por tipo + selo
//      textual "Crítico"/"Ação". Daltonismo e modo claro continuam lendo.
//
//   Preferências ficam AQUI dentro (engrenagem no cabeçalho), não em tela
//   nova — ver components/NotificationPrefs.tsx.
//   Mockup: docs/mockups/sino-de-eventos-da-loja.html
// ============================================================
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, Pressable, ScrollView, Animated, Modal,
  Platform, StyleSheet, Linking,
} from 'react-native';
import { useColors } from '@/constants/colors';
import { AppBanner } from '@/services/notificationsApi';
import {
  Feed, FeedItem, StoreEvent, EventIcon, AccentToken,
  visualForEvent, severityLabel, relTime,
} from '@/components/notificationEventModel';
import { NotificationPrefs } from '@/components/NotificationPrefs';
import { useRouter } from 'expo-router';

type DrawerView = 'feed' | 'prefs';

interface Props {
  feed:           Feed;
  banners:        AppBanner[];
  onClose:        () => void;
  markBannerRead: (id: string) => void;
  markEventRead:  (id: string) => void;
  markAllRead:    () => void;
  prefs:          Record<string, boolean>;
  prefsAllMuted:  boolean;
  savePrefs:      (next: Record<string, boolean>) => void;
}

interface InnerProps extends Props {
  view:    DrawerView;
  setView: (v: DrawerView) => void;
}

// Quantos cards de um dia aparecem antes do "Mostrar mais".
const CORTE_POR_DIA = 8;

// 01/09/2026: nenhuma animação é essencial aqui — quem pediu movimento
// reduzido recebe a gaveta já posicionada, sem transição.
function prefersReducedMotion(): boolean {
  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  } catch (_) { /* matchMedia indisponível */ }
  return false;
}

// ---------- Ícones ----------
// Traço, 24x24, mesma gramática do resto do app. `stroke` recebe a cor de
// acento já resolvida pelo tema.
const ICON_PATHS: Record<EventIcon, string[]> = {
  alerta:      ['M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', 'M12 9v4', 'M12 17h.01'],
  comprovante: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M9 15l2 2 4-4'],
  dinheiro:    ['M12 1v22', 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'],
  check:       ['M20 6 9 17l-5-5'],
  sacola:      ['M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z', 'M3 6h18', 'M16 10a4 4 0 0 1-8 0'],
  caminhao:    ['M1 3h15v13H1z', 'M16 8h4l3 3v5h-7z', 'M5.5 18.5a2 2 0 1 0 0-.1', 'M18.5 18.5a2 2 0 1 0 0-.1'],
  relogio:     ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3 2'],
  caixa:       ['M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z', 'M3.27 6.96 12 12l8.73-5.04', 'M12 22.08V12'],
  x:           ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M15 9l-6 6', 'M9 9l6 6'],
  sino:        ['M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9', 'M13.73 21a2 2 0 0 1-3.46 0'],
};

function EventIconSVG({ icon, color, size = 15 }: { icon: EventIcon; color: string; size?: number }) {
  if (Platform.OS !== 'web') return null;
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[icon].map((d, i) => <path key={i} d={d} />)}
    </svg>
  ) as any;
}

function UiIcon({ paths, color, size = 16 }: { paths: string[]; color: string; size?: number }) {
  if (Platform.OS !== 'web') return null;
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  ) as any;
}

const ICON_ENGRENAGEM = [
  'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
];
const ICON_VOLTAR = ['M15 18 9 12l6-6'];
const ICON_FECHAR = ['M18 6 6 18', 'M6 6l12 12'];
const ICON_CHEVRON = ['M6 9l6 6 6-6'];

// ---------- Cores por acento ----------
function accentColor(a: AccentToken, C: any): string {
  if (a === 'red')    return C.red;
  if (a === 'amber')  return C.amber;
  if (a === 'green')  return C.green;
  if (a === 'ink3')   return C.ink3;
  return C.violet ?? '#7c3aed';
}
function accentSoft(a: AccentToken, C: any): string | undefined {
  if (a === 'red')   return C.redD;
  if (a === 'amber') return C.amberD;
  if (a === 'green') return C.greenD;
  return undefined;
}

// ---------- Card de evento ----------
function EventCard({
  item, C, onOpen, onExpandir, expandido,
}: {
  item:       FeedItem;
  C:          any;
  onOpen:     (ev: StoreEvent) => void;
  onExpandir: (key: string) => void;
  expandido:  boolean;
}) {
  const ev   = item.event;
  const v    = visualForEvent(ev);
  const cor  = accentColor(v.accent, C);
  const selo = severityLabel(v.severity);
  const soft = v.severity === 'info' ? undefined : accentSoft(v.accent, C);
  const naoLido = item.unread > 0;

  const titulo = item.grouped ? item.label : (ev.title || v.label);
  const sub    = item.grouped
    ? `${item.events.length} eventos · ${relTime(ev.created_at)}`
    : ev.body;

  // ── Nativo ──
  if (Platform.OS !== 'web') {
    return (
      <View style={{ marginBottom: 7 }}>
        <Pressable
          onPress={() => (item.grouped ? onExpandir(item.key) : onOpen(ev))}
          accessibilityRole="button"
          accessibilityLabel={[selo, titulo, sub].filter(Boolean).join('. ')}
          style={[
            styles.evCard,
            { borderColor: v.severity === 'critico' ? cor : C.border, backgroundColor: soft || C.bg3 },
          ]}
        >
          {v.severity !== 'info' && (
            <View style={[styles.faixa, { backgroundColor: cor, opacity: v.severity === 'critico' ? 1 : 0.55 }]} />
          )}
          <Text style={{ fontSize: 15 }}>{v.glyph}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: v.severity === 'info' ? '600' : '800', color: C.ink }}>
              {titulo}
            </Text>
            {selo && (
              <Text style={{ fontSize: 10, fontWeight: '800', color: cor, marginTop: 2 }}>
                {selo.toUpperCase()}
              </Text>
            )}
            {!!sub && <Text style={{ fontSize: 11, color: C.ink3, marginTop: 2 }}>{sub}</Text>}
          </View>
          <Text style={{ fontSize: 10.5, color: C.ink3 }}>{relTime(ev.created_at)}</Text>
          {naoLido && <View style={[styles.pontoNaoLido, { backgroundColor: cor }]} />}
        </Pressable>
        {item.grouped && expandido && item.events.map(sub2 => (
          <Pressable
            key={sub2.id}
            onPress={() => onOpen(sub2)}
            style={[styles.subItem, { borderColor: C.border }]}
          >
            <Text style={{ fontSize: 12.5, color: C.ink, flex: 1 }}>{visualForEvent(sub2).label}</Text>
            <Text style={{ fontSize: 10.5, color: C.ink3 }}>{relTime(sub2.created_at)}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  // ── Web ──
  return (
    <div style={{
      border:       `1px solid ${v.severity === 'critico' ? cor : C.border}`,
      borderRadius: 11,
      background:   soft || C.bg3,
      marginBottom: 7,
      overflow:     'hidden',
    } as any}>
      <button
        type="button"
        onClick={() => (item.grouped ? onExpandir(item.key) : onOpen(ev))}
        aria-expanded={item.grouped ? expandido : undefined}
        style={{
          position:   'relative',
          display:    'flex',
          gap:        10,
          width:      '100%',
          minHeight:  56,
          padding:    '11px 12px 11px 14px',
          border:     'none',
          background: 'transparent',
          color:      'inherit',
          font:       'inherit',
          textAlign:  'left',
          cursor:     'pointer',
        } as any}
      >
        {/* Faixa de severidade — FORMA: cheia (crítico) x tracejada (atenção) */}
        {v.severity !== 'info' && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute', left: 0, top: 8, bottom: 8, width: 4,
              borderRadius: '0 3px 3px 0',
              background: v.severity === 'critico'
                ? cor
                : `repeating-linear-gradient(180deg, ${cor} 0 5px, transparent 5px 10px)`,
            } as any}
          />
        )}
        <span style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `1px solid ${C.border}`, background: C.bg4,
        } as any}>
          <EventIconSVG icon={v.icon} color={cor} />
        </span>

        <span style={{ flex: 1, minWidth: 0 } as any}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 7 } as any}>
            <span style={{
              fontSize: 13, color: C.ink,
              fontWeight: v.severity === 'info' ? 700 : 800,
            } as any}>{titulo}</span>
            <span style={{ marginLeft: 'auto', fontSize: 10.5, color: C.ink3, flexShrink: 0 } as any}>
              {relTime(ev.created_at)}
            </span>
          </span>
          {(selo || sub) && (
            <span style={{ display: 'block', fontSize: 11.5, color: C.ink2 ?? C.ink3, marginTop: 3, lineHeight: 1.4 } as any}>
              {selo && (
                <span style={{
                  display: 'inline-block', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em',
                  textTransform: 'uppercase', padding: '1px 6px', borderRadius: 5,
                  border: `1px solid ${cor}`, color: cor, marginRight: 6,
                } as any}>{selo}</span>
              )}
              {sub}
            </span>
          )}
          {!item.grouped && v.ctaLabel && (ev.cta_route || v.fallbackRoute) && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', marginTop: 8,
              minHeight: 36, padding: '8px 12px', borderRadius: 8,
              background: '#7c3aed', color: '#fff', fontSize: 11.5, fontWeight: 700,
            } as any}>{v.ctaLabel}</span>
          )}
        </span>

        {item.grouped && (
          <span style={{
            display: 'flex', alignItems: 'center', flexShrink: 0,
            transform: expandido ? 'rotate(180deg)' : undefined,
          } as any}>
            <UiIcon paths={ICON_CHEVRON} color={C.ink3} size={15} />
          </span>
        )}
        {naoLido && (
          <span
            aria-label="não lido"
            style={{ width: 7, height: 7, borderRadius: 4, background: cor, flexShrink: 0, alignSelf: 'center' } as any}
          />
        )}
      </button>

      {item.grouped && expandido && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '4px 0' } as any}>
          {item.events.map(sub2 => {
            const vs = visualForEvent(sub2);
            return (
              <button
                key={sub2.id}
                type="button"
                onClick={() => onOpen(sub2)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                  minHeight: 44, padding: '8px 12px 8px 14px',
                  border: 'none', background: 'transparent', color: 'inherit',
                  font: 'inherit', textAlign: 'left', cursor: 'pointer',
                } as any}
              >
                <span style={{
                  width: 7, height: 7, borderRadius: 4, flexShrink: 0,
                  background: accentColor(vs.accent, C),
                } as any} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: C.ink, flex: 1 } as any}>{vs.label}</span>
                <span style={{ fontSize: 10.5, color: C.ink3 } as any}>{relTime(sub2.created_at)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- Cabeçalho de seção ----------
function SectionHead({ label, count, destaque, C }: { label: string; count?: number; destaque?: boolean; C: any }) {
  const cor = destaque ? C.amber : C.ink3;
  if (Platform.OS !== 'web') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 9 }}>
        <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 1.1, color: cor }}>
          {label.toUpperCase()}
        </Text>
        {!!count && (
          <Text style={{ fontSize: 10, fontWeight: '800', color: cor }}>({count})</Text>
        )}
      </View>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '16px 2px 9px' } as any}>
      <span style={{
        fontSize: 10.5, fontWeight: 800, letterSpacing: '0.11em',
        textTransform: 'uppercase', color: cor,
      } as any}>{label}</span>
      {!!count && (
        <span style={{
          fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999,
          border: `1px solid ${cor}`, color: cor,
        } as any}>{count}</span>
      )}
      <span style={{ flex: 1, height: 1, background: C.border } as any} />
    </div>
  );
}

// Largura nativa do canvas padrao das pecas de endomarketing (3:2 = 1080x720).
// O HTML do banner vem com tamanho fixo (1080px); renderizamos no tamanho nativo
// e escalamos via transform pra largura do card, mantendo nitidez e proporcao.
const BANNER_BASE_W = 1080;

// ---------- Frame escalonado do banner (web) ----------
// O iframe srcDoc e isolado (sandbox), entao nao da pra medir/ajustar o conteudo
// por dentro. Solucao: iframe no tamanho nativo (1080x720) + transform: scale()
// pra caber na largura disponivel. ResizeObserver re-escala em desktop/mobile.
function BannerFrame({ html, title }: { html: string; title: string }) {
  const wrapRef = useRef<any>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / BANNER_BASE_W);
    update();
    let ro: any = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      ro.observe(el);
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', update);
    }
    return () => {
      if (ro) ro.disconnect();
      else if (typeof window !== 'undefined') window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <div ref={wrapRef} style={{ width: '100%', aspectRatio: '3 / 2', overflow: 'hidden', position: 'relative' } as any}>
      <iframe
        srcDoc={html}
        sandbox="allow-scripts"
        title={title}
        scrolling="no"
        style={{
          width:           BANNER_BASE_W,
          height:          BANNER_BASE_W * 2 / 3,
          border:          'none',
          display:         'block',
          transformOrigin: 'top left',
          transform:       `scale(${scale || 0.0001})`,
        } as any}
      />
    </div>
  );
}

// ---------- Card de banner ----------
function BannerCard({ b, onDismiss, C, router }: { b: AppBanner; onDismiss: () => void; C: any; router: any }) {
  const handleCta = useCallback(() => {
    if (b.cta_route) {
      router?.push(b.cta_route as any);
      onDismiss();
    } else if (b.cta_url) {
      Linking.openURL(b.cta_url).catch(() => {});
    }
  }, [b, router, onDismiss]);

  if (Platform.OS !== 'web') {
    return (
      <View style={[styles.bannerCard, { backgroundColor: C.bg3, borderColor: C.border2 ?? C.border }]}>
        <View style={styles.bannerHeader}>
          <Text style={{ color: C.ink, fontSize: 14, fontWeight: '700', flex: 1 }}>{b.title}</Text>
          <Pressable onPress={onDismiss} hitSlop={12} accessibilityLabel="Dispensar novidade">
            <Text style={{ color: C.ink3, fontSize: 18, lineHeight: 18 }}>×</Text>
          </Pressable>
        </View>
        {b.body && <Text style={{ color: C.ink3, fontSize: 12, marginHorizontal: 14, marginBottom: 8 }}>{b.body}</Text>}
        {(b.cta_label && (b.cta_route || b.cta_url)) && (
          <Pressable onPress={handleCta} style={[styles.ctaBtn, { backgroundColor: '#7c3aed' }]}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{b.cta_label}</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <div style={{
      borderRadius: 12,
      border:       `1px solid ${C.border2 ?? C.border}`,
      overflow:     'hidden',
      marginBottom: 10,
      position:     'relative',
    } as any}>
      {/* Botão fechar */}
      <button
        onClick={onDismiss}
        aria-label="Dispensar novidade"
        style={{
          position:       'absolute',
          top:            8, right: 8,
          zIndex:         10,
          width:          32, height: 32,
          borderRadius:   16,
          background:     'rgba(0,0,0,0.45)',
          border:         'none',
          color:          '#fff',
          fontSize:       16,
          cursor:         'pointer',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
        } as any}
      >×</button>

      {b.html_content ? (
        <BannerFrame html={b.html_content} title={b.title} />
      ) : (
        <div style={{ padding: '16px 14px', background: C.bg3 } as any}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.ink } as any}>{b.title}</div>
          {b.body && <div style={{ fontSize: 12, color: C.ink3, marginTop: 4 } as any}>{b.body}</div>}
        </div>
      )}

      {(b.cta_label && (b.cta_route || b.cta_url)) && (
        <div style={{ padding: '8px 14px 12px', background: C.bg3 } as any}>
          <button
            onClick={handleCta}
            style={{
              minHeight:    40,
              padding:      '8px 16px',
              borderRadius: 8,
              background:   'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              border:       'none',
              color:        '#fff',
              fontSize:     13,
              fontWeight:   700,
              cursor:       'pointer',
            } as any}
          >{b.cta_label}</button>
        </div>
      )}
    </div>
  );
}

// ---------- Estado vazio ----------
// 01/09/2026: o padrão antigo era "🔔 Nenhuma notificação" — texto que aponta.
// Agora sai daqui com botão que faz: vai pros pedidos ou abre as preferências.
function EmptyState({ C, allMuted, onPedidos, onPrefs }: {
  C: any; allMuted: boolean; onPedidos: () => void; onPrefs: () => void;
}) {
  const titulo = allMuted ? 'Seus avisos estão desligados' : 'Nada pendente por aqui';
  const texto  = allMuted
    ? 'Você desligou os avisos da loja, então nada chega aqui — nem pagamento confirmado, nem estoque no fim.'
    : 'Nenhum pedido, pagamento ou aviso da loja esperando você. Quando algo acontecer na vitrine, aparece aqui na hora.';
  const rotuloPrefs = allMuted ? 'Reativar meus avisos' : 'Escolher o que me avisa';

  if (Platform.OS !== 'web') {
    return (
      <View style={{ paddingVertical: 48, paddingHorizontal: 16 }}>
        <Text style={{ fontSize: 28, textAlign: 'center', marginBottom: 12 }}>{allMuted ? '🔕' : '✅'}</Text>
        <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink, textAlign: 'center', marginBottom: 6 }}>{titulo}</Text>
        <Text style={{ fontSize: 12.5, color: C.ink3, textAlign: 'center', marginBottom: 18 }}>{texto}</Text>
        <Pressable onPress={onPedidos} style={[styles.btnPrimario, { backgroundColor: '#7c3aed' }]}>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Ver pedidos da loja</Text>
        </Pressable>
        <Pressable onPress={onPrefs} style={[styles.btnSecundario, { borderColor: C.border2 ?? C.border }]}>
          <Text style={{ color: C.ink2 ?? C.ink, fontSize: 13, fontWeight: '600' }}>{rotuloPrefs}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <div style={{ padding: '56px 22px', textAlign: 'center' } as any}>
      <div style={{
        width: 56, height: 56, margin: '0 auto 14px', borderRadius: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: allMuted ? C.bg4 : C.greenD,
        border: `1px solid ${allMuted ? C.border : C.green}`,
      } as any}>
        <UiIcon
          paths={allMuted ? ICON_PATHS.sino : ICON_PATHS.check}
          color={allMuted ? C.ink3 : C.green}
          size={26}
        />
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 6 } as any}>{titulo}</div>
      <div style={{ fontSize: 12.5, color: C.ink3, lineHeight: 1.5, marginBottom: 18 } as any}>{texto}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 } as any}>
        <button
          type="button"
          onClick={onPedidos}
          style={{
            minHeight: 44, borderRadius: 10, border: 'none', background: '#7c3aed',
            color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          } as any}
        >Ver pedidos da loja</button>
        <button
          type="button"
          onClick={onPrefs}
          style={{
            minHeight: 44, borderRadius: 10, border: `1px solid ${C.border2 ?? C.border}`,
            background: 'transparent', color: C.ink2 ?? C.ink, fontSize: 13,
            fontWeight: 600, cursor: 'pointer',
          } as any}
        >{rotuloPrefs}</button>
      </div>
    </div>
  );
}

// ---------- Corpo compartilhado (lista de eventos) ----------
function useFeedBody(props: InnerProps) {
  const router = useRouter();
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});
  const [diasAbertos, setDiasAbertos] = useState<Record<string, boolean>>({});

  const abrirEvento = useCallback((ev: StoreEvent) => {
    props.markEventRead(ev.id);
    const v = visualForEvent(ev);
    const rota = ev.cta_route || v.fallbackRoute;
    if (rota) {
      try { router?.push(rota as any); } catch (_) { /* rota inválida — não derruba a gaveta */ }
      props.onClose();
    }
  }, [props, router]);

  const irPara = useCallback((rota: string) => {
    try { router?.push(rota as any); } catch (_) {}
    props.onClose();
  }, [props, router]);

  const alternarGrupo = useCallback((key: string) => {
    setExpandidos(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const alternarDia = useCallback((key: string) => {
    setDiasAbertos(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  return { router, expandidos, diasAbertos, abrirEvento, irPara, alternarGrupo, alternarDia };
}

function FeedBody(props: InnerProps) {
  const C = useColors();
  const { router, expandidos, diasAbertos, abrirEvento, irPara, alternarGrupo, alternarDia } = useFeedBody(props);
  const { feed, banners } = props;

  const vazio = feed.acoes.length === 0 && banners.length === 0 && feed.dias.length === 0;

  if (vazio) {
    return (
      <EmptyState
        C={C}
        allMuted={props.prefsAllMuted}
        onPedidos={() => irPara('/canal')}
        onPrefs={() => props.setView('prefs')}
      />
    );
  }

  const cards = (items: FeedItem[]) => items.map(item => (
    <EventCard
      key={item.key}
      item={item}
      C={C}
      onOpen={abrirEvento}
      onExpandir={alternarGrupo}
      expandido={!!expandidos[item.key]}
    />
  ));

  return (
    <>
      {feed.acoes.length > 0 && (
        <>
          <SectionHead label="Precisa de você" count={feed.acoes.length} destaque C={C} />
          {cards(feed.acoes)}
        </>
      )}

      {banners.length > 0 && (
        <>
          <SectionHead label="Novidades" C={C} />
          {banners.map(b => (
            <BannerCard
              key={b.id}
              b={b}
              C={C}
              router={router}
              onDismiss={() => props.markBannerRead(b.id)}
            />
          ))}
        </>
      )}

      {feed.dias.map(sec => {
        const aberto  = !!diasAbertos[sec.key];
        const visiveis = aberto ? sec.items : sec.items.slice(0, CORTE_POR_DIA);
        const resto    = sec.items.length - visiveis.length;
        return (
          <View key={sec.key}>
            <SectionHead label={sec.label} C={C} />
            {cards(visiveis)}
            {resto > 0 && (
              Platform.OS === 'web' ? (
                <button
                  type="button"
                  onClick={() => alternarDia(sec.key)}
                  style={{
                    width: '100%', minHeight: 44, marginTop: 4, borderRadius: 9,
                    border: `1px dashed ${C.border2}`, background: 'transparent',
                    color: C.violet ?? '#7c3aed', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  } as any}
                >{`Mostrar mais ${resto} de ${sec.label.toLowerCase()}`}</button>
              ) : (
                <Pressable onPress={() => alternarDia(sec.key)} style={[styles.btnMais, { borderColor: C.border2 }]}>
                  <Text style={{ color: C.violet ?? '#7c3aed', fontSize: 12, fontWeight: '700' }}>
                    {`Mostrar mais ${resto}`}
                  </Text>
                </Pressable>
              )
            )}
          </View>
        );
      })}
    </>
  );
}

// ---------- Conteúdo do drawer (web) ----------
function DrawerContent(props: InnerProps) {
  const C = useColors();
  const emPrefs = props.view === 'prefs';
  const temAlgoParaLer = useMemo(
    () => props.banners.length > 0 || props.feed.unreadCount > 0,
    [props.banners.length, props.feed.unreadCount]
  );

  // 40px de alvo — cabeçalho denso, mas dedo em celular precisa acertar.
  const btnIcone = {
    width:          40,
    height:         40,
    borderRadius:   9,
    border:         `1px solid ${C.border}`,
    background:     C.bg3,
    color:          C.ink3,
    cursor:         'pointer',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  } as any;

  return (
    <>
      <div style={{
        display:      'flex',
        alignItems:   'center',
        gap:          8,
        padding:      '14px 14px 12px',
        borderBottom: `1px solid ${C.border}`,
        flexShrink:   0,
      } as any}>
        {emPrefs && (
          <button type="button" onClick={() => props.setView('feed')} aria-label="Voltar" title="Voltar" style={btnIcone}>
            <UiIcon paths={ICON_VOLTAR} color={C.ink3} />
          </button>
        )}
        <span style={{
          flex: 1, minWidth: 0, fontSize: 16, fontWeight: 700, color: C.ink,
          letterSpacing: '-0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        } as any}>
          {emPrefs ? 'O que me avisa' : 'Notificações'}
        </span>
        {!emPrefs && temAlgoParaLer && (
          <button
            type="button"
            onClick={props.markAllRead}
            style={{
              minHeight:    40,
              padding:      '6px 10px',
              borderRadius: 8,
              border:       `1px solid ${C.border}`,
              background:   'transparent',
              color:        C.violet,
              fontSize:     11.5,
              fontWeight:   700,
              cursor:       'pointer',
              flexShrink:   0,
              whiteSpace:   'nowrap',
            } as any}
          >Marcar tudo lido</button>
        )}
        {!emPrefs && (
          <button
            type="button"
            onClick={() => props.setView('prefs')}
            aria-label="Preferências de notificação"
            title="Preferências"
            style={btnIcone}
          >
            <UiIcon paths={ICON_ENGRENAGEM} color={C.ink3} size={17} />
          </button>
        )}
        <button type="button" onClick={props.onClose} aria-label="Fechar" title="Fechar" style={btnIcone}>
          <UiIcon paths={ICON_FECHAR} color={C.ink3} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px 24px' } as any}>
        {emPrefs
          ? <NotificationPrefs prefs={props.prefs} onChange={props.savePrefs} />
          : <FeedBody {...props} />}
      </div>
    </>
  );
}

// ---------- Web ----------
const DRAWER_W = 380;       // nativo (phone) — largura segura
const DRAWER_W_WEB = 440;   // web — mais largo pra o banner respirar (cap 95vw)

function DrawerWeb(props: InnerProps) {
  const C = useColors();
  const [visible, setVisible] = useState(false);
  const semAnimacao = useRef(prefersReducedMotion()).current;

  useEffect(() => {
    if (semAnimacao) { setVisible(true); return; }
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, [semAnimacao]);

  const handleClose = () => {
    if (semAnimacao) { props.onClose(); return; }
    setVisible(false);
    setTimeout(props.onClose, 260);
  };

  return (
    <>
      <div
        onClick={handleClose}
        style={{
          position:   'fixed',
          inset:      0,
          zIndex:     1000,
          background: 'rgba(0,0,0,0.35)',
          opacity:    visible ? 1 : 0,
          transition: semAnimacao ? undefined : 'opacity 0.25s ease',
        } as any}
      />
      <div
        role="dialog"
        aria-label="Notificações"
        style={{
          position:      'fixed',
          top:           0, right: 0, bottom: 0,
          width:         DRAWER_W_WEB,
          maxWidth:      '95vw',
          zIndex:        1001,
          display:       'flex',
          flexDirection: 'column',
          background:    C.bg2,
          borderLeft:    `1px solid ${C.border}`,
          boxShadow:     '-12px 0 40px rgba(0,0,0,0.18)',
          transform:     visible ? 'translateX(0)' : `translateX(${DRAWER_W_WEB}px)`,
          transition:    semAnimacao ? undefined : 'transform 0.26s cubic-bezier(0.4, 0, 0.2, 1)',
          willChange:    'transform',
        } as any}
      >
        <DrawerContent {...props} onClose={handleClose} />
      </div>
    </>
  );
}

// ---------- Native ----------
function DrawerNative(props: InnerProps) {
  const C       = useColors();
  const slideX  = useRef(new Animated.Value(DRAWER_W)).current;
  const emPrefs = props.view === 'prefs';

  useEffect(() => {
    Animated.spring(slideX, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
  }, []);

  const handleClose = () => {
    Animated.timing(slideX, { toValue: DRAWER_W, duration: 220, useNativeDriver: true }).start(props.onClose);
  };

  const temAlgoParaLer = props.banners.length > 0 || props.feed.unreadCount > 0;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <Animated.View style={[
        styles.nativePanel,
        { backgroundColor: C.bg2, transform: [{ translateX: slideX }] },
      ]}>
        <View style={[styles.nativeHeader, { borderBottomColor: C.border }]}>
          {emPrefs && (
            <Pressable onPress={() => props.setView('feed')} hitSlop={12} accessibilityLabel="Voltar">
              <Text style={{ fontSize: 20, color: C.ink3, marginRight: 8 }}>‹</Text>
            </Pressable>
          )}
          <Text style={[styles.headerTitle, { color: C.ink, flex: 1 }]}>
            {emPrefs ? 'O que me avisa' : 'Notificações'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {!emPrefs && temAlgoParaLer && (
              <Pressable onPress={props.markAllRead} hitSlop={12}>
                <Text style={{ color: '#7c3aed', fontSize: 12, fontWeight: '600' }}>Marcar tudo lido</Text>
              </Pressable>
            )}
            {!emPrefs && (
              <Pressable onPress={() => props.setView('prefs')} hitSlop={12} accessibilityLabel="Preferências de notificação">
                <Text style={{ fontSize: 16, color: C.ink3 }}>⚙</Text>
              </Pressable>
            )}
            <Pressable onPress={handleClose} hitSlop={12} accessibilityLabel="Fechar">
              <Text style={{ fontSize: 20, color: C.ink3 }}>×</Text>
            </Pressable>
          </View>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          {emPrefs
            ? <NotificationPrefs prefs={props.prefs} onChange={props.savePrefs} />
            : <FeedBody {...props} onClose={handleClose} />}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ---------- Export ----------
export function NotificationDrawer(props: Props) {
  const [view, setView] = useState<DrawerView>('feed');
  const inner: InnerProps = { ...props, view, setView };
  if (Platform.OS !== 'web') return <DrawerNative {...inner} />;
  return <DrawerWeb {...inner} />;
}

const styles = StyleSheet.create({
  backdrop: {
    position:        'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  } as any,
  nativePanel: {
    position:  'absolute',
    top: 0, right: 0, bottom: 0,
    width:     DRAWER_W,
    shadowColor:    '#000',
    shadowOpacity:  0.2,
    shadowRadius:   20,
    elevation:      12,
  } as any,
  nativeHeader: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    padding:          18,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize:   16,
    fontWeight: '700',
  },
  evCard: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
    minHeight:     56,
    padding:       12,
    paddingLeft:   16,
    borderRadius:  11,
    borderWidth:   1,
    overflow:      'hidden',
  },
  faixa: {
    position: 'absolute',
    left:     0, top: 8, bottom: 8,
    width:    4,
    borderTopRightRadius:    3,
    borderBottomRightRadius: 3,
  },
  subItem: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            9,
    minHeight:      44,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  pontoNaoLido: { width: 7, height: 7, borderRadius: 4 },
  btnPrimario: {
    minHeight:      44,
    borderRadius:   10,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   8,
  },
  btnSecundario: {
    minHeight:      44,
    borderRadius:   10,
    borderWidth:    1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  btnMais: {
    minHeight:      44,
    marginTop:      4,
    borderRadius:   9,
    borderWidth:    1,
    borderStyle:    'dashed',
    alignItems:     'center',
    justifyContent: 'center',
  },
  bannerCard: {
    borderRadius: 12,
    borderWidth:  1,
    overflow:     'hidden',
    marginBottom: 10,
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    padding:       14,
    gap:           8,
  },
  ctaBtn: {
    margin:       14,
    padding:      10,
    borderRadius: 8,
    alignItems:   'center',
  },
});
