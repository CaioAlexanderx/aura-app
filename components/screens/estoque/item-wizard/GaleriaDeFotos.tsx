// ============================================================
// AURA. — Cadastro de item · galeria de fotos (migration 323)
//
// Uma linha de até quatro quadradinhos, com o "+" no fim. Serve tanto a
// galeria principal quanto cada cor — é a MESMA linha, e a única
// diferença é o `corHex` que vai no upload e no reorder.
//
// AS DUAS REGRAS QUE ESTA TELA PRECISA CONTAR SEM DAR SERMÃO:
//
//   1. QUATRO É O TETO (o servidor recusa a quinta com 400). A tela não
//      recusa nada: quando não cabe mais, o "+" simplesmente não existe.
//   2. DUAS É A SUGESTÃO. Os dois primeiros espaços vazios vêm rotulados
//      ("frente" e "no corpo"; na principal, "capa" e "no corpo"). É
//      dica, não obrigação — o selo do cartão diz "só 1 foto" em âmbar e
//      nada trava.
//
// A POSIÇÃO 0 É A CAPA e ela espelha o que o resto do sistema já lia
// (products.image_url na principal; o image_url das variantes da cor).
// Por isso reordenar não é enfeite: "Tornar capa" troca a foto que
// aparece na vitrine, no PDV e no catálogo do WhatsApp.
//
// TOQUE (CLAUDE.md, armadilha 7): o × e as setas aparecem no hover no
// desktop, mas em tela sem hover — `matchMedia("(hover: none)")`, o
// equivalente em JS do @media — ficam SEMPRE visíveis. Hover-reveal puro
// deixaria a lojista de tablet sem como apagar uma foto.
// ============================================================
import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, Image, ActivityIndicator, Platform } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { productImagesApi, type ProductImage } from "@/services/productImagesApi";
import {
  MAX_FOTOS_POR_COR, chaveDaCor, contarSlots, idsComFotoEm, rotuloDoSlot,
} from "./types";

const IS_WEB = Platform.OS === "web";
const MAX_MB = 5;
const ACEITOS = "image/jpeg,image/png,image/webp";
const LADO = 64;

// ── dados ───────────────────────────────────────────────────
//
// Multi-CNPJ (CLAUDE.md, armadilha 2): a chave do cache carrega o
// companyId, então trocar de empresa não reaproveita a galeria da
// anterior. A visibilidade de peça compartilhada entre filiais é
// resolvida no servidor, como nas outras rotas de produto.
export function useGaleriaDoProduto(productId: string | null | undefined) {
  const { company } = useAuthStore();
  const companyId = company?.id;
  const qc = useQueryClient();
  const habilitado = !!companyId && !!productId;

  const { data, isLoading } = useQuery({
    queryKey: ["productImages", companyId, productId],
    queryFn: () => productImagesApi.list(companyId!, String(productId)),
    enabled: habilitado,
    staleTime: 30000,
    retry: 1,
  });

  // Depois de qualquer escrita: a galeria, a LISTA de produtos (a capa
  // mudou em products.image_url) e as variações (a capa da cor mudou no
  // image_url delas). Invalidar só a galeria deixaria a grade do passo 3
  // e o estoque mostrando a foto antiga.
  const invalidar = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["productImages", companyId, productId] });
    qc.invalidateQueries({ queryKey: ["products", companyId] });
    qc.invalidateQueries({ queryKey: ["productVariations", companyId, productId] });
  }, [qc, companyId, productId]);

  const aviso = useCallback((err: any, padrao: string) => {
    toast.error(err?.data?.error || err?.message || padrao);
  }, []);

  const subir = useCallback(async (corHex: string | null, content: string, contentType: string) => {
    if (!companyId || !productId) return false;
    try {
      await productImagesApi.upload(companyId, String(productId), {
        content,
        content_type: contentType,
        color_hex: corHex ? chaveDaCor(corHex) : null,
      });
      invalidar();
      return true;
    } catch (err: any) {
      aviso(err, "Não foi possível salvar a foto");
      return false;
    }
  }, [companyId, productId, invalidar, aviso]);

  const remover = useCallback(async (imageId: string) => {
    if (!companyId || !productId) return false;
    try {
      await productImagesApi.remove(companyId, String(productId), imageId);
      invalidar();
      return true;
    } catch (err: any) {
      aviso(err, "Não foi possível remover a foto");
      return false;
    }
  }, [companyId, productId, invalidar, aviso]);

  const reordenar = useCallback(async (corHex: string | null, ids: string[]) => {
    if (!companyId || !productId) return false;
    try {
      await productImagesApi.reorder(companyId, String(productId), {
        color_hex: corHex ? chaveDaCor(corHex) : null,
        ids,
      });
      invalidar();
      return true;
    } catch (err: any) {
      aviso(err, "Não foi possível reordenar as fotos");
      return false;
    }
  }, [companyId, productId, invalidar, aviso]);

  return {
    principal: (data?.main || []) as ProductImage[],
    porCor: (data?.by_color || {}) as Record<string, ProductImage[]>,
    maxPorCor: data?.max_por_cor || MAX_FOTOS_POR_COR,
    carregando: habilitado && isLoading,
    subir,
    remover,
    reordenar,
  };
}

