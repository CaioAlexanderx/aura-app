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
import { useMutation, useQuery } from "@tanstack/react-query";
import { tourTarget } from "@/utils/tourTarget";
import { K, Tx, Ico, Pilula, BotaoRedondo, Ponto, superficie, web, SANS } from "./conversasUi";
import { AtalhoAcao, Folha, type VarianteAtalho } from "./EnvioRapido";
import { Meta } from "./conversasUi";
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
  // Foto: a grade "Fotos dos produtos" abre primeiro; "Escolher do computador" vem depois (artboard Main).
  const [grade, setGrade] = useState(false);
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

  const { data: catalogo } = useQuery({
    queryKey: ["hub-catalogo", companyId, ""],
    queryFn: () => hubApi.catalogo(companyId, ""),
    enabled: grade,
    staleTime: 30000,
  });
  const fotosDosProdutos = (catalogo?.products || []).filter((p) => !!p.image_url).slice(0, 7);

  // Um toque na foto do produto manda a foto (sem o cartão de produto). O navegador baixa a imagem e a manda como mídia.
  const mandarFotoDoProduto = async (url: string) => {
    setGrade(false);
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const pronta = await prepararFoto(new File([blob], "produto.jpg", { type: blob.type || "image/jpeg" }));
      mSend.mutate({ kind: "foto", mime: pronta.mime, data: pronta.base64 });
    } catch {
      onError("Não consegui carregar a foto do produto. Use \"Escolher do computador\".");
    }
  };

  const escolherFoto = async () => {
    setGrade(false);
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
    ? <AtalhoAcao testID="hub-envio-foto" icone="foto" label="Foto" on={grade || estado.tipo === "foto"} disabled={bloqueadoFoto} onPress={() => setGrade((v) => !v)} />
    : (
      <Pilula testID="hub-envio-foto" on={grade || estado.tipo === "foto"} disabled={bloqueadoFoto} onPress={() => setGrade((v) => !v)}>
        <Ico nome="foto" cor={grade || estado.tipo === "foto" ? K.pillOnInk : K.ink} />
        <Tx style={{ fontSize: 14, fontWeight: "600", lineHeight: 18, color: grade || estado.tipo === "foto" ? K.pillOnInk : K.ink }}>Foto</Tx>
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
          style={{ minHeight: 40, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: K.dryBorda, backgroundColor: K.dryFb, fontFamily: SANS, fontSize: 14, color: K.ink }} />
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
  const folha = (flutua: boolean) => !grade ? null : (
    <Folha label="Mandar foto" testID="hub-foto-grade" flutua={flutua} gap={10} onFechar={() => setGrade(false)} gatilho="hub-envio-foto">
      <Meta style={{ paddingHorizontal: 6, paddingTop: 4 }}>Fotos dos produtos</Meta>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {fotosDosProdutos.map((p) => (
          <Pressable key={p.id} testID={`hub-foto-produto-${p.id}`} accessibilityRole="button" {...({ dataSet: { opcao: "1" } } as any)} accessibilityLabel={p.name} onPress={() => void mandarFotoDoProduto(p.image_url!)}
            style={[{ width: "23%", aspectRatio: 1, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,.14)", backgroundColor: K.trilho }, web({ cursor: "pointer" })]}>
            <Image source={{ uri: p.image_url! }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          </Pressable>
        ))}
        <Pressable testID="hub-foto-computador" accessibilityRole="button" {...({ dataSet: { opcao: "1" } } as any)} accessibilityLabel="Escolher do computador" onPress={() => void escolherFoto()}
          style={[{ width: "23%", aspectRatio: 1, borderRadius: 14, borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(255,255,255,.3)", alignItems: "center", justifyContent: "center" }, web({ cursor: "pointer" })]}>
          <Ico nome="mais" size={24} cor={K.ink2} traco={1.8} />
        </Pressable>
      </View>
    </Folha>
  );

  return { foto, audio, painel, folha };
}
