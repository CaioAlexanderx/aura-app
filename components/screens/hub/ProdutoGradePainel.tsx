// ============================================================
// Hub — painel "Produto com fotos e tamanhos" (artboard ProdutoGrade.dc.html).
//
// Dentro da folha de vidro sólido do EnvioRapido: o produto escolhido (Trocar),
// a cor primeiro quando há cor, as fotos marcáveis (✓ e "2 de 3 marcadas"), os
// tamanhos COM peça da cor (sem quantidade; "último" quando sobra 1; sem peça
// riscado), o interruptor "Perguntar o tamanho com botões" e o único botão
// sólido. Sem foto: o aviso e "Tirar foto agora" (sobe pela rota de imagens do
// produto). Os dados e o envio vêm do servidor (hubProdutoGradeApi).
// ============================================================
import { useState } from "react";
import { View, Pressable, Image, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hubProdutoGradeApi, type GradeCor } from "@/services/hubProdutoGradeApi";
import { productImagesApi } from "@/services/productImagesApi";
import { fmt } from "@/constants/helpers";
import { Lnk, Sw } from "@/components/whatsapp/waVidro";
import { K, Tx, Meta, Pilula, BotaoPrincipal, superficie, anima, web, WEB } from "./conversasUi";
import { escolherArquivo, prepararFoto } from "./midiaWeb";
import {
  contadorFotos, coresDoPainel, fotosDaCor, hexValido, marcadasIniciais, notaDoTamanho, rotuloEnviar, subtituloDoProduto, tamanhosDoPainel, temCor,
} from "./produtoGrade";

const LARGURA_FOTO: any = WEB ? "calc((100% - 24px) / 4)" : "23%";

