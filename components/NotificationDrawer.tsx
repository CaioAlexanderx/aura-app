// ============================================================
// AURA. — Gaveta de notificações (slide da direita)
// Criado: 13/06/2026
//
// Web:    position:fixed overlay + painel deslizante via CSS transition
// Native: Modal com Animated.spring
// Banners HTML renderizados via <iframe srcDoc> (web) — conteúdo admin = trusted
// ============================================================
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, Pressable, ScrollView, Animated, Modal,
  Platform, StyleSheet, Linking,
} from 'react-native';
import { useColors } from '@/constants/colors';
import { AppBanner, OrderNotification } from '@/services/notificationsApi';
import { useRouter } from 'expo-router';

interface Props {
  banners:        AppBanner[];
  orders:         OrderNotification[];
  onClose:        () => void;
  markBannerRead: (id: string) => void;
  markAllRead:    () => void;
}

function fmt(v?: number) {
  if (v == null) return '';
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sourceLabel(s: string) {
  return s === 'canal_digital' ? 'Canal Digital' : 'Studio';
}
function sourceDot(s: string) {
  return s === 'canal_digital' ? '#7c3aed' : '#d946ef';
}

function relTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return 'agora';
  if (diff < 3600)  return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

// ---------- Card de pedido ----------
function OrderCard({ o, C }: { o: OrderNotification; C: any }) {
  const age2h = Date.now() - 2 * 60 * 60 * 1000;
  const isNew = new Date(o.created_at).getTime() > age2h;

  if (Platform.OS !== 'web') {
    return (
      <View style={[styles.orderCard, { backgroundColor: C.bg3, borderColor: C.border }]}>
        <View style={[styles.srcDot, { backgroundColor: sourceDot(o.source) }]} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.ink, fontSize: 13, fontWeight: '600' }}>
            {sourceLabel(o.source)} — Pedido #{o.order_number}
          </Text>
          {o.customer_name && <Text style={{ color: C.ink3, fontSize: 11 }}>{o.customer_name}</Text>}
          <Text style={{ color: C.ink3, fontSize: 11 }}>{fmt(o.total)} · {relTime(o.created_at)}</Text>
        </View>
        {isNew && <View style={[styles.newDot, { backgroundColor: '#7c3aed' }]} />}
      </View>
    );
  }

  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          10,
      padding:      '10px 14px',
      borderRadius: 10,
      border:       `1px solid ${C.border}`,
      background:   C.bg3,
      marginBottom: 6,
    } as any}>
      <div style={{ width: 8, height: 8, borderRadius: 4, background: sourceDot(o.source), flexShrink: 0 } as any} />
      <div style={{ flex: 1, minWidth: 0 } as any}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as any}>
          {sourceLabel(o.source)} — Pedido #{o.order_number}
        </div>
        {o.customer_name && <div style={{ fontSize: 11, color: C.ink3, marginTop: 1 } as any}>{o.customer_name}</div>}
        <div style={{ fontSize: 11, color: C.ink3, marginTop: 1 } as any}>{fmt(o.total)} · {relTime(o.created_at)}</div>
      </div>
      {isNew && <div style={{ width: 8, height: 8, borderRadius: 4, background: '#7c3aed', flexShrink: 0 } as any} />}
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
          <Pressable onPress={onDismiss} hitSlop={8}>
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
        style={{
          position:       'absolute',
          top:            8, right: 8,
          zIndex:         10,
          width:          26, height: 26,
          borderRadius:   13,
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
        <iframe
          srcDoc={b.html_content}
          sandbox="allow-scripts"
          style={{ width: '100%', aspectRatio: '3 / 2', border: 'none', display: 'block' } as any}
          title={b.title}
        />
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

// ---------- Conteúdo do drawer ----------
function DrawerContent({ banners, orders, onClose, markBannerRead, markAllRead }: Props) {
  const C      = useColors();
  const router = useRouter();
  const isEmpty = banners.length === 0 && orders.length === 0;

  return (
    <>
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '18px 20px 14px',
        borderBottom:   `1px solid ${C.border}`,
        flexShrink:     0,
      } as any}>
        <span style={{ fontSize: 16, fontWeight: 700, color: C.ink, letterSpacing: '-0.3px' } as any}>
          Notificações
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' } as any}>
          {banners.length > 0 && (
            <button
              onClick={markAllRead}
              style={{
                fontSize:    11,
                color:       '#7c3aed',
                fontWeight:  600,
                background:  'transparent',
                border:      'none',
                cursor:      'pointer',
                padding:     '3px 6px',
                borderRadius: 5,
              } as any}
            >Marcar tudo lido</button>
          )}
          <button
            onClick={onClose}
            style={{
              width:          28, height: 28,
              borderRadius:   8,
              border:         `1px solid ${C.border}`,
              background:     C.bg3,
              color:          C.ink3,
              fontSize:       16,
              cursor:         'pointer',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
            } as any}
          >×</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' } as any}>
        {isEmpty && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: C.ink3 } as any}>
            <div style={{ fontSize: 32, marginBottom: 10 } as any}>🔔</div>
            <div style={{ fontSize: 13 } as any}>Nenhuma notificação</div>
          </div>
        )}

        {banners.length > 0 && (
          <>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#7c3aed', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 10 } as any}>
              ENDOMARKETING
            </div>
            {banners.map(b => (
              <BannerCard key={b.id} b={b} C={C} router={router} onDismiss={() => markBannerRead(b.id)} />
            ))}
          </>
        )}

        {orders.length > 0 && (
          <>
            <div style={{
              fontSize:      10,
              fontWeight:    800,
              color:         C.ink3,
              letterSpacing: '1.2px',
              textTransform: 'uppercase',
              marginBottom:  10,
              marginTop:     banners.length > 0 ? 14 : 0,
            } as any}>
              PEDIDOS RECENTES
            </div>
            {orders.map(o => <OrderCard key={o.id + o.source} o={o} C={C} />)}
          </>
        )}
      </div>
    </>
  );
}

