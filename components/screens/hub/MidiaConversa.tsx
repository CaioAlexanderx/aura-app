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
import { View, Pressable, TextInput, Image } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { tourTarget } from "@/utils/tourTarget";
import { K, Tx, Ico, Pilula, BotaoRedondo, Ponto, superficie, web } from "./waVisual";
import { AtalhoAcao, type VarianteAtalho } from "./EnvioRapido";
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

  const bloqueadoFoto = ocupado || estado.tipo === "gravando";
  const bloqueadoAudio = ocupado || estado.tipo === "foto";
  const gravandoAgora = estado.tipo === "gravando";

  // Foto: pílula na barra (desktop) ou círculo na folha (celular).
  const foto = (v: VarianteAtalho) => v === "acao"
    ? <AtalhoAcao testID="hub-envio-foto" icone="foto" label="Foto" on={estado.tipo === "foto"} disabled={bloqueadoFoto} onPress={escolherFoto} />
    : (
      <Pilula testID="hub-envio-foto" on={estado.tipo === "foto"} disabled={bloqueadoFoto} onPress={escolherFoto}>
        <Ico nome="foto" cor={estado.tipo === "foto" ? K.pillOnInk : K.ink} />
        <Tx style={{ fontSize: 14, fontWeight: "600", lineHeight: 18, color: estado.tipo === "foto" ? K.pillOnInk : K.ink }}>Foto</Tx>
      </Pilula>
    );

  // Áudio: microfone redondo ao lado do campo (desktop) ou o primeiro círculo da folha (celular).
  const alternarGravacao = () => (gravandoAgora ? void mandarGravacao() : void comecarGravacao());
  const audio = (v: VarianteAtalho) => {
    if (!gravacaoDisponivel()) return null;
    if (v === "acao") {
      return <AtalhoAcao testID="hub-envio-audio" icone="mic" label={gravandoAgora ? "Mandar áudio" : "Áudio"} alvo="wa.microfone" destaque disabled={bloqueadoAudio} onPress={alternarGravacao} />;
    }
    return (
      <BotaoRedondo testID="hub-envio-audio" {...tourTarget("wa.microfone")} size={52} disabled={bloqueadoAudio} onPress={alternarGravacao}
        acessLabel={gravandoAgora ? "Parar e mandar o áudio" : "Gravar áudio"}
        style={gravandoAgora ? [{ borderColor: "rgba(255,220,220,.7)", backgroundColor: "#dc2626" }, web({ backgroundImage: "linear-gradient(135deg,#f87171,#dc2626)" })] : undefined}>
        <Ico nome="mic" size={20} cor={gravandoAgora ? "#fff" : K.ink2} traco={1.9} />
      </BotaoRedondo>
    );
  };

  const painelBase: any = [superficie.seca(20), { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10, padding: 12 }];
  const painel = estado.tipo === "gravando" ? (
    <View testID="hub-gravando" style={painelBase}>
      <Ponto cor="#f87171" size={9} />
      <Tx style={{ flex: 1, fontSize: 14, color: K.ink2, minWidth: 160 }}>
        <Tx style={{ fontWeight: "700", fontSize: 14, color: K.ink2 }}>{`Gravando ${relogio(estado.segundos)}`}</Tx>
        {" · toque no microfone de novo para mandar"}
      </Tx>
      <Pilula testID="hub-gravacao-mandar" pequena on onPress={() => void mandarGravacao()}>Mandar áudio</Pilula>
      <Pressable testID="hub-gravacao-cancelar" onPress={cancelarGravacao}>
        <Tx style={{ fontSize: 13, fontWeight: "700", color: K.ink3 }}>Cancelar</Tx>
      </Pressable>
    </View>
  ) : estado.tipo === "foto" ? (
    <View testID="hub-foto-previa" style={[...painelBase, { alignItems: "flex-start" }]}>
      <Image source={{ uri: estado.foto.previa }} style={{ width: 96, height: 96, borderRadius: 14, backgroundColor: K.trilho }} resizeMode="cover" />
      <View style={{ flex: 1, minWidth: 160, gap: 8 }}>
        <TextInput testID="hub-foto-legenda" value={legenda} onChangeText={setLegenda}
          placeholder="Legenda (opcional)" placeholderTextColor={K.ink3}
          style={{ minHeight: 40, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: K.dryBorda, backgroundColor: K.dryFb, fontFamily: "inherit" as any, fontSize: 14, color: K.ink }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Pilula testID="hub-foto-mandar" pequena on disabled={ocupado}
            onPress={() => mSend.mutate({ kind: "foto", mime: estado.foto.mime, data: estado.foto.base64, caption: legenda.trim() || undefined })}>
            {ocupado ? "Enviando…" : "Mandar foto"}
          </Pilula>
          <Pressable testID="hub-foto-cancelar" onPress={() => { setEstado({ tipo: "livre" }); setLegenda(""); }}>
            <Tx style={{ fontSize: 13, fontWeight: "700", color: K.ink3 }}>Cancelar</Tx>
          </Pressable>
        </View>
      </View>
    </View>
  ) : ocupado ? (
    <View style={painelBase}><Tx style={{ fontSize: 14, color: K.ink2 }}>Enviando…</Tx></View>
  ) : null;
  return { foto, audio, painel };
}
