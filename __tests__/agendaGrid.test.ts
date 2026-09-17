import {
  applyAppointmentPatch,
  blockBox,
  blockTier,
  columnAt,
  dropLabel,
  findConflicts,
  gridHourRange,
  hm,
  inversePatch,
  layoutLanes,
  moveStart,
  resizeDuration,
} from "@/utils/agendaGrid";
import { changeFromPreview, conflictsFor } from "@/hooks/useAgendaGridFlow";

const G = { hourPx: 56, startHour: 7, endHour: 19 };
const iso = (h: number, m = 0, day = 17) => new Date(2026, 8, day, h, m).toISOString();

describe("layoutLanes", () => {
  it("bloco sozinho ocupa a coluna inteira", () => {
    const out = layoutLanes([{ id: "a", start: 540, dur: 60 }]);
    expect(out).toEqual([expect.objectContaining({ col: 0, n: 1 })]);
  });

  it("dois sobrepostos ficam lado a lado", () => {
    const out = layoutLanes([
      { id: "a", start: 900, dur: 60 },
      { id: "b", start: 930, dur: 45 },
    ]);
    const byId = Object.fromEntries(out.map(o => [o.item.id, o]));
    expect(byId.a).toMatchObject({ col: 0, n: 2 });
    expect(byId.b).toMatchObject({ col: 1, n: 2 });
  });

  it("encostar não sobrepõe", () => {
    const out = layoutLanes([
      { id: "a", start: 540, dur: 30 },
      { id: "b", start: 570, dur: 30 },
    ]);
    expect(out.every(o => o.n === 1 && o.col === 0)).toBe(true);
  });

  it("a divisão vale só para o grupo de sobreposição, não para o dia todo", () => {
    const out = layoutLanes([
      { id: "a", start: 600, dur: 60 },
      { id: "b", start: 600, dur: 30 },
      { id: "c", start: 900, dur: 60 },
    ]);
    const byId = Object.fromEntries(out.map(o => [o.item.id, o]));
    expect(byId.a.n).toBe(2);
    expect(byId.b.n).toBe(2);
    expect(byId.c).toMatchObject({ col: 0, n: 1 });
  });

  it("reaproveita a faixa que já terminou", () => {
    const out = layoutLanes([
      { id: "a", start: 600, dur: 120 },
      { id: "b", start: 600, dur: 30 },
      { id: "c", start: 660, dur: 30 },
    ]);
    const byId = Object.fromEntries(out.map(o => [o.item.id, o]));
    expect(byId.c.col).toBe(1);
    expect(byId.a.n).toBe(2);
  });
});

describe("blockTier / blockBox", () => {
  it("30 min a 56px/h vira uma linha só (t1) na Semana", () => {
    const box = blockBox(540, 30, 7, 56);
    expect(box.height).toBe(26);
    expect(blockTier(box.height, false)).toBe("t1");
  });

  it("limiares da Semana e do Dia", () => {
    expect(blockTier(35, false)).toBe("t1");
    expect(blockTier(36, false)).toBe("t2");
    expect(blockTier(49, true)).toBe("t1");
    expect(blockTier(50, true)).toBe("t2");
    expect(blockTier(63, false)).toBe("t2");
    expect(blockTier(64, false)).toBe("t3");
  });

  it("topo é proporcional ao início da grade", () => {
    expect(blockBox(9 * 60 + 30, 60, 7, 56).top).toBe(140);
  });
});

describe("gridHourRange", () => {
  it("mantém a faixa padrão quando tudo cabe", () => {
    expect(gridHourRange([{ start: 540, dur: 60 }], 7, 19)).toEqual({ startHour: 7, endHour: 19 });
  });

  it("estica para consulta antes das 7h e depois das 19h", () => {
    expect(gridHourRange([{ start: 6 * 60 + 30, dur: 30 }, { start: 19 * 60 + 15, dur: 60 }], 7, 19))
      .toEqual({ startHour: 6, endHour: 21 });
  });

  it("não passa de 24h", () => {
    expect(gridHourRange([{ start: 23 * 60 + 30, dur: 90 }], 7, 19).endHour).toBe(24);
  });
});

