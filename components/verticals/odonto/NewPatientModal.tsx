// ============================================================
// AURA. — NewPatientModal (shim de retrocompat — PR22)
//
// O componente real virou PatientFormModal (drawer + create/edit
// + endereco + ViaCEP). Esse arquivo continua existindo so pra
// nao quebrar imports antigos. Em call sites novos, importar
// PatientFormModal direto.
// ============================================================
import { PatientFormModal } from "./PatientFormModal";

interface NewPatientModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated?: (patient: any) => void;
}

export function NewPatientModal({ visible, onClose, onCreated }: NewPatientModalProps) {
  return (
    <PatientFormModal
      visible={visible}
      onClose={onClose}
      onSaved={onCreated}
      mode="create"
    />
  );
}

export default NewPatientModal;
