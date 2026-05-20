import { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, ActivityIndicator, Platform, Modal,
} from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
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
  converted_company_id: string | null;
  interaction_count: string; last_interaction_at: string | null;
  created_at: string; updated_at: string;
};

type Interaction = {
  id: string; lead_id: string; author_name: string | null;
  body: string; channel: string | null; created_at: string;
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
  return "ha " + diff + "d";
}

function waLink(phone: string | null) {
  if (!phone) return null;
  var digits = phone.replace(/\D/g, "");
  if (!digits.startsWith("55")) digits = "55" + digits;
  return "https://wa.me/" + digits;
}

// ── Componente principal ────────────────────────────────────────

export function ProspecaoAdmin() {
  var { token, isStaff } = useAuthStore();
  var qc = useQueryClient();

  var [view, setView] = useState<"lista" | "pipeline" | "importar">("lista");
  var [selectedId, setSelectedId] = useState<string | null>(null);
  var [filterStatus, setFilterStatus] = useState("");
  var [filterCity, setFilterCity] = useState("");
  var [filterCategory, setFilterCategory] = useState("");
  var [search, setSearch] = useState("");

  // Modal de interacao
  var [showModal, setShowModal] = useState(false);
  var [modalLead, setModalLead] = useState<Lead | null>(null);
  var [intBody, setIntBody] = useState("");
  var [intChannel, setIntChannel] = useState("whatsapp");
  var [intStatus, setIntStatus] = useState("");
  var [intFollowup, setIntFollowup] = useState("");

  // Importacao Excel
  var [importing, setImporting] = useState(false);
  var [importPreview, setImportPreview] = useState<any[]>([]);
  var [importStats, setImportStats] = useState<{ inserted: number; skipped: number } | null>(null);

  var params: Record<string, string> = {};
  if (filterStatus)   params.status   = filterStatus;
  if (filterCity)     params.city     = filterCity;
  if (filterCategory) params.category = filterCategory;
  if (search)         params.search   = search;
  var qs = Object.entries(params).map(function([k,v]) { return k+"="+encodeURIComponent(v); }).join("&");

  var { data, isLoading } = useQuery<{ leads: Lead[]; pipeline: Record<string, number> }>({
    queryKey: ["admin-leads", qs],
    queryFn: function() { return request("/admin/leads" + (qs ? "?" + qs : "")); },
    enabled: !!token && (isStaff ?? false),
    staleTime: 30_000,
  });

  var { data: meta } = useQuery<{ cities: string[]; categories: string[] }>({
    queryKey: ["admin-leads-meta"],
    queryFn: function() { return request("/admin/leads/meta"); },
    enabled: !!token && (isStaff ?? false),
    staleTime: 120_000,
  });

  var { data: detailData, isLoading: loadingDetail } = useQuery<{ lead: Lead; interactions: Interaction[] }>({
    queryKey: ["admin-lead-detail", selectedId],
    queryFn: function() { return request("/admin/leads/" + selectedId); },
    enabled: !!selectedId,
    staleTime: 30_000,
  });

  // FIX: body passado como objeto — request() ja faz JSON.stringify internamente.
  // Passar JSON.stringify() aqui causava double-serialization → backend recebia
  // req.body como string em vez de objeto → req.body.leads = undefined → 400.
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
      setShowModal(false); setIntBody(""); setIntStatus(""); setIntFollowup("");
      toast.success("Interacao registrada");
    },
    onError: function() { toast.error("Erro ao registrar"); },
  });

  // FIX: mesma correcao — objeto direto, sem JSON.stringify().
  var importMutation = useMutation({
    mutationFn: function(leads: any[]) {
      return request("/admin/leads/import", { method: "POST", body: { leads } as any });
    },
    onSuccess: function(r: any) {
      qc.invalidateQueries({ queryKey: ["admin-leads"] });
      qc.invalidateQueries({ queryKey: ["admin-leads-meta"] });
      setImportStats({ inserted: r.inserted, skipped: r.skipped });
      setImportPreview([]);
      toast.success("Importado: " + r.inserted + " leads");
    },
    onError: function() { toast.error("Erro ao importar"); },
  });

  function openInteraction(lead: Lead) {
    setModalLead(lead);
    setIntStatus(lead.status);
    setShowModal(true);
  }

  function submitInteraction() {
    if (!modalLead || !intBody.trim()) { toast.info("Digite uma observacao"); return; }
    interactionMutation.mutate({
      id: modalLead.id,
      body: intBody.trim(),
      channel: intChannel,
      new_status: intStatus || undefined,
      next_followup_at: intFollowup || undefined,
    });
  }

  async function pickExcel() {
    try {
      var result = await DocumentPicker.getDocumentAsync({ type: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv"] });
      if (result.canceled || !result.assets?.length) return;
      setImporting(true);
      var asset = result.assets[0];
      var res = await fetch(asset.uri);
      var buf = await res.arrayBuffer();
      var wb = XLSX.read(buf, { type: "array" });
      var ws = wb.Sheets[wb.SheetNames[0]];
      var rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      // Normalizar cabecalhos: suporta tanto as colunas do script Python
      // (nome, telefone, categoria_busca, etc.) quanto variantes em ingles.
      var mapped = rows.map(function(r) {
        return {
          name:           String(r.nome || r.name || "").trim(),
          phone:          String(r.telefone || r.phone || "").trim(),
          city:           String(r.cidade || r.city || "").trim(),
          category:       String(r.categoria_busca || r.categoria || r.category || "").trim(),
          address:        String(r.endereco || r.address || "").trim(),
          website:        String(r.site || r.website || "").trim(),
          google_rating:  r.nota_google  || r.google_rating  || null,
          google_reviews: r.num_avaliacoes || r.google_reviews || null,
        };
      }).filter(function(r) { return r.name || r.phone; });
      setImporting(false);
      if (!mapped.length) { toast.info("Nenhuma linha valida encontrada no arquivo"); return; }
      setImportPreview(mapped.slice(0, 5));
      importMutation.mutate(mapped);
    } catch (e) {
      setImporting(false);
      toast.error("Erro ao ler arquivo");
    }
  }

  // ── Detalhe de lead ────────────────────────────────────────

  if (selectedId && detailData) {
    var lead = detailData.lead;
    var interactions = detailData.interactions;
    var sm = statusMeta(lead.status);
    var wa = waLink(lead.phone);

    return (
      <View>
        <Pressable onPress={function() { setSelectedId(null); }} style={s.backBtn}>
          <Text style={s.backText}>{"<"} Voltar aos leads</Text>
        </Pressable>

        {/* Header */}
        <View style={s.slideHeader}>
          <View style={[s.statusDot, { backgroundColor: sm.color + "22" }]}>
            <Text style={[s.statusDotText, { color: sm.color }]}>{lead.name[0].toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.slideName}>{lead.name}</Text>
            <Text style={s.slideMeta}>{lead.city}{lead.category ? " · " + lead.category : ""}</Text>
          </View>
          <View style={[s.badge, { backgroundColor: sm.color + "20" }]}>
            <Text style={[s.badgeText, { color: sm.color }]}>{sm.label}</Text>
          </View>
        </View>

        {/* Acoes */}
        <View style={s.actionsRow}>
          {wa && (
            <Pressable
              onPress={function() { if (typeof window !== "undefined") window.open(wa!, "_blank"); }}
              style={[s.actionBtn, { backgroundColor: Colors.green + "18", borderColor: Colors.green + "44" }]}
            >
              <Icon name="message" size={14} color={Colors.green} />
              <Text style={[s.actionBtnText, { color: Colors.green }]}>WhatsApp</Text>
            </Pressable>
          )}
          <Pressable onPress={function() { openInteraction(lead); }} style={[s.actionBtn, { backgroundColor: Colors.violetD, borderColor: Colors.border2 }]}>
            <Icon name="edit" size={14} color={Colors.violet3} />
            <Text style={[s.actionBtnText, { color: Colors.violet3 }]}>Registrar contato</Text>
          </Pressable>
        </View>

        {/* Info */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Dados do lead</Text>
          {[
            ["Telefone", lead.phone],
            ["Endereco", lead.address],
            ["Site", lead.website],
            ["Nota Google", lead.google_rating ? lead.google_rating + " (" + lead.google_reviews + " av.)" : null],
            ["Fonte", lead.source],
            ["Ultimo contato", fmtDate(lead.last_contact_at)],
            ["Proximo follow-up", fmtDate(lead.next_followup_at)],
            ["Cadastrado em", fmtDate(lead.created_at)],
          ].map(function([label, val]) {
            if (!val) return null;
            return (
              <View key={String(label)} style={s.infoRow}>
                <Text style={s.infoLabel}>{label}</Text>
                <Text style={s.infoVal} numberOfLines={1}>{String(val)}</Text>
              </View>
            );
          })}
        </View>

        {/* Historico */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Historico de contatos ({interactions.length})</Text>
          {interactions.length === 0 && (
            <Text style={s.emptyText}>Nenhum contato registrado ainda.</Text>
          )}
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

        {/* Modal de interacao */}
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
                <TextInput value={intBody} onChangeText={setIntBody} placeholder="Ex: Enviou mensagem, aguardando resposta" placeholderTextColor={Colors.ink3} multiline numberOfLines={3} style={s.noteInput} />
                <Text style={s.fieldLabel}>Mover para status</Text>
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

  // ── Views principais ────────────────────────────────────────

  var leads = data?.leads || [];
  var pipeline = data?.pipeline || {};

  return (
    <View>
      {/* Sub-tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 16 }} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
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
          <Text style={{ fontSize: 11, color: Colors.ink3, textAlign: "center", marginTop: 8 }}>
            Toque em um status para filtrar a lista
          </Text>
        </View>
      )}

      {/* ── IMPORTAR ── */}
      {view === "importar" && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Importar leads (Excel / CSV)</Text>
          <Text style={s.hintText}>
            Importe diretamente a planilha gerada pelos scripts Python do Google Maps.
            Colunas reconhecidas: nome/name, telefone/phone, cidade/city, categoria_busca/category,
            endereco/address, site/website, nota_google/google_rating, num_avaliacoes/google_reviews.
          </Text>
          <Pressable onPress={pickExcel} disabled={importing || importMutation.isPending} style={[s.importBtn, (importing || importMutation.isPending) && { opacity: 0.5 }]}>
            {(importing || importMutation.isPending) ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.importBtnText}>Selecionar arquivo Excel / CSV</Text>
            )}
          </Pressable>
          {importStats && (
            <View style={[s.section, { marginTop: 16 }]}>
              <Text style={[s.sectionTitle, { color: Colors.green }]}>Importacao concluida</Text>
              <View style={{ flexDirection: "row", gap: 16, marginTop: 8 }}>
                <View style={s.statBox}><Text style={[s.statVal, { color: Colors.green }]}>{importStats.inserted}</Text><Text style={s.statLabel}>Inseridos</Text></View>
                <View style={s.statBox}><Text style={[s.statVal, { color: Colors.amber }]}>{importStats.skipped}</Text><Text style={s.statLabel}>Ignorados (duplicatas)</Text></View>
              </View>
            </View>
          )}
        </View>
      )}

      {/* ── LISTA ── */}
      {view === "lista" && (
        <View>
          {/* Filtros */}
          <View style={s.filtersRow}>
            <TextInput value={search} onChangeText={setSearch} placeholder="Buscar por nome ou telefone..." placeholderTextColor={Colors.ink3} style={s.searchInput} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
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
              <Text style={s.emptyTitle}>Nenhum lead ainda</Text>
              <Text style={s.emptyText}>Importe uma planilha do Google Maps ou cadastre leads manualmente.</Text>
              <Pressable onPress={function() { setView("importar"); }} style={s.importBtn}>
                <Text style={s.importBtnText}>Importar planilha</Text>
              </Pressable>
            </View>
          )}

          {leads.map(function(lead) {
            var sm = statusMeta(lead.status);
            var wa = waLink(lead.phone);
            var rel = fmtRelative(lead.last_contact_at);
            return (
              <View key={lead.id} style={s.leadRow}>
                <Pressable style={{ flex: 1 }} onPress={function() { setSelectedId(lead.id); }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={[s.statusDotSm, { backgroundColor: sm.color + "22" }]}>
                      <View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: sm.color }]} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.leadName} numberOfLines={1}>{lead.name}</Text>
                      <Text style={s.leadMeta} numberOfLines={1}>
                        {[lead.city, lead.category].filter(Boolean).join(" · ")}
                        {rel ? " · " + rel : ""}
                        {lead.google_rating ? " · ★" + lead.google_rating : ""}
                      </Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: sm.color + "18" }]}>
                      <Text style={[s.badgeText, { color: sm.color }]}>{sm.label}</Text>
                    </View>
                  </View>
                </Pressable>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                  {wa && (
                    <Pressable
                      onPress={function() { if (typeof window !== "undefined") window.open(wa!, "_blank"); }}
                      style={[s.rowBtn, { borderColor: Colors.green + "44" }]}
                    >
                      <Text style={[s.rowBtnText, { color: Colors.green }]}>WA</Text>
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

      {/* Modal de interacao (lista) */}
      {showModal && modalLead && (
        <Modal transparent animationType="fade" onRequestClose={function() { setShowModal(false); }}>
          <View style={s.modalOverlay}>
            <View style={s.modalBox}>
              <Text style={s.modalTitle}>Contato com {modalLead.name}</Text>
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
              <TextInput value={intBody} onChangeText={setIntBody} placeholder="O que aconteceu neste contato?" placeholderTextColor={Colors.ink3} multiline numberOfLines={3} style={s.noteInput} />
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
  slideHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  statusDot: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  statusDotText: { fontSize: 20, fontWeight: "800" },
  statusDotSm: { width: 24, height: 24, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  slideName: { fontSize: 18, fontWeight: "800", color: Colors.ink },
  slideMeta: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: "700" },
  actionsRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
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
  pipelineGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pipelineCard: { width: isWeb ? "13%" : "47%", backgroundColor: Colors.bg3, borderRadius: 12, borderWidth: 1.5, padding: 14, alignItems: "center" },
  pipelineCount: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  pipelineLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3, marginTop: 2 },
  filtersRow: { marginBottom: 10 },
  searchInput: { backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingVertical: 10, paddingHorizontal: 14, fontSize: 13, color: Colors.ink },
  leadRow: { backgroundColor: Colors.bg3, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 6 },
  leadName: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  leadMeta: { fontSize: 10, color: Colors.ink3, marginTop: 1 },
  rowBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4 },
  rowBtnText: { fontSize: 11, fontWeight: "700", color: Colors.ink3 },
  emptyState: { alignItems: "center", padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: Colors.ink, marginTop: 12 },
  emptyText: { fontSize: 12, color: Colors.ink3, textAlign: "center", marginTop: 6, lineHeight: 18, marginBottom: 16 },
  importBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  importBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  hintText: { fontSize: 11, color: Colors.ink3, lineHeight: 16, marginBottom: 16 },
  statBox: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  statVal: { fontSize: 24, fontWeight: "800", color: Colors.ink },
  statLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.3, marginTop: 2 },
  fieldLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 6 },
  noteInput: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingVertical: 10, paddingHorizontal: 12, fontSize: 13, color: Colors.ink, minHeight: 70, textAlignVertical: "top", marginBottom: 12 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalBox: { backgroundColor: Colors.bg2, borderRadius: 20, padding: 20, width: "100%", maxWidth: 480, borderWidth: 1, borderColor: Colors.border },
  modalTitle: { fontSize: 16, fontWeight: "800", color: Colors.ink, marginBottom: 16 },
});
