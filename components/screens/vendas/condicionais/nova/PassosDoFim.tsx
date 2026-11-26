// ============================================================
// AURA. — Nova condicional · passo 3 e Pronto (C7 preenche; C6 só o encaixe)
//
// O C6 entrega os passos 1 e 2. Este arquivo é o ponto de encaixe do C7
// (prazo e conferência, guardar, "Pronto"): aqui ele fica sem tela, e o botão
// "Nova condicional" só deve ser ligado depois do C7.
// ============================================================
import { View } from "react-native";
import type { CondicionalGuardada, FaltaDaCondicional } from "./api";
import type { ClienteDaCondicional, PecaDaCondicional } from "./busca";

export type EstadoDaNova = {
  lojaId: string | null;
  cliente: ClienteDaCondicional | null;
  telefoneAvulso: string;
  pecas: PecaDaCondicional[];
  faltas: FaltaDaCondicional[] | null;
  hoje?: string;
};

export type Guardar = {
  enviando: boolean;
  guardada: CondicionalGuardada | null;
  recomecar: () => void;
};

export function useGuardarCondicional(_estado: EstadoDaNova, _opts: { onCriada: (c: CondicionalGuardada) => void }): Guardar {
  return { enviando: false, guardada: null, recomecar: () => {} };
}

export const PassosDoFim = {
  Passo3: (_p: { estado: EstadoDaNova; guardar: Guardar }) => <View testID="nova-passo-3" />,
  RodapeDoPasso3: (_p: {
    estado: EstadoDaNova; guardar: Guardar; total: number;
    onVoltar: () => void; onGuardada: () => void; onFaltas: (f: FaltaDaCondicional[]) => void;
  }) => null,
  LinhasDoResumo: (_p: { estado: EstadoDaNova }) => null,
  Pronto: (_p: { guardada: CondicionalGuardada; onNova: () => void; onVerNaLista: () => void; onFechar: () => void }) => null,
};
