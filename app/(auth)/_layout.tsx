import { Stack } from "expo-router";
import { Colors } from "@/constants/colors";
import { ToastContainer } from "@/components/Toast";

// 29/08/2026 (QA da porta de entrada) — o banner de LGPD e montado no root
// (app/_layout.tsx) como overlay ancorado no rodape e vinha POR CIMA do
// conteudo: em 375px cobria metade do "Continuar" do cadastro e escondia o
// divisor "ou" do login.
//
// Regra para TODA tela nova de (auth): nada de conteudo debaixo do banner.
// Cada tela e um container 100vh proprio (nao ha wrapper comum que possa
// receber o padding), entao a tela chama `useLgpdConsentInset()` de
// components/LGPDConsent e soma o valor ao paddingBottom do container que
// centraliza o cartao — com boxSizing "border-box", para o container seguir
// com 100vh e o cartao apenas centralizar na area livre. Com o banner fora da
// tela o inset e 0: no desktop, e depois do aceite, nao sobra vao nenhum.
export default function AuthLayout() {
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.bg },
        }}
      />
      <ToastContainer />
    </>
  );
}
