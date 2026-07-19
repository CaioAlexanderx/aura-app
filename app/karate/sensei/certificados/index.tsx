// F1 Aura Dojô (compat): /karate/sensei/certificados →
// /karate/(dojo)/certificados (conteúdo movido, MOCK_APTOS intocado).
import React from "react";
import { Redirect } from "expo-router";

export default function SenseiCertificadosCompat() {
  return <Redirect href={"/karate/(dojo)/certificados" as any} />;
}
