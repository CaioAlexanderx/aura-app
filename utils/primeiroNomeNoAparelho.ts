// ============================================================
// Primeiro nome do último login neste aparelho (tq-67, 21/10/2026)
//
// A saudação do login chama pelo nome quem já entrou aqui ("Boa tarde,
// Caio."). Guarda SÓ o primeiro nome — nunca o e-mail, nunca o nome
// completo — no localStorage da web, gravado no último login que deu certo.
// No nativo não guarda nada (a saudação sai no genérico).
//
// Toda leitura e escrita vai em try/catch: aba anônima, storage bloqueado
// ou cheio não podem quebrar o login.
// ============================================================
import { Platform } from "react-native";
import { primeiroNome } from "@/utils/saudacao";

export const CHAVE_PRIMEIRO_NOME = "aura_primeiro_nome";
// Um nome não passa disso; acima é lixo e não vai para a tela.
const LIMITE = 40;

function storageDaWeb(): Storage | null {
  if (Platform.OS !== "web") return null;
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export function lerPrimeiroNome(): string {
  const ls = storageDaWeb();
  if (!ls) return "";
  try {
    const v = primeiroNome(ls.getItem(CHAVE_PRIMEIRO_NOME));
    return v.length <= LIMITE ? v : "";
  } catch {
    return "";
  }
}

export function guardarPrimeiroNome(nomeCompleto?: string | null): void {
  const ls = storageDaWeb();
  if (!ls) return;
  const v = primeiroNome(nomeCompleto);
  try {
    // Sem nome (ou um e-mail no lugar do nome): apaga, para não saudar o
    // próximo login com o nome de outra pessoa.
    if (!v || v.includes("@") || v.length > LIMITE) ls.removeItem(CHAVE_PRIMEIRO_NOME);
    else ls.setItem(CHAVE_PRIMEIRO_NOME, v);
  } catch {}
}
