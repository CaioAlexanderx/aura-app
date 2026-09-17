// ============================================================
// Agenda odonto — regras puras dos modais (mockup 16/09/2026).
//   1. Um botão principal por status (e "Editar / remarcar" some quando
//      o principal já é "Remarcar").
//   2. Conflito com a mesma regra do backend (dentista, status, encostar).
//   3. Próximo horário livre: para frente, depois para trás, dentro do dia.
//   4. Remarcar falta volta para agendado; cancelado vira agendamento novo.
//   5. Cancelamento exige motivo; "Outro" exige texto.
//   6. Progresso do "Confirmar amanhã".
// ============================================================
import {
  primaryActionFor,
  showEditButton,
  findConflicts,
  nextFreeSlot,
  rescheduleMode,
  isCancelValid,
  cancelReasonText,
  splitTomorrow,
  pendingTomorrowCount,
  tomorrowLocalString,
  localDayBoundsISO,
  dayLabel,
  whenLine,
  conflictLabel,
  shortDayTime,
  slotSummary,
} from "@/utils/dentalAgenda";

const at = (h: number, m = 0, day = 17) => new Date(2026, 8, day, h, m).toISOString();

describe("primaryActionFor", () => {
  it("segue a sequência Confirmar → Iniciar → Concluir → Retorno", () => {
    expect(primaryActionFor("agendado")).toMatchObject({ kind: "status", to: "confirmado", label: "Confirmar presença" });
    expect(primaryActionFor("confirmado")).toMatchObject({ kind: "status", to: "em_atendimento", label: "Iniciar atendimento", openConsulta: true });
    expect(primaryActionFor("paciente_consultorio")).toMatchObject({ to: "em_atendimento" });
    expect(primaryActionFor("em_atendimento")).toMatchObject({ kind: "conclude", label: "Concluir atendimento" });
    expect(primaryActionFor("concluido")).toMatchObject({ kind: "return", label: "Agendar retorno" });
  });
  it("falta, justificada e cancelado viram Remarcar e escondem o Editar", () => {
    for (const s of ["faltou", "falta_justificada", "cancelado"]) {
      expect(primaryActionFor(s)).toMatchObject({ kind: "reschedule", label: "Remarcar" });
      expect(showEditButton(s)).toBe(false);
    }
    expect(showEditButton("agendado")).toBe(true);
    expect(showEditButton("concluido")).toBe(true);
  });
  it("status vazio é tratado como agendado; avaliação segue para aprovado", () => {
    expect(primaryActionFor(undefined)).toMatchObject({ to: "confirmado" });
    expect(primaryActionFor("avaliacao")).toMatchObject({ to: "aprovado" });
  });
});

describe("findConflicts", () => {
  const list = [
    { id: "b", scheduled_at: at(14), duration_min: 30, practitioner_id: "p1", status: "agendado", patient_name: "Bruno" },
    { id: "c", scheduled_at: at(14, 15), duration_min: 30, practitioner_id: "p2", status: "agendado", patient_name: "Carla" },
    { id: "d", scheduled_at: at(15), duration_min: 30, practitioner_id: "p1", status: "faltou", patient_name: "Diego" },
    { id: "a", scheduled_at: at(9), duration_min: 60, practitioner_id: "p1", status: "confirmado", patient_name: "Ana" },
  ];
  it("acha sobreposição do mesmo dentista", () => {
    const r = findConflicts({ id: "a", scheduled_at: at(14), duration_min: 60, practitioner_id: "p1" }, list);
    expect(r.map((c) => c.id)).toEqual(["b"]);
  });
  it("ignora o próprio, outro dentista e status que não ocupam horário", () => {
    const r = findConflicts({ id: "b", scheduled_at: at(14), duration_min: 90, practitioner_id: "p1" }, list);
    expect(r).toEqual([]);
  });
  it("encostar não é conflito", () => {
    expect(findConflicts({ scheduled_at: at(13, 30), duration_min: 30, practitioner_id: "p1" }, list)).toEqual([]);
    expect(findConflicts({ scheduled_at: at(14, 30), duration_min: 30, practitioner_id: "p1" }, list)).toEqual([]);
  });
  it("sem dentista só conflita com sem dentista", () => {
    const semDentista = [{ id: "x", scheduled_at: at(10), duration_min: 30, practitioner_id: null, status: "agendado" }];
    expect(findConflicts({ scheduled_at: at(10), duration_min: 30, practitioner_id: null }, semDentista)).toHaveLength(1);
    expect(findConflicts({ scheduled_at: at(10), duration_min: 30, practitioner_id: "p1" }, semDentista)).toHaveLength(0);
  });
  it("devolve em ordem de horário e monta o rótulo do aviso", () => {
    const two = [
      { id: "2", scheduled_at: at(14, 30), duration_min: 30, practitioner_id: null, status: "agendado", patient_name: "Z" },
      { id: "1", scheduled_at: at(14), duration_min: 30, practitioner_id: null, status: "agendado", patient_name: "Bruno" },
    ];
    const r = findConflicts({ scheduled_at: at(14), duration_min: 60 }, two);
    expect(r.map((c) => c.id)).toEqual(["1", "2"]);
    expect(conflictLabel(r[0])).toBe("Bruno (14:00–14:30)");
  });
});

