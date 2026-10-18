// ============================================================
// AURA. — Cadastro de item · aviso "este NCM não existe" (18/10/2026, t3-05)
//
// Fica logo abaixo do campo NCM. Só avisa; salvar continua liberado.
// ============================================================
import { Text, View } from "react-native";
import { useAvisoDeNcm } from "@/hooks/useAvisoDeNcm";
import { Nota, s } from "./ui";

export function AvisoDeNcm({ ncm }: { ncm: string }) {
  const aviso = useAvisoDeNcm(ncm);
  if (!aviso) return null;
  return (
    <View style={{ marginTop: 8 }}>
      <Nota tom="amber" icon="alert">
        <Text style={s.hint} testID="aviso-ncm-inexistente">{aviso}</Text>
      </Nota>
    </View>
  );
}

export default AvisoDeNcm;
