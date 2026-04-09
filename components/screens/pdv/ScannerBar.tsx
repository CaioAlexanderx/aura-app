// ============================================================
// AURA. — PDV Scanner Bar (wraps ScannerInput)
// Supports: USB/Bluetooth barcode scanners + Camera QR reader
// ============================================================
import { ScannerInput } from "@/components/ScannerInput";

export function ScannerBar({ onScan }: { onScan: (code: string) => void }) {
  return (
    <ScannerInput
      onScan={(result) => onScan(result.code)}
      placeholder="Escanear codigo de barras ou QR Code..."
    />
  );
}

export default ScannerBar;
