import { Stack } from "expo-router";
import { Stage } from "@/constants/colors";
import { ToastContainer } from "@/components/Toast";

// 29/08/2026 (QA da porta de entrada) — o banner de LGPD e montado no root
// (app/_layout.tsx) como overlay ancorado no rodape e vinha POR CIMA do
// conteudo: em 375px cobria metade do "Continuar" do cadastro e escondia o
// divisor "ou" do login.
//
// Regra para TODA tela nova de (auth): nada de conteudo debaixo do banner.
// 21/10/2026 (tq-67): as telas de (auth) agora montam o palco comum
// (components/auth/AuthStage), e e ELE que chama `useLgpdConsentInset()` de
// components/LGPDConsent e soma o valor ao paddingBottom da area que
// centraliza o cartao (boxSizing "border-box"; o palco fica parado e so o
// conteudo rola). Tela nova de (auth): use o AuthStage, nao um container
// proprio. Com o banner fora da tela o inset e 0: no desktop, e depois do
// aceite, nao sobra vao nenhum.
export default function AuthLayout() {
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          // Palco sempre escuro: sem clarão do tema claro antes do palco pintar.
          contentStyle: { backgroundColor: Stage.bg },
        }}
      />
      <ToastContainer />
    </>
  );
}
