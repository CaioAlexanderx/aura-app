// ============================================================
// ProductGalleryEditor — galeria de fotos do produto (até 5)
//
// 19/08/2026 — Antes o lojista só cadastrava UMA foto por produto
// (PATCH { image_url }). O backend passou a aceitar `gallery_urls`
// (array JSONB, índice 0 = capa, backend espelha `image_url` sozinho
// a partir dela). Esse componente é a UI: grid de miniaturas + slot
// "+" pra adicionar, remover e "definir como capa".
//
// Cada operação (adicionar/remover/definir capa) salva a LISTA INTEIRA
// via PATCH imediatamente — não fica pendurado no botão "Salvar
// alterações" do resto do formulário, porque senão a lojista tira uma
// foto, sai da aba sem salvar e perde a alteração. Padrão otimista +
// rollback, igual toggleStorefrontVisible em estoque.tsx: atualiza a
// UI na hora, e só desfaz se o PATCH falhar.
//
// IMPORTANTE: nunca mandar `image_url` junto do PATCH de gallery_urls
// — o contrato do backend diz que, se vier, a escolha explícita vence
// e quebra o espelhamento automático da capa.
// ============================================================
import { useMemo, useState } from "react";
import { View, Text, Pressable, Image, Platform, ActivityIndicator, StyleSheet } from "react-native";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import type { StudioPalette } from "@/constants/studio-tokens";
import { Icon } from "@/components/Icon";
import { request } from "@/services/api";
import { pickImageBase64, uploadStudioMockup } from "@/services/studioUploadApi";
import { toast } from "@/components/Toast";
import { confirmAlert } from "@/utils/webAlert";

const MAX_PHOTOS = 5;
const THUMB = 84;

type Props = {
  productId: string;
  companyId: string;
  /**
   * Galeria já resolvida pelo caller: se o produto só tem `image_url`
   * legado (gallery_urls vazio), o caller deve passar `[image_url]`
   * (compat produto antigo — sem isso a foto cadastrada "some" da UI).
   */
  galleryUrls: string[];
  /**
   * Disparado após CADA operação persistir com sucesso, já com a lista
   * nova. O caller (BasicoForm → onProductPatched) usa isso pra manter
   * `gallery_urls` E `image_url` (capa = índice 0) sincronizados na
   * linha da lista master e no header do produto expandido.
   */
  onChanged: (gallery: string[]) => void;
};

