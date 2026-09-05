// ============================================================
// Busca de clientes (05/09/2026) — modulo puro, sem React.
//
// Extraida da tela do Studio para o teste nao precisar carregar a tela
// inteira (que puxa Reanimated). Mesma regra da tela comum: nome,
// e-mail, @instagram e, com 3+ digitos, parte do telefone.
// ============================================================
import type { Customer } from "./types";

export function filtrarClientes(lista: Customer[], busca: string): Customer[] {
  const q = String(busca || "").trim().toLowerCase();
  if (!q) return lista;
  const digitos = q.replace(/\D/g, "");
  return lista.filter((c) =>
    c.name.toLowerCase().includes(q) ||
    (c.email || "").toLowerCase().includes(q) ||
    (c.instagram || "").toLowerCase().includes(q) ||
    (digitos.length >= 3 && (c.phone || "").replace(/\D/g, "").includes(digitos)),
  );
}
