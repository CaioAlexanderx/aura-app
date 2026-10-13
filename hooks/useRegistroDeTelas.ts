// ============================================================
// AURA. — useRegistroDeTelas: conta as telas visitadas e manda em lote
//
// Criado: 13/10/2026
//
// Montado UMA vez, no AuthGuard do layout raiz (app/_layout.tsx). A lógica
// (nome da tela, acúmulo, envio, descarte em silêncio) mora em
// services/registroDeTelas.ts; aqui só se liga o React a ela.
//
//   · uma entrada na tela = uma contagem (o efeito só roda quando o NOME
//     da rota muda, não a cada render; remonte do StrictMode não duplica);
//   · sem sessão (token nulo) ou em telas de autenticação, não conta;
//   · trocar de empresa troca o token: o cleanup do efeito de sessão
//     manda o lote pendente ANTES de a nova sessão acumular.
// ============================================================
import { useEffect, useRef } from "react";
import { useSegments } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import {
  criarRegistroDeTelas,
  nomeDaTela,
  type RegistroDeTelas,
} from "@/services/registroDeTelas";

export function useRegistroDeTelas(): void {
  const segments = useSegments();
  const token = useAuthStore((s) => s.token);
  const tela = nomeDaTela(segments as string[]);

  const registroRef = useRef<RegistroDeTelas | null>(null);
  if (!registroRef.current) registroRef.current = criarRegistroDeTelas();
  const registro = registroRef.current;
  const ultimaTela = useRef<string | null>(null);

  // Timer de 60 s + gatilhos de saída (aba escondida, pagehide, background).
  useEffect(() => registro.iniciar(), [registro]);

  // Troca de sessão/empresa (ou logout): o lote pendente sai agora, com o
  // token em que foi acumulado.
  useEffect(() => () => registro.descarregar(), [registro, token]);

  // Entrada na tela.
  useEffect(() => {
    if (!token || !tela) {
      ultimaTela.current = null;
      return;
    }
    if (ultimaTela.current === tela) return;
    ultimaTela.current = tela;
    registro.registrar(tela, token);
  }, [registro, tela, token]);
}
