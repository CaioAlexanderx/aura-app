// ============================================================
// BannerCarousel — carrossel de banners do hub público FPKT
//
// Busca GET /public/karate/:slug/banners?placement=hub e renderiza
// cada banner respeitando seu aspect-ratio:
//   square   → 1:1
//   story    → 9:16 (teto: 320px)
//   landscape → 16:9
//
// Tocar num banner com event_id navega para a inscrição do evento;
// sem event_id é puramente visual.
// Se não houver banners: renderiza null (sem placeholder).
// ============================================================
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Image, ScrollView, TouchableOpacity, StyleSheet,
  useWindowDimensions, ViewStyle, Platform, NativeSyntheticEvent, NativeScrollEvent,
} from "react-native";
import { useRouter } from "expo-router";
import { HubBanner, karatePublicApi } from "@/services/karatePublicApi";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";

interface Props {
  slug: string;
}

// Aspect-ratio helpers (altura relativa a uma largura)
const STORY_MAX_H = 320;
function bannerHeight(format: HubBanner["format"], width: number): number {
  if (format === "square") return width;
  if (format === "story") return Math.min(STORY_MAX_H, width * (16 / 9));
  // landscape 16:9
  return Math.round(width * (9 / 16));
}

export function BannerCarousel({ slug }: Props) {
  const [banners, setBanners] = useState<HubBanner[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    let alive = true;
    karatePublicApi
      .getBanners(slug)
      .then((r) => { if (alive) setBanners(r.banners || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [slug]);

  const { width: screenW } = useWindowDimensions();
  // Para layout de portal (sidebar 248px em telas largas), limitar largura do carrossel
  const maxW = Math.min(screenW, 760);
  const itemW = maxW;

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / itemW);
    setActiveIndex(idx);
  }, [itemW]);

  if (banners.length === 0) return null;

  // Use the format of the first banner as the "dominant" height for the container
  const containerH = bannerHeight(banners[0].format, itemW);

  return (
    <View style={[styles.wrap, { height: containerH }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={itemW}
        snapToAlignment="start"
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {banners.map((banner) => {
          const h = bannerHeight(banner.format, itemW);
          return (
            <TouchableOpacity
              key={banner.id}
              activeOpacity={banner.event_id ? 0.85 : 1}
              onPress={() => {
                if (banner.event_id) {
                  router.push(`/karate/${slug}/inscricao/${banner.event_id}` as any);
                }
              }}
              style={[styles.slide, { width: itemW, height: containerH }]}
            >
              <Image
                source={{ uri: banner.image_url }}
                style={[styles.img, { width: itemW, height: h }]}
                resizeMode="cover"
                accessibilityLabel={banner.title}
              />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Paginação (dots) — só quando há mais de 1 banner */}
      {banners.length > 1 && (
        <View style={styles.dots}>
          {banners.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    borderRadius: KarateRadius.lg,
    overflow: "hidden",
    position: "relative",
    backgroundColor: KarateColors.bg2,
  } as ViewStyle,
  scroll: { flex: 1 } as ViewStyle,
  scrollContent: {} as ViewStyle,
  slide: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,
  img: {
    borderRadius: KarateRadius.lg,
  } as any,
  dots: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  } as ViewStyle,
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(252,250,245,0.45)",
  } as ViewStyle,
  dotActive: {
    backgroundColor: "rgba(252,250,245,0.95)",
    width: 18,
  } as ViewStyle,
});