// ---------- Web ----------
const DRAWER_W = 380;

function DrawerWeb(props: Props) {
  const C = useColors();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => {
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
          transition: 'opacity 0.25s ease',
        } as any}
      />
      <div style={{
        position:      'fixed',
        top:           0, right: 0, bottom: 0,
        width:         DRAWER_W,
        maxWidth:      '95vw',
        zIndex:        1001,
        display:       'flex',
        flexDirection: 'column',
        background:    C.bg2,
        borderLeft:    `1px solid ${C.border}`,
        boxShadow:     '-12px 0 40px rgba(0,0,0,0.18)',
        transform:     visible ? 'translateX(0)' : `translateX(${DRAWER_W}px)`,
        transition:    'transform 0.26s cubic-bezier(0.4, 0, 0.2, 1)',
        willChange:    'transform',
      } as any}>
        <DrawerContent {...props} onClose={handleClose} />
      </div>
    </>
  );
}

// ---------- Native ----------
function DrawerNative(props: Props) {
  const C      = useColors();
  const slideX = useRef(new Animated.Value(DRAWER_W)).current;

  useEffect(() => {
    Animated.spring(slideX, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
  }, []);

  const handleClose = () => {
    Animated.timing(slideX, { toValue: DRAWER_W, duration: 220, useNativeDriver: true }).start(props.onClose);
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <Animated.View style={[
        styles.nativePanel,
        { backgroundColor: C.bg2, transform: [{ translateX: slideX }] },
      ]}>
        <View style={[styles.nativeHeader, { borderBottomColor: C.border }]}>
          <Text style={[styles.headerTitle, { color: C.ink }]}>Notificações</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {props.banners.length > 0 && (
              <Pressable onPress={props.markAllRead} hitSlop={6}>
                <Text style={{ color: '#7c3aed', fontSize: 12, fontWeight: '600' }}>Marcar tudo lido</Text>
              </Pressable>
            )}
            <Pressable onPress={handleClose} hitSlop={10}>
              <Text style={{ fontSize: 20, color: C.ink3 }}>×</Text>
            </Pressable>
          </View>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          {props.banners.length === 0 && props.orders.length === 0 && (
            <Text style={{ color: C.ink3, textAlign: 'center', marginTop: 40 }}>Nenhuma notificação</Text>
          )}
          {props.banners.map(b => (
            <BannerCard key={b.id} b={b} C={C} router={null} onDismiss={() => props.markBannerRead(b.id)} />
          ))}
          {props.orders.map(o => <OrderCard key={o.id + o.source} o={o} C={C} />)}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ---------- Export ----------
export function NotificationDrawer(props: Props) {
  if (Platform.OS !== 'web') return <DrawerNative {...props} />;
  return <DrawerWeb {...props} />;
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
  orderCard: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
    padding:       12,
    borderRadius:  10,
    borderWidth:   1,
    marginBottom:  6,
  },
  srcDot: { width: 8, height: 8, borderRadius: 4 },
  newDot: { width: 8, height: 8, borderRadius: 4 },
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
