// ============================================================
// useLeitorNoCampo (17/11/2026, p-157 / A5)
//
// O leitor de código de barras global (useGlobalBarcodeScanner) não lê com o
// foco num campo de texto: a pessoa precisa poder digitar. Só a busca do
// Caixa tinha o detector de rajada (criarLeitorDeCampo, utils/leituraRapida).
// Com o cursor na quantidade, no preço ou no desconto do carrinho, o código
// bipado era DIGITADO no campo ("7891234567895" unidades, R$ 7.891.234…).
//
// Este hook liga o mesmo detector a qualquer campo: a rajada do leitor é
// reconhecida no keydown (em captura, no próprio campo), o campo volta ao
// texto de antes e o código vai para `onLeitura` — o mesmo caminho do bipe
// fora de campo. Digitação de gente continua sendo digitação.
//
// Uso: `const ligar = useLeitorNoCampo({ escrever, onLeitura })` e
// `<TextInput ref={ligar} … />`. Sem `onLeitura`, nada é ligado.
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { criarLeitorDeCampo } from "@/utils/leituraRapida";

const IS_WEB = Platform.OS === "web";

export type OpcoesDoLeitorNoCampo = {
  /** Põe o campo num texto (o setter do estado que controla o campo). */
  escrever: (v: string) => void;
  /** O código lido. Ausente = o campo não lê (digitação de sempre). */
  onLeitura?: (code: string) => void;
};

/** Devolve o ref (callback) para pôr no TextInput. */
export function useLeitorNoCampo(opcoes: OpcoesDoLeitorNoCampo): (no: any) => void {
  const vivo = useRef(opcoes);
  vivo.current = opcoes;
  const ativo = !!opcoes.onLeitura;
  // O campo pode montar e desmontar (o preço só existe editando): o ref de
  // callback guarda o nó atual e o efeito religa quando ele muda.
  const [no, setNo] = useState<any>(null);
  const ligar = useCallback((n: any) => { setNo(n || null); }, []);

  useEffect(() => {
    if (!IS_WEB || !ativo || !no || typeof no.addEventListener !== "function") return;
    const leitor = criarLeitorDeCampo({
      valor: () => String(no.value ?? ""),
      escrever: (v) => vivo.current.escrever(v),
      onLeitura: (code) => vivo.current.onLeitura?.(code),
    });
    const aoTecla = (e: KeyboardEvent) => leitor.tecla(e);
    no.addEventListener("keydown", aoTecla, true);
    return () => {
      no.removeEventListener("keydown", aoTecla, true);
      leitor.cancelar();
    };
  }, [no, ativo]);

  return ligar;
}

export default useLeitorNoCampo;
