export { OdontogramaSVG } from "./OdontogramaSVG";
export type { ToothData, ToothStatus, ToothFace } from "./OdontogramaSVG";
export { TreatmentPlanCard, TreatmentPlanFunnel } from "./TreatmentPlanCard";
export type { TreatmentPlan, PlanItem, Installment, FunnelData } from "./TreatmentPlanCard";
export { AnamneseWizard } from "./AnamneseWizard";
export type { AnamneseData } from "./AnamneseWizard";
export { ProntuarioTimeline } from "./ProntuarioTimeline";
export type { TimelineEntry, TimelineEntryType } from "./ProntuarioTimeline";
export { AgendaDental } from "./AgendaDental";
export type { DentalAppointment } from "./AgendaDental";
export { ClinicalImages } from "./ClinicalImages";
export type { ClinicalImage } from "./ClinicalImages";
export { OrcamentoFunnel } from "./OrcamentoFunnel";
export type { FunnelPlan } from "./OrcamentoFunnel";
export { RecallControl } from "./RecallControl";
export type { RecallPatient } from "./RecallControl";
export { NoShowTracker } from "./NoShowTracker";
export type { NoShowPatient } from "./NoShowTracker";
export { AgendaOnline } from "./AgendaOnline";
export type { BookingConfig, BookingRequest } from "./AgendaOnline";
export { LabOrderTracker } from "./LabOrderTracker";
export type { LabOrder } from "./LabOrderTracker";
export { FatorRAlert } from "./FatorRAlert";
export { CROBadge, CROSignatureBlock } from "./CROBadge";
export { ContratoPDF } from "./ContratoPDF";
export type { ContratoData } from "./ContratoPDF";
// D-16: Convênios + TUSS
export { ConvenioManager } from "./ConvenioManager";
export type { Insurance, TussCode, InsuranceProcedure } from "./ConvenioManager";
// D-17: Guias TISS
export { TissGuideManager } from "./TissGuideManager";
export type { TissGuide, TissStats } from "./TissGuideManager";
// D-18: Fichas por especialidade
export { FichaEspecialidade } from "./FichaEspecialidade";
export type { SpecialtyForm } from "./FichaEspecialidade";
// D-19: Periograma
export { Periograma } from "./Periograma";
export type { PerioChart } from "./Periograma";
// D-20: Lista de espera
export { ListaEsperaDental } from "./ListaEsperaDental";
export type { WaitlistEntry } from "./ListaEsperaDental";
// D-21: Check-in paciente
export { CheckinPaciente } from "./CheckinPaciente";
export type { Checkin, CheckinStats } from "./CheckinPaciente";
