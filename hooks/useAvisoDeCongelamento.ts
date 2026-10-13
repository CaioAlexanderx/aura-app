// ============================================================
// AURA. — useAvisoDeCongelamento (13/10/2026)
//
// A linha "Atualizações pausadas até 01/12 (temporada)" das Configurações ›
// Aplicativo. É para a EQUIPE: o lojista não precisa saber que existe uma
// janela de congelamento, e para ele o app simplesmente "já está na versão
// mais nova" (ver detalheDaAtualizacao). Fora da janela, ou para quem não
// é staff, devolve null e o card não desenha nada.
// ============================================================
import { useAuthStore } from "@/stores/auth";
import { avisoDeAtualizacoesPausadas } from "@/utils/janelaDeCongelamento";

export function useAvisoDeCongelamento(): string | null {
  const isStaff = useAuthStore((s) => s.isStaff);
  if (!isStaff) return null;
  return avisoDeAtualizacoesPausadas(new Date(Date.now()));
}
