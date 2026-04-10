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
import type { Member } from "@/hooks/useMembers";

// Mapeamento de permissoes para labels
const MODULE_LABELS: Record<string, string> = {
  pdv:           "Caixa (PDV)",
  estoque:       "Estoque",
  clientes:      "Clientes",
  financeiro:    "Financeiro",
  relatorios:    "Relatorios",
  folha:         "Folha de pagamento",
  configuracoes: "Configuracoes",
};

const MODULE_ORDER = ["pdv", "estoque", "clientes", "financeiro", "relatorios", "folha", "configuracoes"];

const ROLE_OPTIONS = ["Colaborador", "Gerente", "Atendente", "Caixa", "Analista"];

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, { label: string; bg: string; color: string }> = {
    active:    { label: "Ativo",     bg: Colors.greenD,  color: Colors.green },
    pending:   { label: "Pendente",  bg: Colors.amberD,  color: Colors.amber },
    suspended: { label: "Suspenso",  bg: Colors.redD,    color: Colors.red },
  };
  const s = m[status] || m.pending;
  return (
    <View style={[badge.wrap, { backgroundColor: s.bg }]}>
      <Text style={[badge.text, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}
const badge = StyleSheet.create({
  wrap: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  text: { fontSize: 10, fontWeight: "700" },
});

// Componente de um membro (expansivel com editor de permissoes)
function MemberRow({
  member,
  isOwner,
  onUpdate,
  onRemove,
  isUpdating,
  isRemoving,
}: {
  member: Member;
  isOwner: boolean;
  onUpdate: (perms: Record<string, boolean>, role: string) => void;
  onRemove: () => void;
  isUpdating: boolean;
  isRemoving: boolean;
}) {
  const [expanded,    setExpanded]    = useState(false);
  const [perms,       setPerms]       = useState<Record<string, boolean>>(member.permissions || {});
  const [role,        setRole]        = useState(member.role_label);
  const [confirmRemove, setConfirmRemove] = useState(false);

  function togglePerm(key: string) {
    setPerms(prev => ({ ...prev, [key]: !prev[key] }));
  }

  const canEdit = !isOwner && member.status !== "suspended";
  const isOwnerMember = member.role_label === "owner";

  return (
    <View>
      <Pressable onPress={() => canEdit && setExpanded(!expanded)} style={s.memberRow}>
        {/* Avatar */}
        <View style={s.avatar}>
          <Text style={s.avatarText}>{(member.name || "?")[0].toUpperCase()}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={s.memberName}>{member.name}</Text>
          <Text style={s.memberEmail} numberOfLines={1}>
            {member.status === "pending" ? (member.invite_email || member.email) : member.email}
          </Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {!isOwnerMember && <StatusBadge status={member.status} />}
          {isOwnerMember && (
            <View style={[badge.wrap, { backgroundColor: Colors.violetD }]}>
              <Text style={[badge.text, { color: Colors.violet3 }]}>Titular</Text>
            </View>
          )}
          {canEdit && (
            <Icon name={expanded ? "chevron_up" : "chevron_down"} size={14} color={Colors.ink3} />
          )}
        </View>
      </Pressable>

      {/* Editor de permissoes (somente para membros ativos, nao-owner) */}
      {expanded && canEdit && (
        <View style={s.permEditor}>
          {/* Role */}
          <Text style={s.permSectionLabel}>Funcao</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 6, marginBottom: 16 }}>
            {ROLE_OPTIONS.map(r => (
              <Pressable key={r} onPress={() => setRole(r)} style={[s.roleChip, role === r && s.roleChipActive]}>
                <Text style={[s.roleChipText, role === r && { color: Colors.violet3 }]}>{r}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Permissoes por modulo */}
          <Text style={s.permSectionLabel}>Acesso aos modulos</Text>
          {MODULE_ORDER.map(key => (
            <View key={key} style={s.permRow}>
              <Text style={s.permLabel}>{MODULE_LABELS[key]}</Text>
              <Switch
                value={!!perms[key]}
                onValueChange={() => togglePerm(key)}
                trackColor={{ true: Colors.green, false: Colors.bg4 }}
                thumbColor="#fff"
              />
            </View>
          ))}

          {/* Acoes */}
          <View style={s.permActions}>
            <Pressable
              onPress={() => onUpdate(perms, role)}
              disabled={isUpdating}
              style={[s.savePermBtn, isUpdating && { opacity: 0.6 }]}
            >
              {isUpdating
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={s.savePermBtnText}>Salvar permissoes</Text>
              }
            </Pressable>
            <Pressable
              onPress={() => setConfirmRemove(true)}
              disabled={isRemoving}
              style={s.removeBtn}
            >
              <Text style={s.removeBtnText}>Suspender</Text>
            </Pressable>
          </View>
        </View>
      )}

      <ConfirmDialog
        visible={confirmRemove}
        title="Suspender membro?"
        message="O membro perdera acesso a empresa imediatamente."
        confirmLabel="Suspender"
        destructive
        onConfirm={() => { setConfirmRemove(false); onRemove(); }}
        onCancel={() => setConfirmRemove(false)}
      />
    </View>
  );
}

// Card de convite criado com link para compartilhar
function InviteSuccessCard({
  inviteUrl,
  email,
  role,
  companyName,
  onClose,
}: {
  inviteUrl: string;
  email: string;
  role: string;
  companyName: string;
  onClose: () => void;
}) {
  function copyLink() {
    if (Platform.OS === "web" && typeof navigator !== "undefined") {
      navigator.clipboard?.writeText(inviteUrl);
    }
    toast.success("Link copiado!");
  }

  function shareWhatsApp() {
    const msg = `Ola! Voce foi convidado para a equipe de ${companyName} no app Aura como ${role}.\n\nCrie sua conta e aceite o convite pelo link:\n${inviteUrl}`;
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msg)}`);
  }

  return (
    <View style={s.inviteSuccess}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Icon name="check" size={14} color={Colors.green} />
            <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.green }}>Convite criado!</Text>
          </View>
          <Text style={{ fontSize: 11, color: Colors.ink3, marginBottom: 12 }}>
            Compartilhe o link com {email} para que crie a conta e entre na equipe.
          </Text>
        </View>
        <Pressable onPress={onClose} style={s.successClose}>
          <Icon name="x" size={12} color={Colors.ink3} />
        </Pressable>
      </View>

      {/* URL do convite */}
      <View style={s.inviteLinkBox}>
        <Text style={s.inviteLinkText} numberOfLines={2}>{inviteUrl}</Text>
      </View>

      {/* Botoes de compartilhamento */}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
        <Pressable onPress={copyLink} style={s.copyBtn}>
          <Icon name="copy" size={13} color={Colors.violet3} />
          <Text style={s.copyBtnText}>Copiar link</Text>
        </Pressable>
        <Pressable onPress={shareWhatsApp} style={s.whatsappBtn}>
          <Icon name="message" size={13} color={Colors.green} />
          <Text style={s.whatsappBtnText}>Enviar no WhatsApp</Text>
        </Pressable>
      </View>

      <Text style={{ fontSize: 10, color: Colors.ink3, marginTop: 8 }}>
        O link e valido por 7 dias. Cada link e de uso unico.
      </Text>
    </View>
  );
}

// Componente principal
export function MembersSection() {
  const { company } = useAuthStore();
  const {
    members, active, pending, monthlyCost, isLoading,
    lastInvite, clearLastInvite,
    inviteMember, isInviting,
    updateMember, isUpdating,
    removeMember, isRemoving,
  } = useMembers();

  const [showForm, setShowForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole]   = useState("Colaborador");

  // Email valido?
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(inviteEmail.trim());

  async function handleInvite() {
    if (!emailValid) { toast.error("Informe um e-mail valido"); return; }
    await inviteMember({ email: inviteEmail.trim().toLowerCase(), role_label: inviteRole });
    setShowForm(false);
    setInviteEmail("");
  }

  function cancelInvite() {
    setShowForm(false);
    setInviteEmail("");
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>Equipe</Text>
          <Text style={s.subtitle}>
            {active} ativo{active !== 1 ? "s" : ""}
            {pending > 0 ? ` / ${pending} pendente${pending !== 1 ? "s" : ""}` : ""}
            {monthlyCost > 0 ? ` / +R$${monthlyCost}/mes` : ""}
          </Text>
        </View>
        {!showForm && !lastInvite && (
          <Pressable onPress={() => setShowForm(true)} style={s.inviteBtn}>
            <Icon name="user_plus" size={14} color="#fff" />
            <Text style={s.inviteBtnText}>Convidar</Text>
          </Pressable>
        )}
      </View>

      {/* Card de sucesso do convite */}
      {lastInvite && (
        <InviteSuccessCard
          inviteUrl={lastInvite.url}
          email={lastInvite.email}
          role={lastInvite.role}
          companyName={company?.name || "Aura"}
          onClose={clearLastInvite}
        />
      )}

      {/* Formulario de convite */}
      {showForm && (
        <View style={s.inviteForm}>
          <Text style={s.formTitle}>Convidar colaborador</Text>

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
          {inviteEmail && !emailValid && (
            <Text style={s.fieldError}>E-mail invalido</Text>
          )}

          <Text style={[s.formLabel, { marginTop: 14 }]}>Funcao</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 6, marginBottom: 16 }}>
            {ROLE_OPTIONS.map(r => (
              <Pressable key={r} onPress={() => setInviteRole(r)} style={[s.roleChip, inviteRole === r && s.roleChipActive]}>
                <Text style={[s.roleChipText, inviteRole === r && { color: Colors.violet3 }]}>{r}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={cancelInvite} style={s.cancelBtn}>
              <Text style={s.cancelBtnText}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={handleInvite}
              disabled={isInviting || !emailValid}
              style={[s.sendBtn, (isInviting || !emailValid) && { opacity: 0.5 }]}
            >
              {isInviting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={s.sendBtnText}>Gerar link de acesso</Text>
              }
            </Pressable>
          </View>
        </View>
      )}

      {/* Lista de membros */}
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
          {members.map(m => (
            <MemberRow
              key={m.id}
              member={m}
              isOwner={m.role_label === "owner"}
              onUpdate={(perms, role) => updateMember(m.id, { permissions: perms, role_label: role })}
              onRemove={() => removeMember(m.id)}
              isUpdating={isUpdating}
              isRemoving={isRemoving}
            />
          ))}
        </View>
      )}

      {/* Nota de cobranca */}
      {members.length > 0 && (
        <View style={s.billingNote}>
          <Text style={s.billingText}>
            O titular nao e cobrado. Cada membro adicional: R$19/mes.
          </Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:    { backgroundColor: Colors.bg3, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: "hidden" },

  // Header
  header:       { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title:        { fontSize: 15, fontWeight: "700", color: Colors.ink },
  subtitle:     { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  inviteBtn:    { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  inviteBtnText:{ fontSize: 12, color: "#fff", fontWeight: "600" },

  // Invite success
  inviteSuccess:{ margin: 12, backgroundColor: Colors.greenD, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.green + "33" },
  successClose: { width: 24, height: 24, borderRadius: 6, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  inviteLinkBox:{ backgroundColor: Colors.bg4, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: Colors.border },
  inviteLinkText:{ fontSize: 11, color: Colors.violet3, fontFamily: "monospace" as any, lineHeight: 16 },
  copyBtn:      { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.violetD, borderRadius: 8, paddingVertical: 9, borderWidth: 1, borderColor: Colors.border2 },
  copyBtnText:  { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  whatsappBtn:  { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.greenD, borderRadius: 8, paddingVertical: 9, borderWidth: 1, borderColor: Colors.green + "44" },
  whatsappBtnText: { fontSize: 11, color: Colors.green, fontWeight: "600" },

  // Invite form
  inviteForm:   { margin: 12, backgroundColor: Colors.bg4, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border },
  formTitle:    { fontSize: 14, fontWeight: "700", color: Colors.ink, marginBottom: 12 },
  formLabel:    { fontSize: 11, color: Colors.ink3, fontWeight: "600", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 },
  input:        { backgroundColor: Colors.bg3, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: Colors.ink, borderWidth: 1, borderColor: Colors.border },
  inputError:   { borderColor: Colors.red },
  fieldError:   { fontSize: 11, color: Colors.red, marginTop: 4 },
  roleChip:     { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  roleChipActive:{ backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  roleChipText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  cancelBtn:    { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  cancelBtnText:{ fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  sendBtn:      { flex: 2, paddingVertical: 10, borderRadius: 8, backgroundColor: Colors.violet, alignItems: "center" },
  sendBtnText:  { fontSize: 12, color: "#fff", fontWeight: "600" },

  // Member row
  memberRow:    { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  avatar:       { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border2 },
  avatarText:   { fontSize: 14, fontWeight: "700", color: Colors.violet3 },
  memberName:   { fontSize: 13, fontWeight: "600", color: Colors.ink },
  memberEmail:  { fontSize: 11, color: Colors.ink3, marginTop: 1 },

  // Permissions editor
  permEditor:   { backgroundColor: Colors.bg4, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  permSectionLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  permRow:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  permLabel:    { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  permActions:  { flexDirection: "row", gap: 8, marginTop: 16 },
  savePermBtn:  { flex: 2, paddingVertical: 10, borderRadius: 8, backgroundColor: Colors.violet, alignItems: "center" },
  savePermBtnText: { fontSize: 12, color: "#fff", fontWeight: "600" },
  removeBtn:    { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: Colors.redD, alignItems: "center", borderWidth: 1, borderColor: Colors.red + "33" },
  removeBtnText:{ fontSize: 12, color: Colors.red, fontWeight: "600" },

  // Empty / billing
  empty:        { alignItems: "center", paddingVertical: 24 },
  emptyText:    { fontSize: 12, color: Colors.ink3 },
  billingNote:  { borderTopWidth: 1, borderTopColor: Colors.border, padding: 12 },
  billingText:  { fontSize: 10, color: Colors.ink3, fontStyle: "italic", textAlign: "center" },
});

export default MembersSection;
