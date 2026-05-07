import { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, Pressable, TextInput,
  ScrollView, Switch, Linking, Platform, ActivityIndicator,
} from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useMembers } from "@/hooks/useMembers";
import { useMemberAudit, AUDIT_LABELS, type AuditAction, type AuditEntry } from "@/hooks/useMemberAudit";
import { useMemberTemplates, type RoleTemplate } from "@/hooks/useMemberTemplates";
import { useAuthStore } from "@/stores/auth";
import type { Member, SiblingCompany } from "@/hooks/useMembers";

// ============================================================
// CONSTANTS
// ============================================================

const MODULE_GROUPS = [
  {
    label: "Operação",
    modules: [
      { key: "painel",   label: "Painel",         hint: "Visão geral do negócio (dashboard)" },
      { key: "pdv",      label: "Caixa (PDV)",    hint: "Vender, abrir e fechar caixa" },
      { key: "estoque",  label: "Estoque",        hint: "Cadastrar e ajustar produtos" },
      { key: "clientes", label: "Clientes",       hint: "Cadastrar e ver histórico de clientes" },
    ],
  },
  {
    label: "Financeiro",
    modules: [
      { key: "financeiro", label: "Financeiro",    hint: "Receitas, despesas, fluxo de caixa, NF-e" },
      { key: "relatorios", label: "Relatórios",    hint: "Gráficos e análises detalhadas" },
      { key: "folha",      label: "Folha",         hint: "Funcionários, salários, holerites" },
    ],
  },
  {
    label: "Administração",
    modules: [
      { key: "configuracoes", label: "Configurações", hint: "Empresa, equipe, integrações — acesso administrativo" },
    ],
  },
];
const MODULE_LABELS = Object.fromEntries(
  MODULE_GROUPS.flatMap(g => g.modules).map(m => [m.key, m.label])
) as Record<string, string>;

const BUILT_IN_TEMPLATES = [
  { key: "caixa",    label: "Caixa",        description: "Painel + Caixa + Clientes",       icon: "🛒", role_label: "Caixa",       permissions: { painel: true, pdv: true, clientes: true } as Record<string, boolean> },
  { key: "gerente",  label: "Gerente",      description: "Acesso amplo, exceto Configs",    icon: "👔", role_label: "Gerente",     permissions: { painel: true, pdv: true, estoque: true, clientes: true, financeiro: true, relatorios: true, folha: true } as Record<string, boolean> },
  { key: "analista", label: "Analista",     description: "Painel + Financeiro + Relatórios", icon: "📊", role_label: "Analista",    permissions: { painel: true, financeiro: true, relatorios: true } as Record<string, boolean> },
  { key: "custom",   label: "Personalizado", description: "Eu escolho cada módulo",          icon: "⚙️", role_label: "Colaborador", permissions: null as Record<string, boolean> | null },
];

// ============================================================
// HELPERS
// ============================================================

const isWeb = Platform.OS === "web";

async function copyToClipboard(text: string): Promise<boolean> {
  if (isWeb && typeof navigator !== "undefined" && (navigator as any).clipboard?.writeText) {
    try { await (navigator as any).clipboard.writeText(text); return true; } catch {}
  }
  try {
    const Clip = require("expo-clipboard");
    if (Clip?.setStringAsync) { await Clip.setStringAsync(text); return true; }
  } catch {}
  return false;
}

function daysUntilExpiry(invitedAt?: string | null): { days: number; expired: boolean; label: string; soon: boolean } {
  if (!invitedAt) return { days: 7, expired: false, label: "expira em 7 dias", soon: false };
  const invited = new Date(invitedAt);
  if (isNaN(invited.getTime())) return { days: 7, expired: false, label: "expira em 7 dias", soon: false };
  const expiresAt = new Date(invited.getTime() + 7 * 24 * 60 * 60 * 1000);
  const ms = expiresAt.getTime() - Date.now();
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  if (days <= 0) return { days: 0, expired: true, label: "convite expirado — gere um novo ou estenda", soon: true };
  if (days === 1) return { days: 1, expired: false, label: "expira amanhã", soon: true };
  if (days <= 2) return { days, expired: false, label: "expira em " + days + " dias", soon: true };
  return { days, expired: false, label: "expira em " + days + " dias", soon: false };
}

function buildWhatsAppMessage(opts: { inviteUrl: string; companyName: string; role: string; inviterName?: string }): string {
  const inviter = opts.inviterName ? opts.inviterName + " te convidou" : "Você foi convidado(a)";
  return "Oi! " + inviter + " pra entrar na equipe da " + opts.companyName + " no app Aura como " + opts.role + "." +
    "\n\nÉ rápido — clique no link abaixo pra criar a conta e entrar:" +
    "\n" + opts.inviteUrl +
    "\n\n💡 Se você já tem conta na Aura, é só fazer login e o acesso aparece automático.";
}

const ROLE_LABEL_PRETTY: Record<string, string> = {
  owner: "Titular", admin: "Administrador", colaborador: "Colaborador",
  caixa: "Caixa", gerente: "Gerente", analista: "Analista", atendente: "Atendente",
};
function prettyRole(label?: string) {
  if (!label) return "Colaborador";
  return ROLE_LABEL_PRETTY[label.toLowerCase()] || label;
}

// Sprint 4#19: tempo relativo pra audit log
function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return "agora";
  const m = Math.floor(s / 60);
  if (m < 60) return "há " + m + " min";
  const h = Math.floor(m / 60);
  if (h < 24) return "há " + h + "h";
  const d = Math.floor(h / 24);
  if (d < 7) return "há " + d + (d === 1 ? " dia" : " dias");
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

