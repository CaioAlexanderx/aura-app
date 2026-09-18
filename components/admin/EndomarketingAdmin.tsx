// ============================================================
// AURA. — Gestão: Endomarketing (banners de notificação no app)
// Publica/segmenta/acompanha banners via /admin/notifications/banners.
// Upload de peça HTML (3:2, 1080×720) lido como texto e salvo inline
// em html_content; o app renderiza no sininho (BannerFrame escala 3:2).
// Web-first (input file). Criado: 17/06/2026.
//
// 18/09/2026 — e-mail de notificação de empresa específica (mockup aprovado
//   pelo Caio). Com "Empresa específica", o banner pode sair também por
//   e-mail (BannerEmailFields): destinatários do cadastro, assunto e bloco
//   PIX opcional. Envio sempre passa por uma confirmação. Banners já
//   publicados de uma empresa ganham "Enviar por e-mail" na lista.
// ============================================================
import { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, Platform, ActivityIndicator,
} from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { adminApi, AdminBannerRow, BannerRecipientsResponse, SendBannerEmailBody } from "@/services/adminApi";
import { BannerEmailFields } from "@/components/admin/BannerEmailFields";
import { EmailDraft, EMPTY_DRAFT, UUID_RE, buildSendBody, fmtEnvio } from "@/components/admin/bannerEmail";

const BANNER_BASE_W = 1080;
type TargetMode = "all" | "plan" | "company";

// Prévia 3:2 — mesma técnica do BannerFrame do app (iframe nativo + scale).
function PreviewFrame({ html }: { html: string }) {
  const wrapRef = useRef<any>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / BANNER_BASE_W);
    update();
    let ro: any = null;
    if (typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(update); ro.observe(el); }
    return () => { if (ro) ro.disconnect(); };
  }, [html]);
  if (Platform.OS !== "web") return null;
  return (
    <div ref={wrapRef as any} style={{ width: "100%", aspectRatio: "3 / 2", overflow: "hidden", position: "relative", borderRadius: 12, border: "1px solid " + Colors.border } as any}>
      <iframe
        srcDoc={html}
        sandbox="allow-scripts"
        scrolling="no"
        style={{ width: BANNER_BASE_W, height: BANNER_BASE_W * 2 / 3, border: "none", display: "block", transformOrigin: "top left", transform: "scale(" + (scale || 0.0001) + ")" } as any}
      />
    </div>
  );
}

// Confirmação antes de qualquer envio de e-mail.
function ConfirmSend({ body, onCancel, onConfirm, busy, note }: {
  body: SendBannerEmailBody; onCancel: () => void; onConfirm: () => void; busy: boolean; note?: string;
}) {
  const n = body.recipients.length;
  return (
    <View style={s.confirm}>
      <Text style={s.confirmTitle}>{"Enviar e-mail para " + n + (n === 1 ? " destinatário?" : " destinatários?")}</Text>
      <Text style={s.hint}>{body.recipients.join(", ") + (body.subject ? " · assunto \u201c" + body.subject + "\u201d" : "")}</Text>
      {note ? <Text style={s.hint}>{note}</Text> : null}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
        <Pressable onPress={onCancel} disabled={busy} style={s.btnSec}><Text style={s.btnSecTxt}>Cancelar</Text></Pressable>
        <Pressable onPress={onConfirm} disabled={busy} style={[s.btnPri, { marginTop: 0, paddingHorizontal: 16 }, busy && { opacity: 0.5 }]}>
          {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnPriTxt}>Enviar</Text>}
        </Pressable>
      </View>
    </View>
  );
}

type SendResult = { sent: { email: string }[]; failed: { email: string; error: string }[] };

function reportSend(r: SendResult, prefix: string) {
  const n = r.sent.length;
  if (r.failed.length === 0) toast.success(prefix + "e-mail enviado para " + n + (n === 1 ? " destinatário" : " destinatários"));
  else if (n) toast.error(prefix + "e-mail enviado para " + n + "; falhou para " + r.failed.map(f => f.email).join(", "));
  else toast.error(prefix + "o e-mail não saiu: " + (r.failed[0]?.error || "erro no envio"));
}

// 502 = nenhum e-mail saiu, mas o corpo ainda traz { sent, failed }.
function sendErrorResult(e: any): SendResult | null {
  const d = e?.data;
  return d && Array.isArray(d.sent) && Array.isArray(d.failed) ? d : null;
}

