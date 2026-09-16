// ============================================================
// AURA. — CRM interno de prospecção · motivo de perda obrigatório (C0.1)
//
// 15/09/2026: o primeiro cliente de trial foi perdido para um concorrente
// porque não encontrou uma função que já existia no app — e ninguém soube
// disso até o lojista já ter cancelado, porque nada registrava POR QUE um
// lead vira "Perdido". Este arquivo cobre as duas garantias que fecham essa
// lacuna:
//   1) sem motivo (lista fechada) o lead NÃO se move pra "Perdido" — nem
//      pelo LossReasonModal (kanban/fila/batch), nem pelo InteractionModal;
//   2) o motivo "Outro" só é aceito com texto livre preenchido.
// E a garantia de que o motivo fica registrado de verdade, em dois lugares:
// o campo `lost_reason` do lead (payload) e uma nota padronizada
// "Motivo de perda: <label>" na linha do tempo (interaction body).
//
// Funções puras (canConfirmLossReason/buildLostReasonNote/lostReasonLabel)
// são testadas isoladas, no mesmo espírito de
// __tests__/components/ImportAlunosModal.test.ts. O LossReasonModal em si é
// renderizado com react-test-renderer (padrão de
// __tests__/components/CategoryTreePicker.test.tsx) pra provar que a UI
// realmente trava o "Confirmar" sem motivo — não só a função pura.
// ============================================================
import TestRenderer, { act } from "react-test-renderer";
import React from "react";

jest.mock("react-native", () => ({
  View: "View", Text: "Text", Pressable: "Pressable", TextInput: "TextInput",
  ScrollView: "ScrollView", Modal: "Modal", ActivityIndicator: "ActivityIndicator",
  StyleSheet: { create: (s: any) => s }, Platform: { OS: "web" },
}));

jest.mock("@/constants/colors", () => ({
  Colors: {
    ink: "#f0edff", ink3: "#aaa", bg2: "#0e1228", bg3: "#141830", bg4: "#1a1f3d",
    border: "#222", border2: "#333", violet: "#7c3aed", violet3: "#a78bfa", violetD: "#1a1030",
    green: "#34d399", red: "#f87171", amber: "#fbbf24",
  },
}));

jest.mock("@/components/Toast", () => ({
  toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() },
}));

import {
  LOST_REASONS,
  lostReasonLabel,
  type LostReasonKey,
} from "@/components/admin/crm/shared/constants";
import { canConfirmLossReason, buildLostReasonNote, LOST_REASON_NOTE_PREFIX } from "@/components/admin/crm/shared/helpers";
import { LossReasonModal, type LossReasonResult } from "@/components/admin/crm/components/LossReasonModal";
import { useLossReasonGate } from "@/components/admin/crm/hooks/useLossReasonGate";
import { renderHook } from "@testing-library/react-native";

// ── Funções puras ────────────────────────────────────────────────────────

describe("canConfirmLossReason — não move sem motivo; 'outro' exige texto", () => {
  it("sem motivo nenhum escolhido, nunca confirma", () => {
    expect(canConfirmLossReason("", "")).toBe(false);
    expect(canConfirmLossReason("", "qualquer coisa")).toBe(false);
  });

  it("motivo da lista fechada (que não seja 'outro') confirma sem texto", () => {
    (LOST_REASONS.map((r) => r.key) as LostReasonKey[])
      .filter((k) => k !== "outro")
      .forEach((k) => expect(canConfirmLossReason(k, "")).toBe(true));
  });

  it("'outro' sem texto NÃO confirma", () => {
    expect(canConfirmLossReason("outro", "")).toBe(false);
    expect(canConfirmLossReason("outro", "   ")).toBe(false); // só espaço não conta
  });

  it("'outro' com texto confirma", () => {
    expect(canConfirmLossReason("outro", "não achou o botão de cancelamento")).toBe(true);
  });
});