// ── hover só existe onde há mouse ───────────────────────────
// Equivalente em JS do `@media (hover: none)`: em tablet e celular os
// controles nascem visíveis, porque lá o hover nunca acontece.
export function useSemHover(): boolean {
  const [semHover, setSemHover] = useState(!IS_WEB);
  useEffect(() => {
    if (!IS_WEB || typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(hover: none)");
    const aplicar = () => setSemHover(!!mq.matches);
    aplicar();
    if (mq.addEventListener) {
      mq.addEventListener("change", aplicar);
      return () => mq.removeEventListener("change", aplicar);
    }
    // Safari antigo.
    (mq as any).addListener?.(aplicar);
    return () => (mq as any).removeListener?.(aplicar);
  }, []);
  return semHover;
}

// ── seletor de arquivo (web) ────────────────────────────────
export function escolherFoto(aoEscolher: (base64: string, contentType: string) => void) {
  if (!IS_WEB || typeof document === "undefined") {
    toast.info("Upload disponível na versão web");
    return;
  }
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ACEITOS;
  input.style.cssText = "position:fixed;top:-100px;opacity:0";
  document.body.appendChild(input);
  input.onchange = () => {
    const file = input.files?.[0];
    if (input.parentNode) input.parentNode.removeChild(input);
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo " + MAX_MB + "MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const base64 = dataUrl.split(",")[1];
      if (!base64) { toast.error("Não consegui ler o arquivo"); return; }
      aoEscolher(base64, file.type || "image/jpeg");
    };
    reader.onerror = () => toast.error("Não consegui ler o arquivo");
    reader.readAsDataURL(file);
  };
  input.click();
}

// ── uma linha da galeria ────────────────────────────────────
type LinhaProps = {
  fotos: ProductImage[];
  /** true = galeria principal (color_hex null). */
  principal: boolean;
  corHex?: string | null;
  rotulo: string;
  maxPorCor: number;
  onSubir: (corHex: string | null, base64: string, contentType: string) => Promise<boolean>;
  onRemover: (imageId: string) => Promise<boolean>;
  onReordenar: (corHex: string | null, ids: string[]) => Promise<boolean>;
  onMudou?: () => void;
};

