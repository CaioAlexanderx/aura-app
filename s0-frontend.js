// s0-frontend.js
// Run from aura-app root: node s0-frontend.js
// S0 items: FE-01 ErrorBoundary + UX-01 ConfirmModal + SEC-04 CSP headers

const fs = require('fs');
const p = require('path');
let changes = 0;

// ============================================================
// FE-01: Error Boundary Component
// ============================================================
console.log('\n=== FE-01: Error Boundary ===');

const ebDir = p.join('components');
const ebPath = p.join(ebDir, 'ErrorBoundary.tsx');

if (!fs.existsSync(ebPath)) {
  fs.writeFileSync(ebPath, `import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

interface Props { children: React.ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console in dev, Sentry in production
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={s.container}>
          <View style={s.card}>
            <Text style={s.icon}>!</Text>
            <Text style={s.title}>Algo deu errado</Text>
            <Text style={s.message}>
              Ocorreu um erro inesperado. Tente novamente ou entre em contato com o suporte.
            </Text>
            {__DEV__ && this.state.error && (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{this.state.error.message}</Text>
              </View>
            )}
            <Pressable onPress={this.handleRetry} style={s.retryBtn}>
              <Text style={s.retryText}>Tentar novamente</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: "transparent",
  },
  card: {
    backgroundColor: Colors.bg3,
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    maxWidth: 400,
    width: "100%",
    borderWidth: 1,
    borderColor: Colors.border2,
    gap: 12,
  },
  icon: {
    fontSize: 32,
    fontWeight: "800",
    color: Colors.red,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.redD,
    textAlign: "center",
    lineHeight: 56,
    overflow: "hidden",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.ink,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: Colors.ink3,
    textAlign: "center",
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: Colors.redD,
    borderRadius: 10,
    padding: 12,
    width: "100%",
    borderWidth: 1,
    borderColor: Colors.red + "33",
  },
  errorText: {
    fontSize: 11,
    color: Colors.red,
    fontFamily: "monospace",
  },
  retryBtn: {
    backgroundColor: Colors.violet,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginTop: 8,
  },
  retryText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
`, 'utf-8');
  console.log('  OK: Created components/ErrorBoundary.tsx');
  changes++;
} else {
  console.log('  SKIP: ErrorBoundary.tsx already exists');
}

// ============================================================
// UX-01: Confirm Modal Component
// ============================================================
console.log('\n=== UX-01: ConfirmModal ===');

const cmPath = p.join(ebDir, 'ConfirmModal.tsx');

if (!fs.existsSync(cmPath)) {
  fs.writeFileSync(cmPath, `import { View, Text, Pressable, Modal, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  confirmColor,
  onConfirm,
  onCancel,
  destructive = false,
}: ConfirmModalProps) {
  const btnColor = confirmColor || (destructive ? Colors.red : Colors.violet);

  if (Platform.OS === "web") {
    if (!visible) return null;
    return (
      <View style={s.overlay}>
        <Pressable style={s.backdrop} onPress={onCancel} />
        <View style={s.card}>
          <View style={[s.iconCircle, destructive && { backgroundColor: Colors.redD }]}>
            <Text style={[s.iconText, destructive && { color: Colors.red }]}>
              {destructive ? "!" : "?"}
            </Text>
          </View>
          <Text style={s.title}>{title}</Text>
          <Text style={s.message}>{message}</Text>
          <View style={s.actions}>
            <Pressable onPress={onCancel} style={s.cancelBtn}>
              <Text style={s.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable onPress={onConfirm} style={[s.confirmBtn, { backgroundColor: btnColor }]}>
              <Text style={s.confirmText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.overlay}>
        <Pressable style={s.backdrop} onPress={onCancel} />
        <View style={s.card}>
          <View style={[s.iconCircle, destructive && { backgroundColor: Colors.redD }]}>
            <Text style={[s.iconText, destructive && { color: Colors.red }]}>
              {destructive ? "!" : "?"}
            </Text>
          </View>
          <Text style={s.title}>{title}</Text>
          <Text style={s.message}>{message}</Text>
          <View style={s.actions}>
            <Pressable onPress={onCancel} style={s.cancelBtn}>
              <Text style={s.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable onPress={onConfirm} style={[s.confirmBtn, { backgroundColor: btnColor }]}>
              <Text style={s.confirmText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Hook helper for common use
import { useState, useCallback } from "react";

export function useConfirmModal() {
  const [state, setState] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    destructive?: boolean;
    onConfirm: () => void;
  }>({
    visible: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const confirm = useCallback(
    (opts: { title: string; message: string; confirmLabel?: string; destructive?: boolean }) =>
      new Promise<boolean>((resolve) => {
        setState({
          visible: true,
          ...opts,
          onConfirm: () => {
            setState((prev) => ({ ...prev, visible: false }));
            resolve(true);
          },
        });
      }),
    []
  );

  const cancel = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  const modal = (
    <ConfirmModal
      visible={state.visible}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      destructive={state.destructive}
      onConfirm={state.onConfirm}
      onCancel={cancel}
    />
  );

  return { confirm, modal };
}

const s = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  backdrop: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  card: {
    backgroundColor: Colors.bg3,
    borderRadius: 20,
    padding: 28,
    maxWidth: 380,
    width: "90%",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border2,
    zIndex: 1,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.violetD,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.violet3,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.ink,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: Colors.ink3,
    textAlign: "center",
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
    width: "100%",
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 14,
    color: Colors.ink3,
    fontWeight: "500",
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmText: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "700",
  },
});
`, 'utf-8');
  console.log('  OK: Created components/ConfirmModal.tsx');
  changes++;
} else {
  console.log('  SKIP: ConfirmModal.tsx already exists');
}

