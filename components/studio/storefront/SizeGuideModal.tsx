// ============================================================
// components/studio/storefront/SizeGuideModal.tsx
// Modal público do storefront — exibe o guia de medidas do produto.
// Renderiza imagem (png/jpeg/webp) inline ou PDF via embed/link.
// Tokens do storefront (dark-first: T.bg, T.card, T.ink*).
// Respects reduceMotion — sem animações de entrada.
// ============================================================
import { useEffect } from "react";
import { View, Text, Pressable, Modal, ScrollView, Platform } from "react-native";
import { T } from "./types";

export type SizeGuide = {
  file_url: string;
  content_type: string; // e.g. "image/png", "image/jpeg", "image/webp", "application/pdf"
};

export function SizeGuideModal({
  sizeGuide,
  onClose,
}: {
  sizeGuide: SizeGuide;
  onClose: () => void;
}) {
  const isImage =
    sizeGuide.content_type === "image/png" ||
    sizeGuide.content_type === "image/jpeg" ||
    sizeGuide.content_type === "image/jpg" ||
    sizeGuide.content_type === "image/webp";
  const isPdf = sizeGuide.content_type === "application/pdf";

  // Fechar com Escape no web
  useEffect(() => {
    if (Platform.OS !== "web") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <Modal
      transparent
      animationType="none" // reduceMotion: sem animação
      visible
      onRequestClose={onClose}
    >
      {/* Overlay */}
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.62)",
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        {/* Card — stopPropagation para não fechar ao clicar dentro */}
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: T.card,
            borderRadius: 16,
            width: "100%",
            maxWidth: 560,
            maxHeight: "90%" as any,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 18,
              paddingTop: 18,
              paddingBottom: 14,
              borderBottomWidth: 1,
              borderBottomColor: T.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 18 }}>📐</Text>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "800",
                  color: T.ink,
                  letterSpacing: -0.2,
                }}
              >
                Guia de medidas
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: T.bg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 16, color: T.ink3, fontWeight: "700" }}>✕</Text>
            </Pressable>
          </View>

          {/* Conteúdo */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 18 }}
          >
            {isImage && (
              <>
                {Platform.OS === "web" ? (
                  // @ts-ignore — img nativo no web
                  <img
                    src={sizeGuide.file_url}
                    alt="Guia de medidas"
                    style={{
                      width: "100%",
                      maxHeight: 520,
                      objectFit: "contain",
                      borderRadius: 8,
                      border: "1px solid " + T.border,
                      backgroundColor: T.bg,
                      display: "block",
                    } as any}
                  />
                ) : (
                  <View
                    style={{
                      backgroundColor: T.bg,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: T.border,
                      padding: 16,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontSize: 13, color: T.ink3, textAlign: "center" }}>
                      Abra no browser para visualizar a imagem.
                    </Text>
                    <Pressable
                      onPress={() => {
                        if (typeof window !== "undefined") {
                          window.open(sizeGuide.file_url, "_blank");
                        }
                      }}
                      style={{
                        marginTop: 12,
                        backgroundColor: T.primary,
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 8,
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>
                        Abrir imagem
                      </Text>
                    </Pressable>
                  </View>
                )}
              </>
            )}

            {isPdf && (
              <View style={{ gap: 12 }}>
                {Platform.OS === "web" ? (
                  // @ts-ignore — iframe nativo no web
                  <iframe
                    src={sizeGuide.file_url}
                    title="Guia de medidas (PDF)"
                    style={{
                      width: "100%",
                      height: 480,
                      border: "1px solid " + T.border,
                      borderRadius: 8,
                      display: "block",
                    } as any}
                  />
                ) : (
                  <View
                    style={{
                      backgroundColor: T.bg,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: T.border,
                      padding: 20,
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Text style={{ fontSize: 28 }}>📄</Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: T.ink2,
                        fontWeight: "700",
                        textAlign: "center",
                      }}
                    >
                      Guia de medidas em PDF
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: T.ink3,
                        textAlign: "center",
                      }}
                    >
                      Clique para abrir o PDF no seu navegador.
                    </Text>
                  </View>
                )}

                {/* Botão de link — sempre visível como fallback */}
                <Pressable
                  onPress={() => {
                    if (typeof window !== "undefined") {
                      window.open(sizeGuide.file_url, "_blank");
                    }
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    paddingVertical: 11,
                    paddingHorizontal: 16,
                    borderRadius: 9,
                    borderWidth: 1.5,
                    borderColor: T.primary,
                    backgroundColor: "rgba(30,58,138,0.06)",
                    alignSelf: "center",
                  }}
                >
                  <Text style={{ fontSize: 14 }}>📥</Text>
                  <Text
                    style={{
                      fontSize: 13,
                      color: T.primary,
                      fontWeight: "700",
                    }}
                  >
                    Abrir guia (PDF)
                  </Text>
                </Pressable>
              </View>
            )}

            {!isImage && !isPdf && (
              // Tipo desconhecido — link genérico
              <View
                style={{
                  backgroundColor: T.bg,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: T.border,
                  padding: 20,
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Text style={{ fontSize: 28 }}>📎</Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: T.ink2,
                    fontWeight: "700",
                    textAlign: "center",
                  }}
                >
                  Guia de medidas
                </Text>
                <Pressable
                  onPress={() => {
                    if (typeof window !== "undefined") {
                      window.open(sizeGuide.file_url, "_blank");
                    }
                  }}
                  style={{
                    marginTop: 8,
                    backgroundColor: T.primary,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>
                    Abrir arquivo
                  </Text>
                </Pressable>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: T.border,
              padding: 14,
              alignItems: "center",
            }}
          >
            <Pressable
              onPress={onClose}
              style={{
                paddingHorizontal: 24,
                paddingVertical: 11,
                borderRadius: 9,
                backgroundColor: T.bg,
                borderWidth: 1.5,
                borderColor: T.border,
              }}
            >
              <Text style={{ color: T.ink2, fontSize: 14, fontWeight: "700" }}>Fechar</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
