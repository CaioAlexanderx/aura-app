// ============================================================
// AURA. — Sininho de notificações
// Criado: 13/06/2026
//
// 17/06/2026 — Alerta não invasivo:
//   - Glow suave (pulsa de leve) só quando há item NÃO VISTO.
//   - Abrir o sino marca como visto (persistido): o glow some e não
//     volta em refresh/nova sessão. O banner continua acessível no drawer.
//
// 18/08/2026 — o sino saiu do Shell Negócio e passou a valer também para
// Aura Dojô, Aura Karatê e Aura Studio (backend: target_vertical, PR #506).
// Daí a prop `tone`: a topbar da federação é OXBLOOD (KarateColors.headRed)
// e o sino default — borda/fundo claros de useColors() — some nela. Com
// tone="onDark" a moldura vira vidro translúcido e o ícone/glow ficam
// brancos. `tone` é OPCIONAL e o default reproduz byte a byte o visual
// antigo, então nenhum ponto de uso existente muda.
//
// 01/09/2026 — a gaveta virou feed de eventos da loja (`loja_*`) e ganhou
// preferências por tipo. O sino agora entrega `feed` (já agrupado) em vez de
// `orders`, e busca as preferências na PRIMEIRA abertura (ensurePrefs), não a
// cada poll. O glow continua exatamente com a regra de 17/06.
// O keyframe respeita prefers-reduced-motion: quem pediu menos movimento
// recebe o sino em estado aceso fixo, sem pulsar.
// ============================================================
import { useState, useCallback, useEffect } from 'react';
import { Pressable, View, Text, Platform, StyleSheet } from 'react-native';
import { useColors } from '@/constants/colors';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationDrawer } from '@/components/NotificationDrawer';

export type BellTone = 'default' | 'onDark';

// Injeta os keyframes do glow uma única vez (web). São dois: o roxo do
// Shell Negócio e um branco para topbar escura (oxblood do Karatê), onde
// roxo sobre vermelho fica sujo.
function ensureGlowStyle() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('aura-bell-glow')) return;
  const el = document.createElement('style');
  el.id = 'aura-bell-glow';
  el.textContent =
    '@keyframes auraBellGlow{' +
    '0%,100%{box-shadow:0 0 0 0 rgba(124,58,237,0)}' +
    '50%{box-shadow:0 0 0 4px rgba(124,58,237,0.16),0 0 12px 2px rgba(124,58,237,0.34)}}' +
    '@keyframes auraBellGlowOnDark{' +
    '0%,100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}' +
    '50%{box-shadow:0 0 0 4px rgba(255,255,255,0.20),0 0 12px 2px rgba(255,255,255,0.30)}}' +
    '@media (prefers-reduced-motion: reduce){' +
    '@keyframes auraBellGlow{0%,100%{box-shadow:0 0 0 3px rgba(124,58,237,0.20)}}' +
    '@keyframes auraBellGlowOnDark{0%,100%{box-shadow:0 0 0 3px rgba(255,255,255,0.24)}}}';
  document.head.appendChild(el);
}

function BellSVG({ color, size = 18 }: { color: string; size?: number }) {
  if (Platform.OS !== 'web') return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ) as any;
}

export function NotificationBell({ tone = 'default' }: { tone?: BellTone } = {}) {
  const C      = useColors();
  const onDark = tone === 'onDark';
  const [open, setOpen] = useState(false);
  const notifs = useNotifications();
  const count  = notifs.unreadCount;
  const glow   = notifs.hasUnseen;

  useEffect(() => { ensureGlowStyle(); }, []);

  // Abrir o sino = visualizar => marca como visto (para de alertar, persistido).
  // Aproveita a abertura pra carregar as preferências (só na primeira vez).
  const handleOpen  = useCallback(() => {
    notifs.markSeen();
    notifs.ensurePrefs();
    setOpen(true);
  }, [notifs]);
  const handleClose = useCallback(() => setOpen(false), []);

  if (Platform.OS !== 'web') {
    return (
      <>
        <Pressable onPress={handleOpen} style={styles.nativeBell} accessibilityRole="button" accessibilityLabel="Notificações">
          <Text style={{ fontSize: 20 }}>🔔</Text>
          {count > 0 && (
            <View style={[styles.badge, { backgroundColor: '#7c3aed' }]}>
              <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
            </View>
          )}
        </Pressable>
        {open && (
          <NotificationDrawer
            banners={notifs.banners}
            feed={notifs.feed}
            onClose={handleClose}
            markBannerRead={notifs.markBannerRead}
            markEventRead={notifs.markEventRead}
            markAllRead={notifs.markAllRead}
            prefs={notifs.prefs}
            prefsAllMuted={notifs.prefsAllMuted}
            savePrefs={notifs.savePrefs}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div
        onClick={handleOpen}
        role="button"
        tabIndex={0}
        aria-label={count > 0 ? `Notificações — ${count} não vistas` : 'Notificações'}
        onKeyDown={(e: any) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpen(); } }}
        title="Notificações"
        style={{
          position:       'relative',
          display:        'inline-flex',
          alignItems:     'center',
          justifyContent: 'center',
          width:          36,
          height:         36,
          borderRadius:   10,
          border:         `1px solid ${onDark ? 'rgba(255,255,255,0.30)' : C.border}`,
          background:     onDark ? 'rgba(255,255,255,0.12)' : C.bg3,
          cursor:         'pointer',
          flexShrink:     0,
          transition:     'background 0.15s',
          animation:      glow
            ? `${onDark ? 'auraBellGlowOnDark' : 'auraBellGlow'} 2.2s ease-in-out infinite`
            : undefined,
        } as any}
      >
        <BellSVG color={onDark ? '#fff' : glow ? '#7c3aed' : C.ink3} size={18} />
        {count > 0 && (
          <div style={{
            position:       'absolute',
            top:            -5,
            right:          -5,
            minWidth:       17,
            height:         17,
            borderRadius:   9,
            background:     onDark ? '#fff' : '#7c3aed',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            padding:        '0 3px',
            boxShadow:      '0 0 0 2px var(--bg, #fff)',
          } as any}>
            <span style={{ color: onDark ? '#a44c3e' : '#fff', fontSize: 9, fontWeight: 700, lineHeight: 1 } as any}>
              {count > 9 ? '9+' : count}
            </span>
          </div>
        )}
      </div>
      {open && (
        <NotificationDrawer
          banners={notifs.banners}
          feed={notifs.feed}
          onClose={handleClose}
          markBannerRead={notifs.markBannerRead}
          markEventRead={notifs.markEventRead}
          markAllRead={notifs.markAllRead}
          prefs={notifs.prefs}
          prefsAllMuted={notifs.prefsAllMuted}
          savePrefs={notifs.savePrefs}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  nativeBell: {
    width:           44,
    height:          44,
    alignItems:      'center',
    justifyContent:  'center',
    position:        'relative',
  },
  badge: {
    position:          'absolute',
    top:               0,
    right:             0,
    minWidth:          16,
    height:            16,
    borderRadius:      8,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 2,
  },
  badgeText: {
    color:      '#fff',
    fontSize:   9,
    fontWeight: '700',
  },
});
