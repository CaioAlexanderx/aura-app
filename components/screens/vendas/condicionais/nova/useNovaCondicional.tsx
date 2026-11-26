// ============================================================
// AURA. — Como ligar o botão "Nova condicional" (C6, 26/11/2026)
//
// A aba (AbaCondicionais, C5) usa assim, quando o C7 estiver no ar:
//
//   const nova = useNovaCondicional({ onCriada: () => refetch() });
//   ...
//   <Pressable onPress={nova.abrir} testID="nova-condicional-botao">Nova condicional</Pressable>
//   {nova.modal}
//
// `onCriada` recebe a condicional guardada (para recarregar a lista).
// `onVerCondicional` (opcional) leva ao detalhe de outra condicional quando o
// aviso "peça sem unidade livre" oferece "Ver a C-0029".
// ============================================================
import { useCallback, useState } from "react";
import { NovaCondicionalModal } from "./NovaCondicionalModal";
import type { CondicionalGuardada } from "./api";

export function useNovaCondicional(opts: {
  onCriada?: (c: CondicionalGuardada) => void;
  onVerCondicional?: (condicionalId: string, companyId?: string | null) => void;
} = {}) {
  const [aberto, setAberto] = useState(false);
  const abrir = useCallback(() => setAberto(true), []);
  const fechar = useCallback(() => setAberto(false), []);
  const modal = (
    <NovaCondicionalModal
      visible={aberto}
      onClose={fechar}
      onCriada={(c) => opts.onCriada?.(c)}
      onVerCondicional={opts.onVerCondicional ? (id, lojaId) => { setAberto(false); opts.onVerCondicional?.(id, lojaId); } : undefined}
    />
  );
  return { aberto, abrir, fechar, modal };
}
