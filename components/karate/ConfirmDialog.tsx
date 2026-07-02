import React from "react";
import { Modal, View, Text } from "react-native";
import { create } from "zustand";
import { KarateColors } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";

type ConfirmOptions = { title?: string; message: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean };
type Pending = ConfirmOptions & { resolve: (v: boolean) => void };
type ConfirmState = { pending: Pending | null; open: (o: ConfirmOptions) => Promise<boolean>; _close: (v: boolean) => void };

const useConfirm = create<ConfirmState>((set, get) => ({
  pending: null,
  open: (o) => new Promise<boolean>((resolve) => set({ pending: { ...o, resolve } })),
  _close: (v) => { const p = get().pending; set({ pending: null }); if (p) p.resolve(v); },
}));

/** Confirmação assíncrona chamável de qualquer lugar (inclusive fora de componentes). */
export function confirmAsync(o: ConfirmOptions): Promise<boolean> {
  return useConfirm.getState().open(o);
}

/** Host do diálogo — montar UMA vez por área (ex.: layout da federação). */
export function ConfirmHost() {
  const pending = useConfirm((s) => s.pending);
  const close = useConfirm((s) => s._close);
  return (
    <Modal transparent visible={!!pending} animationType="fade" onRequestClose={() => close(false)}>
      <View style={{ flex: 1, backgroundColor: "rgba(28,23,20,0.45)", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <View style={{ width: "100%", maxWidth: 400, backgroundColor: "#fdf8f2", borderRadius: 16, padding: 20 }}>
          {!!pending?.title && <Text style={{ fontSize: 16, fontWeight: "800", color: KarateColors.ink, marginBottom: 8 }}>{pending.title}</Text>}
          <Text style={{ fontSize: 13, color: KarateColors.ink3, lineHeight: 19, marginBottom: 16 }}>{pending?.message}</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <KarateButton label={pending?.cancelLabel || "Cancelar"} variant="ghost" size="md" onPress={() => close(false)} style={{ flex: 1 }} />
            <KarateButton label={pending?.confirmLabel || "Confirmar"} variant={pending?.destructive ? "primary" : "sumi"} size="md" onPress={() => close(true)} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
