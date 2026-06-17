// ============================================================
// AURA. — Sininho de notificações
// Criado: 13/06/2026
//
// 17/06/2026 — Alerta não invasivo:
//   - Glow suave (pulsa de leve) só quando há item NÃO VISTO.
//   - Abrir o sino marca como visto (persistido): o glow some e não
//     volta em refresh/nova sessão. O banner continua acessível no drawer.
// ============================================================
import { useState, useCallback, useEffect } from 'react';
import { Pressable, View, Text, Platform, StyleSheet } from 'react-native';
import { useColors } from '@/constants/colors';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationDrawer } from '@/components/NotificationDrawer';

// Injeta o keyframe do glow uma única vez (web).
function ensureGlowStyle() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('aura-bell-glow')) return;
  const el = document.createElement('style');
  el.id = 'aura-bell-glow';
  el.textContent =
    '@keyframes auraBellGlow{' +
    '0%,100%{box-shadow:0 0 0 0 rgba(124,58,237,0)}' +
    '50%{box-shadow:0 0 0 4px rgba(124,58,237,0.16),0 0 12px 2px rgba(124,58,237,0.34)}}';
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

export function NotificationBell() {
  const C      = useColors();
  const [open, setOpen] = useState(false);
  const notifs = useNotifications();
  const count  = notifs.unreadCount;
  const glow   = notifs.hasUnseen;

  useEffect(() => { ensureGlowStyle(); }, []);

  // Abrir o sino = visualizar => marca como visto (para de alertar, persistido).
  const handleOpen  = useCallback(() => {
    notifs.markSeen();
    setOpen(true);
  }, [notifs]);
  const handleClose = useCallback(() => setOpen(false), []);

  if (Platform.OS !== 'web') {
    return (
      <>
        <Pressable onPress={handleOpen} style={styles.nativeBell}>
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
            orders={notifs.orders}
            onClose={handleClose}
            markBannerRead={notifs.markBannerRead}
            markAllRead={notifs.markAllRead}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div
        onClick={handleOpen}
        title="Notificações"
        style={{
          position:       'relative',
          display:        'inline-flex',
          alignItems:     'center',
          justifyContent: 'center',
          width:          36,
          height:         36,
          borderRadius:   10,
          border:         `1px solid ${C.border}`,
          background:     C.bg3,
          cursor:         'pointer',
          flexShrink:     0,
          transition:     'background 0.15s',
          animation:      glow ? 'auraBellGlow 2.2s ease-in-out infinite' : undefined,
        } as any}
      >
        <BellSVG color={glow ? '#7c3aed' : C.ink3} size={18} />
        {count > 0 && (
          <div style={{
            position:       'absolute',
            top:            -5,
            right:          -5,
            minWidth:       17,
            height:         17,
            borderRadius:   9,
            background:     '#7c3aed',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            padding:        '0 3px',
            boxShadow:      '0 0 0 2px var(--bg, #fff)',
          } as any}>
            <span style={{ color: '#fff', fontSize: 9, fontWeight: 700, lineHeight: 1 } as any}>
              {count > 9 ? '9+' : count}
            </span>
          </div>
        )}
      </div>
      {open && (
        <NotificationDrawer
          banners={notifs.banners}
          orders={notifs.orders}
          onClose={handleClose}
          markBannerRead={notifs.markBannerRead}
          markAllRead={notifs.markAllRead}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  nativeBell: {
    width:           40,
    height:          40,
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
