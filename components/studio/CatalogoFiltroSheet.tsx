// ============================================================
// AURA STUDIO · CatalogoFiltroSheet — filtros do catálogo no celular
//
// Etapa 3 da limpeza do painel no celular (05/10/2026). As duas fileiras
// de chips (Todos/Personalizáveis/Não, e as categorias) empurravam o
// primeiro produto para depois de 60% da tela. No celular elas viram um
// botão "Filtrar" ao lado da busca, que abre esta folha.
//
// A escolha vale na hora (a lista atrás já muda); o botão de baixo só
// fecha e diz quantos produtos ficaram. O desktop continua com os chips.
// ============================================================
import { useMemo } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { Icon } from "@/components/Icon";
import { StudioBottomSheet } from "@/components/studio/StudioBottomSheet";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import type { StudioPalette } from "@/constants/studio-tokens";
import { ROTULO_DO_TIPO, filtrosAtivos, type FiltroDeTipo } from "@/components/studio/telaEnxuta";

const TIPOS: FiltroDeTipo[] = ["all", "personalizable", "nonpersonalizable"];

export function CatalogoFiltroSheet({
  visible, onClose, tipo, onTipo, categorias, categoria, onCategoria, total,
}: {
  visible: boolean;
  onClose: () => void;
  tipo: FiltroDeTipo;
  onTipo: (t: FiltroDeTipo) => void;
  categorias: Array<{ id: string; name: string; color: string | null }>;
  /** `null` = todas. */
  categoria: string | null;
  onCategoria: (nome: string | null) => void;
  /** Quantos produtos sobram com o filtro atual. */
  total: number;
}) {
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);
  const temFiltro = filtrosAtivos(tipo, categoria).length > 0;

  return (
    <StudioBottomSheet visible={visible} onClose={onClose} title="Filtrar produtos" compactHeader>
      <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 4 }}>
        <Text style={s.grupo}>TIPO</Text>
        {TIPOS.map((k) => (
          <Opcao
            key={k}
            s={s}
            t={t}
            rotulo={ROTULO_DO_TIPO[k]}
            ativa={tipo === k}
            onPress={() => onTipo(k)}
            testID={"filtro-tipo-" + k}
          />
        ))}

        {categorias.length > 0 ? (
          <>
            <Text style={[s.grupo, { marginTop: 12 }]}>CATEGORIA</Text>
            <Opcao
              s={s}
              t={t}
              rotulo="Todas"
              ativa={categoria === null}
              onPress={() => onCategoria(null)}
              testID="filtro-categoria-todas"
            />
            {categorias.map((c) => (
              <Opcao
                key={c.id}
                s={s}
                t={t}
                rotulo={c.name}
                cor={c.color}
                ativa={categoria === c.name}
                onPress={() => onCategoria(c.name)}
                testID={"filtro-categoria-" + c.id}
              />
            ))}
          </>
        ) : null}
      </ScrollView>

      <View style={s.rodape}>
        {temFiltro ? (
          <Pressable
            onPress={() => { onTipo("all"); onCategoria(null); }}
            accessibilityRole="button"
            style={s.limpar}
            testID="filtro-limpar"
          >
            <Text style={s.limparTxt}>Limpar</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onClose} accessibilityRole="button" style={s.ver} testID="filtro-ver">
          <Text style={s.verTxt}>
            {total === 1 ? "Ver 1 produto" : `Ver ${total} produtos`}
          </Text>
        </Pressable>
      </View>
    </StudioBottomSheet>
  );
}

function Opcao({
  s, t, rotulo, ativa, onPress, cor, testID,
}: {
  s: ReturnType<typeof buildStyles>;
  t: StudioPalette;
  rotulo: string;
  ativa: boolean;
  onPress: () => void;
  cor?: string | null;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: ativa, checked: ativa }}
      style={[s.opcao, ativa && s.opcaoAtiva]}
      testID={testID}
    >
      {cor ? <View style={[s.ponto, { backgroundColor: cor }]} /> : null}
      <Text style={[s.opcaoTxt, ativa && s.opcaoTxtAtiva]} numberOfLines={1}>{rotulo}</Text>
      {ativa ? <Icon name="check" size={16} color={t.primary} /> : null}
    </Pressable>
  );
}

function buildStyles(t: StudioPalette) {
  return StyleSheet.create({
    grupo: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.8, color: t.ink3, marginBottom: 2 },
    opcao: {
      flexDirection: "row", alignItems: "center", gap: 10,
      minHeight: 44, paddingHorizontal: 12, borderRadius: 10,
      borderWidth: 1, borderColor: "transparent",
    },
    opcaoAtiva: { backgroundColor: t.primarySoft, borderColor: t.primary },
    opcaoTxt: { flex: 1, fontSize: 14, fontWeight: "600", color: t.ink2 },
    opcaoTxtAtiva: { color: t.primary, fontWeight: "800" },
    ponto: { width: 9, height: 9, borderRadius: 5 },
    rodape: { flexDirection: "row", gap: 8, marginTop: 14 },
    limpar: {
      minHeight: 44, paddingHorizontal: 16, borderRadius: 10,
      borderWidth: 1.5, borderColor: t.ink5, backgroundColor: t.paperCard,
      alignItems: "center", justifyContent: "center",
    },
    limparTxt: { fontSize: 13, fontWeight: "700", color: t.ink2 },
    ver: {
      flex: 1, minHeight: 44, paddingHorizontal: 16, borderRadius: 10,
      backgroundColor: t.primary, alignItems: "center", justifyContent: "center",
    },
    verTxt: { fontSize: 13.5, fontWeight: "800", color: "#fff" },
  });
}

export default CatalogoFiltroSheet;
