// ============================================================
// AURA. — Preferências de notificação (painel dentro da gaveta)
// Criado: 01/09/2026
//
// Mora DENTRO do sino (engrenagem no cabeçalho), não em tela nova: o ajuste
// acontece onde o barulho é sentido, e não exige rota/entrada de NAV nova.
//
// Dois tipos não desligam (`fixo`): loja sem meio de pagamento e comprovante
// esperando conferência. Os dois travam dinheiro; deixar a lojista silenciar
// isso seria vender um botão de dar prejuízo. Aparecem com selo "Fixo" e
// aria-disabled, não escondidos — ela precisa saber que existem.
//
// Toque: linha inteira é o alvo (min 56px), sem hover-reveal (CLAUDE.md #7).
// ============================================================
import { View, Text, Pressable, Platform, StyleSheet, Switch } from 'react-native';
import { useColors } from '@/constants/colors';
import { PREF_SECTIONS, PrefRow } from '@/components/notificationEventModel';

interface Props {
  prefs:    Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
}

const INTRO =
  'Loja movimentada gera muito aviso. Desligue o que virou ruído — o que pede ' +
  'decisão sua fica sempre ligado.';

// ---------- Linha (web) ----------
function PrefLineWeb({ row, on, onToggle, C }: { row: PrefRow; on: boolean; onToggle: () => void; C: any }) {
  const fixo = !!row.fixo;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-disabled={fixo}
      aria-label={row.nome}
      onClick={fixo ? undefined : onToggle}
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          12,
        width:        '100%',
        minHeight:    56,
        padding:      '11px 12px',
        marginBottom: 6,
        border:       `1px solid ${C.border}`,
        borderRadius: 11,
        background:   C.bg3,
        color:        'inherit',
        font:         'inherit',
        textAlign:    'left',
        cursor:       fixo ? 'default' : 'pointer',
      } as any}
    >
      <span style={{ flex: 1, minWidth: 0 } as any}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.ink } as any}>{row.nome}</span>
        <span style={{ display: 'block', fontSize: 11, color: C.ink3, marginTop: 2, lineHeight: 1.35 } as any}>{row.desc}</span>
      </span>
      {fixo ? (
        <span style={{
          fontSize: 10, fontWeight: 700, color: C.ink3, textTransform: 'uppercase',
          letterSpacing: '0.06em', flexShrink: 0,
        } as any}>Fixo</span>
      ) : (
        <span style={{
          width: 42, height: 24, borderRadius: 12, flexShrink: 0, position: 'relative',
          background:   on ? '#7c3aed' : C.bg4,
          border:       `1px solid ${on ? '#7c3aed' : C.border}`,
          transition:   'background 0.15s',
        } as any}>
          <span style={{
            position: 'absolute', top: 2, left: on ? 20 : 2,
            width: 18, height: 18, borderRadius: 9,
            background: on ? '#fff' : C.ink3,
            transition: 'left 0.15s',
          } as any} />
        </span>
      )}
    </button>
  );
}

// ---------- Linha (nativo) ----------
function PrefLineNative({ row, on, onToggle, C }: { row: PrefRow; on: boolean; onToggle: () => void; C: any }) {
  const fixo = !!row.fixo;
  return (
    <Pressable
      onPress={fixo ? undefined : onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled: fixo }}
      accessibilityLabel={row.nome}
      style={[styles.linha, { borderColor: C.border, backgroundColor: C.bg3 }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: C.ink }}>{row.nome}</Text>
        <Text style={{ fontSize: 11, color: C.ink3, marginTop: 2 }}>{row.desc}</Text>
      </View>
      {fixo
        ? <Text style={{ fontSize: 10, fontWeight: '700', color: C.ink3 }}>FIXO</Text>
        : <Switch value={on} onValueChange={onToggle} trackColor={{ true: '#7c3aed', false: C.bg4 }} />}
    </Pressable>
  );
}

export function NotificationPrefs({ prefs, onChange }: Props) {
  const C = useColors();

  const toggle = (type: string) => {
    onChange({ ...prefs, [type]: !prefs[type] });
  };

  if (Platform.OS !== 'web') {
    return (
      <View>
        <Text style={{ fontSize: 12, color: C.ink3, lineHeight: 18, marginBottom: 14 }}>{INTRO}</Text>
        {PREF_SECTIONS.map(sec => (
          <View key={sec.titulo} style={{ marginBottom: 16 }}>
            <Text style={[styles.secaoTitulo, { color: C.ink3 }]}>{sec.titulo.toUpperCase()}</Text>
            {sec.linhas.map(row => (
              <PrefLineNative
                key={row.type}
                row={row}
                on={row.fixo ? true : !!prefs[row.type]}
                onToggle={() => toggle(row.type)}
                C={C}
              />
            ))}
          </View>
        ))}
      </View>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: C.ink3, lineHeight: 1.5, margin: '2px 2px 14px' } as any}>{INTRO}</div>
      {PREF_SECTIONS.map(sec => (
        <div key={sec.titulo} style={{ marginBottom: 16 } as any}>
          <div style={{
            fontSize: 10.5, fontWeight: 800, letterSpacing: '0.11em', textTransform: 'uppercase',
            color: C.ink3, margin: '0 2px 8px',
          } as any}>{sec.titulo}</div>
          {sec.linhas.map(row => (
            <PrefLineWeb
              key={row.type}
              row={row}
              on={row.fixo ? true : !!prefs[row.type]}
              onToggle={() => toggle(row.type)}
              C={C}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

const styles = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
    minHeight:     56,
    padding:       12,
    marginBottom:  6,
    borderWidth:   1,
    borderRadius:  11,
  },
  secaoTitulo: {
    fontSize:      10.5,
    fontWeight:    '800',
    letterSpacing: 1.1,
    marginBottom:  8,
    marginLeft:    2,
  },
});
