import { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, ActivityIndicator, Platform, Modal, Switch, Clipboard,
} from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request, BASE_URL } from "@/services/api";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { IS_WIDE } from "@/constants/helpers";
import * as DocumentPicker from "expo-document-picker";
import * as XLSX from "xlsx";

var isWeb = Platform.OS === "web";

// ── Tipos ──────────────────────────────────────────────────────

type Lead = {
  id: string; name: string; phone: string | null; city: string | null;
  category: string | null; address: string | null; website: string | null;
  google_rating: number | null; google_reviews: number | null;
  source: string; status: string; lost_reason: string | null;
  last_contact_at: string | null; next_followup_at: string | null;
  converted_company_id: string | null; followup_overdue: boolean;
  interaction_count: number; last_interaction_at: string | null;
  created_at: string; updated_at: string;
};

type Interaction = {
  id: string; lead_id: string; author_name: string | null;
  body: string; channel: string | null; created_at: string;
};

type Meta = {
  cities: { name: string; total: number }[];
  categories: { name: string; total: number }[];
  stats: { with_phone: number; high_rated: number; followup_overdue: number; never_contacted: number; total: number };
};

type Stats = {
  total: number; contacted_total: number; responded_total: number;
  interested_total: number; demo_total: number; converted_total: number; lost_total: number;
  with_phone: number; avg_rating: number; overdue: number;
  rate_contacted: number; rate_responded: number; rate_interested: number;
  rate_demo: number; rate_converted: number;
};

// ── Constantes ──────────────────────────────────────────────────

var STATUSES: { key: string; label: string; color: string }[] = [
  { key: "new",        label: "Novo",        color: Colors.ink3 },
  { key: "contacted",  label: "Contatado",   color: Colors.amber },
  { key: "responded",  label: "Respondeu",   color: "#06b6d4" },
  { key: "interested", label: "Interessado", color: Colors.violet3 },
  { key: "demo",       label: "Demo",        color: Colors.green },
  { key: "converted",  label: "Convertido",  color: Colors.green },
  { key: "lost",       label: "Perdido",     color: Colors.red },
];

var CHANNELS = ["whatsapp", "ligacao", "email", "visita", "sem_resposta", "outro"];

var WA_TEMPLATE_DEFAULT = `Ola, {nome}! Tudo bem? 😄

Vou ser breve — somos a Aura, uma plataforma de gestao para negocios como o seu.

Caixa, estoque, NF-e e muito mais em um lugar so — e a migracao fica por nossa conta 😊

Vale 5 minutos para conhecer?

www.getaura.com.br`;

function statusMeta(key: string) {
  return STATUSES.find(function(s) { return s.key === key; }) || { label: key, color: Colors.ink3 };
}
function fmtDate(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
function fmtRelative(iso: string | null) {
  if (!iso) return null;
  var diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff === 0) return "hoje";
  if (diff === 1) return "ontem";
  if (diff < 0) return "em " + Math.abs(diff) + "d";
  return "ha " + diff + "d";
}
function waLink(phone: string | null) {
  if (!phone) return null;
  var digits = phone.replace(/\D/g, "");
  if (!digits.startsWith("55")) digits = "55" + digits;
  return "https://wa.me/" + digits;
}
function extractCity(address: string): string {
  if (!address) return "";
  var match = address.match(/,\s*([^,\-]+?)\s*-\s*[A-Z]{2},/);
  return match ? match[1].trim() : "";
}
function scoreLead(lead: Lead): number {
  var score = 0;
  if (lead.phone) score += 40;
  if (lead.google_rating) score += Math.min(lead.google_rating * 8, 40);
  if ((lead.google_reviews || 0) >= 20) score += 20;
  return Math.min(score, 100);
}

// ── Componente principal ────────────────────────────────────────

