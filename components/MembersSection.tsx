import { useState } from "react";
import {
  View, Text, StyleSheet, Pressable, TextInput,
  ScrollView, Switch, Linking, Platform, ActivityIndicator,
} from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useMembers } from "@/hooks/useMembers";
import { useAuthStore } from "@/stores/auth";
import type { Member, SiblingCompany } from "@/hooks/useMembers";

var MODULE_LABELS: Record<string, string> = {
  painel: "Painel (Dashboard)", pdv: "Caixa (PDV)", estoque: "Estoque",
  clientes: "Clientes", financeiro: "Financeiro", relatorios: "Relatorios",
  folha: "Folha de pagamento", configuracoes: "Configuracoes",
};
var MODULE_ORDER = ["painel", "pdv", "estoque", "clientes", "financeiro", "relatorios", "folha", "configuracoes"];
var ROLE_OPTIONS = ["Colaborador", "Gerente", "Atendente", "Caixa", "Analista"];

function StatusBadge({ status }: { status: string }) {
  var m: Record<string, { label: string; bg: string; color: string }> = {
    active:    { label: "Ativo",    bg: Colors.greenD, color: Colors.green },
    pending:   { label: "Pendente", bg: Colors.amberD, color: Colors.amber },
    suspended: { label: "Suspenso", bg: Colors.redD,   color: Colors.red },
  };
  var cfg = m[status] || m.pending;
  return <View style={[bdg.wrap, { backgroundColor: cfg.bg }]}><Text style={[bdg.text, { color: cfg.color }]}>{cfg.label}</Text></View>;
}
var bdg = StyleSheet.create({
  wrap: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  text: { fontSize: 10, fontWeight: "700" },
});