describe("alvo do arraste", () => {
  it("px vira minuto arredondado para 15", () => {
    // ponteiro 7h + 2h30 + 5px, pegando o bloco no topo
    expect(moveStart(2.5 * 56 + 5, 0, 60, G)).toBe(9 * 60 + 30);
    // 8 min (7,5px) arredonda para 15
    expect(moveStart(7.5, 0, 30, G)).toBe(7 * 60 + 15);
  });

  it("desconta onde o bloco foi pego", () => {
    expect(moveStart(3 * 56 + 20, 20, 60, G)).toBe(10 * 60);
  });

  it("não sai da grade (início nem fim)", () => {
    expect(moveStart(-300, 0, 60, G)).toBe(7 * 60);
    expect(moveStart(5000, 0, 60, G)).toBe(18 * 60);
  });

  it("redimensionar arredonda o fim, mínimo 15 min e limite no fim da grade", () => {
    const start = 14 * 60;
    expect(resizeDuration((14.75 - 7) * 56 + 3, start, G)).toBe(45);
    expect(resizeDuration((14 - 7) * 56, start, G)).toBe(15);
    expect(resizeDuration(9999, start, G)).toBe(5 * 60);
  });

  it("coluna sob o ponteiro, ou a mais próxima fora da grade", () => {
    const rects = [{ left: 50, right: 150, top: 0 }, { left: 150, right: 250, top: 0 }];
    expect(columnAt(160, rects)).toBe(1);
    expect(columnAt(10, rects)).toBe(0);
    expect(columnAt(900, rects)).toBe(1);
    expect(columnAt(10, [])).toBe(-1);
  });

  it("rótulos da faixa-alvo", () => {
    expect(dropLabel("move", new Date(2026, 8, 17), 14 * 60 + 30, 60)).toBe("Qui 17 · 14:30");
    expect(dropLabel("resize", new Date(2026, 8, 17), 14 * 60, 45)).toBe("45 min · 14:00–14:45");
    expect(hm(570)).toBe("09:30");
  });
});

describe("findConflicts (mesma regra do backend)", () => {
  const base = [
    { id: "bruno", patient_name: "Bruno Carvalho", scheduled_at: iso(14), duration_min: 30, status: "agendado", practitioner_id: "p1" },
    { id: "falta", patient_name: "Igor", scheduled_at: iso(15), duration_min: 60, status: "faltou", practitioner_id: "p1" },
    { id: "outro", patient_name: "Carla", scheduled_at: iso(16), duration_min: 60, status: "confirmado", practitioner_id: "p2" },
    { id: "semdent", patient_name: "Sofia", scheduled_at: iso(17), duration_min: 60, status: "confirmado", practitioner_id: null },
  ];

  it("sobreposição com o mesmo dentista conflita", () => {
    const c = findConflicts({ id: "ana", scheduled_at: iso(13, 45), duration_min: 30, practitioner_id: "p1" }, base);
    expect(c.map(x => x.id)).toEqual(["bruno"]);
    expect(c[0]).toEqual({ id: "bruno", patient_name: "Bruno Carvalho", scheduled_at: iso(14), duration_min: 30 });
  });

  it("encostar não conta", () => {
    expect(findConflicts({ id: "ana", scheduled_at: iso(13, 30), duration_min: 30, practitioner_id: "p1" }, base)).toEqual([]);
    expect(findConflicts({ id: "ana", scheduled_at: iso(14, 30), duration_min: 30, practitioner_id: "p1" }, base)).toEqual([]);
  });

  it("ignora faltou/cancelado, outro dentista e o próprio agendamento", () => {
    expect(findConflicts({ id: "ana", scheduled_at: iso(15), duration_min: 60, practitioner_id: "p1" }, base)).toEqual([]);
    expect(findConflicts({ id: "ana", scheduled_at: iso(16), duration_min: 60, practitioner_id: "p1" }, base)).toEqual([]);
    expect(findConflicts({ id: "bruno", scheduled_at: iso(14), duration_min: 30, practitioner_id: "p1" }, base)).toEqual([]);
  });

  it("sem dentista só conflita com sem dentista", () => {
    expect(findConflicts({ id: "x", scheduled_at: iso(17), duration_min: 30, practitioner_id: null }, base).map(c => c.id))
      .toEqual(["semdent"]);
    expect(findConflicts({ id: "x", scheduled_at: iso(17), duration_min: 30 }, base).map(c => c.id))
      .toEqual(["semdent"]);
  });

  it("conflictsFor usa o dentista novo quando o patch troca de cadeira", () => {
    const appt = { id: "ana", patient_name: "Ana Paula", scheduled_at: iso(9), duration_min: 60, status: "agendado", practitioner_id: "p1" };
    expect(conflictsFor({ appt, patch: { scheduled_at: iso(16) } }, base as any)).toEqual([]);
    expect(conflictsFor({ appt, patch: { scheduled_at: iso(16), practitioner_id: "p2" } }, base as any).map(c => c.id))
      .toEqual(["outro"]);
  });
});