export default function ProductGalleryEditor({ productId, companyId, galleryUrls, onChanged }: Props) {
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);

  // Estado local otimista — fonte de verdade da UI enquanto o componente
  // está montado. Resincroniza com a prop só quando o produto muda (troca
  // de produto expandido), pra não conflitar com o otimismo de uma
  // operação em andamento.
  const [gallery, setGallery] = useState<string[]>(galleryUrls);
  const [lastProductId, setLastProductId] = useState(productId);
  if (productId !== lastProductId) {
    setLastProductId(productId);
    setGallery(galleryUrls);
  }

  // Índice em operação (remover/definir capa) — desabilita a miniatura
  // envolvida pra evitar duplo-clique/corrida entre operações.
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const busy = busyIndex !== null || uploading;

  // Persiste a lista inteira. Retorna true/false pra quem chamou decidir
  // se aplica ou desfaz o otimismo já feito no estado local.
  async function persist(next: string[]): Promise<boolean> {
    try {
      await request<any>(`/companies/${companyId}/products/${productId}`, {
        method: "PATCH",
        // Só gallery_urls — nunca image_url junto (contrato do backend).
        body: { gallery_urls: next },
        retry: 0,
        timeout: 12000,
      });
      onChanged(next);
      return true;
    } catch (e: any) {
      const status = e?.status ? `[${e.status}] ` : "";
      toast.error(`${status}${e?.data?.error || e?.message || "Erro ao salvar fotos"}`);
      return false;
    }
  }

  async function addPhoto() {
    if (gallery.length >= MAX_PHOTOS || busy) return;

    // TRAVA ANTES de abrir o seletor, não depois: o picker é UI do
    // sistema e pode ficar aberto minutos. Travando só no retorno, a
    // lojista continuava podendo remover uma foto nesse intervalo — e
    // quando o upload voltasse, a lista capturada aqui (sem a remoção)
    // seria persistida, RESSUSCITANDO a foto que ela acabou de apagar.
    setUploading(true);
    try {
      const picked = await pickImageBase64().catch((e: any) => {
        const status = e?.status ? `[${e.status}] ` : "";
        toast.error(`${status}${e?.data?.error || e?.message || "Não foi possível abrir a galeria."}`);
        return null;
      });
      if (!picked) return; // cancelou o seletor — nada a fazer

      const uploaded = await uploadStudioMockup(companyId, {
        content_base64: picked.base64,
        content_type: picked.content_type,
        kind: "product",
      });

      // Otimista sobre o estado MAIS RECENTE (functional update), não
      // sobre a closure desta render. `prev` guarda o que desfazer.
      let prev: string[] = [];
      let next: string[] = [];
      setGallery((atual) => {
        prev = atual;
        // Limite reavaliado aqui: outra aba/dispositivo pode ter enchido
        // a galeria enquanto o seletor estava aberto.
        next = atual.length >= MAX_PHOTOS ? atual : [...atual, uploaded.url];
        return next;
      });
      if (next.length === prev.length) {
        toast.error(`Máximo de ${MAX_PHOTOS} fotos por produto`);
        return;
      }
      const ok = await persist(next);
      if (!ok) setGallery(prev); // rollback
      else toast.success("Foto adicionada");
    } catch (e: any) {
      const status = e?.status ? `[${e.status}] ` : "";
      toast.error(`${status}${e?.data?.error || e?.message || "Falha ao carregar imagem"}`);
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(index: number) {
    if (busy) return;
    const wasCover = index === 0;
    confirmAlert(
      "Remover foto",
      wasCover && gallery.length > 1
        ? "Essa é a foto de capa. Removendo ela, a próxima foto vira a nova capa. Continuar?"
        : "Essa foto será removida do produto.",
      "Remover",
      async () => {
        setBusyIndex(index);
        const prev = gallery;
        const next = gallery.filter((_, i) => i !== index);
        setGallery(next);
        const ok = await persist(next);
        if (!ok) setGallery(prev); // rollback
        else toast.success("Foto removida");
        setBusyIndex(null);
      },
      { destructive: true },
    );
  }

  async function setAsCover(index: number) {
    if (busy || index === 0) return;
    setBusyIndex(index);
    const prev = gallery;
    // Move a foto pro índice 0 (capa) mantendo a ordem relativa das demais.
    const next = [gallery[index], ...gallery.filter((_, i) => i !== index)];
    setGallery(next);
    const ok = await persist(next);
    if (!ok) setGallery(prev); // rollback
    else toast.success("Capa atualizada");
    setBusyIndex(null);
  }

  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>Fotos do produto</Text>
      <Text style={s.hint}>
        A primeira foto é a capa: é ela que aparece na vitrine, no PDV e no carrinho.
      </Text>

      <View style={s.grid}>
        {gallery.map((url, index) => (
          <GalleryThumb
            key={`${url}-${index}`}
            url={url}
            isCover={index === 0}
            busy={busyIndex === index}
            disabled={busy}
            t={t}
            s={s}
            onSetCover={() => setAsCover(index)}
            onRemove={() => removePhoto(index)}
          />
        ))}

        {gallery.length < MAX_PHOTOS && (
          <Pressable
            onPress={addPhoto}
            disabled={busy}
            style={[s.slot, s.slotAdd, busy && { opacity: 0.5 }]}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={t.primary} />
            ) : (
              <>
                <Icon name="plus" size={20} color={t.primary} />
                <Text style={s.slotAddTxt}>Adicionar</Text>
              </>
            )}
          </Pressable>
        )}
      </View>

      {gallery.length >= MAX_PHOTOS && (
        <Text style={s.maxHint}>Máximo de 5 fotos por produto.</Text>
      )}
    </View>
  );
}