describe("nextFreeSlot", () => {
  const busy = [
    { id: "b", scheduled_at: at(14), duration_min: 30, practitioner_id: "p1", status: "agendado" },
    { id: "c", scheduled_at: at(14, 30), duration_min: 30, practitioner_id: "p1", status: "confirmado" },
  ];
  it("anda para frente de 15 em 15 min até caber", () => {
    const r = nextFreeSlot({ id: "a", scheduled_at: at(14), duration_min: 60, practitioner_id: "p1" }, busy);
    expect(r && r.getHours()).toBe(15);
    expect(r && r.getMinutes()).toBe(0);
  });
  it("sem espaço à frente, procura para trás", () => {
    const r = nextFreeSlot({ scheduled_at: at(18), duration_min: 60, practitioner_id: "p1" },
      [{ id: "z", scheduled_at: at(17, 30), duration_min: 90, practitioner_id: "p1", status: "agendado" }]);
    expect(r && `${r.getHours()}:${r.getMinutes()}`).toBe("16:30");
  });
  it("dia cheio devolve null", () => {
    const full = [{ id: "z", scheduled_at: at(7), duration_min: 12 * 60, practitioner_id: "p1", status: "agendado" }];
    expect(nextFreeSlot({ scheduled_at: at(10), duration_min: 30, practitioner_id: "p1" }, full)).toBeNull();
  });
});

describe("rescheduleMode", () => {
  it("falta e justificada voltam para agendado só quando mudou o horário", () => {
    expect(rescheduleMode("faltou", true)).toEqual({ mode: "patch", status: "agendado" });
    expect(rescheduleMode("falta_justificada", true)).toEqual({ mode: "patch", status: "agendado" });
    expect(rescheduleMode("faltou", false)).toEqual({ mode: "patch" });
  });
  it("cancelado é terminal: vira agendamento novo", () => {
    expect(rescheduleMode("cancelado", true)).toEqual({ mode: "create" });
  });
  it("demais status só mudam os campos", () => {
    expect(rescheduleMode("confirmado", true)).toEqual({ mode: "patch" });
  });
});

describe("cancelamento", () => {
  it("exige motivo", () => {
    expect(isCancelValid(null, "")).toBe(false);
    expect(isCancelValid("desmarcou", "")).toBe(true);
    expect(isCancelValid("remarcada", "")).toBe(true);
  });
  it("Outro exige texto com 2+ letras", () => {
    expect(isCancelValid("outro", "")).toBe(false);
    expect(isCancelValid("outro", " a ")).toBe(false);
    expect(isCancelValid("outro", "Viagem")).toBe(true);
    expect(cancelReasonText("outro", "  Viagem ")).toBe("Viagem");
  });
  it("grava o rótulo do motivo", () => {
    expect(cancelReasonText("sem_resposta", "")).toBe("Paciente não respondeu");
  });
});

describe("Confirmar amanhã", () => {
  const list = [
    { id: "3", scheduled_at: at(16), status: "agendado" },
    { id: "1", scheduled_at: at(8), status: "confirmado" },
    { id: "2", scheduled_at: at(9), status: "agendado" },
    { id: "4", scheduled_at: at(10), status: "cancelado" },
    { id: "5", scheduled_at: at(11), status: "paciente_consultorio" },
  ];
  it("separa pendentes e confirmados em ordem de horário, sem cancelados", () => {
    const r = splitTomorrow(list);
    expect(r.pending.map((a) => a.id)).toEqual(["2", "3"]);
    expect(r.done.map((a) => a.id)).toEqual(["1", "5"]);
    expect(r.total).toBe(4);
    expect(r.label).toBe("2 de 4 confirmados");
    expect(r.pct).toBe(50);
  });
  it("lista vazia não divide por zero", () => {
    expect(splitTomorrow([])).toMatchObject({ total: 0, pct: 0, label: "0 de 0 confirmados" });
    expect(splitTomorrow([{ id: "1", scheduled_at: at(8), status: "confirmado" }]).label).toBe("1 de 1 confirmado");
  });
  it("contador conta só os agendados", () => {
    expect(pendingTomorrowCount(list)).toBe(2);
    expect(pendingTomorrowCount(undefined)).toBe(0);
  });
  it("amanhã é o dia local, inclusive depois das 21h", () => {
    expect(tomorrowLocalString(new Date(2026, 8, 16, 23, 30))).toBe("2026-09-17");
    expect(tomorrowLocalString(new Date(2026, 8, 30, 10))).toBe("2026-10-01");
  });
});

describe("datas", () => {
  const now = new Date(2026, 8, 16, 10, 40);
  it("limites do dia local para a consulta da agenda", () => {
    const b = localDayBoundsISO("2026-09-17")!;
    expect(new Date(b.start).getDate()).toBe(17);
    expect(new Date(b.start).getHours()).toBe(0);
    expect(new Date(b.end).getTime() - new Date(b.start).getTime()).toBe(24 * 3600 * 1000);
    expect(localDayBoundsISO("")).toBeNull();
  });
  it("rótulos de dia", () => {
    expect(dayLabel(new Date(2026, 8, 16, 15), now)).toBe("Hoje, qua 16/09");
    expect(dayLabel(new Date(2026, 8, 17, 15), now)).toBe("Amanhã, qui 17/09");
    expect(dayLabel(new Date(2026, 8, 18, 15), now)).toBe("Sex 18/09");
    expect(whenLine(new Date(2026, 8, 16, 15), 60, now)).toBe("Hoje, qua 16/09 · 15:00–16:00");
    expect(shortDayTime(new Date(2026, 8, 17, 14))).toBe("qui 17 às 14:00");
    expect(slotSummary(new Date(2026, 8, 17, 14), 45)).toBe("Qui 17 · 14:00 · 45 min");
  });
});
