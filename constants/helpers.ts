import { Dimensions } from "react-native";

export const SCREEN_W = Dimensions.get("window").width;
export const IS_WIDE = SCREEN_W > 768;
export const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
export const fmtK = (n: number) => n >= 1000 ? `R$ ${(n / 1000).toFixed(1)}k` : fmt(n);