// ───────────────────────────────────────────────────────────
// GalleryThumb — uma miniatura da galeria (capa ou não)
// ───────────────────────────────────────────────────────────
function GalleryThumb({
  url, isCover, busy, disabled, t, s, onSetCover, onRemove,
}: {
  url: string;
  isCover: boolean;
  busy: boolean;
  disabled: boolean;
  t: StudioPalette;
  s: ReturnType<typeof buildStyles>;
  onSetCover: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={[s.slot, isCover && s.slotCover]}>
      {Platform.OS === "web" ? (
        // eslint-disable-next-line jsx-a11y/alt-text
        <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10 }} />
      ) : (
        <Image source={{ uri: url }} style={s.thumbImg} />
      )}

      {busy && (
        <View style={s.thumbOverlay}>
          <ActivityIndicator size="small" color="#fff" />
        </View>
      )}

      {isCover && (
        <View style={s.coverBadge}>
          <Icon name="star" size={9} color="#fff" />
          <Text style={s.coverBadgeTxt}>Capa</Text>
        </View>
      )}

      {/* Remover — sempre disponível. hitSlop generoso: o botão é 18px
          por caber na miniatura, mas é ação destrutiva e no celular
          precisa de alvo de toque de verdade. */}
      <Pressable
        onPress={onRemove}
        disabled={disabled}
        hitSlop={12}
        style={s.removeBtn}
        accessibilityRole="button"
        accessibilityLabel="Remover foto"
      >
        <Icon name="x" size={11} color="#fff" />
      </Pressable>

      {/* Definir como capa — só nas fotos que não são a capa */}
      {!isCover && (
        <Pressable
          onPress={onSetCover}
          disabled={disabled}
          style={s.setCoverBtn}
          accessibilityRole="button"
          accessibilityLabel="Definir esta foto como capa"
        >
          <Icon name="star" size={10} color={t.primary} />
          <Text style={s.setCoverBtnTxt}>Definir capa</Text>
        </Pressable>
      )}
    </View>
  );
}

// ───────────────────────────────────────────────────────────
// Styles
// ───────────────────────────────────────────────────────────
function buildStyles(t: StudioPalette) {
  return StyleSheet.create({
    field: { gap: 6 },
    fieldLabel: {
      fontSize: 11,
      color: t.ink3,
      fontWeight: "700",
      letterSpacing: 0.4,
    },
    hint: { fontSize: 11, color: t.ink3, lineHeight: 15, marginBottom: 4 },
    maxHint: { fontSize: 11, color: t.ink3, marginTop: 2 },

    // Grid — quebra linha sozinho em tela estreita (mobile).
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },

    slot: {
      width: THUMB,
      height: THUMB,
      borderRadius: 12,
      backgroundColor: t.bgSoft,
      borderWidth: 1.5,
      borderColor: t.ink5,
      overflow: "hidden",
      position: "relative",
    },
    slotCover: { borderColor: t.primary, borderWidth: 2 },

    slotAdd: {
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      borderStyle: "dashed" as any,
      borderColor: t.primary,
      backgroundColor: t.primaryGhost,
    },
    slotAddTxt: { fontSize: 10, color: t.primary, fontWeight: "700" },

    thumbImg: { width: "100%", height: "100%" },
    thumbOverlay: {
      position: "absolute",
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(15,23,42,0.55)",
      alignItems: "center",
      justifyContent: "center",
    },

    coverBadge: {
      position: "absolute",
      top: 4,
      left: 4,
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: t.primary,
    },
    coverBadgeTxt: { fontSize: 9, color: "#fff", fontWeight: "800", letterSpacing: 0.2 },

    removeBtn: {
      position: "absolute",
      top: 4,
      right: 4,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: "rgba(15,23,42,0.65)",
      alignItems: "center",
      justifyContent: "center",
    },

    setCoverBtn: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      paddingVertical: 4,
      backgroundColor: "rgba(255,255,255,0.92)",
    },
    setCoverBtnTxt: { fontSize: 9, color: t.primary, fontWeight: "800" },
  });
}