// ============================================================
// Wire ErrorBoundary into _layout.tsx
// ============================================================
console.log('\n=== Wiring ErrorBoundary into _layout.tsx ===');

const layoutPath = p.join('app', '(tabs)', '_layout.tsx');
if (fs.existsSync(layoutPath)) {
  let c = fs.readFileSync(layoutPath, 'utf-8');

  // Add import if missing
  if (!c.includes('ErrorBoundary')) {
    // Find the last import line and add after it
    const importLines = c.split('\n').filter(l => l.startsWith('import '));
    const lastImport = importLines[importLines.length - 1];
    if (lastImport) {
      c = c.replace(
        lastImport,
        lastImport + '\nimport { ErrorBoundary } from "@/components/ErrorBoundary";'
      );
      console.log('  OK: Added ErrorBoundary import to _layout.tsx');
      changes++;
    }
  }

  // Wrap the main return with ErrorBoundary
  // Look for the main component's return JSX and wrap it
  if (c.includes('ErrorBoundary') && !c.includes('<ErrorBoundary>')) {
    // Find the default export function and wrap its return
    // Strategy: wrap the outermost <View> or first JSX in the return with ErrorBoundary
    if (c.includes('return (')) {
      // Find first "return (" and wrap
      const returnIdx = c.lastIndexOf('return (');
      if (returnIdx > -1) {
        // Find the opening ( after return
        const afterReturn = c.substring(returnIdx + 8);
        const firstTag = afterReturn.match(/^\s*</);
        if (firstTag) {
          c = c.substring(0, returnIdx) + 'return (\n    <ErrorBoundary>\n    ' + afterReturn;
          // Find the matching closing ); and add </ErrorBoundary> before it
          const lastCloseParen = c.lastIndexOf(');');
          if (lastCloseParen > -1) {
            c = c.substring(0, lastCloseParen) + '    </ErrorBoundary>\n  );' + c.substring(lastCloseParen + 2);
          }
          console.log('  OK: Wrapped _layout.tsx return with <ErrorBoundary>');
          changes++;
        }
      }
    }
  }

  fs.writeFileSync(layoutPath, c, 'utf-8');
} else {
  console.log('  SKIP: _layout.tsx not found');
}

// ============================================================
// SEC-04: CSP headers for Cloudflare Pages
// ============================================================
console.log('\n=== SEC-04: CSP headers ===');

const publicDir = p.join('public');
if (!fs.existsSync(publicDir)) { fs.mkdirSync(publicDir, { recursive: true }); }

const headersPath = p.join(publicDir, '_headers');
const headersContent = `/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  X-XSS-Protection: 1; mode=block
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://cdn.jsdelivr.net https://placehold.co; connect-src 'self' https://aura-backend-production-f805.up.railway.app https://api.anthropic.com; frame-ancestors 'none'
`;

fs.writeFileSync(headersPath, headersContent, 'utf-8');
console.log('  OK: Created public/_headers with CSP');
changes++;

// ============================================================
console.log('\n========================================');
console.log('DONE: ' + changes + ' changes applied');
console.log('========================================');
console.log('  FE-01: ErrorBoundary component + wired in _layout.tsx');
console.log('  UX-01: ConfirmModal component + useConfirmModal() hook');
console.log('  SEC-04: CSP headers in public/_headers');
console.log('\nUsage examples:');
console.log('');
console.log('  // ConfirmModal with hook:');
console.log('  const { confirm, modal } = useConfirmModal();');
console.log('  async function handleDelete() {');
console.log('    const ok = await confirm({');
console.log('      title: "Excluir produto?",');
console.log('      message: "Esta acao nao pode ser desfeita.",');
console.log('      confirmLabel: "Excluir",');
console.log('      destructive: true,');
console.log('    });');
console.log('    if (ok) deleteProduct(id);');
console.log('  }');
console.log('  // Add {modal} to your JSX');
console.log('');
console.log('Run:');
console.log('  git add -A && git commit -m "feat: S0 - ErrorBoundary + ConfirmModal + CSP headers" && git push');
