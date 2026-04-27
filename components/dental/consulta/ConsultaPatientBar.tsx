// ============================================================
// ConsultaPatientBar — strip com paciente + alertas + timer.
//
// Ficam embaixo do topbar. Mostra avatar, nome, alergia/condicao
// inline e cronometro tickando desde o startedAt.
// ============================================================

import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { DentalColors } from "@/constants/dental-tokens";
import type { ConsultaPatient, ConsultaAppointment } from "@/lib/dentalConsultaTypes";

interface Props {
  patient: ConsultaPatient | null;
  appointment: ConsultaAppointment | null;
  startedAt: string | null;
}

function fmtElapsed(startedAt: string | null, now: number): string {
  if (!startedAt) return "00:00";
  const elapsed = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const m = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const s = String(elapsed % 60).padStart(2, "0");
  return m + ":" + s;
}

export function ConsultaPatientBar({ patient, appointment, startedAt }: Props) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const initials = (patient?.name || "?")
    .split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <View style={{
      paddingHorizontal: 14, paddingVertical: 8,
      flexDirection: "row", alignItems: "center", gap: 12,
      backgroundColor: DentalColors.cyanGhost,
      borderBottomWidth: 1, borderBottomColor: DentalColors.border,
    }}>
      <View style={{
        width: 36, height: 36, borderRadius: 18, backgroundColor: DentalColors.cyan,
        alignItems: "center", justifyContent: "center",
      }}>
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>{initials}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: DentalColors.ink }} numberOfLines={1}>
          {patient?.name || "—"}
          {patient?.age != null ? <Text style={{ fontWeight: "400", color: DentalColors.ink3, fontSize: 10 }}>{" · " + patient.age + " anos"}</Text> : null}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 }}>
          <Text style={{ fontSize: 9, color: DentalColors.ink3 }}>
            📋 {appointment?.chief_complaint || "Sem queixa"}
          </Text>
          {patient?.allergies ? (
            <Text style={{ fontSize: 9, color: DentalColors.red, fontWeight: "600" }}>⚠ Alergia: {patient.allergies}</Text>
          ) : null}
          {patient?.conditions ? (
            <Text style={{ fontSize: 9, color: DentalColors.amber, fontWeight: "600" }}>⚠ {patient.conditions}</Text>
          ) : null}
        </View>
      </View>
      <View style={{
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7,
        backgroundColor: DentalColors.surface, borderWidth: 1, borderColor: DentalColors.border,
        alignItems: "center",
      }}>
        <Text style={{ fontSize: 7, color: DentalColors.ink3, letterSpacing: 1.2, fontWeight: "700" }}>
          EST. {appointment?.duration_min || 60}MIN
        </Text>
        <Text style={{ fontSize: 15, fontWeight: "700", color: DentalColors.cyan }}>
          {fmtElapsed(startedAt, now)}
        </Text>
      </View>
    </View>
  );
}
