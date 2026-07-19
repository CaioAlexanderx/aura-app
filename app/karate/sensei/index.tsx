// F1 Aura Dojô (compat): /karate/sensei → Painel do dojô.
// O conteúdo antigo (lista de praticantes + pirâmide) vive em
// /karate/(dojo)/praticantes; o home novo é o Painel, que resume tudo
// e linka pra cada seção. Href com o nome do grupo: as URLs do dojô
// são compartilhadas com o grupo (federation).
import React from "react";
import { Redirect } from "expo-router";

export default function SenseiIndexCompat() {
  return <Redirect href={"/karate/(dojo)" as any} />;
}
