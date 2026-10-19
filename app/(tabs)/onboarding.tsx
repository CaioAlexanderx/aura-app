// Tela aposentada em 08/04/2026 (o cadastro passou a ir direto pro Painel).
// Fica so como rede de seguranca: link antigo ou favorito cai no Painel em vez
// de uma tela em branco (antes: `return null`).
import { Redirect } from "expo-router";

export default function OnboardingScreen() { return <Redirect href={"/(tabs)/" as any} />; }
