// ============================================================
// AURA. — JanelaEmpilhada: janela que pode abrir por cima de outra janela.
//
// 17/11/2026 (incidente da NF-e): o WebPortal joga o conteúdo no body, mas
// FORA da armadilha de foco do Modal do react-native-web. Aberto por cima de
// um ResponsiveSheet (que é um Modal), cada clique num campo devolvia o foco
// para a janela de baixo e não dava para digitar. Esta casca usa o próprio
// Modal (transparente, sem animação): ele também sai em portal no body e
// entra na pilha de Modais, então a armadilha de foco fica com a janela de
// cima. Use no lugar do WebPortal para qualquer janela com campo de texto
// que possa abrir de dentro de outra janela.
// ============================================================
import React from "react";
import { Modal } from "react-native";

export function JanelaEmpilhada({ children, onRequestClose }: { children: React.ReactNode; onRequestClose?: () => void }) {
  return (
    <Modal visible transparent animationType="none" onRequestClose={onRequestClose} statusBarTranslucent>
      {children}
    </Modal>
  );
}

export default JanelaEmpilhada;
