// ============================================================
// AURA. -- PDV/Caixa · Glass search box with ⌘K shortcut
// ============================================================
import { useEffect, useRef } from "react";
import { tourTarget } from "@/utils/tourTarget";
import { View, Text, TextInput, StyleSheet, Platform } from "react-native";
import { Colors, Glass } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { IS_WEB, webOnly } from "./types";
import { criarDetector, criarLeitorDeCampo, OCIOSO_MS } from "@/utils/leituraRapida";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** 16/09/2026: a busca tinha `minWidth: 340` fixo. Num 390px isso não
   *  deixava espaço pro chip de estado do leitor ao lado — agora ela ocupa a
   *  linha e o pai decide o limite. */
  maxWidth?: number;
  /** 28/09/2026: Enter na busca. O leitor global ignora teclas quando o foco
   *  está num campo — então quem bipa com o cursor na busca (o placeholder diz
   *  "ou código") via o código parado aqui e tinha de apagar antes do próximo
   *  bipe. Com isso o Enter do leitor lança o item e o pai limpa o campo. */
  onSubmit?: (v: string) => void;
  /** 29/09/2026: leitura do leitor de código DENTRO da busca, com ou sem
   *  Enter. Uma rajada rápida (ver utils/leituraRapida) vira bipe: o campo
   *  volta ao texto de antes e o código vai para onScan. Sem isso, leitor
   *  configurado sem Enter deixava o código na busca e o próximo bipe
   *  grudava nele. Digitação normal continua sendo busca.
   *  09/10/2026: na web a leitura é reconhecida no keydown, pelo horário do
   *  próprio evento, e o código é engolido antes de entrar no campo (ver
   *  criarLeitorDeCampo). O caminho pelo onChangeText fica só para onde não
   *  há keydown (app nativo). */
  onScan?: (code: string) => void;
};

export function SearchBox({ value, onChange, placeholder, maxWidth, onSubmit, onScan }: Props) {
  const ref = useRef<TextInput | null>(null);
  const detector = useRef(criarDetector()).current;
  const ultimoValor = useRef(value);
  const antesDaRajada = useRef(value);
  const timer = useRef<any>(null);
  useEffect(() => { ultimoValor.current = value; }, [value]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Web: leitor reconhecido no keydown do próprio campo, em captura.
  const tecladoLigado = useRef(false);
  const onChangeRef = useRef(onChange);
  const onScanRef = useRef(onScan);
  onChangeRef.current = onChange;
  onScanRef.current = onScan;
  const temLeitor = !!onScan;
  useEffect(() => {
    const el: any = ref.current;
    if (!IS_WEB || !temLeitor || !el || typeof el.addEventListener !== "function") return;
    const leitor = criarLeitorDeCampo({
      valor: () => String(el.value ?? ""),
      escrever: (v) => { ultimoValor.current = v; onChangeRef.current(v); },
      onLeitura: (code) => onScanRef.current?.(code),
    });
    const aoTecla = (e: KeyboardEvent) => leitor.tecla(e);
    el.addEventListener("keydown", aoTecla, true);
    tecladoLigado.current = true;
    return () => {
      el.removeEventListener("keydown", aoTecla, true);
      tecladoLigado.current = false;
      leitor.cancelar();
    };
  }, [temLeitor]);

  // Fecha a rajada: se foi leitura, desfaz o texto que ela digitou e lança o código.
  function fecharRajada(): boolean {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const code = detector.leitura();
    // Pedaço curto fica no detector: se o resto da leitura chegar logo depois
    // de um soluço, ele emenda (ver utils/leituraRapida).
    if (!code || !onScan) return false;
    detector.reset();
    ultimoValor.current = antesDaRajada.current;
    onChange(antesDaRajada.current);
    onScan(code);
    return true;
  }

  function aoMudar(v: string) {
    const anterior = ultimoValor.current || "";
    if (tecladoLigado.current) {
      // O keydown já cuida do leitor; aqui é só o texto.
    } else if (onScan && v.length === anterior.length + 1 && v.startsWith(anterior)) {
      // Um caractere a mais no fim: pode ser o leitor digitando.
      if (detector.tecla(v.slice(-1), Date.now())) antesDaRajada.current = anterior;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(fecharRajada, OCIOSO_MS);
    } else {
      // Apagou, colou, editou no meio: é a pessoa mexendo, não o leitor.
      detector.reset();
    }
    ultimoValor.current = v;
    onChange(v);
  }

  function aoEnviar(e: any) {
    if (!tecladoLigado.current && fecharRajada()) return;
    onSubmit?.(e?.nativeEvent?.text ?? value);
  }

  // Web keyboard shortcut: ⌘K / Ctrl+K focuses the input.
  useEffect(() => {
    if (!IS_WEB) return;
    function handler(e: KeyboardEvent) {
      const isK = e.key === "k" || e.key === "K";
      if (!isK) return;
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        const el: any = ref.current;
        if (el && typeof el.focus === "function") el.focus();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const webBox = webOnly({
    background: Glass.card,
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: "1px solid " + Glass.lineBorderCard,
  });

  return (
    <View {...tourTarget("pdv.busca")} style={[s.box, maxWidth ? { maxWidth } : null, Platform.OS === "web" ? (webBox as any) : { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border }]}>
      <Icon name="search" size={15} color={Colors.ink3} />
      <TextInput
        ref={ref}
        style={s.input as any}
        value={value}
        onChangeText={aoMudar}
        onSubmitEditing={onSubmit || onScan ? aoEnviar : undefined}
        testID="pdv-busca"
        blurOnSubmit={false}
        returnKeyType="search"
        placeholder={placeholder || "Buscar produto ou código…"}
        placeholderTextColor={Colors.ink3}
      />
      {IS_WEB && <Text style={s.kbd}>⌘K</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    flex: 1,
    minWidth: 0,
  },
  input: {
    flex: 1,
    backgroundColor: "transparent",
    color: Colors.ink,
    fontSize: 13,
    outlineStyle: "none",
    borderWidth: 0 as any,
  } as any,
  kbd: {
    fontFamily: Platform.OS === "web" ? ("ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" as any) : "monospace",
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: Glass.lineFaint,
    color: Colors.ink3,
  },
});

export default SearchBox;