// "Enviar por e-mail" de um banner já publicado (empresa específica).
function ListEmailPanel({ b, onDone }: { b: AdminBannerRow; onDone: () => void }) {
  const [draft, setDraft] = useState<EmailDraft>({ ...EMPTY_DRAFT, enabled: true });
  const [confirm, setConfirm] = useState<SendBannerEmailBody | null>(null);
  const [sending, setSending] = useState(false);

  function pedir() {
    const r = buildSendBody(draft, b.title);
    if (r.error) { toast.error(r.error); return; }
    setConfirm(r.body!);
  }
  async function enviar() {
    if (!confirm) return;
    setSending(true);
    try {
      reportSend(await adminApi.notifications.sendEmail(b.id, confirm), "");
      setConfirm(null);
      onDone();
    } catch (e: any) {
      const parcial = sendErrorResult(e);
      if (parcial) { reportSend(parcial, ""); setConfirm(null); onDone(); }
      else toast.error(e?.data?.error || e?.message || "Erro ao enviar e-mail");
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={{ gap: 10, paddingBottom: 12 }}>
      <BannerEmailFields companyId={b.target_company_id || ""} title={b.title} draft={draft} setDraft={setDraft} />
      {b.last_emailed_at ? <Text style={s.hint}>{"Último envio: " + fmtEnvio(b.last_emailed_at) + ". Enviar de novo manda outro e-mail."}</Text> : null}
      {confirm ? (
        <ConfirmSend body={confirm} busy={sending} onCancel={() => setConfirm(null)} onConfirm={enviar} />
      ) : (
        <Pressable onPress={pedir} style={[s.btnPri, { marginTop: 0 }]}>
          <Icon name="check" size={14} color="#fff" />
          <Text style={s.btnPriTxt}>Enviar e-mail</Text>
        </Pressable>
      )}
    </View>
  );
}

export function EndomarketingAdmin() {
  const [title, setTitle]       = useState("");
  const [body, setBody]         = useState("");
  const [html, setHtml]         = useState("");
  const [fileName, setFileName] = useState("");
  const [target, setTarget]     = useState<TargetMode>("all");
  const [plan, setPlan]         = useState("essencial");
  const [companyId, setCompanyId] = useState("");
  const [expires, setExpires]   = useState("2026-06-30");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl]     = useState("");
  const [publishing, setPublishing] = useState(false);
  const [emailDraft, setEmailDraft] = useState<EmailDraft>(EMPTY_DRAFT);
  const [company, setCompany]       = useState<BannerRecipientsResponse["company"] | null>(null);
  const [confirmBody, setConfirmBody] = useState<SendBannerEmailBody | null>(null);
  const [emailOpenId, setEmailOpenId] = useState<string | null>(null);

  const [list, setList]       = useState<AdminBannerRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.notifications.list();
      setList(r.banners || []);
    } catch (e: any) {
      toast.error(e?.data?.error || e?.message || "Erro ao listar banners");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  function pickFile() {
    if (Platform.OS !== "web") { toast.error("Upload disponível na versão web"); return; }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".html,text/html";
    input.onchange = () => {
      const f = input.files && input.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => { setHtml(String(reader.result || "")); setFileName(f.name); };
      reader.onerror = () => toast.error("Falha ao ler o arquivo");
      reader.readAsText(f);
    };
    input.click();
  }

  const emailOn = target === "company" && emailDraft.enabled;

  // 1º clique: valida tudo; com e-mail ligado, abre a confirmação.
  function publish() {
    if (title.trim().length < 2) { toast.error("Título é obrigatório"); return; }
    if (!html && !body.trim()) { toast.error("Envie um HTML ou escreva um corpo de fallback"); return; }
    // Sem id válido o banner iria para TODOS os clientes (target_company_id null).
    if (target === "company" && !UUID_RE.test(companyId.trim())) { toast.error("Informe o company_id (UUID) da empresa"); return; }
    if (emailOn) {
      const r = buildSendBody(emailDraft, title.trim());
      if (r.error) { toast.error(r.error); return; }
      setConfirmBody(r.body!);
      return;
    }
    doPublish(null);
  }

  async function doPublish(emailBody: SendBannerEmailBody | null) {
    setPublishing(true);
    try {
      const { banner } = await adminApi.notifications.create({
        title:             title.trim(),
        body:              body.trim() || null,
        html_content:      html || null,
        cta_label:         ctaLabel.trim() || null,
        cta_url:           ctaUrl.trim() || null,
        target_company_id: target === "company" && companyId.trim() ? companyId.trim() : null,
        target_plan:       target === "plan" ? plan : null,
        expires_at:        expires ? new Date(expires + "T23:59:59").toISOString() : null,
        is_active:         true,
      });
      if (emailBody) {
        try {
          reportSend(await adminApi.notifications.sendEmail(banner.id, emailBody), "Banner publicado; ");
        } catch (e: any) {
          const parcial = sendErrorResult(e);
          if (parcial) reportSend(parcial, "Banner publicado, mas ");
          else toast.error("Banner publicado, mas o e-mail falhou: " + (e?.data?.error || e?.message || "erro no envio"));
        }
      } else {
        toast.success("Banner publicado");
      }
      setTitle(""); setBody(""); setHtml(""); setFileName(""); setCtaLabel(""); setCtaUrl("");
      setEmailDraft(d => ({ ...EMPTY_DRAFT, recipients: d.recipients, selected: d.recipients.filter(x => x.selected).map(x => x.email) }));
      setConfirmBody(null);
      load();
    } catch (e: any) {
      toast.error(e?.data?.error || e?.message || "Erro ao publicar");
    } finally {
      setPublishing(false);
    }
  }

  async function toggleActive(b: AdminBannerRow) {
    try { await adminApi.notifications.update(b.id, { is_active: !b.is_active }); load(); }
    catch (e: any) { toast.error(e?.data?.error || e?.message || "Erro ao atualizar"); }
  }
  async function removeBanner(b: AdminBannerRow) {
    try { await adminApi.notifications.remove(b.id); setList(prev => prev.filter(x => x.id !== b.id)); }
    catch (e: any) { toast.error(e?.data?.error || e?.message || "Erro ao excluir"); }
  }

  function targetLabel(b: AdminBannerRow) {
    if (b.target_company_id) return "1 empresa";
    if (b.target_plan) return "Plano " + b.target_plan;
    return "Todos";
  }

  const sizeKb = html ? Math.round(html.length / 1024) : 0;
  const targets: [TargetMode, string][] = [["all", "Todos os clientes"], ["plan", "Por plano"], ["company", "Empresa específica"]];

  return (
    <View style={{ gap: 18 }}>
      <View style={s.card}>
        <Text style={s.cardTitle}>Novo banner</Text>

        <View style={s.field}>
          <Text style={s.label}>Título *</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="Ex.: Junho Mágico" placeholderTextColor={Colors.ink3} style={s.input} />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Corpo (fallback, opcional)</Text>
          <TextInput value={body} onChangeText={setBody} placeholder="Texto exibido se o HTML não carregar" placeholderTextColor={Colors.ink3} style={[s.input, { minHeight: 60, textAlignVertical: "top" }]} multiline />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Peça HTML (3:2 — 1080×720)</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Pressable onPress={pickFile} style={s.btnSec}>
              <Icon name="upload" size={14} color={Colors.violet3} />
              <Text style={s.btnSecTxt}>{html ? "Trocar arquivo" : "Enviar .html"}</Text>
            </Pressable>
            <Text style={s.hint}>{fileName ? fileName + " · " + sizeKb + " KB" : "nenhum arquivo"}</Text>
          </View>
        </View>

        {html ? (
          <View style={s.field}>
            <Text style={s.label}>Prévia</Text>
            <PreviewFrame html={html} />
          </View>
        ) : null}

        <View style={s.field}>
          <Text style={s.label}>Público</Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {targets.map(([k, lbl]) => (
              <Pressable key={k} onPress={() => setTarget(k)} style={[s.chip, target === k && s.chipActive]}>
                <Text style={[s.chipTxt, target === k && s.chipTxtActive]}>{lbl}</Text>
              </Pressable>
            ))}
          </View>
          {target === "plan" && (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              {["essencial", "negocio", "expansao"].map(p => (
                <Pressable key={p} onPress={() => setPlan(p)} style={[s.chip, plan === p && s.chipActive]}>
                  <Text style={[s.chipTxt, plan === p && s.chipTxtActive]}>{p}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {target === "company" && (
            <>
              <TextInput value={companyId} onChangeText={setCompanyId} placeholder="company_id (UUID)" placeholderTextColor={Colors.ink3} style={[s.input, { marginTop: 8 }]} />
              {company ? (
                <Text style={s.companyName} numberOfLines={1}>{(company.name || "Empresa sem nome") + (company.legal_name && company.legal_name !== company.name ? " · " + company.legal_name : "")}</Text>
              ) : null}
            </>
          )}
        </View>

        <View style={s.row2}>
          <View style={[s.field, { flex: 1, minWidth: 160 }]}>
            <Text style={s.label}>Validade (AAAA-MM-DD)</Text>
            <TextInput value={expires} onChangeText={setExpires} placeholder="2026-06-30" placeholderTextColor={Colors.ink3} style={s.input} />
          </View>
        </View>

        <View style={s.row2}>
          <View style={[s.field, { flex: 1, minWidth: 160 }]}>
            <Text style={s.label}>CTA — texto (opcional)</Text>
            <TextInput value={ctaLabel} onChangeText={setCtaLabel} placeholder="Quero indicar" placeholderTextColor={Colors.ink3} style={s.input} />
          </View>
          <View style={[s.field, { flex: 1, minWidth: 160 }]}>
            <Text style={s.label}>CTA — link (opcional)</Text>
            <TextInput value={ctaUrl} onChangeText={setCtaUrl} placeholder="https://…" placeholderTextColor={Colors.ink3} style={s.input} />
          </View>
        </View>

        {target === "company" && (
          <BannerEmailFields
            withToggle
            companyId={companyId}
            title={title.trim()}
            draft={emailDraft}
            setDraft={setEmailDraft}
            onCompany={setCompany}
          />
        )}

        {confirmBody && emailOn ? (
          <ConfirmSend
            body={confirmBody}
            busy={publishing}
            onCancel={() => setConfirmBody(null)}
            onConfirm={() => doPublish(confirmBody)}
            note="O banner é publicado mesmo se o e-mail falhar; a falha aparece aqui."
          />
        ) : (
          <Pressable onPress={publish} disabled={publishing} style={[s.btnPri, publishing && { opacity: 0.5 }]}>
            {publishing ? <ActivityIndicator size="small" color="#fff" /> : (
              <>
                <Icon name="check" size={14} color="#fff" />
                <Text style={s.btnPriTxt}>{emailOn ? "Publicar banner e enviar e-mail" : "Publicar banner"}</Text>
              </>
            )}
          </Pressable>
        )}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Banners publicados</Text>
        {loading ? (
          <ActivityIndicator color={Colors.violet} />
        ) : list.length === 0 ? (
          <Text style={s.hint}>Nenhum banner ainda.</Text>
        ) : list.map(b => {
          const expired = !!b.expires_at && new Date(b.expires_at).getTime() < Date.now();
          const aberto = emailOpenId === b.id;
          return (
            <View key={b.id} style={s.rowWrap}>
            <View style={s.rowItem}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.rowName} numberOfLines={1}>{b.title}</Text>
                <Text style={s.rowMeta}>
                  {targetLabel(b)} · {(b.read_count ?? 0)} leram
                  {b.expires_at ? " · até " + String(b.expires_at).slice(0, 10) : ""}
                  {expired ? " · expirado" : ""}
                  {b.last_emailed_at ? <Text style={s.rowMetaOk}>{" · e-mail enviado " + fmtEnvio(b.last_emailed_at)}</Text> : null}
                </Text>
              </View>
              {b.target_company_id ? (
                <Pressable onPress={() => setEmailOpenId(aberto ? null : b.id)} style={[s.btnSec, aberto && s.chipActive]}>
                  <Icon name="mail" size={13} color={Colors.violet3} />
                  <Text style={s.btnSecTxt}>{aberto ? "Fechar" : "Enviar por e-mail"}</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => toggleActive(b)} style={[s.tag, { backgroundColor: b.is_active ? "rgba(16,185,129,0.16)" : Colors.bg3 }]}>
                <Text style={[s.tagTxt, { color: b.is_active ? Colors.green : Colors.ink3 }]}>{b.is_active ? "Ativo" : "Inativo"}</Text>
              </Pressable>
              <Pressable onPress={() => removeBanner(b)} style={s.iconBtn}>
                <Icon name="trash" size={14} color={Colors.red} />
              </Pressable>
            </View>
            {aberto ? <ListEmailPanel b={b} onDone={() => { setEmailOpenId(null); load(); }} /> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card:       { backgroundColor: Colors.bg2, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 12 },
  cardTitle:  { fontSize: 15, fontWeight: "800", color: Colors.ink },
  field:      { gap: 6 },
  label:      { fontSize: 11, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  input:      { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.ink },
  row2:       { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  btnPri:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.violet, paddingVertical: 11, borderRadius: 10, marginTop: 4 },
  btnPriTxt:  { color: "#fff", fontWeight: "800", fontSize: 13 },
  btnSec:     { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(124,58,237,0.10)", borderWidth: 1, borderColor: "rgba(124,58,237,0.35)", paddingVertical: 9, paddingHorizontal: 12, borderRadius: 9 },
  btnSecTxt:  { color: Colors.violet3, fontWeight: "700", fontSize: 12 },
  hint:       { fontSize: 12, color: Colors.ink3 },
  chip:       { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: "rgba(124,58,237,0.16)", borderColor: Colors.violet },
  chipTxt:    { fontSize: 12, color: Colors.ink2, fontWeight: "700" },
  chipTxtActive: { color: Colors.violet3 },
  rowWrap:    { borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowItem:    { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, flexWrap: "wrap" },
  rowMetaOk:  { color: Colors.green, fontWeight: "700" },
  companyName: { fontSize: 12, color: Colors.ink2, fontWeight: "700", marginTop: 6 },
  confirm:    { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, gap: 6 },
  confirmTitle: { fontSize: 14, fontWeight: "800", color: Colors.ink },
  rowName:    { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  rowMeta:    { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  tag:        { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  tagTxt:     { fontSize: 11, fontWeight: "800" },
  iconBtn:    { padding: 6, borderRadius: 8 },
});