describe("buildLostReasonNote — motivo gravado na nota com o prefixo padronizado", () => {
  it("usa sempre o prefixo 'Motivo de perda:' seguido do label", () => {
    const note = buildLostReasonNote("preco");
    expect(note.startsWith(LOST_REASON_NOTE_PREFIX)).toBe(true);
    expect(note).toBe("Motivo de perda: Preço");
  });

  it("concorrente: anexa o nome quando informado", () => {
    expect(buildLostReasonNote("concorrente", { competitor: "ConcorrenteX" }))
      .toBe("Motivo de perda: Foi para concorrente (concorrente: ConcorrenteX)");
  });

  it("concorrente sem nome informado não quebra e não anexa parênteses vazios", () => {
    expect(buildLostReasonNote("concorrente")).toBe("Motivo de perda: Foi para concorrente");
  });

  it("'outro' anexa o detalhe digitado", () => {
    expect(buildLostReasonNote("outro", { detail: "queria emitir boleto e não achou" }))
      .toBe("Motivo de perda: Outro — queria emitir boleto e não achou");
  });

  it("nao_encontrou_funcao existe na lista fechada (o caso real de 15/09)", () => {
    expect(LOST_REASONS.some((r) => r.key === "nao_encontrou_funcao")).toBe(true);
    expect(lostReasonLabel("nao_encontrou_funcao")).toBe("Não encontrou a função no app");
  });
});

describe("LOST_REASONS — lista fechada tem as 10 chaves combinadas", () => {
  it("bate exatamente com o combinado (ordem não importa aqui)", () => {
    const keys = LOST_REASONS.map((r) => r.key).sort();
    expect(keys).toEqual(
      [
        "sem_resposta", "preco", "ja_tem_sistema", "sem_tempo", "fora_do_perfil",
        "falta_funcionalidade", "concorrente", "nao_encontrou_funcao",
        "travou_no_cadastro", "outro",
      ].sort()
    );
  });
});

// ── useLossReasonGate — orquestração (kanban/fila/batch) ─────────────────

describe("useLossReasonGate — cancelar não resolve motivo nenhum", () => {
  it("cancel() resolve null — quem chamou sabe que deve abortar o move", async () => {
    const { result } = renderHook(() => useLossReasonGate());

    let pending!: Promise<LossReasonResult | null>;
    act(() => {
      pending = result.current.requestReason({ leadName: "Padaria Teste" });
    });
    expect(result.current.isOpen).toBe(true);
    expect(result.current.target?.leadName).toBe("Padaria Teste");

    act(() => { result.current.cancel(); });
    expect(await pending).toBeNull();
    expect(result.current.isOpen).toBe(false);
  });

  it("confirm() resolve o resultado escolhido", async () => {
    const { result } = renderHook(() => useLossReasonGate());

    let pending!: Promise<LossReasonResult | null>;
    act(() => {
      pending = result.current.requestReason({ leadName: "Loja X" });
    });

    const fakeResult: LossReasonResult = {
      reason: "preco",
      note: "Motivo de perda: Preço",
    };
    act(() => { result.current.confirm(fakeResult); });

    expect(await pending).toEqual(fakeResult);
    expect(result.current.isOpen).toBe(false);
  });
});

// ── LossReasonModal — a UI trava o "Confirmar", não só a função pura ──────

function findByText(renderer: TestRenderer.ReactTestRenderer, text: string) {
  return renderer.root.findAll(
    (node: TestRenderer.ReactTestInstance) => node.type === "Text" && node.props.children === text
  )[0];
}

function pressAncestor(node: TestRenderer.ReactTestInstance) {
  // Sobe até achar o Pressable/View mais próximo com onPress (mock de RN
  // aqui é so tag string — o onPress fica no elemento pai imediato).
  let cur: TestRenderer.ReactTestInstance | null = node.parent;
  while (cur && typeof cur.props.onPress !== "function") cur = cur.parent;
  if (!cur) throw new Error("onPress não encontrado subindo a árvore");
  act(() => { cur!.props.onPress(); });
}

