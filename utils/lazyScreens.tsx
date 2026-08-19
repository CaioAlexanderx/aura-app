import { lazy, Suspense, ComponentType } from "react";
import { View, ActivityIndicator, StyleSheet, Text, Platform } from "react-native";
import { Colors } from "@/constants/colors";

// ============================================================
// FE-05: Lazy Loading wrapper for heavy screens
// Reduces initial bundle by code-splitting large screens
// ============================================================

interface LazyScreenOptions {
  fallbackMessage?: string;
}

/**
 * Creates a lazy-loaded screen component with loading indicator
 * Usage: const LazyEstoque = createLazyScreen(() => import('@/screens/Estoque'));
 */
export function createLazyScreen<P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  options: LazyScreenOptions = {},
) {
  // React.lazy only works on web; on native, import eagerly
  if (Platform.OS !== "web") {
    // For native, just return a wrapper that imports eagerly
    let Component: ComponentType<P> | null = null;
    const promise = importFn().then(mod => { Component = mod.default; });

    return function NativeLazyScreen(props: P) {
      if (!Component) return <LazyFallback message={options.fallbackMessage} />;
      return <Component {...props} />;
    };
  }

  const LazyComponent = lazy(importFn);

  return function LazyScreen(props: P) {
    return (
      <Suspense fallback={<LazyFallback message={options.fallbackMessage} />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

function LazyFallback({ message }: { message?: string }) {
  return (
    <View style={s.container}>
      <ActivityIndicator size="large" color={Colors.violet || "#7C3AED"} />
      {message && <Text style={s.text}>{message}</Text>}
    </View>
  );
}

/**
 * Pre-configured lazy screens for the heaviest files:
 * - estoque.tsx (42KB)
 * - financeiro.tsx (32KB)
 * - contabilidade.tsx (31KB)
 * - whatsapp.tsx (29KB)
 * - clientes.tsx (26KB)
 *
 * Usage in _layout.tsx or tabs:
 *   import { LazyScreens } from '@/utils/lazyScreens';
 *   // Replace direct import with LazyScreens.Estoque
 */
export const LazyScreens = {
  // These would be used if screens were extracted to separate files
  // For now, document the pattern for future use
};

const s = StyleSheet.create({
  container: {
    flex: 1, justifyContent: "center", alignItems: "center",
    backgroundColor: "transparent", gap: 12,
  },
  text: { fontSize: 12, color: Colors.ink3 || "#888" },
});

export default createLazyScreen;
