// ============================================================
// AURA. — Pedidos de disparo preparados pelo Claude (Endomarketing)
// Mockup aprovado pelo Caio em 18/09/2026. O Claude grava o pedido
// (GET/POST /admin/dispatch-requests, migration 348 do backend); nada
// sai sem alguém da equipe clicar em "Aprovar e enviar" e confirmar.
// O card some quando não há pedido aguardando nem decidido em 14 dias.
// ============================================================
import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { adminApi, DispatchRequestRow } from "@/services/adminApi";
import { fmtEnvio } from "@/components/admin/bannerEmail";

const ACTION_LABEL: Record<string, string> = {
  notification_email: "Enviar notificação por e-mail",
};

function fmtBRL(v: number) {
  return "R$ " + v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
function fmtDia(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d + "/" + m + "/" + y;
}
export function expiraEm(iso: string, agora = Date.now()): string {
  const h = Math.floor((new Date(iso).getTime() - agora) / 3600000);
  if (h < 1) return "expira em menos de 1h";
  return "expira em " + h + "h";
}

const STATUS: Record<string, { label: string; tone: "ok" | "muted" | "bad" }> = {
  done:       { label: "Enviado",   tone: "ok" },
  rejected:   { label: "Recusado",  tone: "muted" },
  failed:     { label: "Falhou",    tone: "bad" },
  processing: { label: "Enviando",  tone: "muted" },
};

function Pedido({ r, onDone }: { r: DispatchRequestRow; onDone: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const p = r.preview || {};
  const para = p.recipients || [];

  async function aprovar() {
    setBusy(true);
    try {
      const res = await adminApi.dispatchRequests.approve(r.id);
      const n = res.result?.sent?.length ?? 0;
      const falhas = res.result?.failed || [];
      if (res.status === "done" && !falhas.length) toast.success("E-mail enviado para " + n + (n === 1 ? " destinatário" : " destinatários"));
      else if (res.status === "done") toast.error("Enviado para " + n + "; falhou para " + falhas.map(f => f.email).join(", "));
      else toast.error("Não enviado: " + (res.result?.error || res.error || "falhou"));
    } catch (e: any) {
      toast.error("Não enviado: " + (e?.data?.result?.error || e?.data?.error || e?.message || "falhou"));
    } finally {
      setBusy(false); setConfirm(false); onDone();
    }
  }
  async function recusar() {
    setBusy(true);
    try { await adminApi.dispatchRequests.reject(r.id); toast.success("Pedido recusado"); }
    catch (e: any) { toast.error(e?.data?.error || e?.message || "Erro ao recusar"); }
    finally { setBusy(false); onDone(); }
  }

  return (
    <View style={s.req}>
      <View style={s.who}>
        <Text style={s.badge}>{r.requested_via === "claude" ? "Claude" : r.requested_via}</Text>
        <Text style={s.whoTxt}>{"preparado " + fmtEnvio(r.created_at)}</Text>
      </View>
      {r.note ? <Text style={s.note}>{"“" + r.note + "”"}</Text> : null}

      {p.error ? (
        <Text style={[s.hint, { color: Colors.red }]}>{p.error}</Text>
      ) : (
        <View style={s.kv}>
          <Linha k="Ação" v={ACTION_LABEL[r.action] || r.action} />
          {p.banner ? <Linha k="Banner" v={p.banner.title + (p.banner.is_active ? "" : " (inativo)")} /> : null}
          {p.company ? <Linha k="Empresa" v={(p.company.name || "") + (p.company.legal_name && p.company.legal_name !== p.company.name ? " · " + p.company.legal_name : "")} /> : null}
          <Linha k="Para" v={para.length ? para.join(", ") : "nenhum destinatário"} bad={!para.length} />
          {p.subject ? <Linha k="Assunto" v={p.subject} /> : null}
          {p.pix ? (
            <View style={s.kvRow}>
              <Text style={s.k}>PIX</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.v}>
                  {[p.pix.amount != null ? fmtBRL(Number(p.pix.amount)) : null, p.pix.due_date ? "vence " + fmtDia(p.pix.due_date) : null].filter(Boolean).join(" · ") || "sem valor"}
                </Text>
                <Text style={s.mono} numberOfLines={2}>{p.pix.code}</Text>
              </View>
            </View>
          ) : null}
        </View>
      )}

      {confirm ? (
        <View style={s.confirm}>
          <Text style={s.confirmTitle}>{"Enviar agora para " + para.length + (para.length === 1 ? " destinatário?" : " destinatários?")}</Text>
          <Text style={s.hint}>{para.join(", ") + (p.subject ? " · “" + p.subject + "”" : "")}</Text>
          <View style={s.row}>
            <Pressable onPress={() => setConfirm(false)} disabled={busy} style={s.btnSec}><Text style={s.btnSecTxt}>Cancelar</Text></Pressable>
            <Pressable onPress={aprovar} disabled={busy} style={[s.btnPri, busy && { opacity: 0.5 }]}>
              {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnPriTxt}>Enviar</Text>}
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={s.row}>
          {r.expired ? (
            <Text style={[s.hint, { color: Colors.red }]}>Expirado: prepare um pedido novo.</Text>
          ) : (
            <Pressable onPress={() => setConfirm(true)} disabled={busy || !!p.error || !para.length} style={[s.btnPri, (busy || !!p.error || !para.length) && { opacity: 0.5 }]}>
              <Icon name="check" size={14} color="#fff" />
              <Text style={s.btnPriTxt}>Aprovar e enviar</Text>
            </Pressable>
          )}
          <Pressable onPress={recusar} disabled={busy} style={s.btnSec}><Text style={s.btnSecTxt}>Recusar</Text></Pressable>
          {!r.expired ? <Text style={s.exp}>{expiraEm(r.expires_at)}</Text> : null}
        </View>
      )}
    </View>
  );
}