export function ProspecaoAdmin() {
  var { token, isStaff } = useAuthStore();
  var qc = useQueryClient();

  var [view, setView] = useState<"lista" | "pipeline" | "importar">("lista");
  var [selectedId, setSelectedId] = useState<string | null>(null);
  var [showFilters, setShowFilters] = useState(false);

  // Filtros
  var [filterStatus, setFilterStatus] = useState("");
  var [filterCity, setFilterCity] = useState("");
  var [filterCategory, setFilterCategory] = useState("");
  var [filterHasPhone, setFilterHasPhone] = useState(false);
  var [filterMinRating, setFilterMinRating] = useState("");
  var [filterFollowup, setFilterFollowup] = useState(false);
  var [filterNoContact, setFilterNoContact] = useState(false);
  var [search, setSearch] = useState("");

  // Modal interacao
  var [showModal, setShowModal] = useState(false);
  var [modalLead, setModalLead] = useState<Lead | null>(null);
  var [intBody, setIntBody] = useState("");
  var [intChannel, setIntChannel] = useState("whatsapp");
  var [intStatus, setIntStatus] = useState("");
  var [intFollowup, setIntFollowup] = useState("");

  // Template WA
  var [waTemplate, setWaTemplate] = useState(WA_TEMPLATE_DEFAULT);

  // Importacao
  var [importing, setImporting] = useState(false);
  var [importStats, setImportStats] = useState<{ inserted: number; skipped: number } | null>(null);

  // Construir query string
  var params: Record<string, string> = {};
  if (filterStatus)                params.status     = filterStatus;
  if (filterCity)                  params.city       = filterCity;
  if (filterCategory)              params.category   = filterCategory;
  if (filterHasPhone)              params.has_phone  = "true";
  if (filterMinRating)             params.min_rating = filterMinRating;
  if (filterFollowup)              params.followup_due = "true";
  if (filterNoContact)             params.no_contact = "true";
  if (search)                      params.search     = search;
  var qs = Object.entries(params).map(function([k, v]) { return k + "=" + encodeURIComponent(v); }).join("&");

  var activeFilterCount = [filterStatus, filterCity, filterCategory, filterHasPhone ? "1" : "", filterMinRating, filterFollowup ? "1" : "", filterNoContact ? "1" : ""].filter(Boolean).length;

  var { data, isLoading } = useQuery<{ leads: Lead[]; pipeline: Record<string, number> }>({
    queryKey: ["admin-leads", qs],
    queryFn: function() { return request("/admin/leads" + (qs ? "?" + qs : "")); },
    enabled: !!token && (isStaff ?? false),
    staleTime: 30_000,
  });

  var { data: meta } = useQuery<Meta>({
    queryKey: ["admin-leads-meta"],
    queryFn: function() { return request("/admin/leads/meta"); },
    enabled: !!token && (isStaff ?? false),
    staleTime: 120_000,
  });

  var { data: stats } = useQuery<Stats>({
    queryKey: ["admin-leads-stats"],
    queryFn: function() { return request("/admin/leads/stats"); },
    enabled: !!token && (isStaff ?? false) && view === "pipeline",
    staleTime: 60_000,
  });

  var { data: detailData, isLoading: loadingDetail } = useQuery<{ lead: Lead; interactions: Interaction[] }>({
    queryKey: ["admin-lead-detail", selectedId],
    queryFn: function() { return request("/admin/leads/" + selectedId); },
    enabled: !!selectedId,
    staleTime: 30_000,
  });

  var interactionMutation = useMutation({
    mutationFn: function(p: { id: string; body: string; channel: string; new_status?: string; next_followup_at?: string }) {
      return request("/admin/leads/" + p.id + "/interactions", {
        method: "POST",
        body: { body: p.body, channel: p.channel, new_status: p.new_status || undefined, next_followup_at: p.next_followup_at || undefined } as any,
      });
    },
    onSuccess: function() {
      qc.invalidateQueries({ queryKey: ["admin-leads"] });
      qc.invalidateQueries({ queryKey: ["admin-lead-detail", selectedId] });
      qc.invalidateQueries({ queryKey: ["admin-leads-stats"] });
      setShowModal(false); setIntBody(""); setIntStatus(""); setIntFollowup("");
      toast.success("Interacao registrada");
    },
    onError: function() { toast.error("Erro ao registrar"); },
  });

  var importMutation = useMutation({
    mutationFn: function(leads: any[]) {
      return request("/admin/leads/import", { method: "POST", body: { leads } as any });
    },
    onSuccess: function(r: any) {
      qc.invalidateQueries({ queryKey: ["admin-leads"] });
      qc.invalidateQueries({ queryKey: ["admin-leads-meta"] });
      qc.invalidateQueries({ queryKey: ["admin-leads-stats"] });
      setImportStats({ inserted: r.inserted, skipped: r.skipped });
      toast.success("Importado: " + r.inserted + " leads");
    },
    onError: function(err: any) { toast.error(err?.data?.error || "Erro ao importar"); },
  });

  function clearFilters() {
    setFilterStatus(""); setFilterCity(""); setFilterCategory("");
    setFilterHasPhone(false); setFilterMinRating(""); setFilterFollowup(false); setFilterNoContact(false);
    setSearch("");
  }

  function openInteraction(lead: Lead) {
    setModalLead(lead);
    setIntStatus(lead.status);
    setShowModal(true);
  }

  function submitInteraction() {
    if (!modalLead || !intBody.trim()) { toast.info("Digite uma observacao"); return; }
    interactionMutation.mutate({ id: modalLead.id, body: intBody.trim(), channel: intChannel, new_status: intStatus || undefined, next_followup_at: intFollowup || undefined });
  }

  function copyWaMessage(leadName: string) {
    var msg = waTemplate.replace(/{nome}/g, leadName.split(" ")[0]);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(msg).then(function() { toast.success("Mensagem copiada!"); });
    } else {
      Clipboard.setString(msg);
      toast.success("Mensagem copiada!");
    }
  }

  function exportCSV() {
    var exportQs = qs || "";
    var url = BASE_URL + "/admin/leads/export" + (exportQs ? "?" + exportQs : "");
    if (typeof window !== "undefined") window.open(url, "_blank");
  }

  async function pickExcel() {
    try {
      var result = await DocumentPicker.getDocumentAsync({ type: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv", "*/*"] });
      if (result.canceled || !result.assets?.length) return;
      setImporting(true);
      var asset = result.assets[0];
      var res = await fetch(asset.uri);
      var buf = await res.arrayBuffer();
      var wb = XLSX.read(buf, { type: "array" });
      var sheetName = wb.SheetNames.includes("Com Telefone") ? "Com Telefone" : wb.SheetNames[0];
      var ws = wb.Sheets[sheetName];
      var rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      var mapped = rows.map(function(r) {
        var address = String(r.endereco || r.address || "").trim();
        return {
          name:           String(r.nome || r.name || "").trim(),
          phone:          String(r.telefone || r.phone || "").trim(),
          city:           String(r.cidade || r.city || "").trim() || extractCity(address),
          category:       String(r.categoria_busca || r.categoria || r.category || "").trim(),
          address,
          website:        String(r.site || r.website || "").trim(),
          google_rating:  r.nota_google  || r.google_rating  || null,
          google_reviews: r.num_avaliacoes || r.google_reviews || null,
        };
      }).filter(function(r) { return r.name || r.phone; });
      setImporting(false);
      if (!mapped.length) { toast.info("Nenhuma linha valida encontrada"); return; }
      toast.info("Importando " + mapped.length + " leads...");
      importMutation.mutate(mapped);
    } catch (e) {
      setImporting(false);
      toast.error("Erro ao ler arquivo");
    }
  }

  // ── Detalhe de lead ──────────────────────────────────────────

  if (selectedId && detailData) {
    var lead = detailData.lead;
    var interactions = detailData.interactions;
    var sm = statusMeta(lead.status);
    var wa = waLink(lead.phone);
    var score = scoreLead(lead);

    return (
      <View>
        <Pressable onPress={function() { setSelectedId(null); }} style={s.backBtn}>
          <Text style={s.backText}>{"<"} Voltar aos leads</Text>
        </Pressable>

        <View style={s.slideHeader}>
          <View style={[s.statusDot, { backgroundColor: sm.color + "22" }]}>
            <Text style={[s.statusDotText, { color: sm.color }]}>{lead.name[0].toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.slideName}>{lead.name}</Text>
            <Text style={s.slideMeta}>{lead.city}{lead.category ? " · " + lead.category : ""}</Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            <View style={[s.badge, { backgroundColor: sm.color + "20" }]}>
              <Text style={[s.badgeText, { color: sm.color }]}>{sm.label}</Text>
            </View>
            <Text style={[s.scoreText, { color: score >= 70 ? Colors.green : score >= 40 ? Colors.amber : Colors.ink3 }]}>
              Score {score}/100
            </Text>
          </View>
        </View>

        {lead.followup_overdue && (
          <View style={s.overdueBar}>
            <Icon name="clock" size={12} color={Colors.red} />
            <Text style={s.overdueText}>Follow-up vencido em {fmtDate(lead.next_followup_at)}</Text>
          </View>
        )}

        <View style={s.actionsRow}>
          {wa && (
            <Pressable onPress={function() { if (typeof window !== "undefined") window.open(wa!, "_blank"); }} style={[s.actionBtn, { backgroundColor: Colors.green + "18", borderColor: Colors.green + "44" }]}>
              <Icon name="message" size={14} color={Colors.green} />
              <Text style={[s.actionBtnText, { color: Colors.green }]}>WhatsApp</Text>
            </Pressable>
          )}
          {wa && (
            <Pressable onPress={function() { copyWaMessage(lead.name); }} style={[s.actionBtn, { backgroundColor: Colors.violetD, borderColor: Colors.border2 }]}>
              <Icon name="copy" size={14} color={Colors.violet3} />
              <Text style={[s.actionBtnText, { color: Colors.violet3 }]}>Copiar msg</Text>
            </Pressable>
          )}
          <Pressable onPress={function() { openInteraction(lead); }} style={s.actionBtn}>
            <Icon name="edit" size={14} color={Colors.ink3} />
            <Text style={s.actionBtnText}>+ Contato</Text>
          </Pressable>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Dados</Text>
          {[
            ["Telefone", lead.phone],
            ["Endereco", lead.address],
            ["Site", lead.website],
            ["Nota Google", lead.google_rating ? lead.google_rating + " (" + (lead.google_reviews || 0) + " av.)" : null],
            ["Ultimo contato", fmtDate(lead.last_contact_at)],
            ["Proximo follow-up", lead.next_followup_at ? fmtDate(lead.next_followup_at) + (lead.followup_overdue ? " ⚠" : "") : null],
            ["Cadastrado", fmtDate(lead.created_at)],
          ].map(function([label, val]) {
            if (!val) return null;
            return (
              <View key={String(label)} style={s.infoRow}>
                <Text style={s.infoLabel}>{label}</Text>
                <Text style={s.infoVal} numberOfLines={2}>{String(val)}</Text>
              </View>
            );
          })}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Historico ({interactions.length})</Text>
          {interactions.length === 0 && <Text style={s.emptyText}>Nenhum contato ainda.</Text>}
          {interactions.map(function(it) {
            return (
              <View key={it.id} style={s.noteRow}>
                <View style={s.noteHead}>
                  <Text style={s.noteAuthor}>{it.author_name || "Staff"}{it.channel ? " · " + it.channel : ""}</Text>
                  <Text style={s.noteDate}>{fmtDate(it.created_at)}</Text>
                </View>
                <Text style={s.noteBody}>{it.body}</Text>
              </View>
            );
          })}
        </View>

        {showModal && (
          <Modal transparent animationType="fade" onRequestClose={function() { setShowModal(false); }}>
            <View style={s.modalOverlay}>
              <View style={s.modalBox}>
                <Text style={s.modalTitle}>Registrar contato</Text>
                <Text style={s.fieldLabel}>Canal</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }}>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {CHANNELS.map(function(ch) {
                      return (
                        <Pressable key={ch} onPress={function() { setIntChannel(ch); }} style={[s.chip, intChannel === ch && s.chipActive]}>
                          <Text style={[s.chipText, intChannel === ch && s.chipTextActive]}>{ch}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
                <Text style={s.fieldLabel}>Observacao *</Text>
                <TextInput value={intBody} onChangeText={setIntBody} placeholder="O que aconteceu?" placeholderTextColor={Colors.ink3} multiline numberOfLines={3} style={s.noteInput} />
                <Text style={s.fieldLabel}>Novo status</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }}>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {STATUSES.map(function(st) {
                      return (
                        <Pressable key={st.key} onPress={function() { setIntStatus(st.key); }} style={[s.chip, intStatus === st.key && { backgroundColor: st.color + "22", borderColor: st.color }]}>
                          <Text style={[s.chipText, intStatus === st.key && { color: st.color }]}>{st.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
                <Text style={s.fieldLabel}>Proximo follow-up (YYYY-MM-DD)</Text>
                <TextInput value={intFollowup} onChangeText={setIntFollowup} placeholder="2026-05-27" placeholderTextColor={Colors.ink3} style={[s.noteInput, { minHeight: 40 }]} />
                <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                  <Pressable onPress={function() { setShowModal(false); }} style={[s.actionBtn, { flex: 1 }]}>
                    <Text style={s.actionBtnText}>Cancelar</Text>
                  </Pressable>
                  <Pressable onPress={submitInteraction} disabled={interactionMutation.isPending} style={[s.actionBtn, { flex: 1, backgroundColor: Colors.violetD, borderColor: Colors.border2 }]}>
                    {interactionMutation.isPending ? <ActivityIndicator size="small" color={Colors.violet3} /> : <Text style={[s.actionBtnText, { color: Colors.violet3 }]}>Salvar</Text>}
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        )}
      </View>
    );
  }

  if (selectedId && loadingDetail) return <ActivityIndicator color={Colors.violet3} style={{ padding: 40 }} />;

  var leads = data?.leads || [];
  var pipeline = data?.pipeline || {};
  var metaStats = meta?.stats;

  return (
    <View>
      {/* Sub-tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
        {(["lista", "pipeline", "importar"] as const).map(function(v) {
          return (
            <Pressable key={v} onPress={function() { setView(v); }} style={[s.chip, view === v && s.chipActive]}>
              <Text style={[s.chipText, view === v && s.chipTextActive]}>{v.charAt(0).toUpperCase() + v.slice(1)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── PIPELINE ── */}
      {view === "pipeline" && (
        <View>
          {/* Funil com taxas */}
          {stats && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Funil de conversao</Text>
              {[
                { label: "Total de leads", val: stats.total, rate: null, color: Colors.ink3 },
                { label: "Contatados", val: stats.contacted_total, rate: stats.rate_contacted + "% do total", color: Colors.amber },
                { label: "Responderam", val: stats.responded_total, rate: stats.rate_responded + "% dos contatados", color: "#06b6d4" },
                { label: "Interessados", val: stats.interested_total, rate: stats.rate_interested + "% dos que responderam", color: Colors.violet3 },
                { label: "Demo", val: stats.demo_total, rate: stats.rate_demo + "% dos interessados", color: Colors.green },
                { label: "Convertidos", val: stats.converted_total, rate: stats.rate_converted + "% do total", color: Colors.green },
              ].map(function(row) {
                return (
                  <View key={row.label} style={s.funnelRow}>
                    <View style={[s.funnelDot, { backgroundColor: row.color }]} />
                    <Text style={s.funnelLabel}>{row.label}</Text>
                    <View style={{ flex: 1 }} />
                    <Text style={[s.funnelCount, { color: row.color }]}>{row.val}</Text>
                    {row.rate && <Text style={s.funnelRate}>{row.rate}</Text>}
                  </View>
                );
              })}
              <View style={[s.funnelRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border }]}>
                <Text style={s.funnelLabel}>Perdidos</Text>
                <View style={{ flex: 1 }} />
                <Text style={[s.funnelCount, { color: Colors.red }]}>{stats.lost_total}</Text>
              </View>
            </View>
          )}

          {/* Cards de status */}
          <View style={s.pipelineGrid}>
            {STATUSES.map(function(st) {
              var count = pipeline[st.key] || 0;
              return (
                <Pressable key={st.key} onPress={function() { setFilterStatus(st.key); setView("lista"); }} style={[s.pipelineCard, { borderColor: st.color + "44" }]}>
                  <Text style={[s.pipelineCount, { color: st.color }]}>{count}</Text>
                  <Text style={s.pipelineLabel}>{st.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Stats rapidas */}
          {metaStats && (
            <View style={s.quickStatsRow}>
              {[
                { label: "Com telefone", val: metaStats.with_phone, color: Colors.green },
                { label: "Alta nota (≥4)", val: metaStats.high_rated, color: Colors.amber },
                { label: "Follow-up vencido", val: metaStats.followup_overdue, color: Colors.red },
                { label: "Nunca contatado", val: metaStats.never_contacted, color: Colors.ink3 },
              ].map(function(stat) {
                return (
                  <View key={stat.label} style={s.quickStatCard}>
                    <Text style={[s.quickStatVal, { color: stat.color }]}>{stat.val}</Text>
                    <Text style={s.quickStatLabel}>{stat.label}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* ── IMPORTAR ── */}
      {view === "importar" && (
        <View>
          <View style={s.section}>
            <Text style={s.sectionTitle}>Importar planilha</Text>
            <Text style={s.hintText}>
              Selecione o Excel gerado pelo script Python. A aba "Com Telefone" e escolhida
              automaticamente. Cidade e extraida do endereco quando nao ha coluna explicita.
            </Text>
            <Pressable onPress={pickExcel} disabled={importing || importMutation.isPending} style={[s.importBtn, (importing || importMutation.isPending) && { opacity: 0.5 }]}>
              {(importing || importMutation.isPending) ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.importBtnText}>Selecionar arquivo Excel / CSV</Text>}
            </Pressable>
            {importStats && (
              <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
                <View style={s.statBox}><Text style={[s.statVal, { color: Colors.green }]}>{importStats.inserted}</Text><Text style={s.statLabel}>Inseridos</Text></View>
                <View style={s.statBox}><Text style={[s.statVal, { color: Colors.amber }]}>{importStats.skipped}</Text><Text style={s.statLabel}>Ignorados</Text></View>
              </View>
            )}
          </View>

          {/* Template de mensagem WA */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Template WhatsApp</Text>
            <Text style={s.hintText}>
              Use {"{nome}"} como variavel — sera substituido pelo primeiro nome do lead ao copiar.
              O botao "Copiar msg" aparece em cada lead na lista e no detalhe.
            </Text>
            <TextInput
              value={waTemplate}
              onChangeText={setWaTemplate}
              multiline
              numberOfLines={8}
              style={[s.noteInput, { minHeight: 160 }]}
            />
            <Pressable onPress={function() { setWaTemplate(WA_TEMPLATE_DEFAULT); }} style={[s.actionBtn, { marginTop: 8 }]}>
              <Text style={s.actionBtnText}>Restaurar padrao</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── LISTA ── */}
      {view === "lista" && (
        <View>
          {/* Search + filtros */}
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
            <TextInput value={search} onChangeText={setSearch} placeholder="Buscar nome, telefone, endereco..." placeholderTextColor={Colors.ink3} style={[s.searchInput, { flex: 1 }]} />
            <Pressable onPress={function() { setShowFilters(!showFilters); }} style={[s.filterToggleBtn, activeFilterCount > 0 && { borderColor: Colors.violet3, backgroundColor: Colors.violetD }]}>
              <Icon name="filter" size={14} color={activeFilterCount > 0 ? Colors.violet3 : Colors.ink3} />
              {activeFilterCount > 0 && <Text style={s.filterBadge}>{activeFilterCount}</Text>}
            </Pressable>
            <Pressable onPress={exportCSV} style={s.filterToggleBtn}>
              <Icon name="download" size={14} color={Colors.ink3} />
            </Pressable>
          </View>

          {/* Painel de filtros */}
          {showFilters && (
            <View style={[s.section, { marginBottom: 10 }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <Text style={s.sectionTitle}>Filtros</Text>
                {activeFilterCount > 0 && (
                  <Pressable onPress={clearFilters}>
                    <Text style={{ fontSize: 11, color: Colors.red, fontWeight: "600" }}>Limpar tudo</Text>
                  </Pressable>
                )}
              </View>

              {/* Cidade */}
              <Text style={s.fieldLabel}>Cidade</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Pressable onPress={function() { setFilterCity(""); }} style={[s.chip, !filterCity && s.chipActive]}>
                    <Text style={[s.chipText, !filterCity && s.chipTextActive]}>Todas</Text>
                  </Pressable>
                  {(meta?.cities || []).slice(0, 10).map(function(c) {
                    return (
                      <Pressable key={c.name} onPress={function() { setFilterCity(filterCity === c.name ? "" : c.name); }} style={[s.chip, filterCity === c.name && s.chipActive]}>
                        <Text style={[s.chipText, filterCity === c.name && s.chipTextActive]}>{c.name} ({c.total})</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Categoria */}
              <Text style={s.fieldLabel}>Categoria</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Pressable onPress={function() { setFilterCategory(""); }} style={[s.chip, !filterCategory && s.chipActive]}>
                    <Text style={[s.chipText, !filterCategory && s.chipTextActive]}>Todas</Text>
                  </Pressable>
                  {(meta?.categories || []).slice(0, 12).map(function(c) {
                    return (
                      <Pressable key={c.name} onPress={function() { setFilterCategory(filterCategory === c.name ? "" : c.name); }} style={[s.chip, filterCategory === c.name && s.chipActive]}>
                        <Text style={[s.chipText, filterCategory === c.name && s.chipTextActive]}>{c.name} ({c.total})</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Nota minima */}
              <Text style={s.fieldLabel}>Nota Google minima</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {["", "3", "3.5", "4", "4.5"].map(function(v) {
                    return (
                      <Pressable key={v || "todas"} onPress={function() { setFilterMinRating(v); }} style={[s.chip, filterMinRating === v && s.chipActive]}>
                        <Text style={[s.chipText, filterMinRating === v && s.chipTextActive]}>{v ? "≥ " + v + " ★" : "Todas"}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Toggles */}
              <View style={{ gap: 10 }}>
                {[
                  { label: "Somente com telefone", val: filterHasPhone, set: setFilterHasPhone },
                  { label: "Follow-up vencido", val: filterFollowup, set: setFilterFollowup },
                  { label: "Nunca contatados", val: filterNoContact, set: setFilterNoContact },
                ].map(function(toggle) {
                  return (
                    <View key={toggle.label} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ fontSize: 13, color: Colors.ink, fontWeight: "500" }}>{toggle.label}</Text>
                      <Switch
                        value={toggle.val}
                        onValueChange={toggle.set}
                        trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
                        thumbColor={toggle.val ? Colors.violet : Colors.ink3}
                      />
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Status chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 10 }} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
            <Pressable onPress={function() { setFilterStatus(""); }} style={[s.chip, !filterStatus && s.chipActive]}>
              <Text style={[s.chipText, !filterStatus && s.chipTextActive]}>Todos ({leads.length})</Text>
            </Pressable>
            {STATUSES.map(function(st) {
              var count = pipeline[st.key] || 0;
              if (!count) return null;
              return (
                <Pressable key={st.key} onPress={function() { setFilterStatus(filterStatus === st.key ? "" : st.key); }} style={[s.chip, filterStatus === st.key && { backgroundColor: st.color + "22", borderColor: st.color }]}>
                  <Text style={[s.chipText, filterStatus === st.key && { color: st.color }]}>{st.label} ({count})</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {isLoading && <ActivityIndicator color={Colors.violet3} style={{ padding: 40 }} />}

          {!isLoading && leads.length === 0 && (
            <View style={s.emptyState}>
              <Icon name="users" size={32} color={Colors.ink3} />
              <Text style={s.emptyTitle}>{activeFilterCount > 0 ? "Nenhum lead com esses filtros" : "Nenhum lead ainda"}</Text>
              {activeFilterCount > 0
                ? <Pressable onPress={clearFilters} style={[s.importBtn, { marginTop: 16 }]}><Text style={s.importBtnText}>Limpar filtros</Text></Pressable>
                : <Pressable onPress={function() { setView("importar"); }} style={[s.importBtn, { marginTop: 16 }]}><Text style={s.importBtnText}>Importar planilha</Text></Pressable>
              }
            </View>
          )}

          {leads.map(function(lead) {
            var sm = statusMeta(lead.status);
            var wa = waLink(lead.phone);
            var rel = fmtRelative(lead.last_contact_at);
            var score = scoreLead(lead);
            return (
              <View key={lead.id} style={[s.leadRow, lead.followup_overdue && s.leadRowOverdue]}>
                {lead.followup_overdue && (
                  <View style={s.overdueChip}>
                    <Text style={s.overdueChipText}>Follow-up</Text>
                  </View>
                )}
                <Pressable style={{ flex: 1 }} onPress={function() { setSelectedId(lead.id); }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={[s.statusDotSm, { backgroundColor: sm.color + "22" }]}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: sm.color }} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={s.leadName} numberOfLines={1}>{lead.name}</Text>
                        {score >= 70 && <Text style={{ fontSize: 9, color: Colors.green, fontWeight: "700" }}>★</Text>}
                      </View>
                      <Text style={s.leadMeta} numberOfLines={1}>
                        {[lead.city, lead.category].filter(Boolean).join(" · ")}
                        {rel ? " · " + rel : ""}
                        {lead.google_rating ? " · " + lead.google_rating + "★" : ""}
                      </Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: sm.color + "18" }]}>
                      <Text style={[s.badgeText, { color: sm.color }]}>{sm.label}</Text>
                    </View>
                  </View>
                </Pressable>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                  {wa && (
                    <Pressable onPress={function() { if (typeof window !== "undefined") window.open(wa!, "_blank"); }} style={[s.rowBtn, { borderColor: Colors.green + "44" }]}>
                      <Text style={[s.rowBtnText, { color: Colors.green }]}>WA</Text>
                    </Pressable>
                  )}
                  {wa && (
                    <Pressable onPress={function() { copyWaMessage(lead.name); }} style={s.rowBtn}>
                      <Text style={s.rowBtnText}>Copiar msg</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={function() { openInteraction(lead); }} style={s.rowBtn}>
                    <Text style={s.rowBtnText}>+ Contato</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Modal interacao (lista) */}
      {showModal && modalLead && (
        <Modal transparent animationType="fade" onRequestClose={function() { setShowModal(false); }}>
          <View style={s.modalOverlay}>
            <View style={s.modalBox}>
              <Text style={s.modalTitle}>Contato — {modalLead.name}</Text>
              <Text style={s.fieldLabel}>Canal</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {CHANNELS.map(function(ch) {
                    return (
                      <Pressable key={ch} onPress={function() { setIntChannel(ch); }} style={[s.chip, intChannel === ch && s.chipActive]}>
                        <Text style={[s.chipText, intChannel === ch && s.chipTextActive]}>{ch}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
              <Text style={s.fieldLabel}>Observacao *</Text>
              <TextInput value={intBody} onChangeText={setIntBody} placeholder="O que aconteceu?" placeholderTextColor={Colors.ink3} multiline numberOfLines={3} style={s.noteInput} />
              <Text style={s.fieldLabel}>Novo status</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {STATUSES.map(function(st) {
                    return (
                      <Pressable key={st.key} onPress={function() { setIntStatus(st.key); }} style={[s.chip, intStatus === st.key && { backgroundColor: st.color + "22", borderColor: st.color }]}>
                        <Text style={[s.chipText, intStatus === st.key && { color: st.color }]}>{st.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
              <Text style={s.fieldLabel}>Proximo follow-up (YYYY-MM-DD)</Text>
              <TextInput value={intFollowup} onChangeText={setIntFollowup} placeholder="2026-05-27" placeholderTextColor={Colors.ink3} style={[s.noteInput, { minHeight: 40 }]} />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable onPress={function() { setShowModal(false); }} style={[s.actionBtn, { flex: 1 }]}>
                  <Text style={s.actionBtnText}>Cancelar</Text>
                </Pressable>
                <Pressable onPress={submitInteraction} disabled={interactionMutation.isPending} style={[s.actionBtn, { flex: 1, backgroundColor: Colors.violetD, borderColor: Colors.border2 }]}>
                  {interactionMutation.isPending ? <ActivityIndicator size="small" color={Colors.violet3} /> : <Text style={[s.actionBtnText, { color: Colors.violet3 }]}>Salvar</Text>}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

var s = StyleSheet.create({
  backBtn: { marginBottom: 16 },
  backText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  slideHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  statusDot: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  statusDotText: { fontSize: 20, fontWeight: "800" },
  statusDotSm: { width: 24, height: 24, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  slideName: { fontSize: 18, fontWeight: "800", color: Colors.ink },
  slideMeta: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  scoreText: { fontSize: 10, fontWeight: "700" },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: "700" },
  overdueBar: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.red + "15", borderRadius: 8, padding: 8, marginBottom: 10, borderWidth: 1, borderColor: Colors.red + "33" },
  overdueText: { fontSize: 11, color: Colors.red, fontWeight: "600" },
  actionsRow: { flexDirection: "row", gap: 8, marginBottom: 14, flexWrap: "wrap" },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3 },
  actionBtnText: { fontSize: 12, fontWeight: "600", color: Colors.ink3 },
  section: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: Colors.ink, marginBottom: 10 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "600" },
  infoVal: { fontSize: 11, color: Colors.ink, fontWeight: "500", maxWidth: "60%" },
  noteRow: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, padding: 10, marginBottom: 8 },
  noteHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  noteAuthor: { fontSize: 10, color: Colors.violet3, fontWeight: "700" },
  noteDate: { fontSize: 10, color: Colors.ink3 },
  noteBody: { fontSize: 12, color: Colors.ink, lineHeight: 18 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  chipText: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  chipTextActive: { color: Colors.violet3, fontWeight: "700" },
  // Pipeline
  pipelineGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  pipelineCard: { width: isWeb ? "13%" : "47%", backgroundColor: Colors.bg3, borderRadius: 12, borderWidth: 1.5, padding: 14, alignItems: "center" },
  pipelineCount: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  pipelineLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3, marginTop: 2 },
  // Funil
  funnelRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  funnelDot: { width: 8, height: 8, borderRadius: 4 },
  funnelLabel: { fontSize: 12, color: Colors.ink, fontWeight: "500" },
  funnelCount: { fontSize: 14, fontWeight: "800", letterSpacing: -0.3 },
  funnelRate: { fontSize: 10, color: Colors.ink3, marginLeft: 6 },
  // Quick stats
  quickStatsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  quickStatCard: { flex: 1, minWidth: "44%", backgroundColor: Colors.bg3, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  quickStatVal: { fontSize: 22, fontWeight: "800", color: Colors.ink },
  quickStatLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.3, marginTop: 2, textAlign: "center" },
  // Lista filtros
  searchInput: { backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingVertical: 10, paddingHorizontal: 14, fontSize: 13, color: Colors.ink },
  filterToggleBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  filterBadge: { position: "absolute", top: -4, right: -4, width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.violet, fontSize: 8, color: "#fff", fontWeight: "800", textAlign: "center", lineHeight: 14 } as any,
  fieldLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 6 },
  leadRow: { backgroundColor: Colors.bg3, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 6, position: "relative" },
  leadRowOverdue: { borderColor: Colors.red + "44", backgroundColor: Colors.red + "06" },
  leadName: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  leadMeta: { fontSize: 10, color: Colors.ink3, marginTop: 1 },
  overdueChip: { position: "absolute", top: 8, right: 8, backgroundColor: Colors.red + "18", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  overdueChipText: { fontSize: 9, color: Colors.red, fontWeight: "700", textTransform: "uppercase" },
  rowBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4 },
  rowBtnText: { fontSize: 10, fontWeight: "700", color: Colors.ink3 },
  emptyState: { alignItems: "center", padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: Colors.ink, marginTop: 12 },
  emptyText: { fontSize: 12, color: Colors.ink3, textAlign: "center", marginTop: 6, lineHeight: 18 },
  importBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  importBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  hintText: { fontSize: 11, color: Colors.ink3, lineHeight: 16, marginBottom: 14 },
  statBox: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  statVal: { fontSize: 24, fontWeight: "800", color: Colors.ink },
  statLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.3, marginTop: 2 },
  noteInput: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingVertical: 10, paddingHorizontal: 12, fontSize: 13, color: Colors.ink, minHeight: 70, textAlignVertical: "top", marginBottom: 12 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalBox: { backgroundColor: Colors.bg2, borderRadius: 20, padding: 20, width: "100%", maxWidth: 480, borderWidth: 1, borderColor: Colors.border },
  modalTitle: { fontSize: 16, fontWeight: "800", color: Colors.ink, marginBottom: 16 },
});
