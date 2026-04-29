// ============================================================
// AURA. — _svgShim (PR43.7, 2026-04-29)
//
// Shim que reproduz a API de react-native-svg usando React.createElement
// pra elementos SVG nativos do DOM. Web-only — em native renderiza null/View.
//
// Motivacao: aura-app eh web-first (Cloudflare Pages); adicionar
// react-native-svg quebrou o build porque o package-lock.json ficou
// out-of-sync e o lock e grande demais pra propagar via tooling.
//
// Este shim deixa o Odontograma2D usar a mesma API sem dependencia externa.
// Native (iOS/Android) ainda nao renderiza odontograma — sera tratado
// quando o app sair pra mobile native.
// ============================================================

import React from "react";
import { Platform, View } from "react-native";

const isWeb = Platform.OS === "web";

type AnyProps = Record<string, any>;

function makeSvgEl(tag: string) {
  return function SvgEl(props: AnyProps) {
    if (!isWeb) return null;
    const { children, ...rest } = props || {};
    return React.createElement(tag, rest, children);
  };
}

// <Svg> root container
export default function Svg(props: AnyProps) {
  const { children, width, height, viewBox, style, ...rest } = props || {};
  if (!isWeb) {
    return React.createElement(View, { style }, null);
  }
  return React.createElement(
    "svg",
    {
      width,
      height,
      viewBox,
      xmlns: "http://www.w3.org/2000/svg",
      style,
      ...rest,
    },
    children
  );
}

// Primitivos SVG usados pelo Odontograma2D
export const Path = makeSvgEl("path");
export const Rect = makeSvgEl("rect");
export const Circle = makeSvgEl("circle");
export const Ellipse = makeSvgEl("ellipse");
export const Defs = makeSvgEl("defs");
export const LinearGradient = makeSvgEl("linearGradient");
export const RadialGradient = makeSvgEl("radialGradient");
export const Stop = makeSvgEl("stop");
export const G = makeSvgEl("g");
export const Text = makeSvgEl("text");