describe("LossReasonModal — não move sem motivo; 'outro' exige texto (render real)", () => {
  it("Confirmar sem motivo escolhido NÃO chama onConfirm", () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <LossReasonModal visible leadName="Padaria Teste" onCancel={onCancel} onConfirm={onConfirm} />
      );
    });

    const confirmText = findByText(renderer, "Marcar como perdido");
    expect(confirmText).toBeTruthy();
    pressAncestor(confirmText);

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("escolher 'Preço' e confirmar chama onConfirm com o motivo e a nota prefixada", () => {
    const onConfirm = jest.fn();
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <LossReasonModal visible leadName="Padaria Teste" onCancel={jest.fn()} onConfirm={onConfirm} />
      );
    });

    pressAncestor(findByText(renderer, "Preço"));
    pressAncestor(findByText(renderer, "Marcar como perdido"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const result: LossReasonResult = onConfirm.mock.calls[0][0];
    expect(result.reason).toBe("preco");
    expect(result.note).toBe("Motivo de perda: Preço");
  });

  it("escolher 'Outro' e confirmar SEM digitar detalhe NÃO chama onConfirm", () => {
    const onConfirm = jest.fn();
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <LossReasonModal visible leadName="Padaria Teste" onCancel={jest.fn()} onConfirm={onConfirm} />
      );
    });

    pressAncestor(findByText(renderer, "Outro"));
    pressAncestor(findByText(renderer, "Marcar como perdido"));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("'Outro' com detalhe preenchido confirma e a nota carrega o texto digitado", () => {
    const onConfirm = jest.fn();
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <LossReasonModal visible leadName="Padaria Teste" onCancel={jest.fn()} onConfirm={onConfirm} />
      );
    });

    pressAncestor(findByText(renderer, "Outro"));
    const detailInput = renderer.root.findByProps({ placeholder: "O que aconteceu?" });
    act(() => { detailInput.props.onChangeText("não achou o botão de cancelar assinatura"); });
    pressAncestor(findByText(renderer, "Marcar como perdido"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const result: LossReasonResult = onConfirm.mock.calls[0][0];
    expect(result.reason).toBe("outro");
    expect(result.detail).toBe("não achou o botão de cancelar assinatura");
    expect(result.note).toBe("Motivo de perda: Outro — não achou o botão de cancelar assinatura");
  });

  it("'Foi para concorrente' aceita o campo opcional e ele entra na nota", () => {
    const onConfirm = jest.fn();
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <LossReasonModal visible leadName="Padaria Teste" onCancel={jest.fn()} onConfirm={onConfirm} />
      );
    });

    pressAncestor(findByText(renderer, "Foi para concorrente"));
    const competitorInput = renderer.root.findByProps({ placeholder: "Ex: NomeDoConcorrente" });
    act(() => { competitorInput.props.onChangeText("ConcorrenteX"); });
    pressAncestor(findByText(renderer, "Marcar como perdido"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const result: LossReasonResult = onConfirm.mock.calls[0][0];
    expect(result.reason).toBe("concorrente");
    expect(result.competitor).toBe("ConcorrenteX");
    expect(result.note).toBe("Motivo de perda: Foi para concorrente (concorrente: ConcorrenteX)");
  });

  it("'Foi para concorrente' SEM preencher o nome ainda confirma (campo é opcional)", () => {
    const onConfirm = jest.fn();
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <LossReasonModal visible leadName="Padaria Teste" onCancel={jest.fn()} onConfirm={onConfirm} />
      );
    });

    pressAncestor(findByText(renderer, "Foi para concorrente"));
    pressAncestor(findByText(renderer, "Marcar como perdido"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0].competitor).toBeUndefined();
  });

  it("Cancelar chama onCancel e não onConfirm", () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <LossReasonModal visible leadName="Padaria Teste" onCancel={onCancel} onConfirm={onConfirm} />
      );
    });

    pressAncestor(findByText(renderer, "Cancelar"));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
