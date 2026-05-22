import React from "react";
import Svg, { Path, Ellipse, Defs, LinearGradient, RadialGradient, Stop } from "react-native-svg";

type Variant = "gradient" | "cherry" | "violet" | "white" | "black" | "outline";

interface Props {
  size?: number;
  variant?: Variant;
  withHighlight?: boolean; // o highlight branco superior
  withCore?: boolean;       // o core amber quente
}

// Mark canônico Aura Food. Derivado do glifo do site (food.html).
// Usar este componente em todo lugar — nada de SVG inline.
export function AuraFoodMark({
  size = 32,
  variant = "gradient",
  withHighlight = true,
  withCore = true,
}: Props) {
  const id = React.useId();
  const flameId = `food-flame-${id}`;
  const coreId  = `food-core-${id}`;

  const fill =
    variant === "gradient" ? `url(#${flameId})` :
    variant === "cherry"   ? "#EF4444" :
    variant === "violet"   ? "#7c3aed" :
    variant === "white"    ? "#ffffff" :
    variant === "black"    ? "#0a0a0f" :
    "none";

  const stroke = variant === "outline" ? "#0a0a0f" : "none";
  const strokeWidth = variant === "outline" ? 2.4 : 0;

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id={flameId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#EF4444"/>
          <Stop offset="0.6" stopColor="#EF4444"/>
          <Stop offset="1" stopColor="#7c3aed"/>
        </LinearGradient>
        <RadialGradient id={coreId} cx="0.5" cy="0.55" rx="0.4" ry="0.4">
          <Stop offset="0" stopColor="#FCD34D" stopOpacity="0.95"/>
          <Stop offset="0.6" stopColor="#FCD34D" stopOpacity="0"/>
        </RadialGradient>
      </Defs>
      <Path
        d="M32 6 C 25 14, 21 21, 21 32 C 21 41, 25 46, 32 51 C 39 46, 43 41, 43 32 C 43 21, 39 14, 32 6 Z"
        fill={fill} stroke={stroke} strokeWidth={strokeWidth}
      />
      {withCore && variant === "gradient" && (
        <Ellipse cx="32" cy="36" rx="5.5" ry="8" fill={`url(#${coreId})`}/>
      )}
      {withHighlight && (variant === "gradient" || variant === "cherry") && (
        <Path
          d="M30 12 C 27 18, 26 22, 26 28"
          fill="none" stroke="#ffffff" strokeWidth="1.2"
          strokeLinecap="round" opacity={0.55}
        />
      )}
    </Svg>
  );
}