// Sprint 4#19: formata metadata da action pra texto legivel
function formatAuditDetail(e: AuditEntry): string | null {
  const m = e.metadata || {};
  switch (e.action) {
    case "invite_email_changed":
      if (m.old_email && m.new_email) return m.old_email + " → " + m.new_email;
      if (m.new_email) return "Para " + m.new_email;
      return null;
    case "invite_created":
      if (m.invite_email) return "Para " + m.invite_email + " · " + (m.role_label || "colaborador");
      return m.role_label ? "Como " + m.role_label : null;
    case "permissions_updated":
      const added = (m.added || []).map((k: string) => MODULE_LABELS[k] || k);
      const removed = (m.removed || []).map((k: string) => MODULE_LABELS[k] || k);
      const parts: string[] = [];
      if (added.length) parts.push("+ " + added.join(", "));
      if (removed.length) parts.push("− " + removed.join(", "));
      return parts.join(" · ") || null;
    case "role_changed":
      return (m.from || "?") + " → " + (m.to || "?");
    case "companies_changed":
      return (m.company_ids || []).length + " empresa(s)";
    case "invite_resent":
      return m.invite_email ? "Para " + m.invite_email : null;
    default:
      return null;
  }
}

// ============================================================
// MICRO COMPONENTS
// ============================================================

function StatusBadge({ status, soon }: { status: string; soon?: boolean }) {
  const m: Record<string, { label: string; bg: string; color: string }> = {
    active:    { label: "Ativo",    bg: Colors.greenD, color: Colors.green },
    pending:   { label: soon ? "Pendente — expira logo" : "Pendente", bg: Colors.amberD, color: Colors.amber },
    suspended: { label: "Suspenso", bg: Colors.redD,   color: Colors.red },
  };
  const cfg = m[status] || m.pending;
  return <View style={[bdg.wrap, { backgroundColor: cfg.bg }]}><Text style={[bdg.text, { color: cfg.color }]}>{cfg.label}</Text></View>;
}
const bdg = StyleSheet.create({
  wrap: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  text: { fontSize: 10, fontWeight: "700" },
});

function CompanyBadge({ name, isPrimary }: { name: string; isPrimary: boolean }) {
  const initials = (name || "E").split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  return (
    <View style={[cb.wrap, isPrimary && cb.wrapPrimary]}>
      <Text style={cb.text}>{initials}</Text>
    </View>
  );
}
const cb = StyleSheet.create({
  wrap:        { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  wrapPrimary: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  text:        { fontSize: 9, fontWeight: "700", color: Colors.ink3 },
});

function ModuleToggleRow({ moduleKey, label, hint, value, onToggle }: {
  moduleKey: string; label: string; hint: string; value: boolean; onToggle: () => void;
}) {
  return (
    <View style={s.modRow}>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={s.modLabel}>{label}</Text>
        <Text style={s.modHint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ true: Colors.green, false: Colors.bg4 }}
        thumbColor="#fff"
      />
    </View>
  );
}

