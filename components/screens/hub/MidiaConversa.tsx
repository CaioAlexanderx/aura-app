// ============================================================
// Hub — foto e áudio da conversa ABERTA (grátis, mensagem de sessão).
//
// useMidiaConversa devolve os botões (Foto, Áudio) e o painel que abre
// abaixo (gravação ou prévia da foto). O áudio só existe porque a
// EnvioRapido só é montada com a conversa aberta; o servidor recusa fora
// da janela de qualquer jeito. Aqui o Chrome grava (WebM/Opus) e o
// servidor converte para o formato da Meta.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Image } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { hubApi } from "@/services/hubApi";
import {
  Gravador, MAX_SEGUNDOS_AUDIO, gravacaoDisponivel, blobParaBase64, escolherArquivo, prepararFoto, relogio,
  type FotoPronta,
} from "./midiaWeb";

type Estado =
  | { tipo: "livre" }
  | { tipo: "gravando"; segundos: number }
  | { tipo: "foto"; foto: FotoPronta };

export function useMidiaConversa({ companyId, convId, onSent, onError }: {
  companyId: string; convId: string; onSent: () => void; onError: (m: string) => void;
}) {
  const [estado, setEstado] = useState<Estado>({ tipo: "livre" });
  const [legenda, setLegenda] = useState("");
  const gravador = useRef<Gravador | null>(null);
  const relogioId = useRef<any>(null);

  const pararRelogio = () => { if (relogioId.current) { clearInterval(relogioId.current); relogioId.current = null; } };
  useEffect(() => () => { pararRelogio(); gravador.current?.cancelar(); }, []);

  const mSend = useMutation({
    mutationFn: (b: { kind: "foto" | "audio"; mime: string; data: string; caption?: string }) =>
      hubApi.midia(companyId, convId, b),
    onSuccess: () => { setEstado({ tipo: "livre" }); setLegenda(""); onSent(); },
    onError: (e: any) => onError(e?.message || "Não foi possível enviar."),
  });

  const comecarGravacao = async () => {
    if (gravador.current) return;
    try {
      const g = new Gravador();
      await g.iniciar();
      gravador.current = g;
      setEstado({ tipo: "gravando", segundos: 0 });
      relogioId.current = setInterval(() => {
        const s = g.segundos();
        setEstado({ tipo: "gravando", segundos: s });
        if (s >= MAX_SEGUNDOS_AUDIO) void mandarGravacao();
      }, 250);
    } catch {
      gravador.current = null;
      onError("Não consegui usar o microfone. Libere o microfone no navegador e tente de novo.");
    }
  };

  const cancelarGravacao = () => {
    pararRelogio();
    gravador.current?.cancelar();
    gravador.current = null;
    setEstado({ tipo: "livre" });
  };

  const mandarGravacao = async () => {
    const g = gravador.current;
    if (!g) return;
    pararRelogio();
    gravador.current = null;
    try {
      const gravacao = await g.parar();
      if (gravacao.segundos < 1) { setEstado({ tipo: "livre" }); return; }
      const data = await blobParaBase64(gravacao.blob);
      mSend.mutate({ kind: "audio", mime: gravacao.mime, data });
    } catch {
      setEstado({ tipo: "livre" });
      onError("A gravação falhou. Tente de novo.");
    }
  };

  const escolherFoto = async () => {
    try {
      const file = await escolherArquivo("image/jpeg,image/png");
      if (!file) return;
      setEstado({ tipo: "foto", foto: await prepararFoto(file) });
    } catch (e: any) {
      onError(e?.message || "Não consegui abrir a foto.");
    }
  };

  const ocupado = mSend.isPending;

  const botoes = (
    <>
      <Pressable testID="hub-envio-foto" onPress={escolherFoto} disabled={ocupado || estado.tipo === "gravando"}
        style={[s.atalho, estado.tipo === "foto" && s.atalhoOn, (ocupado || estado.tipo === "gravando") && { opacity: 0.6 }]}>
        <Text style={[s.atalhoText, estado.tipo === "foto" && s.atalhoTextOn]}>Foto</Text>
      </Pressable>
      {gravacaoDisponivel() && (
        <Pressable testID="hub-envio-audio" disabled={ocupado || estado.tipo === "foto"}
          onPress={() => (estado.tipo === "gravando" ? void mandarGravacao() : void comecarGravacao())}
          style={[s.atalho, estado.tipo === "gravando" && s.gravando, (ocupado || estado.tipo === "foto") && { opacity: 0.6 }]}>
          <Text style={[s.atalhoText, estado.tipo === "gravando" && s.atalhoTextOn]}>
            {estado.tipo === "gravando" ? "Mandar áudio" : "Áudio"}
          </Text>
        </Pressable>
      )}
    </>
  );

  const painel = estado.tipo === "gravando" ? (
    <View testID="hub-gravando" style={s.painel}>
      <View style={s.ponto} />
      <Text style={s.gravText}>
        <Text style={s.gravBold}>Gravando {relogio(estado.segundos)}</Text> · toque em "Mandar áudio" quando terminar
      </Text>
      <Pressable testID="hub-gravacao-cancelar" onPress={cancelarGravacao}>
        <Text style={s.cancelar}>Cancelar</Text>
      </Pressable>
    </View>
  ) : estado.tipo === "foto" ? (
    <View testID="hub-foto-previa" style={[s.painel, { alignItems: "flex-start" }]}>
      <Image source={{ uri: estado.foto.previa }} style={s.previa} resizeMode="cover" />
      <View style={{ flex: 1, minWidth: 160, gap: 8 }}>
        <TextInput testID="hub-foto-legenda" style={s.legenda} value={legenda} onChangeText={setLegenda}
          placeholder="Legenda (opcional)" placeholderTextColor={Colors.ink3} />
        <View style={s.linha}>
          <Pressable testID="hub-foto-mandar" disabled={ocupado} style={[s.botao, ocupado && { opacity: 0.5 }]}
            onPress={() => mSend.mutate({ kind: "foto", mime: estado.foto.mime, data: estado.foto.base64, caption: legenda.trim() || undefined })}>
            <Text style={s.botaoText}>{ocupado ? "Enviando…" : "Mandar foto"}</Text>
          </Pressable>
          <Pressable testID="hub-foto-cancelar" onPress={() => { setEstado({ tipo: "livre" }); setLegenda(""); }}>
            <Text style={s.cancelar}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </View>
  ) : ocupado ? (
    <View style={s.painel}><Text style={s.gravText}>Enviando…</Text></View>
  ) : null;

  return { botoes, painel };
}

const s = StyleSheet.create({
  atalho: { borderWidth: 1, borderColor: Colors.border2, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.bg3 },
  atalhoOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  gravando: { backgroundColor: Colors.red, borderColor: Colors.red },
  atalhoText: { fontSize: 12, fontWeight: "700", color: Colors.ink2 },
  atalhoTextOn: { color: "#fff" },
  painel: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 10, backgroundColor: Colors.bg3 },
  ponto: { width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.red },
  gravText: { flex: 1, fontSize: 12.5, color: Colors.ink2, minWidth: 160 },
  gravBold: { fontWeight: "800", color: Colors.ink },
  cancelar: { fontSize: 12, fontWeight: "700", color: Colors.ink3 },
  previa: { width: 96, height: 96, borderRadius: 10, backgroundColor: Colors.bg4 },
  legenda: { borderWidth: 1, borderColor: Colors.border, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8, fontSize: 13, color: Colors.ink, backgroundColor: Colors.bg2 },
  linha: { flexDirection: "row", alignItems: "center", gap: 14 },
  botao: { backgroundColor: Colors.violet, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 9 },
  botaoText: { color: "#fff", fontSize: 12.5, fontWeight: "700" },
});
