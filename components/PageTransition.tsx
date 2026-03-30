import { useEffect, useRef, useState } from "react";
import { View, Animated, Platform, StyleSheet } from "react-native";
import { usePathname } from "expo-router";

type Props = { children: React.ReactNode };

// Web: CSS fade + slide-up animation
function WebTransition({ children }: Props) {
  const pathname = usePathname();
  const [key, setKey] = useState(pathname);
  const [animClass, setAnimClass] = useState("aura-page-enter");

  useEffect(() => {
    if (pathname !== key) {
      setAnimClass("aura-page-exit");
      const t = setTimeout(() => {
        setKey(pathname);
        setAnimClass("aura-page-enter");
      }, 150);
      return () => clearTimeout(t);
    }
  }, [pathname]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes auraPageIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes auraPageOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-4px); }
        }
        .aura-page-enter {
          animation: auraPageIn 0.25s ease-out forwards;
        }
        .aura-page-exit {
          animation: auraPageOut 0.15s ease-in forwards;
        }
      `}} />
      <div key={key} className={animClass} style={{ flex: 1, minHeight: "100%" } as any}>
        {children}
      </div>
    </>
  );
}

// Native: fade animation
function NativeTransition({ children }: Props) {
  const pathname = usePathname();
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const prevPath = useRef(pathname);

  useEffect(() => {
    if (pathname !== prevPath.current) {
      prevPath.current = pathname;
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [pathname]);

  return (
    <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>
      {children}
    </Animated.View>
  );
}

export function PageTransition({ children }: Props) {
  if (Platform.OS === "web") {
    return <WebTransition>{children}</WebTransition>;
  }
  return <NativeTransition>{children}</NativeTransition>;
}

export default PageTransition;