describe("changeFromPreview", () => {
  const appt = { id: "ana", patient_name: "Ana Paula Ribeiro", scheduled_at: iso(15, 0, 16), duration_min: 60, status: "agendado", practitioner_id: "p1" };

  it("mover gera só scheduled_at e o texto do aviso", () => {
    const r = changeFromPreview(appt, { id: "ana", mode: "move", fromCol: 2, colIdx: 3, startMin: 14 * 60 + 30, durMin: 60 },
      { day: new Date(2026, 8, 17), columnChanged: true });
    expect(r.patch).toEqual({ scheduled_at: iso(14, 30) });
    expect(r.message).toBe("Consulta de Ana movida para qui 17 às 14:30");
  });

  it("trocar de cadeira manda o dentista da cadeira", () => {
    const r = changeFromPreview(appt, { id: "ana", mode: "move", fromCol: 0, colIdx: 1, startMin: 15 * 60, durMin: 60 },
      { day: new Date(2026, 8, 16), columnChanged: true, practitionerId: "p2", columnLabel: "Cadeira 2" });
    expect(r.patch).toEqual({ scheduled_at: iso(15, 0, 16), practitioner_id: "p2" });
    expect(r.message).toContain("· Cadeira 2");
  });

  it("redimensionar gera só duration_min", () => {
    const r = changeFromPreview(appt, { id: "ana", mode: "resize", fromCol: 2, colIdx: 2, startMin: 15 * 60, durMin: 45 },
      { day: new Date(2026, 8, 16), columnChanged: false });
    expect(r.patch).toEqual({ duration_min: 45 });
    expect(r.message).toBe("Consulta de Ana agora dura 45 min (15:00–15:45)");
  });
});

describe("atualização otimista e desfazer", () => {
  it("aplica o patch só no agendamento certo", () => {
    const data = { total: 2, appointments: [{ id: "a", duration_min: 30 }, { id: "b", duration_min: 60 }] };
    const out = applyAppointmentPatch(data, "b", { duration_min: 45 })!;
    expect(out.appointments).toEqual([{ id: "a", duration_min: 30 }, { id: "b", duration_min: 45 }]);
    expect(data.appointments[1].duration_min).toBe(60);
    expect(applyAppointmentPatch(data, "zzz", { duration_min: 45 })).toBe(data);
    expect(applyAppointmentPatch(undefined, "a", {})).toBeUndefined();
  });

  it("inversePatch devolve os valores antigos dos mesmos campos", () => {
    const appt = { scheduled_at: iso(9), duration_min: 30, practitioner_id: "p1" };
    expect(inversePatch(appt, { scheduled_at: iso(10) })).toEqual({ scheduled_at: iso(9) });
    expect(inversePatch(appt, { duration_min: 45 })).toEqual({ duration_min: 30 });
    expect(inversePatch(appt, { scheduled_at: iso(10), practitioner_id: "p2" }))
      .toEqual({ scheduled_at: iso(9), practitioner_id: "p1" });
  });
});
