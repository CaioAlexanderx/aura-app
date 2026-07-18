// F1 Aura Dojô (compat): /karate/sensei/eventos →
// /karate/(dojo)/eventos (conteúdo movido, mesmo componente).
import React from "react";
import { Redirect } from "expo-router";

export default function SenseiEventosCompat() {
  return <Redirect href={"/karate/(dojo)/eventos" as any} />;
}