export function LinhaDaGaleria({
  fotos, principal, corHex, rotulo, maxPorCor,
  onSubir, onRemover, onReordenar, onMudou,
}: LinhaProps) {
  const semHover = useSemHover();
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [subindo, setSubindo] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cor = principal ? null : (corHex || null);
  const teto = Math.max(1, maxPorCor || MAX_FOTOS_POR_COR);
  const slots = contarSlots(fotos.length);
  const vazios = Math.max(0, Math.min(slots, teto) - fotos.length);

  function abrirSeletor() {
    if (subindo || fotos.length >= teto) return;
    escolherFoto(async (base64, ctype) => {
      setSubindo(true);
      const ok = await onSubir(cor, base64, ctype);
      setSubindo(false);
      if (ok) onMudou?.();
    });
  }

  async function apagar(id: string) {
    if (ocupado) return;
    setOcupado(id);
    const ok = await onRemover(id);
    setOcupado(null);
    if (ok) onMudou?.();
  }

  async function mover(id: string, destino: number) {
    if (ocupado) return;
    const ids = idsComFotoEm(fotos, id, destino);
    setOcupado(id);
    const ok = await onReordenar(cor, ids);
    setOcupado(null);
    if (ok) onMudou?.();
  }

  return (
    <View style={st.linha}>
      {fotos.map((f, i) => {
        const mostrarAcoes = semHover || hoverId === f.id;
        const trabalhando = ocupado === f.id;
        return (
          <View
            key={f.id}
            style={st.slot}
            {...(IS_WEB && !semHover
              ? {
                  onMouseEnter: () => setHoverId(f.id),
                  onMouseLeave: () => setHoverId((h) => (h === f.id ? null : h)),
                }
              : {})}
          >
            <Image
              source={{ uri: f.thumb_url || f.url }}
              style={st.foto}
              resizeMode="cover"
              accessibilityLabel={rotulo + " — foto " + (i + 1) + " de " + fotos.length}
            />

            {i === 0 && <View style={st.capa}><Text style={st.capaTxt}>CAPA</Text></View>}

            {mostrarAcoes && !trabalhando && (
              <Pressable
                onPress={() => apagar(f.id)}
                hitSlop={6}
                style={st.x}
                accessibilityLabel={"Remover foto " + (i + 1) + " de " + rotulo}
              >
                <Icon name="x" size={9} color="#fff" />
              </Pressable>
            )}

            {mostrarAcoes && !trabalhando && fotos.length > 1 && (
              <View style={st.barra}>
                <Pressable
                  onPress={() => mover(f.id, i - 1)}
                  disabled={i === 0}
                  hitSlop={4}
                  style={[st.seta, i === 0 && st.setaOff]}
                  accessibilityLabel={"Mover foto " + (i + 1) + " para a esquerda"}
                >
                  <Icon name="chevron_left" size={10} color={i === 0 ? "rgba(255,255,255,0.35)" : "#fff"} />
                </Pressable>
                {i > 0 && (
                  <Pressable
                    onPress={() => mover(f.id, 0)}
                    hitSlop={4}
                    style={st.capaBtn}
                    accessibilityLabel={"Tornar capa de " + rotulo}
                    // @ts-ignore — tooltip nativo do navegador
                    title="Tornar capa"
                  >
                    <Text style={st.capaBtnTxt}>capa</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => mover(f.id, i + 1)}
                  disabled={i === fotos.length - 1}
                  hitSlop={4}
                  style={[st.seta, i === fotos.length - 1 && st.setaOff]}
                  accessibilityLabel={"Mover foto " + (i + 1) + " para a direita"}
                >
                  <Icon name="chevron_right" size={10} color={i === fotos.length - 1 ? "rgba(255,255,255,0.35)" : "#fff"} />
                </Pressable>
              </View>
            )}

            {trabalhando && (
              <View style={st.overlay}><ActivityIndicator size="small" color="#fff" /></View>
            )}
          </View>
        );
      })}

      {Array.from({ length: vazios }).map((_, k) => {
        const indice = fotos.length + k;
        const primeiroVazio = k === 0;
        const dica = rotuloDoSlot(indice, principal);
        return (
          <Pressable
            key={"vazio-" + indice}
            onPress={primeiroVazio ? abrirSeletor : undefined}
            disabled={!primeiroVazio || subindo}
            style={[st.slot, st.vazio, !primeiroVazio && st.vazioFraco]}
            accessibilityLabel={
              primeiroVazio
                ? "Adicionar foto" + (dica ? " (" + dica + ")" : "") + " de " + rotulo
                : "Espaço para foto de " + rotulo
            }
          >
            {primeiroVazio && subindo ? (
              <ActivityIndicator size="small" color={Colors.violet3} />
            ) : (
              <>
                <Icon name="plus" size={14} color={primeiroVazio ? Colors.violet3 : Colors.ink3} />
                {!!dica && <Text style={st.dica} numberOfLines={1}>{dica}</Text>}
              </>
            )}
          </Pressable>
        );
      })}

      {fotos.length >= teto && (
        <View style={st.teto}>
          <Text style={st.tetoTxt}>{teto + " fotos"}</Text>
        </View>
      )}
    </View>
  );
}

const st = {
  linha: { flexDirection: "row" as const, flexWrap: "wrap" as const, alignItems: "center" as const, gap: 6 },
  slot: {
    width: LADO, height: LADO, borderRadius: 9, overflow: "hidden" as const,
    position: "relative" as any, backgroundColor: Colors.bg4,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: "center" as const, justifyContent: "center" as const,
  },
  foto: { width: LADO, height: LADO },
  vazio: {
    borderStyle: "dashed" as any, borderColor: Colors.border2,
    backgroundColor: Colors.bg3, gap: 2,
  },
  vazioFraco: { opacity: 0.55, borderColor: Colors.border },
  dica: { fontSize: 8.5, color: Colors.ink3, fontWeight: "700" as const, letterSpacing: 0.2 },
  capa: {
    position: "absolute" as any, top: 3, left: 3,
    paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  capaTxt: { fontSize: 7.5, color: "#fff", fontWeight: "800" as const, letterSpacing: 0.4 },
  x: {
    position: "absolute" as any, top: -3, right: -3,
    width: 16, height: 16, borderRadius: 8, backgroundColor: "#dc2626",
    alignItems: "center" as const, justifyContent: "center" as const,
    borderWidth: 1, borderColor: "#fff",
  },
  barra: {
    position: "absolute" as any, left: 0, right: 0, bottom: 0,
    flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const,
    gap: 2, paddingVertical: 2, backgroundColor: "rgba(0,0,0,0.55)",
  },
  seta: { paddingHorizontal: 2, paddingVertical: 1 },
  setaOff: { opacity: 0.4 },
  capaBtn: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.22)" },
  capaBtnTxt: { fontSize: 8, color: "#fff", fontWeight: "800" as const },
  overlay: {
    position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center" as const, justifyContent: "center" as const,
  },
  teto: { paddingHorizontal: 6 },
  tetoTxt: { fontSize: 10.5, color: Colors.ink3, fontWeight: "700" as const },
};

export default LinhaDaGaleria;