// Small company badge showing initials
function CompanyBadge({ name, isPrimary }: { name: string; isPrimary: boolean }) {
  var initials = (name || "E").split(" ").slice(0, 2).map(function(w) { return w[0]; }).join("").toUpperCase();
  return (
    <View style={[cb.wrap, isPrimary && cb.wrapPrimary]}>
      <Text style={cb.text}>{initials}</Text>
    </View>
  );
}
var cb = StyleSheet.create({
  wrap:        { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  wrapPrimary: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  text:        { fontSize: 9, fontWeight: "700", color: Colors.ink3 },
});

function MemberRow({ member, siblings, isOwner, onUpdate, onRemove, isUpdating, isRemoving }: {
  member: Member;
  siblings: SiblingCompany[];
  isOwner: boolean;
  onUpdate: (perms: Record<string, boolean>, role: string, company_ids?: string[]) => void;
  onRemove: () => void;
  isUpdating: boolean;
  isRemoving: boolean;
}) {
  var [expanded, setExpanded]   = useState(false);
  var [perms, setPerms]         = useState<Record<string, boolean>>(member.permissions || {});
  var [role, setRole]           = useState(member.role_label);
  var [cnpjIds, setCnpjIds]     = useState<string[]>(member.companies.map(function(c) { return c.company_id; }));
  var [confirmRemove, setConfirmRemove] = useState(false);

  var canEdit      = !isOwner && member.status !== "suspended";
  var isOwnerLabel = member.role_label === "owner";
  var isPending    = member.status === "pending";
  var multiCnpj   = siblings.length > 1;
  var memberCnpjIds = member.companies.map(function(c) { return c.company_id; });

  return (
    <View>
      <Pressable
        onPress={function() { if (canEdit && !isPending) setExpanded(!expanded); }}
        style={s.memberRow}
      >
        <View style={s.avatar}>
          <Text style={s.avatarText}>{(member.name || "?")[0].toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.memberName}>{member.name}</Text>
          <Text style={s.memberEmail} numberOfLines={1}>
            {isPending ? (member.invite_email || member.email || "Link enviado") : member.email}
          </Text>
          {/* Company access badges (multi-CNPJ only, non-owner) */}
          {multiCnpj && !isOwnerLabel && memberCnpjIds.length > 0 && (
            <View style={{ flexDirection: "row", gap: 3, marginTop: 4, flexWrap: "wrap" }}>
              {siblings.map(function(sib) {
                return memberCnpjIds.includes(sib.id)
                  ? <CompanyBadge key={sib.id} name={sib.name} isPrimary={sib.is_primary} />
                  : null;
              })}
            </View>
          )}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {isOwnerLabel
            ? <View style={[bdg.wrap, { backgroundColor: Colors.violetD }]}><Text style={[bdg.text, { color: Colors.violet3 }]}>Titular</Text></View>
            : <StatusBadge status={member.status} />}
          {isPending && (
            <Pressable onPress={function() { setConfirmRemove(true); }} disabled={isRemoving} style={s.deleteBtn} hitSlop={8}>
              <Icon name="x" size={14} color={Colors.red} />
            </Pressable>
          )}
          {canEdit && !isPending && (
            <Icon name={expanded ? "chevron_up" : "chevron_down"} size={14} color={Colors.ink3} />
          )}
        </View>
      </Pressable>

      {expanded && canEdit && !isPending && (
        <View style={s.permEditor}>
          {/* Role selector */}
          <Text style={s.permSectionLabel}>Funcao</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 6, marginBottom: 16 }}>
            {ROLE_OPTIONS.map(function(r) {
              return (
                <Pressable key={r} onPress={function() { setRole(r); }} style={[s.roleChip, role === r && s.roleChipActive]}>
                  <Text style={[s.roleChipText, role === r && { color: Colors.violet3 }]}>{r}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* CNPJ access toggles (only for multi-CNPJ accounts, non-owner) */}
          {multiCnpj && (
            <>
              <Text style={s.permSectionLabel}>Acesso as empresas</Text>
              {siblings.map(function(sib) {
                var enabled = cnpjIds.includes(sib.id);
                return (
                  <View key={sib.id} style={s.permRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.permLabel}>{sib.name}</Text>
                      {sib.is_primary && <Text style={{ fontSize: 10, color: Colors.ink3 }}>Principal</Text>}
                    </View>
                    <Switch
                      value={enabled}
                      onValueChange={function(v) {
                        setCnpjIds(function(prev) {
                          return v
                            ? [...prev, sib.id]
                            : prev.filter(function(id) { return id !== sib.id; });
                        });
                      }}
                      trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
                      thumbColor={enabled ? Colors.violet : Colors.ink3}
                    />
                  </View>
                );
              })}
              <View style={{ height: 8 }} />
            </>
          )}

          {/* Permissions — universal (auto-synced to all CNPJs) */}
          <Text style={s.permSectionLabel}>
            {multiCnpj ? "Permissoes — aplicadas em todos os CNPJs" : "Acesso aos modulos"}
          </Text>
          {MODULE_ORDER.map(function(key) {
            return (
              <View key={key} style={s.permRow}>
                <Text style={s.permLabel}>{MODULE_LABELS[key]}</Text>
                <Switch
                  value={!!perms[key]}
                  onValueChange={function() { setPerms(function(p) { return { ...p, [key]: !p[key] }; }); }}
                  trackColor={{ true: Colors.green, false: Colors.bg4 }}
                  thumbColor="#fff"
                />
              </View>
            );
          })}

          <View style={s.permActions}>
            <Pressable
              onPress={function() { onUpdate(perms, role, multiCnpj ? cnpjIds : undefined); }}
              disabled={isUpdating}
              style={[s.savePermBtn, isUpdating && { opacity: 0.6 }]}
            >
              {isUpdating
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={s.savePermBtnText}>Salvar permissoes</Text>}
            </Pressable>
            <Pressable onPress={function() { setConfirmRemove(true); }} disabled={isRemoving} style={s.removeBtn}>
              <Text style={s.removeBtnText}>Suspender</Text>
            </Pressable>
          </View>
        </View>
      )}

      <ConfirmDialog
        visible={confirmRemove}
        title={isPending ? "Cancelar convite?" : "Suspender membro?"}
        message={isPending ? "O link de convite sera invalidado." : "O membro perdera acesso imediatamente."}
        confirmLabel={isPending ? "Cancelar convite" : "Suspender"}
        destructive
        onConfirm={function() { setConfirmRemove(false); onRemove(); }}
        onCancel={function() { setConfirmRemove(false); }}
      />
    </View>
  );
}

function InviteSuccessCard({ inviteUrl, email, role, companyName, onClose }: {
  inviteUrl: string; email: string; role: string; companyName: string; onClose: () => void;
}) {
  function copyLink() {
    if (Platform.OS === "web" && typeof navigator !== "undefined") navigator.clipboard?.writeText(inviteUrl);
    toast.success("Link copiado!");
  }
  function shareWhatsApp() {
    var msg = "Voce foi convidado para a equipe de " + companyName + " no app Aura como " + role + ".\n\nAcesse o link para entrar:\n" + inviteUrl;
    Linking.openURL("https://wa.me/?text=" + encodeURIComponent(msg));
  }
  return (
    <View style={s.inviteSuccess}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Icon name="check" size={14} color={Colors.green} />
            <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.green }}>Link de acesso gerado!</Text>
          </View>
          <Text style={{ fontSize: 11, color: Colors.ink3, marginBottom: 12 }}>
            {email ? "Compartilhe com " + email + " para" : "Compartilhe o link para que a pessoa"} criar a conta e entrar na equipe.
          </Text>
        </View>
        <Pressable onPress={onClose} style={s.successClose}>
          <Icon name="x" size={12} color={Colors.ink3} />
        </Pressable>
      </View>
      <View style={s.inviteLinkBox}>
        <Text style={s.inviteLinkText} numberOfLines={2}>{inviteUrl}</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
        <Pressable onPress={copyLink} style={s.copyBtn}>
          <Icon name="copy" size={13} color={Colors.violet3} />
          <Text style={s.copyBtnText}>Copiar link</Text>
        </Pressable>
        <Pressable onPress={shareWhatsApp} style={s.whatsappBtn}>
          <Icon name="message" size={13} color={Colors.green} />
          <Text style={s.whatsappBtnText}>WhatsApp</Text>
        </Pressable>
      </View>
      <Text style={{ fontSize: 10, color: Colors.ink3, marginTop: 8 }}>Link valido por 7 dias. Uso unico.</Text>
    </View>
  );
}

