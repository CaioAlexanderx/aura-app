// ============================================================
// Helpers — Tags do dojô (F11)
//
// Mapeia os erros do backend (src/routes/karateDojoTags.js) pro campo
// certo do form, em pt-BR — mesmo racional de mapStudentSaveError
// (dojoAlunos/helpers.ts) e mapClassesError (dojoTurmas/helpers.ts).
// ============================================================

export type TagErrorField = "name" | "general";

export function mapTagError(e: any): { field: TagErrorField; message: string } {
  const code = e?.data?.code ?? e?.code ?? null;
  const apiErrors: string[] = Array.isArray(e?.data?.errors) ? e.data.errors : [];

  if (code === "DUPLICATE_TAG_NAME") {
    return { field: "name", message: "Já existe uma tag com este nome (maiúsculas e minúsculas não diferenciam)." };
  }
  if (code === "TAG_EM_USO") {
    return {
      field: "general",
      message: "Esta tag está atribuída a alunos e não pode ser excluída. Desative-a para preservar o histórico.",
    };
  }
  if (code === "TAG_INATIVA") {
    return {
      field: "general",
      message: "Esta tag está desativada e não pode ser atribuída. Reative-a em Configurações ou escolha outra.",
    };
  }
  if (code === "VALIDATION_ERROR") {
    const joined = apiErrors.join(" ");
    if (/name/i.test(joined)) return { field: "name", message: "Informe um nome para a tag." };
    return { field: "general", message: apiErrors[0] || "Dados inválidos — confira o formulário." };
  }
  if (code === "SCHEMA_PENDING") {
    return { field: "general", message: "As tags ainda não estão disponíveis neste ambiente (atualização pendente no servidor)." };
  }
  if (code === "PORTAL_READ_ONLY") {
    return { field: "general", message: "O portal do dojô é somente leitura. Entre com a conta do dojô para alterar tags." };
  }
  if (code === "NOT_FOUND" || code === "TAG_NOT_FOUND") {
    return { field: "general", message: "Tag não encontrada — talvez tenha sido removida em outra aba." };
  }
  return { field: "general", message: e?.data?.error || e?.message || "Não foi possível concluir. Tente de novo." };
}