function ModuleGroupSelector({ value, onChange }: {
  value: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
}) {
  return (
    <View style={{ gap: 12 }}>
      {MODULE_GROUPS.map(group => (
        <View key={group.label}>
          <Text style={s.groupHeader}>{group.label}</Text>
          <View style={s.groupBody}>
            {group.modules.map(m => (
              <ModuleToggleRow
                key={m.key}
                moduleKey={m.key}
                label={m.label}
                hint={m.hint}
                value={!!value[m.key]}
                onToggle={() => onChange({ ...value, [m.key]: !value[m.key] })}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

// Sprint 4#20: cards visuais agora aceitam custom templates do servidor
type PickerEntry = {
  key: string;
  label: string;
  description: string;
  icon: string;
  permissions: Record<string, boolean> | null;
  role_label: string;
  isCustom?: boolean;
  customId?: string;
};

function RoleTemplatePicker({ entries, selected, onSelect, onDeleteCustom }: {
  entries: PickerEntry[];
  selected: string;
  onSelect: (key: string) => void;
  onDeleteCustom?: (id: string, label: string) => void;
}) {
  return (
    <View style={s.tmplGrid}>
      {entries.map(t => {
        const active = t.key === selected;
        return (
          <Pressable
            key={t.key}
            onPress={() => onSelect(t.key)}
            style={[s.tmplCard, active && s.tmplCardActive]}
          >
            <Text style={s.tmplIcon}>{t.icon}</Text>
            <Text style={[s.tmplLabel, active && { color: Colors.violet3 }]}>{t.label}</Text>
            <Text style={s.tmplDesc} numberOfLines={2}>{t.description}</Text>
            {active && (
              <View style={s.tmplCheck}>
                <Icon name="check" size={10} color="#fff" />
              </View>
            )}
            {t.isCustom && onDeleteCustom && t.customId && (
              <Pressable
                onPress={(e: any) => { e.stopPropagation?.(); onDeleteCustom(t.customId!, t.label); }}
                style={s.tmplDelete}
                hitSlop={6}
              >
                <Icon name="x" size={9} color={Colors.ink3} />
              </Pressable>
            )}
            {t.isCustom && !active && (
              <View style={s.tmplCustomTag}>
                <Text style={s.tmplCustomTagText}>SEU PERFIL</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

// ============================================================
// AUDIT HISTORY (Sprint 4#19)
// ============================================================

function AuditHistorySection({ memberId, expanded }: { memberId: string; expanded: boolean }) {
  const { data, isLoading } = useMemberAudit(expanded ? memberId : null);
  const entries: AuditEntry[] = data?.entries || [];

  if (!expanded) return null;

  return (
    <View style={s.auditWrap}>
      <Text style={s.auditTitle}>Histórico</Text>
      {isLoading ? (
        <View style={{ paddingVertical: 12, alignItems: "center" }}>
          <ActivityIndicator size="small" color={Colors.violet3} />
        </View>
      ) : entries.length === 0 ? (
        <Text style={s.auditEmpty}>Sem eventos registrados ainda.</Text>
      ) : (
        <View style={{ gap: 6 }}>
          {entries.map(e => {
            const detail = formatAuditDetail(e);
            return (
              <View key={e.id} style={s.auditRow}>
                <View style={s.auditDot} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.auditLabel}>{AUDIT_LABELS[e.action] || e.action}</Text>
                  {detail && <Text style={s.auditDetail} numberOfLines={2}>{detail}</Text>}
                  <Text style={s.auditMeta}>
                    {timeAgo(e.created_at)}
                    {e.actor_name ? " · " + e.actor_name : ""}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ============================================================
// PENDING INVITE PANEL — agora com botão Estender (Sprint 4#18)
// ============================================================

function PendingInvitePanel({ member, companyName, inviterName, onResend, onEditEmail, onExtend, onCancel, isResending, isEditingEmail, isExtending, isCancelling }: {
  member: Member;
  companyName: string;
  inviterName?: string;
  onResend: () => void;
  onEditEmail: (newEmail: string) => Promise<void>;
  onExtend: () => void;
  onCancel: () => void;
  isResending: boolean;
  isEditingEmail: boolean;
  isExtending: boolean;
  isCancelling: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [newEmail, setNewEmail] = useState(member.invite_email || "");
  const expiry = daysUntilExpiry(member.invited_at);
  const role = prettyRole(member.role_label);
  const inviteUrl = member.invite_url || "";
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(newEmail.trim());
  const showExtend = expiry.soon || expiry.expired;

  async function handleCopy() {
    const ok = await copyToClipboard(inviteUrl);
    ok ? toast.success("Link copiado!") : toast.error("Não foi possível copiar.");
  }
  function handleWhatsApp() {
    const msg = buildWhatsAppMessage({ inviteUrl, companyName, role, inviterName });
    Linking.openURL("https://wa.me/?text=" + encodeURIComponent(msg)).catch(() => toast.error("Não foi possível abrir o WhatsApp"));
  }
  async function handleSaveEmail() {
    if (!emailValid) { toast.error("E-mail inválido"); return; }
    try { await onEditEmail(newEmail.trim().toLowerCase()); setEditing(false); } catch {}
  }

  return (
    <View style={[s.pendingPanel, expiry.expired && { backgroundColor: Colors.redD, borderColor: Colors.red + "44" }]}>
      <View style={s.pendingHead}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Icon name={expiry.expired ? "alert" : "link"} size={14} color={expiry.expired ? Colors.red : Colors.amber} />
            <Text style={[s.pendingTitle, { color: expiry.expired ? Colors.red : Colors.amber }]}>
              {expiry.expired ? "Convite expirado" : "Convite ainda não aceito"}
            </Text>
          </View>
          <Text style={s.pendingSubtitle}>
            {member.invite_email
              ? "Enviado para " + member.invite_email + " · " + expiry.label
              : "Sem email cadastrado · " + expiry.label}
          </Text>
        </View>
      </View>

      {/* Estender — visivel quando proximo de expirar ou expirado */}
      {showExtend && (
        <Pressable
          onPress={onExtend}
          disabled={isExtending}
          style={[s.extendBtn, isExtending && { opacity: 0.5 }]}
        >
          {isExtending
            ? <ActivityIndicator size="small" color={Colors.violet} />
            : <><Icon name="clock" size={13} color={Colors.violet} /><Text style={s.extendBtnText}>Estender 7 dias</Text></>}
        </Pressable>
      )}

      <View style={s.linkBox}>
        <Text style={s.linkText} numberOfLines={2}>{inviteUrl || "—"}</Text>
      </View>

      <View style={s.actionsRow}>
        <Pressable onPress={handleCopy} style={s.copyBtn}>
          <Icon name="copy" size={13} color={Colors.violet3} />
          <Text style={s.copyBtnText}>Copiar link</Text>
        </Pressable>
        <Pressable onPress={handleWhatsApp} style={s.whatsBtn}>
          <Icon name="message" size={13} color={Colors.green} />
          <Text style={s.whatsBtnText}>WhatsApp</Text>
        </Pressable>
      </View>

      {!editing ? (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          {member.invite_email && (
            <Pressable
              onPress={onResend}
              disabled={isResending || expiry.expired}
              style={[s.softBtn, (isResending || expiry.expired) && { opacity: 0.5 }]}
            >
              {isResending
                ? <ActivityIndicator size="small" color={Colors.violet3} />
                : <><Icon name="mail" size={12} color={Colors.violet3} /><Text style={s.softBtnText}>Reenviar email</Text></>}
            </Pressable>
          )}
          <Pressable onPress={() => setEditing(true)} style={s.softBtn}>
            <Icon name="edit" size={12} color={Colors.violet3} />
            <Text style={s.softBtnText}>{member.invite_email ? "Trocar email" : "Adicionar email"}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={s.editEmailBox}>
          <Text style={s.editEmailLabel}>Novo destinatário</Text>
          <TextInput
            style={[s.input, newEmail && !emailValid && s.inputError]}
            value={newEmail}
            onChangeText={setNewEmail}
            placeholder="email@exemplo.com"
            placeholderTextColor={Colors.ink3}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          {newEmail && !emailValid && <Text style={s.fieldError}>E-mail inválido</Text>}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <Pressable onPress={() => { setEditing(false); setNewEmail(member.invite_email || ""); }} style={s.cancelBtn}>
              <Text style={s.cancelBtnText}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={handleSaveEmail}
              disabled={isEditingEmail || !emailValid}
              style={[s.sendBtn, (isEditingEmail || !emailValid) && { opacity: 0.5 }]}
            >
              {isEditingEmail
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={s.sendBtnText}>Salvar e reenviar</Text>}
            </Pressable>
          </View>
        </View>
      )}

      <Pressable
        onPress={onCancel}
        disabled={isCancelling}
        style={[s.cancelInviteBtn, isCancelling && { opacity: 0.5 }]}
      >
        {isCancelling
          ? <ActivityIndicator size="small" color={Colors.red} />
          : <Text style={s.cancelInviteBtnText}>Cancelar convite</Text>}
      </Pressable>
    </View>
  );
}

// ============================================================
// MEMBER ROW
// ============================================================

function MemberRow(props: {
  member: Member;
  siblings: SiblingCompany[];
  isOwner: boolean;
  companyName: string;
  inviterName?: string;
  onUpdate: (perms: Record<string, boolean>, role: string, company_ids?: string[]) => void;
  onRemove: () => void;
  onResend: () => void;
  onEditEmail: (newEmail: string) => Promise<void>;
  onExtend: () => void;
  isUpdating: boolean;
  isRemoving: boolean;
  isResending: boolean;
  isEditingEmail: boolean;
  isExtending: boolean;
}) {
  const { member, siblings, isOwner, companyName, inviterName, onUpdate, onRemove, onResend, onEditEmail, onExtend, isUpdating, isRemoving, isResending, isEditingEmail, isExtending } = props;
  const [expanded, setExpanded] = useState(false);
  const [perms, setPerms] = useState<Record<string, boolean>>(member.permissions || {});
  const [role, setRole] = useState(member.role_label);
  const [cnpjIds, setCnpjIds] = useState<string[]>(member.companies.map(c => c.company_id));
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const isOwnerLabel = member.role_label === "owner";
  const isPending = member.status === "pending";
  const canEdit = !isOwner && member.status !== "suspended";
  const multiCnpj = siblings.length > 1;
  const memberCnpjIds = member.companies.map(c => c.company_id);
  const canExpand = !isOwner && (
    (isPending && !!member.invite_url) ||
    (!isPending && canEdit)
  );
  const expiry = isPending ? daysUntilExpiry(member.invited_at) : null;

  return (
    <View>
      <Pressable
        onPress={() => { if (canExpand) setExpanded(!expanded); }}
        style={s.memberRow}
      >
        <View style={s.avatar}>
          <Text style={s.avatarText}>{(member.name || "?")[0].toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.memberName}>{member.name}</Text>
          <Text style={s.memberEmail} numberOfLines={1}>
            {isPending ? (member.invite_email || "Compartilhe o link manualmente") : member.email}
          </Text>
          {multiCnpj && !isOwnerLabel && memberCnpjIds.length > 0 && (
            <View style={{ flexDirection: "row", gap: 3, marginTop: 4, flexWrap: "wrap" }}>
              {siblings.map(sib =>
                memberCnpjIds.includes(sib.id)
                  ? <CompanyBadge key={sib.id} name={sib.name} isPrimary={sib.is_primary} />
                  : null
              )}
            </View>
          )}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {isOwnerLabel
            ? <View style={[bdg.wrap, { backgroundColor: Colors.violetD }]}><Text style={[bdg.text, { color: Colors.violet3 }]}>Titular</Text></View>
            : <StatusBadge status={member.status} soon={expiry?.soon} />}
          {canExpand && <Icon name={expanded ? "chevron_up" : "chevron_down"} size={14} color={Colors.ink3} />}
        </View>
      </Pressable>

      {expanded && isPending && member.invite_url && (
        <PendingInvitePanel
          member={member}
          companyName={companyName}
          inviterName={inviterName}
          onResend={onResend}
          onEditEmail={onEditEmail}
          onExtend={onExtend}
          onCancel={() => setConfirmRemove(true)}
          isResending={isResending}
          isEditingEmail={isEditingEmail}
          isExtending={isExtending}
          isCancelling={isRemoving}
        />
      )}

      {expanded && canEdit && !isPending && (
        <View style={s.permEditor}>
          <Text style={s.permSectionLabel}>Função (rótulo)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 6, marginBottom: 16 }}>
            {["Colaborador", "Caixa", "Gerente", "Analista", "Atendente"].map(r => (
              <Pressable key={r} onPress={() => setRole(r)} style={[s.roleChip, role === r && s.roleChipActive]}>
                <Text style={[s.roleChipText, role === r && { color: Colors.violet3 }]}>{r}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {multiCnpj && (
            <>
              <Text style={s.permSectionLabel}>Acesso às empresas</Text>
              {siblings.map(sib => {
                const enabled = cnpjIds.includes(sib.id);
                return (
                  <View key={sib.id} style={s.cnpjToggleRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.permLabel}>{sib.name}</Text>
                      {sib.is_primary && <Text style={{ fontSize: 10, color: Colors.ink3 }}>Principal</Text>}
                    </View>
                    <Switch
                      value={enabled}
                      onValueChange={v => setCnpjIds(prev => v ? [...prev, sib.id] : prev.filter(id => id !== sib.id))}
                      trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
                      thumbColor={enabled ? Colors.violet : Colors.ink3}
                    />
                  </View>
                );
              })}
              <View style={{ height: 12 }} />
            </>
          )}

          <Text style={s.permSectionLabel}>
            {multiCnpj ? "Permissões (aplicadas em todos os CNPJs)" : "O que esta pessoa pode fazer"}
          </Text>
          <ModuleGroupSelector value={perms} onChange={setPerms} />

          <View style={s.permActions}>
            <Pressable
              onPress={() => onUpdate(perms, role, multiCnpj ? cnpjIds : undefined)}
              disabled={isUpdating}
              style={[s.savePermBtn, isUpdating && { opacity: 0.6 }]}
            >
              {isUpdating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.savePermBtnText}>Salvar permissões</Text>}
            </Pressable>
            <Pressable onPress={() => setConfirmRemove(true)} disabled={isRemoving} style={s.removeBtn}>
              <Text style={s.removeBtnText}>Suspender</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Sprint 4#19: histórico — colapsavel dentro de qualquer membro expandido */}
      {expanded && canExpand && (
        <View style={s.historyWrap}>
          <Pressable onPress={() => setHistoryOpen(v => !v)} style={s.historyToggle}>
            <Icon name={historyOpen ? "chevron_up" : "chevron_right"} size={12} color={Colors.ink3} />
            <Text style={s.historyToggleText}>Histórico</Text>
          </Pressable>
          {historyOpen && <AuditHistorySection memberId={member.id} expanded={historyOpen} />}
        </View>
      )}

      <ConfirmDialog
        visible={confirmRemove}
        title={isPending ? "Cancelar convite?" : "Suspender membro?"}
        message={isPending ? "O link de convite será invalidado. A pessoa não poderá mais usar esse link." : "O membro perderá acesso imediatamente."}
        confirmLabel={isPending ? "Cancelar convite" : "Suspender"}
        destructive
        onConfirm={() => { setConfirmRemove(false); onRemove(); }}
        onCancel={() => setConfirmRemove(false)}
      />
    </View>
  );
}

// ============================================================
// INVITE WIZARD — Sprint 1+2+4 (templates customizados)
// ============================================================

function InviteWizard({ siblings, currentCompanyId, customTemplates, onSaveTemplate, onDeleteTemplate, onCancel, onSubmit, isSubmitting, isSavingTemplate }: {
  siblings: SiblingCompany[];
  currentCompanyId: string;
  customTemplates: RoleTemplate[];
  onSaveTemplate: (body: { name: string; permissions: Record<string, boolean> }) => Promise<any>;
  onDeleteTemplate: (id: string) => Promise<any>;
  onCancel: () => void;
  onSubmit: (data: { email: string; role_label: string; company_ids?: string[]; permissions?: Record<string, boolean> }) => Promise<void>;
  isSubmitting: boolean;
  isSavingTemplate: boolean;
}) {
  const multiCnpj = siblings.length > 1;
  const [email, setEmail] = useState("");
  const [cnpjIds, setCnpjIds] = useState<string[]>([currentCompanyId]);
  const [tmplKey, setTmplKey] = useState<string>("caixa");
  const [customPerms, setCustomPerms] = useState<Record<string, boolean>>({ painel: true });
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const emailValid = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  // Sprint 4#20: monta entries combinando built-in + custom + opcao Personalizado
  const entries: PickerEntry[] = useMemo(() => {
    const builtIn = BUILT_IN_TEMPLATES.filter(t => t.key !== "custom").map(t => ({ ...t, isCustom: false } as PickerEntry));
    const custom: PickerEntry[] = customTemplates.map(ct => ({
      key:         "custom-" + ct.id,
      label:       ct.name,
      description: ct.description || "Perfil personalizado",
      icon:        "🏷️",
      role_label:  "Colaborador",
      permissions: ct.permissions,
      isCustom:    true,
      customId:    ct.id,
    }));
    const customOption: PickerEntry = { ...BUILT_IN_TEMPLATES.find(t => t.key === "custom")!, isCustom: false };
    return [...builtIn, ...custom, customOption];
  }, [customTemplates]);

  const selected = entries.find(e => e.key === tmplKey);
  const isCustomMode = tmplKey === "custom";

  async function handleSubmit() {
    if (email.trim() && !emailValid) { toast.error("E-mail inválido"); return; }
    if (multiCnpj && cnpjIds.length === 0) { toast.error("Selecione pelo menos uma empresa"); return; }
    const permissions = isCustomMode ? customPerms : (selected?.permissions || {});
    await onSubmit({
      email: email.trim().toLowerCase(),
      role_label: selected?.role_label || "Colaborador",
      company_ids: multiCnpj ? cnpjIds : undefined,
      permissions,
    });
  }

  async function handleSaveAsTemplate() {
    if (!templateName.trim()) { toast.error("Dê um nome para o perfil"); return; }
    if (Object.values(customPerms).filter(Boolean).length === 0) {
      toast.error("Selecione pelo menos uma permissão");
      return;
    }
    try {
      const res: any = await onSaveTemplate({ name: templateName.trim(), permissions: customPerms });
      // Se backend retornou template, seleciona ele direto
      if (res?.template?.id) setTmplKey("custom-" + res.template.id);
      setSavingTemplate(false);
      setTemplateName("");
    } catch {}
  }

  async function handleDeleteTemplate(id: string, label: string) {
    if (typeof window !== "undefined" && window.confirm) {
      if (!window.confirm("Remover o perfil '" + label + "'?")) return;
    }
    try {
      await onDeleteTemplate(id);
      if (tmplKey === "custom-" + id) setTmplKey("caixa");
    } catch {}
  }

  return (
    <View style={s.wizard}>
      <Text style={s.wizardTitle}>Convidar pessoa para a equipe</Text>
      <Text style={s.wizardSubtitle}>
        Vamos gerar um link único. Se você preencher o e-mail, mandamos o convite por lá também.
      </Text>

      <View style={s.step}>
        <Text style={s.stepLabel}>1. Para quem é?</Text>
        <Text style={s.stepHint}>E-mail é opcional — sem ele você compartilha o link via WhatsApp.</Text>
        <TextInput
          style={[s.input, email && !emailValid && s.inputError]}
          value={email}
          onChangeText={setEmail}
          placeholder="email@exemplo.com (opcional)"
          placeholderTextColor={Colors.ink3}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        {email && !emailValid && <Text style={s.fieldError}>E-mail inválido</Text>}
      </View>

      {multiCnpj && (
        <View style={s.step}>
          <Text style={s.stepLabel}>2. Em quais empresas?</Text>
          <Text style={s.stepHint}>Esta pessoa vai trabalhar em quais lojas?</Text>
          {siblings.map(sib => {
            const checked = cnpjIds.includes(sib.id);
            return (
              <Pressable
                key={sib.id}
                onPress={() => setCnpjIds(prev => checked ? prev.filter(x => x !== sib.id) : [...prev, sib.id])}
                style={s.checkRow}
              >
                <View style={[s.checkBox, checked && s.checkBoxActive]}>
                  {checked && <Icon name="check" size={11} color="#fff" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.checkLabel}>{sib.name}</Text>
                  {sib.is_primary && <Text style={{ fontSize: 10, color: Colors.ink3 }}>Principal</Text>}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={s.step}>
        <Text style={s.stepLabel}>{multiCnpj ? "3" : "2"}. O que ela pode fazer?</Text>
        <Text style={s.stepHint}>Escolha um perfil pronto, use um dos seus salvos ou personalize.</Text>
        <RoleTemplatePicker
          entries={entries}
          selected={tmplKey}
          onSelect={setTmplKey}
          onDeleteCustom={handleDeleteTemplate}
        />

        {isCustomMode ? (
          <View style={{ marginTop: 14 }}>
            <ModuleGroupSelector value={customPerms} onChange={setCustomPerms} />

            {/* Sprint 4#20: salvar como template */}
            <View style={{ marginTop: 12 }}>
              {!savingTemplate ? (
                <Pressable onPress={() => setSavingTemplate(true)} style={s.softBtn}>
                  <Icon name="bookmark" size={12} color={Colors.violet3} />
                  <Text style={s.softBtnText}>Salvar como perfil</Text>
                </Pressable>
              ) : (
                <View style={s.editEmailBox}>
                  <Text style={s.editEmailLabel}>Nome do perfil</Text>
                  <TextInput
                    style={s.input}
                    value={templateName}
                    onChangeText={setTemplateName}
                    placeholder="Ex.: Caixa Senior, Vendedor com Desconto"
                    placeholderTextColor={Colors.ink3}
                    maxLength={60}
                  />
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                    <Pressable onPress={() => { setSavingTemplate(false); setTemplateName(""); }} style={s.cancelBtn}>
                      <Text style={s.cancelBtnText}>Cancelar</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleSaveAsTemplate}
                      disabled={isSavingTemplate || !templateName.trim()}
                      style={[s.sendBtn, (isSavingTemplate || !templateName.trim()) && { opacity: 0.5 }]}
                    >
                      {isSavingTemplate
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={s.sendBtnText}>Salvar perfil</Text>}
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={s.tmplPreview}>
            <Text style={s.tmplPreviewLabel}>Esta pessoa terá acesso a:</Text>
            <View style={s.tmplPreviewChips}>
              {Object.keys(selected?.permissions || {}).filter(k => selected!.permissions![k]).map(k => (
                <View key={k} style={s.tmplPreviewChip}>
                  <Text style={s.tmplPreviewChipText}>{MODULE_LABELS[k] || k}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 18 }}>
        <Pressable onPress={onCancel} style={s.cancelBtn}><Text style={s.cancelBtnText}>Cancelar</Text></Pressable>
        <Pressable
          onPress={handleSubmit}
          disabled={isSubmitting}
          style={[s.sendBtn, isSubmitting && { opacity: 0.5 }]}
        >
          {isSubmitting
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={s.sendBtnText}>Criar acesso →</Text>}
        </Pressable>
      </View>
    </View>
  );
}

// ============================================================
// INVITE SUCCESS CARD
// ============================================================

function InviteSuccessCard({ inviteUrl, email, role, companyName, inviterName, onClose }: {
  inviteUrl: string; email: string; role: string; companyName: string; inviterName?: string; onClose: () => void;
}) {
  async function handleCopy() {
    const ok = await copyToClipboard(inviteUrl);
    ok ? toast.success("Link copiado!") : toast.error("Não foi possível copiar.");
  }
  function handleWhats() {
    const msg = buildWhatsAppMessage({ inviteUrl, companyName, role: prettyRole(role), inviterName });
    Linking.openURL("https://wa.me/?text=" + encodeURIComponent(msg)).catch(() => toast.error("Não foi possível abrir o WhatsApp"));
  }
  return (
    <View style={s.successCard}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Icon name="check" size={14} color={Colors.green} />
            <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.green }}>Acesso criado!</Text>
          </View>
          <Text style={{ fontSize: 11, color: Colors.ink3, marginBottom: 12 }}>
            {email
              ? "Mandamos o convite por email pra " + email + ". Você também pode compartilhar o link:"
              : "Compartilhe o link abaixo pra pessoa entrar na equipe."}
          </Text>
        </View>
        <Pressable onPress={onClose} style={s.successClose}>
          <Icon name="x" size={12} color={Colors.ink3} />
        </Pressable>
      </View>
      <View style={s.linkBox}>
        <Text style={s.linkText} numberOfLines={2}>{inviteUrl}</Text>
      </View>
      <View style={s.actionsRow}>
        <Pressable onPress={handleCopy} style={s.copyBtn}>
          <Icon name="copy" size={13} color={Colors.violet3} />
          <Text style={s.copyBtnText}>Copiar link</Text>
        </Pressable>
        <Pressable onPress={handleWhats} style={s.whatsBtn}>
          <Icon name="message" size={13} color={Colors.green} />
          <Text style={s.whatsBtnText}>WhatsApp</Text>
        </Pressable>
      </View>
      <Text style={{ fontSize: 10, color: Colors.ink3, marginTop: 8 }}>
        Pode fechar tranquilo — você recupera o link, reenvia ou estende a validade depois clicando no convite na lista abaixo.
      </Text>
    </View>
  );
}

// ============================================================
// EMPTY ONBOARDING
// ============================================================

function EmptyOnboarding({ onInvite }: { onInvite: () => void }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyHero}><Text style={{ fontSize: 36 }}>👥</Text></View>
      <Text style={s.emptyTitle}>Convide sua equipe</Text>
      <Text style={s.emptySubtitle}>Funcionários, sócios ou freelancers — todo mundo na mesma plataforma.</Text>
      <View style={s.steps3}>
        <View style={s.step3}>
          <View style={s.step3Num}><Text style={s.step3NumText}>1</Text></View>
          <Text style={s.step3Title}>Crie o acesso</Text>
          <Text style={s.step3Desc}>Defina o que a pessoa pode fazer</Text>
        </View>
        <View style={s.step3}>
          <View style={s.step3Num}><Text style={s.step3NumText}>2</Text></View>
          <Text style={s.step3Title}>Compartilhe</Text>
          <Text style={s.step3Desc}>Por email ou WhatsApp</Text>
        </View>
        <View style={s.step3}>
          <View style={s.step3Num}><Text style={s.step3NumText}>3</Text></View>
          <Text style={s.step3Title}>Pronto!</Text>
          <Text style={s.step3Desc}>Ela aceita e já entra</Text>
        </View>
      </View>
      <Pressable onPress={onInvite} style={s.emptyCta}>
        <Icon name="plus" size={14} color="#fff" />
        <Text style={s.emptyCtaText}>Convidar primeira pessoa</Text>
      </Pressable>
    </View>
  );
}

// ============================================================
// ROOT
// ============================================================

export function MembersSection() {
  const { company, user } = useAuthStore();
  const {
    members, siblings, active, pending, monthlyCost, isLoading,
    lastInvite, clearLastInvite,
    inviteMember, isInviting,
    updateMember, isUpdating,
    removeMember, isRemoving,
    resendInviteEmail, isResending,
    updateInviteEmail, isUpdatingEmail,
    extendInvite, isExtending,
  } = useMembers();
  const { customTemplates, createTemplate, isCreating, deleteTemplate } = useMemberTemplates();

  const [wizardOpen, setWizardOpen] = useState(false);
  const inviterName = (user as any)?.name || (user as any)?.full_name || undefined;
  const companyName = (company as any)?.name || "Aura";

  async function handleInvite(data: { email: string; role_label: string; company_ids?: string[]; permissions?: Record<string, boolean> }) {
    try { await inviteMember(data); setWizardOpen(false); } catch {}
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Equipe</Text>
          <Text style={s.subtitle}>
            {active} ativo{active !== 1 ? "s" : ""}
            {pending > 0 ? " · " + pending + " pendente" + (pending !== 1 ? "s" : "") : ""}
            {monthlyCost > 0 ? " · +R$" + monthlyCost + "/mês" : ""}
          </Text>
        </View>
        {!wizardOpen && (
          <Pressable onPress={() => setWizardOpen(true)} style={s.inviteBtn} disabled={isInviting}>
            {isInviting
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Icon name="plus" size={13} color="#fff" /><Text style={s.inviteBtnText}>Convidar pessoa</Text></>}
          </Pressable>
        )}
      </View>

      {lastInvite && (
        <InviteSuccessCard
          inviteUrl={lastInvite.url}
          email={lastInvite.email}
          role={lastInvite.role}
          companyName={companyName}
          inviterName={inviterName}
          onClose={clearLastInvite}
        />
      )}

      {wizardOpen && (
        <InviteWizard
          siblings={siblings}
          currentCompanyId={company?.id || ""}
          customTemplates={customTemplates}
          onSaveTemplate={createTemplate}
          onDeleteTemplate={deleteTemplate}
          onCancel={() => setWizardOpen(false)}
          onSubmit={handleInvite}
          isSubmitting={isInviting}
          isSavingTemplate={isCreating}
        />
      )}

      {isLoading ? (
        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <ActivityIndicator color={Colors.violet3} />
        </View>
      ) : members.length === 0 && !wizardOpen ? (
        <EmptyOnboarding onInvite={() => setWizardOpen(true)} />
      ) : (
        <View>
          {members.map(m => (
            <MemberRow
              key={m.id}
              member={m}
              siblings={siblings}
              isOwner={m.role_label === "owner"}
              companyName={companyName}
              inviterName={inviterName}
              onUpdate={(perms, role, cnpjIds) => {
                const body: any = { permissions: perms, role_label: role };
                if (cnpjIds !== undefined) body.company_ids = cnpjIds;
                updateMember(m.id, body);
              }}
              onRemove={() => {
                const allIds = m.companies.length > 0 ? m.companies.map(c => c.member_id) : [m.id];
                removeMember(allIds);
              }}
              onResend={() => resendInviteEmail(m.id)}
              onEditEmail={(newEmail) => updateInviteEmail(m.id, newEmail)}
              onExtend={() => extendInvite(m.id)}
              isUpdating={isUpdating}
              isRemoving={isRemoving}
              isResending={isResending}
              isEditingEmail={isUpdatingEmail}
              isExtending={isExtending}
            />
          ))}
        </View>
      )}

      {members.length > 0 && (
        <View style={s.billingNote}>
          <Text style={s.billingText}>O titular não é cobrado. Cada membro adicional ativo: R$19/mês.</Text>
        </View>
      )}
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const s = StyleSheet.create({
  container:    { backgroundColor: Colors.bg3, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: "hidden" },
  header:       { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 },
  title:        { fontSize: 15, fontWeight: "700", color: Colors.ink },
  subtitle:     { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  inviteBtn:    { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14 },
  inviteBtnText:{ fontSize: 12.5, color: "#fff", fontWeight: "600" },

  successCard:  { margin: 12, backgroundColor: Colors.greenD, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.green + "33" },
  successClose: { width: 24, height: 24, borderRadius: 6, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },

  pendingPanel:    { backgroundColor: Colors.amberD, paddingHorizontal: 14, paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.amber + "33", borderBottomWidth: 1, borderBottomColor: Colors.amber + "33" },
  pendingHead:     { flexDirection: "row", marginBottom: 10 },
  pendingTitle:    { fontSize: 13, fontWeight: "700" },
  pendingSubtitle: { fontSize: 11, color: Colors.ink3, marginTop: 2, lineHeight: 15 },

  // Sprint 4#18: botao Estender — destaque visual
  extendBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.violetD, borderRadius: 8, paddingVertical: 10, marginBottom: 10, borderWidth: 1, borderColor: Colors.violet + "55" },
  extendBtnText: { fontSize: 12, color: Colors.violet, fontWeight: "700" },

  linkBox:    { backgroundColor: Colors.bg4, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: Colors.border },
  linkText:   { fontSize: 11, color: Colors.violet3, fontFamily: "monospace" as any, lineHeight: 16 },
  actionsRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  copyBtn:    { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.violetD, borderRadius: 8, paddingVertical: 9, borderWidth: 1, borderColor: Colors.border2 },
  copyBtnText:{ fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  whatsBtn:   { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.greenD, borderRadius: 8, paddingVertical: 9, borderWidth: 1, borderColor: Colors.green + "44" },
  whatsBtnText:{ fontSize: 11, color: Colors.green, fontWeight: "600" },

  softBtn:     { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: "transparent", borderRadius: 8, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border2 },
  softBtnText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },

  editEmailBox:   { marginTop: 10, padding: 10, backgroundColor: Colors.bg4, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  editEmailLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 },

  cancelInviteBtn:     { marginTop: 12, paddingVertical: 9, borderRadius: 8, alignItems: "center", borderWidth: 1, borderColor: Colors.red + "33", backgroundColor: "transparent" },
  cancelInviteBtnText: { fontSize: 12, color: Colors.red, fontWeight: "600" },

  wizard:         { margin: 12, backgroundColor: Colors.bg4, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  wizardTitle:    { fontSize: 15, fontWeight: "700", color: Colors.ink, marginBottom: 4 },
  wizardSubtitle: { fontSize: 12, color: Colors.ink3, marginBottom: 18, lineHeight: 17 },
  step:           { marginBottom: 18 },
  stepLabel:      { fontSize: 13, color: Colors.ink, fontWeight: "700", marginBottom: 4 },
  stepHint:       { fontSize: 11, color: Colors.ink3, marginBottom: 10, lineHeight: 15 },

  input:      { backgroundColor: Colors.bg3, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.ink, borderWidth: 1, borderColor: Colors.border },
  inputError: { borderColor: Colors.red },
  fieldError: { fontSize: 11, color: Colors.red, marginTop: 4 },

  checkRow:        { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  checkBox:        { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center" },
  checkBoxActive:  { backgroundColor: Colors.violet, borderColor: Colors.violet },
  checkLabel:      { fontSize: 13, color: Colors.ink, fontWeight: "500" },

  tmplGrid:      { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tmplCard:      { flexBasis: "48%", flexGrow: 1, padding: 12, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, position: "relative", minHeight: 100 },
  tmplCardActive:{ borderColor: Colors.violet, backgroundColor: Colors.violetD },
  tmplIcon:      { fontSize: 22, marginBottom: 6 },
  tmplLabel:     { fontSize: 13, fontWeight: "700", color: Colors.ink, marginBottom: 2 },
  tmplDesc:      { fontSize: 10, color: Colors.ink3, lineHeight: 14 },
  tmplCheck:     { position: "absolute", top: 8, right: 8, width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center" },
  tmplDelete:    { position: "absolute", top: 8, right: 8, width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  tmplCustomTag: { position: "absolute", bottom: 6, right: 6, paddingHorizontal: 5, paddingVertical: 1, backgroundColor: Colors.violetD, borderRadius: 3, borderWidth: 1, borderColor: Colors.border2 },
  tmplCustomTagText: { fontSize: 7.5, fontWeight: "800", color: Colors.violet3, letterSpacing: 0.5 },

  tmplPreview:         { marginTop: 14, padding: 12, backgroundColor: Colors.bg3, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  tmplPreviewLabel:    { fontSize: 11, color: Colors.ink3, fontWeight: "600", marginBottom: 8 },
  tmplPreviewChips:    { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tmplPreviewChip:     { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 },
  tmplPreviewChipText: { fontSize: 10, color: Colors.violet3, fontWeight: "700" },

  groupHeader: { fontSize: 10, color: Colors.violet3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  groupBody:   { backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12 },
  modRow:      { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modLabel:    { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  modHint:     { fontSize: 10, color: Colors.ink3, marginTop: 2, lineHeight: 14 },

  cancelBtn:     { flex: 1, paddingVertical: 11, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, alignItems: "center", backgroundColor: "transparent" },
  cancelBtnText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  sendBtn:       { flex: 2, paddingVertical: 11, borderRadius: 8, backgroundColor: Colors.violet, alignItems: "center" },
  sendBtnText:   { fontSize: 12.5, color: "#fff", fontWeight: "700" },

  memberRow:    { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  avatar:       { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border2 },
  avatarText:   { fontSize: 14, fontWeight: "700", color: Colors.violet3 },
  memberName:   { fontSize: 13, fontWeight: "600", color: Colors.ink },
  memberEmail:  { fontSize: 11, color: Colors.ink3, marginTop: 1 },

  permEditor:       { backgroundColor: Colors.bg4, paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  permSectionLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  permLabel:        { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  cnpjToggleRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  permActions:      { flexDirection: "row", gap: 8, marginTop: 16 },
  savePermBtn:      { flex: 2, paddingVertical: 11, borderRadius: 8, backgroundColor: Colors.violet, alignItems: "center" },
  savePermBtnText:  { fontSize: 12.5, color: "#fff", fontWeight: "700" },
  removeBtn:        { flex: 1, paddingVertical: 11, borderRadius: 8, backgroundColor: "transparent", alignItems: "center", borderWidth: 1, borderColor: Colors.red + "33" },
  removeBtnText:    { fontSize: 12, color: Colors.red, fontWeight: "600" },

  roleChip:       { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  roleChipActive: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  roleChipText:   { fontSize: 12, color: Colors.ink3, fontWeight: "500" },

  // Sprint 4#19: history collapsible + entries
  historyWrap:       { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.bg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  historyToggle:     { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 },
  historyToggleText: { fontSize: 11, color: Colors.ink3, fontWeight: "600", letterSpacing: 0.3 },
  auditWrap:         { paddingTop: 8, paddingBottom: 4 },
  auditTitle:        { fontSize: 10, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  auditEmpty:        { fontSize: 11, color: Colors.ink3, fontStyle: "italic", paddingVertical: 8 },
  auditRow:          { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  auditDot:          { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.violet3, marginTop: 6 },
  auditLabel:        { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  auditDetail:       { fontSize: 11, color: Colors.ink2, marginTop: 1 },
  auditMeta:         { fontSize: 10, color: Colors.ink3, marginTop: 2 },

  empty:        { alignItems: "center", paddingVertical: 32, paddingHorizontal: 20 },
  emptyHero:    { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  emptyTitle:   { fontSize: 17, fontWeight: "700", color: Colors.ink, marginBottom: 6 },
  emptySubtitle:{ fontSize: 12, color: Colors.ink3, textAlign: "center", maxWidth: 320, lineHeight: 17, marginBottom: 24 },
  steps3:       { flexDirection: "row", gap: 10, marginBottom: 24, flexWrap: "wrap", justifyContent: "center" },
  step3:        { flexBasis: "30%", minWidth: 100, alignItems: "center", padding: 10, backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  step3Num:     { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  step3NumText: { fontSize: 11, fontWeight: "800", color: "#fff" },
  step3Title:   { fontSize: 12, fontWeight: "700", color: Colors.ink, marginBottom: 2 },
  step3Desc:    { fontSize: 10, color: Colors.ink3, textAlign: "center", lineHeight: 14 },
  emptyCta:     { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.violet, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10 },
  emptyCtaText: { fontSize: 13, fontWeight: "700", color: "#fff" },

  billingNote:  { borderTopWidth: 1, borderTopColor: Colors.border, padding: 12 },
  billingText:  { fontSize: 10, color: Colors.ink3, fontStyle: "italic", textAlign: "center" },
});

export default MembersSection;