function Linha({ k, v, bad }: { k: string; v: string; bad?: boolean }) {
  return (
    <View style={s.kvRow}>
      <Text style={s.k}>{k}</Text>
      <Text style={[s.v, bad && { color: Colors.red }]}>{v}</Text>
    </View>
  );
}

export function DispatchRequestsCard({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<DispatchRequestRow[]>([]);

  const load = useCallback(async () => {
    try { setRows((await adminApi.dispatchRequests.list()).requests || []); }
    catch { /* card é auxiliar: sem pedidos visíveis, sem barulho */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!rows.length) return null;
  const aguardando = rows.filter(r => r.status === "awaiting_approval");
  const historico  = rows.filter(r => r.status !== "awaiting_approval");

  return (
    <View style={[s.card, aguardando.length > 0 && s.cardHl]}>
      <View style={s.head}>
        <Text style={s.title}>Pedidos para aprovar</Text>
        {aguardando.length > 0 ? <Text style={s.count}>{aguardando.length + " aguardando"}</Text> : null}
      </View>

      {aguardando.map(r => (
        <Pedido key={r.id} r={r} onDone={() => { load(); onChanged && onChanged(); }} />
      ))}

      {historico.length > 0 && (
        <View>
          <Text style={s.label}>Últimos 14 dias</Text>
          {historico.map(r => {
            const st = STATUS[r.status] || { label: r.status, tone: "muted" as const };
            const quem = r.decided_by_name ? (r.status === "rejected" ? "recusado por " : "aprovado por ") + r.decided_by_name : "";
            const quando = r.decided_at ? fmtEnvio(r.decided_at) : "";
            const n = r.result?.sent?.length;
            const detalhe = r.status === "failed" && r.error ? "falhou: " + r.error : n != null ? n + (n === 1 ? " enviado" : " enviados") : "";
            return (
              <View key={r.id} style={s.hist}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.histName} numberOfLines={1}>{(ACTION_LABEL[r.action] || r.action) + (r.note ? " · " + r.note : "")}</Text>
                  <Text style={s.hint} numberOfLines={2}>{[quem, quando, detalhe].filter(Boolean).join(" · ")}</Text>
                </View>
                <Text style={[s.st, st.tone === "ok" ? s.stOk : st.tone === "bad" ? s.stBad : s.stMuted]}>{st.label}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card:       { backgroundColor: Colors.bg2, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 12 },
  cardHl:     { borderColor: "rgba(245,158,11,0.55)" },
  head:       { flexDirection: "row", alignItems: "center", gap: 10 },
  title:      { flex: 1, fontSize: 15, fontWeight: "800", color: Colors.ink },
  count:      { fontSize: 11, fontWeight: "800", color: Colors.amber, backgroundColor: "rgba(245,158,11,0.16)", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, overflow: "hidden" },
  req:        { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, gap: 10 },
  who:        { flexDirection: "row", alignItems: "center", gap: 6 },
  badge:      { fontSize: 10, fontWeight: "800", color: Colors.violet3, backgroundColor: "rgba(124,58,237,0.16)", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, overflow: "hidden" },
  whoTxt:     { fontSize: 11, color: Colors.ink3 },
  note:       { fontSize: 13, color: Colors.ink2, fontStyle: "italic", borderLeftWidth: 3, borderLeftColor: Colors.violet, paddingLeft: 10, lineHeight: 19 },
  kv:         { gap: 6 },
  kvRow:      { flexDirection: "row", gap: 12 },
  k:          { width: 90, fontSize: 11, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4, paddingTop: 2 },
  v:          { flex: 1, minWidth: 0, fontSize: 13, color: Colors.ink },
  mono:       { fontFamily: "monospace", fontSize: 11, color: Colors.ink2, marginTop: 2 },
  row:        { flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" },
  btnPri:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.violet, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, minHeight: 40 },
  btnPriTxt:  { color: "#fff", fontWeight: "800", fontSize: 13 },
  btnSec:     { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 9, minHeight: 40 },
  btnSecTxt:  { color: Colors.ink2, fontWeight: "700", fontSize: 12 },
  exp:        { fontSize: 11, color: Colors.ink3, marginLeft: "auto" as any },
  confirm:    { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg2, borderRadius: 10, padding: 12, gap: 6 },
  confirmTitle: { fontSize: 14, fontWeight: "800", color: Colors.ink },
  hint:       { fontSize: 12, color: Colors.ink3, lineHeight: 17 },
  label:      { fontSize: 11, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 4 },
  hist:       { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.border },
  histName:   { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  st:         { fontSize: 11, fontWeight: "800", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, overflow: "hidden" },
  stOk:       { color: Colors.green, backgroundColor: "rgba(16,185,129,0.16)" },
  stBad:      { color: Colors.red, backgroundColor: "rgba(239,68,68,0.14)" },
  stMuted:    { color: Colors.ink3, backgroundColor: Colors.bg3 },
});
