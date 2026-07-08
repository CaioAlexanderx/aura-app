// CertificatePreview — preview ao vivo do certificado (iframe escalado, web).
// + printCertificate: abre o HTML em nova janela e dispara impressão/PDF.
import React from "react";
import { View, Text, Platform, StyleSheet } from "react-native";
import { buildCertificateHtml, CertData, CertTemplate } from "./buildCertificateHtml";
import { KarateColors as P } from "@/constants/karateTheme";

const A4L_W = 1122; // 297mm @96dpi
const A4L_H = 794;  // 210mm @96dpi

export function CertificatePreview({ data, template, width = 560, watermarkUrl }: {
  data: CertData; template: CertTemplate; width?: number; watermarkUrl?: string | null;
}) {
  const html = buildCertificateHtml(data, template, watermarkUrl);
  const scale = width / A4L_W;
  const h = Math.round(A4L_H * scale);
  if (Platform.OS !== "web") {
    return <View style={[st.ph, { width, height: h }]}><Text style={st.phTxt}>Preview disponível no navegador</Text></View>;
  }
  return React.createElement(
    "div",
    { style: { width, height: h, overflow: "hidden", borderRadius: 10, border: "1px solid rgba(43,38,32,0.12)", boxShadow: "0 8px 24px rgba(28,23,20,0.10)", background: "#fff" } },
    React.createElement("iframe", {
      srcDoc: html, title: "Preview do certificado",
      style: { width: A4L_W, height: A4L_H, border: 0, transform: `scale(${scale})`, transformOrigin: "top left" },
      sandbox: "allow-same-origin",
    })
  );
}

export function printCertificate(data: CertData, template: CertTemplate, watermarkUrl?: string | null) {
  if (Platform.OS !== "web") return;
  const html = buildCertificateHtml(data, template, watermarkUrl);
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.open(); w.document.write(html); w.document.close();
  // dá tempo do QR/selos carregarem antes de imprimir
  setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 900);
}

const st = StyleSheet.create({
  ph: { alignItems: "center", justifyContent: "center", backgroundColor: P.glass, borderRadius: 10, borderWidth: 1, borderColor: P.border },
  phTxt: { color: P.ink3, fontSize: 12 },
});

export default CertificatePreview;