export function MembersSection() {
  var { company } = useAuthStore();
  var {
    members, siblings, active, pending, monthlyCost, isLoading,
    lastInvite, clearLastInvite,
    inviteMember, isInviting, updateMember, isUpdating, removeMember, isRemoving,
  } = useMembers();

  var multiCnpj = siblings.length > 1;

  var [inviteMode, setInviteMode]       = useState<"none" | "link" | "email">("none");
  var [inviteEmail, setInviteEmail]     = useState("");
  var [inviteRole, setInviteRole]       = useState("Colaborador");
  // CNPJ selection for the invite form (default: all siblings)
  var [inviteCnpjIds, setInviteCnpjIds] = useState<string[] | null>(null);
  var emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(inviteEmail.trim());

  // Lazy default: all siblings selected
  function getInviteCnpjIds() {
    if (inviteCnpjIds !== null) return inviteCnpjIds;
    return siblings.map(function(s) { return s.id; });
  }

  function toggleInviteCnpj(id: string, checked: boolean) {
    var current = getInviteCnpjIds();
    setInviteCnpjIds(checked
      ? current.filter(function(x) { return x !== id; })
      : [...current, id]
    );
  }

  async function handleInviteLink() {
    try {
      await inviteMember({
        email:       "",
        role_label:  inviteRole,
        company_ids: multiCnpj ? getInviteCnpjIds() : undefined,
      });
      setInviteMode("none"); setInviteRole("Colaborador"); setInviteCnpjIds(null);
    } catch {}
  }

  async function handleInviteEmail() {
    if (!emailValid) { toast.error("Informe um e-mail valido"); return; }
    try {
      await inviteMember({
        email:       inviteEmail.trim().toLowerCase(),
        role_label:  inviteRole,
        company_ids: multiCnpj ? getInviteCnpjIds() : undefined,
      });
      setInviteMode("none"); setInviteEmail(""); setInviteRole("Colaborador"); setInviteCnpjIds(null);
    } catch {}
  }

  function cancelInvite() {
    setInviteMode("none"); setInviteEmail("");
    setInviteRole("Colaborador"); setInviteCnpjIds(null);
  }

  function RoleSelector() {
    return (
      <View style={{ marginBottom: 16 }}>
        <Text style={[s.formLabel, { marginBottom: 8 }]}>Funcao</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
          {ROLE_OPTIONS.map(function(r) {
            return (
              <Pressable key={r} onPress={function() { setInviteRole(r); }} style={[s.roleChip, inviteRole === r && s.roleChipActive]}>
                <Text style={[s.roleChipText, inviteRole === r && { color: Colors.violet3 }]}>{r}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  function CnpjSelector() {
    if (!multiCnpj) return null;
    var selected = getInviteCnpjIds();
    return (
      <View style={{ marginBottom: 16 }}>
        <Text style={[s.formLabel, { marginBottom: 8 }]}>Acesso as empresas</Text>
        {siblings.map(function(sib) {
          var checked = selected.includes(sib.id);
          return (
            <Pressable
              key={sib.id}
              onPress={function() { toggleInviteCnpj(sib.id, checked); }}
              style={s.cnpjCheckRow}
            >
              <View style={[s.cnpjCheckBox, checked && s.cnpjCheckBoxActive]}>
                {checked && <Icon name="check" size={10} color="#fff" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cnpjCheckLabel}>{sib.name}</Text>
                {sib.is_primary && <Text style={{ fontSize: 10, color: Colors.ink3 }}>Principal</Text>}
              </View>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>Equipe</Text>
          <Text style={s.subtitle}>
            {active} ativo{active !== 1 ? "s" : ""}
            {pending > 0 ? " / " + pending + " pendente" + (pending !== 1 ? "s" : "") : ""}
            {monthlyCost > 0 ? " / +R$" + monthlyCost + "/mes" : ""}
          </Text>
        </View>
        {inviteMode === "none" && !lastInvite && (
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Pressable onPress={function() { setInviteMode("link"); }} style={s.inviteBtn} disabled={isInviting}>
              {isInviting
                ? <ActivityIndicator size="small" color="#fff" />
                : <><Icon name="link" size={13} color="#fff" /><Text style={s.inviteBtnText}>Gerar link</Text></>}
            </Pressable>
            <Pressable onPress={function() { setInviteMode("email"); }} style={s.inviteBtnSecondary}>
              <Icon name="mail" size={13} color={Colors.violet3} />
            </Pressable>
          </View>
        )}
      </View>

      {lastInvite && (
        <InviteSuccessCard
          inviteUrl={lastInvite.url}
          email={lastInvite.email}
          role={lastInvite.role}
          companyName={company?.name || "Aura"}
          onClose={clearLastInvite}
        />
      )}

      {inviteMode === "link" && (
        <View style={s.inviteForm}>
          <Text style={s.formTitle}>Gerar link de acesso</Text>
          <Text style={{ fontSize: 12, color: Colors.ink3, marginBottom: 14, lineHeight: 18 }}>
            Um link unico sera gerado. Qualquer pessoa com o link pode criar uma conta e entrar na equipe.
          </Text>
          <CnpjSelector />
          <RoleSelector />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={cancelInvite} style={s.cancelBtn}><Text style={s.cancelBtnText}>Cancelar</Text></Pressable>
            <Pressable onPress={handleInviteLink} disabled={isInviting} style={[s.sendBtn, isInviting && { opacity: 0.5 }]}>
              {isInviting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.sendBtnText}>Gerar link agora</Text>}
            </Pressable>
          </View>
        </View>
      )}

      {inviteMode === "email" && (
        <View style={s.inviteForm}>
          <Text style={s.formTitle}>Convidar por e-mail</Text>
          <Text style={s.formLabel}>E-mail do colaborador</Text>
          <TextInput
            style={[s.input, inviteEmail && !emailValid && s.inputError]}
            value={inviteEmail}
            onChangeText={setInviteEmail}
            placeholder="email@exemplo.com"
            placeholderTextColor={Colors.ink3}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          {inviteEmail && !emailValid && <Text style={s.fieldError}>E-mail invalido</Text>}
          <View style={{ marginTop: 14 }}>
            <CnpjSelector />
            <RoleSelector />
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={cancelInvite} style={s.cancelBtn}><Text style={s.cancelBtnText}>Cancelar</Text></Pressable>
            <Pressable
              onPress={handleInviteEmail}
              disabled={isInviting || !emailValid}
              style={[s.sendBtn, (isInviting || !emailValid) && { opacity: 0.5 }]}
            >
              {isInviting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.sendBtnText}>Enviar convite</Text>}
            </Pressable>
          </View>
        </View>
      )}

      {isLoading ? (
        <View style={{ alignItems: "center", paddingVertical: 20 }}>
          <ActivityIndicator color={Colors.violet3} />
        </View>
      ) : members.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>Apenas voce por aqui. Convide sua equipe!</Text>
        </View>
      ) : (
        <View>
          {members.map(function(m) {
            return (
              <MemberRow
                key={m.id}
                member={m}
                siblings={siblings}
                isOwner={m.role_label === "owner"}
                onUpdate={function(perms, role, cnpjIds) {
                  var body: any = { permissions: perms, role_label: role };
                  if (cnpjIds !== undefined) body.company_ids = cnpjIds;
                  updateMember(m.id, body);
                }}
                onRemove={function() {
                  // Remove from all companies this member belongs to
                  var allIds = m.companies.length > 0
                    ? m.companies.map(function(c) { return c.member_id; })
                    : [m.id];
                  removeMember(allIds);
                }}
                isUpdating={isUpdating}
                isRemoving={isRemoving}
              />
            );
          })}
        </View>
      )}

      {members.length > 0 && (
        <View style={s.billingNote}>
          <Text style={s.billingText}>Titular nao cobrado. Cada membro adicional: R$19/mes.</Text>
        </View>
      )}
    </View>
  );
}

var s = StyleSheet.create({
  container:          { backgroundColor: Colors.bg3, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: "hidden" },
  header:             { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title:              { fontSize: 15, fontWeight: "700", color: Colors.ink },
  subtitle:           { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  inviteBtn:          { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  inviteBtnText:      { fontSize: 12, color: "#fff", fontWeight: "600" },
  inviteBtnSecondary: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" },
  inviteSuccess:      { margin: 12, backgroundColor: Colors.greenD, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.green + "33" },
  successClose:       { width: 24, height: 24, borderRadius: 6, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  inviteLinkBox:      { backgroundColor: Colors.bg4, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: Colors.border },
  inviteLinkText:     { fontSize: 11, color: Colors.violet3, fontFamily: "monospace" as any, lineHeight: 16 },
  copyBtn:            { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.violetD, borderRadius: 8, paddingVertical: 9, borderWidth: 1, borderColor: Colors.border2 },
  copyBtnText:        { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  whatsappBtn:        { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.greenD, borderRadius: 8, paddingVertical: 9, borderWidth: 1, borderColor: Colors.green + "44" },
  whatsappBtnText:    { fontSize: 11, color: Colors.green, fontWeight: "600" },
  inviteForm:         { margin: 12, backgroundColor: Colors.bg4, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border },
  formTitle:          { fontSize: 14, fontWeight: "700", color: Colors.ink, marginBottom: 12 },
  formLabel:          { fontSize: 11, color: Colors.ink3, fontWeight: "600", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 },
  input:              { backgroundColor: Colors.bg3, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: Colors.ink, borderWidth: 1, borderColor: Colors.border },
  inputError:         { borderColor: Colors.red },
  fieldError:         { fontSize: 11, color: Colors.red, marginTop: 4 },
  roleChip:           { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  roleChipActive:     { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  roleChipText:       { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  cancelBtn:          { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  cancelBtnText:      { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  sendBtn:            { flex: 2, paddingVertical: 10, borderRadius: 8, backgroundColor: Colors.violet, alignItems: "center" },
  sendBtnText:        { fontSize: 12, color: "#fff", fontWeight: "600" },
  memberRow:          { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  avatar:             { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border2 },
  avatarText:         { fontSize: 14, fontWeight: "700", color: Colors.violet3 },
  memberName:         { fontSize: 13, fontWeight: "600", color: Colors.ink },
  memberEmail:        { fontSize: 11, color: Colors.ink3, marginTop: 1 },
  deleteBtn:          { width: 28, height: 28, borderRadius: 7, backgroundColor: Colors.redD, borderWidth: 1, borderColor: Colors.red + "33", alignItems: "center", justifyContent: "center" },
  permEditor:         { backgroundColor: Colors.bg4, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  permSectionLabel:   { fontSize: 10, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  permRow:            { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  permLabel:          { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  permActions:        { flexDirection: "row", gap: 8, marginTop: 16 },
  savePermBtn:        { flex: 2, paddingVertical: 10, borderRadius: 8, backgroundColor: Colors.violet, alignItems: "center" },
  savePermBtnText:    { fontSize: 12, color: "#fff", fontWeight: "600" },
  removeBtn:          { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: Colors.redD, alignItems: "center", borderWidth: 1, borderColor: Colors.red + "33" },
  removeBtnText:      { fontSize: 12, color: Colors.red, fontWeight: "600" },
  empty:              { alignItems: "center", paddingVertical: 24 },
  emptyText:          { fontSize: 12, color: Colors.ink3 },
  billingNote:        { borderTopWidth: 1, borderTopColor: Colors.border, padding: 12 },
  billingText:        { fontSize: 10, color: Colors.ink3, fontStyle: "italic", textAlign: "center" },
  // CNPJ selector (invite form)
  cnpjCheckRow:       { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cnpjCheckBox:       { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center" },
  cnpjCheckBoxActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  cnpjCheckLabel:     { fontSize: 13, color: Colors.ink, fontWeight: "500" },
});

export default MembersSection;
