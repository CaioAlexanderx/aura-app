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
import { useEffect, useState } from 'react';
import { useColors } from '@/constants/colors';
import { somLigado, definirSom, tocarAvisoDePedido } from '@/utils/somDePedido';
import {
  EstadoDoAviso, estadoDoAviso, ativarAviso, desativarAviso, enviarAvisoDeTeste,
} from '@/services/webPush';
import { PREF_SECTIONS, PrefRow } from '@/components/notificationEventModel';

interface Props {
  companyId?: string;
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

// ---------- Neste navegador (web) ----------
// 10/09/2026: som de pedido e aviso no computador. As duas coisas valem POR
// NAVEGADOR (o computador do balcão não é o celular da dona), por isso
// ficam fora das preferências da empresa acima e não passam pelo servidor
// de preferências.
const TEXTO_DO_AVISO: Record<EstadoDoAviso, string> = {
  ativo: 'Ativo. Pedido novo, comprovante e pagamento aparecem aqui mesmo com o painel fechado.',
  inativo: 'Receba o aviso de pedido no computador, mesmo com o painel fechado.',
  bloqueado: 'Bloqueado neste navegador. Libere as notificações deste site nas configurações do navegador.',
  indisponivel: 'Este navegador não recebe o aviso. No iPhone, adicione o painel à Tela de Início e abra por lá.',
};

function AvisosDoNavegadorWeb({ C, companyId }: { C: any; companyId?: string }) {
  const [som, setSom] = useState<boolean>(() => somLigado());
  const [estado, setEstado] = useState<EstadoDoAviso | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    estadoDoAviso()
      .then((e) => { if (vivo) setEstado(e); })
      .catch(() => { if (vivo) setEstado('indisponivel'); });
    return () => { vivo = false; };
  }, []);

  const alternarSom = () => {
    const proximo = !som;
    definirSom(proximo);
    setSom(proximo);
    // Ligar já toca uma vez: a lojista sabe na hora como vai soar.
    if (proximo) tocarAvisoDePedido();
  };

  const agir = async (acao: 'ativar' | 'desativar' | 'testar') => {
    if (!companyId || ocupado) return;
    setOcupado(true);
    setRecado(null);
    try {
      if (acao === 'ativar') setEstado(await ativarAviso(companyId));
      if (acao === 'desativar') setEstado(await desativarAviso(companyId));
      if (acao === 'testar') {
        const r = await enviarAvisoDeTeste(companyId);
        setRecado(r && r.enviados ? 'Aviso de teste enviado. Deve aparecer em alguns segundos.' : 'O aviso não chegou a este navegador. Desative e ative de novo.');
      }
    } catch (err: any) {
      setRecado(err?.message || 'Não deu certo. Tente de novo.');
    } finally {
      setOcupado(false);
    }
  };

  const botao = (rotulo: string, onClick: () => void, primario = false) => (
    <button
      type="button"
      onClick={onClick}
      disabled={ocupado}
      style={{
        padding: '8px 14px', borderRadius: 9, font: 'inherit', fontSize: 12, fontWeight: 700,
        cursor: ocupado ? 'default' : 'pointer', opacity: ocupado ? 0.6 : 1,
        border: `1px solid ${primario ? '#7c3aed' : C.border}`,
        background: primario ? '#7c3aed' : C.bg4,
        color: primario ? '#fff' : C.ink,
      } as any}
    >{rotulo}</button>
  );

  return (
    <div style={{ marginBottom: 16 } as any}>
      <div style={{
        fontSize: 10.5, fontWeight: 800, letterSpacing: '0.11em', textTransform: 'uppercase',
        color: C.ink3, margin: '0 2px 8px',
      } as any}>Neste navegador</div>
      <PrefLineWeb
        row={{ type: 'som_de_pedido', nome: 'Som de pedido novo', desc: 'Toca quando chega pedido, comprovante ou pagamento, com o painel aberto.' } as any}
        on={som}
        onToggle={alternarSom}
        C={C}
      />
      <div style={{
        padding: '11px 12px', marginBottom: 6, border: `1px solid ${C.border}`,
        borderRadius: 11, background: C.bg3,
      } as any}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.ink } as any}>Aviso no computador</span>
        <span style={{ display: 'block', fontSize: 11, color: C.ink3, marginTop: 2, lineHeight: 1.35 } as any}>
          {estado ? TEXTO_DO_AVISO[estado] : 'Verificando…'}
        </span>
        {(estado === 'inativo' || estado === 'ativo') && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' } as any}>
            {estado === 'inativo' && botao('Ativar aviso', () => agir('ativar'), true)}
            {estado === 'ativo' && botao('Enviar teste', () => agir('testar'), true)}
            {estado === 'ativo' && botao('Desativar', () => agir('desativar'))}
          </div>
        )}
        {!!recado && (
          <span style={{ display: 'block', fontSize: 11, color: C.ink2, marginTop: 8 } as any}>{recado}</span>
        )}
      </div>
    </div>
  );
}

export function NotificationPrefs({ prefs, onChange, companyId }: Props) {
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
      <AvisosDoNavegadorWeb C={C} companyId={companyId} />
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
