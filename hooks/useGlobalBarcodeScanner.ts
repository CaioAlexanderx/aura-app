// ============================================================
// AURA. — useGlobalBarcodeScanner (11/05/2026)
// Hook que escuta teclas globalmente e detecta o padrão de scanner
// USB/Bluetooth (sequência rápida de chars terminada em Enter).
// Dispara onScan(code) ao detectar Enter com buffer válido.
//
// Padrão clássico de PDV: scanner sempre ouvindo, operador nunca
// precisa clicar em campo, basta bipar e o item entra no carrinho.
//
// Comportamento:
// - IGNORA teclas quando foco está em <input>, <textarea>, <select>
//   ou contenteditable — operador pode digitar livremente em campos
//   de cliente/cupom/preço/etc sem que vire código de barras.
// - Buffer reseta após `idleMs` de inatividade (default 500ms).
//   Scanner USB digita ~10ms/char, então 500ms cobre folgado e ainda
//   distingue de digitação humana (~200ms/char).
// - Disparado apenas por Enter com buffer >= `minLength`.
// - Filtra atalhos com Ctrl/Alt/Meta pra não interferir.
//
// Uso: chamar com onScan + enabled. Mantenha `enabled=false` quando
// houver modal full-screen abrindo (caixa, troca, variante).
// ============================================================
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

type Options = {
  onScan: (code: string) => void;
  enabled?: boolean;
  minLength?: number;
  idleMs?: number;
};

const IS_WEB = Platform.OS === "web";

function isEditableTarget(t: EventTarget | null): boolean {
  if (!t) return false;
  const el = t as HTMLElement;
  if (!el || !el.tagName) return false;
  const tag = (el.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (el.isContentEditable) return true;
  return false;
}

export function useGlobalBarcodeScanner({
  onScan,
  enabled = true,
  minLength = 3,
  idleMs = 500,
}: Options) {
  const bufferRef = useRef<string>("");
  const lastKeyAtRef = useRef<number>(0);
  const onScanRef = useRef(onScan);

  // Mantém ref atualizada sem re-bindar o listener.
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!IS_WEB || !enabled || typeof window === "undefined") return;

    function handler(e: KeyboardEvent) {
      // Não captura se foco está em campo editável (operador digitando).
      if (isEditableTarget(e.target)) return;
      // Modificadores → pula pra não interferir em atalhos (Ctrl+K, etc).
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const now = Date.now();
      // Reset buffer se passou muito tempo desde a última tecla.
      if (now - lastKeyAtRef.current > idleMs) {
        bufferRef.current = "";
      }
      lastKeyAtRef.current = now;

      if (e.key === "Enter") {
        const code = bufferRef.current;
        bufferRef.current = "";
        if (code.length >= minLength) {
          e.preventDefault();
          onScanRef.current(code);
        }
        return;
      }

      // Aceita apenas chars imprimíveis de 1 caractere (letras, dígitos,
      // pontuação). Filtra teclas como Shift, Tab, F1, ArrowUp, etc.
      if (e.key && e.key.length === 1) {
        bufferRef.current += e.key;
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, minLength, idleMs]);
}

export default useGlobalBarcodeScanner;