export function ProdutoGradePainel({ companyId, convId, productId, onTrocar, onSent, onError, onSemGrade }: {
  companyId: string; convId: string; productId: string;
  onTrocar: () => void;
  onSent: () => void;
  onError: (mensagem: string) => void;
  /** O servidor ainda não conhece a grade: manda o produto do jeito antigo (foto e preço). */
  onSemGrade: () => void;
}) {
  const qc = useQueryClient();
  const chave = ["hub-produto-grade", companyId, productId];
  const { data: grade, isLoading, isError } = useQuery({
    queryKey: chave,
    queryFn: () => hubProdutoGradeApi.grade(companyId, productId),
    staleTime: 15000,
  });
  const [corKey, setCorKey] = useState<string | null>(null);
  const [escolhas, setEscolhas] = useState<Record<string, Record<string, boolean>>>({});
  const [perguntar, setPerguntar] = useState(true);
  const [subindo, setSubindo] = useState(false);

  const cores = grade ? coresDoPainel(grade) : [];
  const comCor = grade ? temCor(grade) : false;
  const cor: GradeCor | undefined = cores.find((c) => c.chave === corKey) || cores[0];
  const fotos = grade ? fotosDaCor(grade, cor) : [];
  const chaveEscolha = cor?.chave || "_";
  const marcadas = escolhas[chaveEscolha] ?? marcadasIniciais(fotos);
  const fotosMarcadas = fotos.filter((f) => marcadas[f.id]);

  const mEnviar = useMutation({
    mutationFn: () => hubProdutoGradeApi.enviar(companyId, convId, {
      type: "produto_grade", product_id: productId, ...(comCor && cor?.chave ? { cor: cor.chave } : {}),
      fotos: fotosMarcadas.map((f) => f.id), perguntar_tamanho: perguntar,
    }),
    onSuccess: () => onSent(),
    onError: (e: any) => onError(e?.message || "Não foi possível enviar."),
  });

  const alternarFoto = (id: string) => setEscolhas((o) => ({ ...o, [chaveEscolha]: { ...marcadas, [id]: !marcadas[id] } }));

  const tirarFoto = async () => {
    if (!WEB || subindo) return;
    setSubindo(true);
    try {
      const file = await escolherArquivo("image/jpeg,image/png", true);
      if (!file) return;
      const pronta = await prepararFoto(file);
      await productImagesApi.upload(companyId, productId, {
        content: pronta.base64, content_type: pronta.mime, color_hex: comCor ? hexValido(cor?.hex) : null,
      });
      await qc.invalidateQueries({ queryKey: chave });
    } catch (e: any) {
      onError(e?.message || "Não consegui subir a foto.");
    } finally {
      setSubindo(false);
    }
  };

  if (isLoading) {
    return <View testID="hub-grade-carregando" style={{ paddingVertical: 40 }}><ActivityIndicator color={K.acc} /></View>;
  }
  if (isError || !grade) {
    return (
      <View testID="hub-grade-erro" style={{ gap: 12 }}>
        <Tx style={{ fontSize: 14, color: K.ink2, lineHeight: 20 }}>Não consegui abrir as fotos e os tamanhos deste produto.</Tx>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Pilula pequena on testID="hub-grade-so-preco" onPress={onSemGrade}>Mandar só a foto e o preço</Pilula>
          <Pilula pequena testID="hub-grade-trocar" onPress={onTrocar}>Trocar</Pilula>
        </View>
      </View>
    );
  }

  const capa = fotos[0]?.url || null;
  const sub = subtituloDoProduto(grade);
  const tamanhos = tamanhosDoPainel(cor);
  const comPeca = tamanhos.filter((z) => z.disponivel).length;
  const semFoto = fotos.length === 0;
  const an = anima("pop", 0.4);

  return (
    <View testID="hub-grade-painel" style={{ gap: 16 }}>
      {/* O produto escolhido */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {capa
          ? <Image source={{ uri: capa }} style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: K.trilho }} />
          : <View style={[{ width: 56, height: 56, borderRadius: 16, backgroundColor: "#b9ab95" }, web({ backgroundImage: "linear-gradient(150deg,#efe6d6,#b9ab95)" })]} />}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Tx numberOfLines={1} style={{ fontSize: 18, fontWeight: "700", lineHeight: 24 }}>{grade.produto.nome}</Tx>
          <Tx numberOfLines={1} style={{ fontSize: 14, color: K.ink2, lineHeight: 20 }}>{[fmt(Number(cor?.preco ?? grade.produto.preco)), sub].filter(Boolean).join(" · ")}</Tx>
        </View>
        <Lnk testID="hub-grade-trocar" onPress={onTrocar}>Trocar</Lnk>
      </View>

      {/* A cor primeiro */}
      {comCor && cores.length > 0 && (
        <View style={{ gap: 8 }}>
          <Meta>Cor</Meta>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {cores.map((c) => (
              <Pilula key={c.chave} pequena on={c.chave === cor?.chave} testID={`hub-grade-cor-${c.chave}`} acessLabel={c.nome || ""} onPress={() => setCorKey(c.chave)}>
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c.hex || K.trilho, borderWidth: 1, borderColor: "rgba(255,255,255,.4)" }} />
                <Tx style={{ fontSize: 13, fontWeight: "600", lineHeight: 18, color: c.chave === cor?.chave ? K.pillOnInk : K.ink }}>{c.nome}</Tx>
              </Pilula>
            ))}
          </View>
        </View>
      )}

      {/* As fotos marcáveis */}
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <Meta>Fotos</Meta>
          <Tx testID="hub-grade-contador" style={{ fontSize: 13, color: K.ink3, lineHeight: 18 }}>{contadorFotos(fotos, marcadas)}</Tx>
        </View>
        {!semFoto && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {fotos.map((f, i) => {
              const on = !!marcadas[f.id];
              return (
                <Pressable key={f.id} testID={`hub-grade-foto-${f.id}`} onPress={() => alternarFoto(f.id)} accessibilityRole="button"
                  accessibilityLabel={`Foto ${i + 1}`} accessibilityState={{ selected: on }}
                  style={[{
                    width: LARGURA_FOTO, aspectRatio: 3 / 4, borderRadius: 16, borderWidth: 2, overflow: "hidden", backgroundColor: K.trilho,
                    borderColor: on ? "#c4b5fd" : "transparent",
                  }, web({ cursor: "pointer" })]}>
                  <Image source={{ uri: f.url }} resizeMode="cover" style={{ width: "100%", height: "100%" }} />
                  <View style={{
                    position: "absolute", right: 6, top: 6, width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1.5,
                    backgroundColor: on ? "#a78bfa" : "rgba(4,2,15,.55)", borderColor: on ? "#e9e3ff" : "rgba(255,255,255,.7)",
                  }}>
                    {on && <Tx style={{ fontSize: 13, fontWeight: "800", color: "#fff", lineHeight: 16 }}>✓</Tx>}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
        {semFoto && (
          <View testID="hub-grade-sem-foto" {...({ dataSet: an.dataSet } as any)}
            style={[superficie.seca(20), { paddingVertical: 14, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }, an.style]}>
            <Tx style={{ flex: 1, minWidth: 180, fontSize: 14, color: K.ink2, lineHeight: 20 }}>Este produto não tem foto. Vai só o texto com o preço e os tamanhos.</Tx>
            <Pilula pequena on testID="hub-grade-tirar-foto" disabled={subindo} onPress={tirarFoto}>{subindo ? "Subindo…" : "Tirar foto agora"}</Pilula>
          </View>
        )}
      </View>

      {/* Os tamanhos com peça */}
      <View style={{ gap: 8 }}>
        <Meta>Tamanhos com peça</Meta>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {tamanhos.map((z) => (
            <View key={z.chave} testID={`hub-grade-tam-${z.tamanho}`} accessibilityState={{ disabled: !z.disponivel }}
              style={{
                minWidth: 58, minHeight: 54, borderRadius: 16, borderWidth: 1, borderColor: K.dryBorda, backgroundColor: K.dryFb,
                alignItems: "center", justifyContent: "center", paddingHorizontal: 8, opacity: z.disponivel ? 1 : 0.35,
              }}>
              <Tx style={{ fontSize: 16, fontWeight: "700", lineHeight: 20, textDecorationLine: z.disponivel ? "none" : "line-through" }}>{z.tamanho}</Tx>
              <Tx style={{ fontSize: 11, fontWeight: "600", color: K.ink3, lineHeight: 14, textDecorationLine: z.disponivel ? "none" : "line-through" }}>{notaDoTamanho(z)}</Tx>
            </View>
          ))}
          {comPeca === 0 && <Tx style={{ fontSize: 13, color: K.ink3, lineHeight: 18 }}>Sem peça livre nesta cor.</Tx>}
        </View>
        <Tx style={{ fontSize: 13, color: K.ink3, lineHeight: 18 }}>A cliente vê só os que têm peça, sem a quantidade. "Último" quando sobra um.</Tx>
      </View>

      {/* Perguntar o tamanho com botões */}
      <View style={[superficie.seca(18), { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 14 }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Tx style={{ fontSize: 14, fontWeight: "700", lineHeight: 20 }}>Perguntar o tamanho com botões</Tx>
          <Tx style={{ fontSize: 13, color: K.ink2, lineHeight: 18 }}>A cliente toca no tamanho e a resposta volta aqui.</Tx>
        </View>
        <Sw testID="hub-grade-perguntar" rotulo="Perguntar o tamanho com botões" ligado={perguntar} onToggle={() => setPerguntar((v) => !v)} />
      </View>

      {/* Rodapé: grátis + o único botão sólido */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Tx style={{ fontSize: 13, color: K.ok, lineHeight: 18 }}>Grátis: a conversa está aberta</Tx>
        <BotaoPrincipal testID="hub-grade-enviar" disabled={mEnviar.isPending} onPress={() => mEnviar.mutate()}>
          {rotuloEnviar(fotosMarcadas.length)}
        </BotaoPrincipal>
      </View>
    </View>
  );
}
