// ============================================================
// Textos de WhatsApp da agenda odonto (mockup 16/09/2026, abas C, D e E):
// falta, cancelamento por motivo, remarcação, lembrete e a escolha por status.
// ============================================================
import {
  noShowText,
  reminderText,
  cancellationText,
  rescheduleText,
  appointmentMessage,
  confirmationText,
} from "@/utils/whatsapp";

const when = new Date(2026, 8, 17, 14, 0); // quinta, 17/09 às 14:00 (local)
const base = { patientName: "Ana Paula Ribeiro", clinicName: "Sorriso Duarte", when };

describe("textos da agenda", () => {
  it("falta oferece remarcar", () => {
    expect(noShowText(base)).toBe(
      "Olá, Ana! Aqui é da Sorriso Duarte. Sentimos sua falta na consulta de quinta, 17/09, às 14:00. Quer remarcar? Me diga o melhor dia e horário para você.",
    );
  });

  it("lembrete para quem já confirmou", () => {
    expect(reminderText(base)).toBe("Olá, Ana! Aqui é da Sorriso Duarte. Lembrando da sua consulta quinta, 17/09 às 14:00. Até lá!");
  });

  it("cancelamento muda com o motivo", () => {
    expect(cancellationText({ ...base, reason: "desmarcou" })).toContain("Conforme combinamos, cancelei sua consulta de quinta, 17/09, às 14:00.");
    expect(cancellationText({ ...base, reason: "sem_resposta" })).toContain("Como não consegui confirmar sua consulta de quinta, 17/09, às 14:00, liberei o horário.");
    expect(cancellationText({ ...base, reason: "remarcada" })).toContain("foi remarcada. Já te mando a nova data.");
    expect(cancellationText({ ...base, reason: "outro" })).toContain("foi cancelada. Quando quiser remarcar");
    expect(cancellationText({ ...base, reason: null })).toContain("foi cancelada.");
  });

  it("sem clínica, omite a apresentação", () => {
    expect(cancellationText({ patientName: "Bruno", when, reason: "desmarcou" })).toMatch(/^Olá, Bruno! Conforme combinamos/);
    expect(noShowText({ patientName: "", when })).toMatch(/^Olá, ! Sentimos/);
  });

  it("remarcação mostra antes e depois", () => {
    const to = new Date(2026, 8, 18, 9, 30);
    expect(rescheduleText({ ...base, from: when, to })).toBe(
      "Olá, Ana! Aqui é da Sorriso Duarte. Sua consulta de quinta, 17/09, às 14:00 foi remarcada para sexta, 18/09, às 09:30. Qualquer dúvida, me avise por aqui.",
    );
  });

  it("escolhe a mensagem pelo status", () => {
    expect(appointmentMessage({ ...base, status: "agendado" })).toBe(confirmationText(base));
    expect(appointmentMessage({ ...base, status: undefined })).toBe(confirmationText(base));
    expect(appointmentMessage({ ...base, status: "faltou" })).toBe(noShowText(base));
    expect(appointmentMessage({ ...base, status: "confirmado" })).toBe(reminderText(base));
    expect(appointmentMessage({ ...base, status: "cancelado" })).toContain("foi cancelada");
  });
});
