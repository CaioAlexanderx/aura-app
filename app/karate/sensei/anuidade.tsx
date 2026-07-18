// F1 Aura Dojô (compat): /karate/sensei/anuidade →
// /karate/(dojo)/anuidade (conteúdo movido, mesmo componente).
import React from "react";
import { Redirect } from "expo-router";

export default function SenseiAnuidadeCompat() {
  return <Redirect href={"/karate/(dojo)/anuidade" as any} />;
}
