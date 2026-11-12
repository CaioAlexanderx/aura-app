import { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Platform, TextInput, ActivityIndicator, Switch, Modal, ScrollView } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/Toast";
import { IS_WIDE } from "@/constants/helpers";
import {
  auraNotasApi,
  type AuraNotasCompany,
  type AuraNotasDetail,
  type EmpresaSemConfig,
  type ProviderMode,
  type FiscalUpdateBody,
  type TestConexaoResponse,
  type Requisito,
  type NfseUpdateBody,
} from "@/services/auraNotasApi";
import { ApiError } from "@/services/api";
import {
  rotulosDaEmpresa,
  ESTADO_REQUISITO,
  precisaConfirmar,
  textoConfirmacao,
  textoRemover,
  type TomRotulo,
} from "./auraNotasRotulos";

var isWeb = Platform.OS === "web";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCnpj(v: string | null | undefined): string {
  if (!v) return "—";
  var d = String(v).replace(/\D/g, "");
  if (d.length !== 14) return v;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    var d = new Date(iso);
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch { return String(iso); }
}

function certLabel(days: number | undefined): { label: string; danger: boolean } {
  if (days == null) return { label: "sem certificado", danger: true };
  if (days < 0) return { label: "vencido", danger: true };
  return { label: "vence em " + days + "d", danger: days < 30 };
}

var AMBIENTE_LABEL: Record<string, string> = { homologacao: "Homologação", producao: "Produção" };

// 12/11/2026: cor de cada tom de rótulo/requisito.
function corDoTom(t: TomRotulo): string {
  if (t === "ok") return Colors.green;
  if (t === "aviso") return Colors.amber;
  if (t === "perigo") return Colors.red;
  return Colors.violet3;
}
function fundoDoTom(t: TomRotulo): string {
  if (t === "ok") return Colors.greenD;
  if (t === "aviso") return Colors.amberD;
  if (t === "perigo") return Colors.redD;
  return Colors.violetD;
}

// Regimes aceitos pelo backend (gestao.validateTaxRegime).
var REGIME_OPTS: { key: string; label: string }[] = [
  { key: "mei", label: "MEI" },
  { key: "simples_nacional", label: "Simples Nacional" },
  { key: "lucro_presumido", label: "Lucro Presumido" },
  { key: "lucro_real", label: "Lucro Real" },
];

var PROVIDER_OPTS: { key: ProviderMode; label: string }[] = [
  { key: "auto", label: "AUTO (recomendado)" },
  { key: "sefaz_sp", label: "SEFAZ-SP (engine própria)" },
  { key: "nuvemfiscal", label: "Nuvem Fiscal (gateway)" },
];

// ─── Componente principal ───────────────────────────────────────────────────────

export function AuraNotasAdmin() {
  var qc = useQueryClient();
  var [selectedId, setSelectedId] = useState<string | null>(null);
  var [q, setQ] = useState("");
  var [showAddModal, setShowAddModal] = useState(false);

  var { data, isLoading, isError, refetch } = useQuery<{ companies: AuraNotasCompany[] }>({
    queryKey: ["aura-notas-companies"],
    queryFn: function() { return auraNotasApi.listCompanies(); },
    staleTime: 60_000,
  });

  var companies = data?.companies || [];
  var filtered = companies.filter(function(c) {
    if (!q.trim()) return true;
    var needle = q.toLowerCase();
    return (c.name || "").toLowerCase().indexOf(needle) >= 0 ||
      String(c.cnpj || "").replace(/\D/g, "").indexOf(needle.replace(/\D/g, "")) >= 0;
  });

  // Seleciona a primeira empresa automaticamente em telas largas
  useEffect(function() {
    if (!selectedId && companies.length && IS_WIDE) setSelectedId(companies[0].company_id);
  }, [companies.length]);

  if (isLoading) {
    return (
      <View style={s.loadingBox}>
        <ActivityIndicator color={Colors.violet} />
        <Text style={s.loadingText}>Carregando empresas...</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={s.loadingBox}>
        <Icon name="alert" size={28} color={Colors.red} />
        <Text style={s.errTitle}>Não foi possível carregar as empresas</Text>
        <Pressable onPress={function() { refetch(); }} style={s.retryBtn}>
          <Icon name="refresh" size={14} color="#fff" />
          <Text style={s.retryText}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[s.layout, !IS_WIDE && { flexDirection: "column" }]}>
      {/* ── Lista ── */}
      <View style={[s.listCol, !IS_WIDE && { width: "100%" }]}>
        <View style={s.searchBox}>
          <Icon name="search" size={15} color={Colors.ink3} />
          <TextInput
            style={s.searchInput}
            value={q}
            onChangeText={setQ}
            placeholder="Buscar por nome ou CNPJ..."
            placeholderTextColor={Colors.ink3}
          />
        </View>

        <Pressable
          onPress={function() { setShowAddModal(true); }}
          style={[s.addBtn, isWeb && ({ cursor: "pointer" } as any)]}
        >
          <Icon name="plus" size={14} color="#7c3aed" />
          <Text style={s.addBtnText}>Adicionar empresa</Text>
        </Pressable>

        {filtered.length === 0 && (
          <View style={s.emptyList}>
            <Text style={s.emptyText}>Nenhuma empresa encontrada.</Text>
          </View>
        )}

        {filtered.map(function(c) {
          var active = c.company_id === selectedId;
          var cl = certLabel(c.cert?.days_left);
          var fallbackActive = c.breaker_open || (c.stats_30d?.fallbacks || 0) > 0;
          var isEngine = c.provider_efetivo === "sefaz_sp";
          // 12/11/2026: empresa que entrou na lista só pelo certificado (sem NFC-e)
          var semNfce = c.nfce_configurada === false;
          var rotulos = rotulosDaEmpresa(c);
          return (
            <Pressable
              key={c.company_id}
              testID={"aura-notas-card-" + c.company_id}
              onPress={function() { setSelectedId(c.company_id); }}
              style={[s.card, active && s.cardActive, isWeb && ({ cursor: "pointer" } as any)]}
            >
              <View style={s.ccTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.ccName} numberOfLines={1}>{c.name}</Text>
                  <Text style={s.ccCnpj}>{fmtCnpj(c.cnpj)}{c.uf ? " · " + (c.municipio ? c.municipio + "/" : "") + c.uf : ""}</Text>
                </View>
                {semNfce ? (
                  <View style={[s.badge, s.badgeNuvem]}>
                    <Text style={[s.badgeText, { color: Colors.ink3 }]}>Sem NFC-e</Text>
                  </View>
                ) : (
                  <View style={[s.badge, isEngine ? s.badgeAura : s.badgeNuvem]}>
                    <Text style={[s.badgeText, { color: isEngine ? Colors.violet3 : Colors.ink3 }]}>
                      {isEngine ? "Aura Notas" : "Nuvem Fiscal"}
                    </Text>
                  </View>
                )}
              </View>

              {rotulos.length > 0 && (
                <View style={[s.ccMeta, { marginBottom: 6 }]}>
                  {rotulos.map(function(r) {
                    return (
                      <View key={r.chave} testID={"aura-notas-rotulo-" + r.chave} style={[s.chip, { backgroundColor: fundoDoTom(r.tom) }]}>
                        <Text style={[s.chipText, { color: corDoTom(r.tom), fontWeight: "700" }]}>{r.texto}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {semNfce ? (
                <Text style={s.ccLast}>
                  {c.faltas && c.faltas.nfse === 0 && c.nfse_configurada
                    ? "NFS-e em dia. Toque para configurar a NFC-e."
                    : "Toque para ver o que falta e configurar."}
                </Text>
              ) : null}

              {!semNfce && <View style={s.ccMeta}>
                {fallbackActive && (
                  <View style={[s.chip, s.chipWarn]}>
                    <Icon name="alert" size={9} color={Colors.amber} />
                    <Text style={[s.chipText, { color: Colors.amber }]}>Fallback ativo</Text>
                  </View>
                )}
                <View style={s.chip}>
                  <Text style={s.chipText}>CSC </Text>
                  <Text style={[s.chipText, { color: c.csc_ok ? Colors.green : Colors.red, fontWeight: "800" }]}>{c.csc_ok ? "✓" : "✗"}</Text>
                </View>
                <View style={s.chip}>
                  <Text style={[s.chipText, cl.danger && { color: Colors.red, fontWeight: "700" }]}>{c.cert ? "A1 " + cl.label : "sem certificado"}</Text>
                </View>
                {c.serie_sefaz_sp != null && (
                  <View style={s.chip}><Text style={s.chipText}>série {c.serie_sefaz_sp}</Text></View>
                )}
              </View>}

              {!semNfce && <View style={s.ccStats}>
                <View style={s.stat}>
                  <Text style={s.statVal}>{c.stats_30d?.total ?? 0}</Text>
                  <Text style={s.statLabel}>30d total</Text>
                </View>
                <View style={s.stat}>
                  <Text style={[s.statVal, { color: Colors.violet3 }]}>{c.stats_30d?.engine ?? 0}</Text>
                  <Text style={s.statLabel}>engine</Text>
                </View>
                <View style={s.stat}>
                  <Text style={[s.statVal, { color: (c.stats_30d?.fallbacks || 0) > 0 ? Colors.amber : Colors.green }]}>{c.stats_30d?.fallbacks ?? 0}</Text>
                  <Text style={s.statLabel}>fallbacks</Text>
                </View>
              </View>}

              {!semNfce && <Text style={s.ccLast}>
                {c.last_emission
                  ? "Última: " + fmtDate(c.last_emission.at) + " · " + c.last_emission.provider_used + " · " + c.last_emission.status
                  : "Sem emissões nos últimos 30 dias"}
              </Text>}
              {c.faltas && (
                <Text style={s.ccLast} testID={"aura-notas-faltas-" + c.company_id}>
                  {(c.faltas.nfce === 0 ? "NFC-e: tudo certo" : "NFC-e: " + c.faltas.nfce + (c.faltas.nfce === 1 ? " item falta" : " itens faltam"))
                    + (c.nfse_configurada ? " · " + (c.faltas.nfse === 0 ? "NFS-e: tudo certo" : "NFS-e: " + c.faltas.nfse + (c.faltas.nfse === 1 ? " item falta" : " itens faltam")) : "")}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* ── Detalhe ── */}
      <View style={[s.detailCol, !IS_WIDE && { width: "100%" }]}>
        {selectedId ? (
          <CompanyDetail
            key={selectedId}
            companyId={selectedId}
            onSaved={function() { qc.invalidateQueries({ queryKey: ["aura-notas-companies"] }); }}
            onRemoved={function() {
              setSelectedId(null);
              qc.invalidateQueries({ queryKey: ["aura-notas-companies"] });
            }}
          />
        ) : (
          <View style={s.detailEmpty}>
            <Icon name="file_text" size={30} color={Colors.ink3} />
            <Text style={s.detailEmptyText}>Selecione uma empresa para gerenciar sua configuração fiscal.</Text>
          </View>
        )}
      </View>

      <AddEmpresaSemConfigModal
        visible={showAddModal}
        onClose={function() { setShowAddModal(false); }}
        onSelect={function(companyId) {
          setSelectedId(companyId);
          setShowAddModal(false);
        }}
      />
    </View>
  );
}

// ─── Modal: "Adicionar empresa" (buscar empresa já existente sem config) ────────

function AddEmpresaSemConfigModal({ visible, onClose, onSelect }: { visible: boolean; onClose: () => void; onSelect: (companyId: string) => void }) {
  var [q, setQ] = useState("");
  var [results, setResults] = useState<EmpresaSemConfig[]>([]);
  var [loading, setLoading] = useState(false);
  var [searched, setSearched] = useState(false);

  useEffect(function() {
    if (!visible) { setQ(""); setResults([]); setSearched(false); return; }
    // Carrega a lista inicial (sem filtro) assim que o modal abre.
    runSearch("");
  }, [visible]);

  function runSearch(term: string) {
    setLoading(true);
    auraNotasApi.searchEmpresasSemConfig(term)
      .then(function(r) { setResults(r.companies || []); setSearched(true); })
      .catch(function(e: any) { toast.error(e?.message || "Erro ao buscar empresas"); })
      .finally(function() { setLoading(false); });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 16 }}
      >
        <Pressable
          onPress={function(e: any) { e.stopPropagation(); }}
          style={{ width: "100%", maxWidth: 480, maxHeight: "85%", backgroundColor: Colors.bg2, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: "hidden" }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#7c3aed20", alignItems: "center", justifyContent: "center" }}>
                <Icon name="plus" size={16} color="#7c3aed" />
              </View>
              <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.ink }}>Adicionar empresa</Text>
            </View>
            <Pressable onPress={onClose} style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" }}>
              <Icon name="x" size={14} color={Colors.ink3} />
            </Pressable>
          </View>

          <View style={{ padding: 18, paddingBottom: 10 }}>
            <Text style={{ fontSize: 12, color: Colors.ink3, lineHeight: 18, marginBottom: 12 }}>
              Escolha uma empresa que já existe no sistema (cadastrada pelo cliente) mas ainda não tem
              configuração fiscal no Aura Notas.
            </Text>
            <View style={s.searchBox}>
              <Icon name="search" size={15} color={Colors.ink3} />
              <TextInput
                style={s.searchInput}
                value={q}
                onChangeText={function(v) { setQ(v); runSearch(v); }}
                placeholder="Buscar por nome ou CNPJ..."
                placeholderTextColor={Colors.ink3}
                autoFocus={isWeb}
              />
            </View>
          </View>

          <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 18 }}>
            {loading && (
              <View style={{ paddingVertical: 24, alignItems: "center" }}>
                <ActivityIndicator color={Colors.violet} />
              </View>
            )}
            {!loading && searched && results.length === 0 && (
              <View style={{ paddingVertical: 24, alignItems: "center" }}>
                <Text style={{ fontSize: 12, color: Colors.ink3, textAlign: "center" }}>
                  {q.trim()
                    ? "Nenhuma empresa sem configuração encontrada com esse termo."
                    : "Todas as empresas ativas já têm configuração fiscal no Aura Notas."}
                </Text>
              </View>
            )}
            {!loading && results.map(function(c) {
              return (
                <Pressable
                  key={c.company_id}
                  onPress={function() { onSelect(c.company_id); }}
                  style={[s.pickRow, isWeb && ({ cursor: "pointer" } as any)]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.pickName} numberOfLines={1}>{c.name}</Text>
                    <Text style={s.pickMeta}>{fmtCnpj(c.cnpj)}{c.address_state ? " · " + c.address_state : ""}</Text>
                  </View>
                  <Icon name="chevron-right" size={16} color={Colors.ink3} />
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Modal de confirmação genérico (usado pelo "Remover") ──────────────────────

function ConfirmModal({ visible, title, message, danger, confirmLabel, loading, onConfirm, onCancel }: {
  visible: boolean; title: string; message: string; danger?: boolean; confirmLabel: string; loading?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable onPress={onCancel} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 16 }}>
        <Pressable
          onPress={function(e: any) { e.stopPropagation(); }}
          style={{ width: "100%", maxWidth: 400, backgroundColor: Colors.bg2, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 18 }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: danger ? "#dc262620" : "#7c3aed20", alignItems: "center", justifyContent: "center" }}>
              <Icon name="alert" size={16} color={danger ? "#dc2626" : "#7c3aed"} />
            </View>
            <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.ink, flex: 1 }}>{title}</Text>
          </View>
          <Text style={{ fontSize: 12, color: Colors.ink2, lineHeight: 18, marginBottom: 16 }}>{message}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={onCancel}
              disabled={loading}
              style={{ flex: 1, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, alignItems: "center", opacity: loading ? 0.5 : 1 }}
            >
              <Text style={{ fontSize: 13, color: Colors.ink, fontWeight: "600" }}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={loading}
              style={{ flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: danger ? "#dc2626" : "#7c3aed", alignItems: "center", opacity: loading ? 0.6 : 1 }}
            >
              {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ fontSize: 13, color: "#fff", fontWeight: "700" }}>{confirmLabel}</Text>}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Detalhe de uma empresa ─────────────────────────────────────────────────────

function CompanyDetail({ companyId, onSaved, onRemoved }: { companyId: string; onSaved: () => void; onRemoved: () => void }) {
  var qc = useQueryClient();
  var [showConfirmRemove, setShowConfirmRemove] = useState(false);
  var { data, isLoading, isError, refetch } = useQuery<AuraNotasDetail>({
    queryKey: ["aura-notas-detail", companyId],
    queryFn: function() { return auraNotasApi.detail(companyId); },
  });

  // 12/11/2026: o A1 é o mesmo da NFS-e. Quem usa NFS-e vê o aviso na
  // confirmação e só então o backend apaga (apagarCertificado).
  var usaNfse = !!(data && data.nfse_configurada && data.cert);
  var removeMut = useMutation({
    mutationFn: function() { return auraNotasApi.removeFiscal(companyId, { apagarCertificado: usaNfse }); },
    onSuccess: function() {
      toast.success("Configuração fiscal removida");
      setShowConfirmRemove(false);
      onRemoved();
    },
    onError: function(e: any) {
      setShowConfirmRemove(false);
      if (e instanceof ApiError && e.data?.code === "HAS_EMISSIONS") {
        toast.error(e.data.error || "Empresa já emitiu notas — desative em vez de remover.");
      } else {
        toast.error(e?.message || "Erro ao remover configuração fiscal");
      }
    },
  });

  if (isLoading) {
    return (
      <View style={s.loadingBox}>
        <ActivityIndicator color={Colors.violet} />
      </View>
    );
  }
  if (isError || !data) {
    return (
      <View style={s.loadingBox}>
        <Icon name="alert" size={24} color={Colors.red} />
        <Text style={s.errTitle}>Falha ao carregar o detalhe.</Text>
        <Pressable onPress={function() { refetch(); }} style={s.retryBtn}>
          <Text style={s.retryText}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["aura-notas-detail", companyId] });
    onSaved();
  }

  // is_active só vem null quando a empresa ainda não tem linha em nfce_config
  // (ver GET /:companyId no backend — cfg={} quando não há config, e nesse
  // caso is_active nunca é gravado como boolean).
  var hasConfig = data.config.is_active !== null;
  var companyName = data.company.trade_name || data.company.legal_name;

  return (
    <View style={{ gap: 14 }}>
      <View style={s.detailHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.detailHeaderName} numberOfLines={1}>{companyName}</Text>
          <Text style={s.detailHeaderCnpj}>{fmtCnpj(data.company.cnpj)}</Text>
        </View>
        {hasConfig && (
          <Pressable
            onPress={function() { setShowConfirmRemove(true); }}
            style={[s.removeBtn, isWeb && ({ cursor: "pointer" } as any)]}
          >
            <Icon name="trash" size={13} color="#dc2626" />
            <Text style={s.removeBtnText}>Remover</Text>
          </Pressable>
        )}
      </View>

      {!hasConfig && (
        <View style={s.newBanner}>
          <Icon name="info" size={14} color={Colors.violet3} />
          <Text style={s.newBannerText}>
            {data.cert
              ? "Esta empresa já enviou o certificado A1, mas a NFC-e ainda não está configurada. Preencha e salve os dados fiscais abaixo para começar."
              : "Empresa ainda sem configuração de NFC-e no Aura Notas. Preencha e salve os dados fiscais abaixo para criar a configuração desta empresa."}
          </Text>
        </View>
      )}

      {data.requisitos && <RequisitosBlock requisitos={data.requisitos} />}

      <FiscalBlock companyId={companyId} detail={data} onSaved={invalidateAll} />
      {hasConfig ? (
        <CscBlock companyId={companyId} detail={data} onSaved={invalidateAll} />
      ) : (
        <View style={s.infoBox}>
          <Icon name="info" size={12} color={Colors.violet3} />
          <Text style={s.infoText}>O CSC fica disponível depois de salvar os dados fiscais da NFC-e.</Text>
        </View>
      )}
      <CertificateBlock companyId={companyId} detail={data} onSaved={invalidateAll} />
      {data.requisitos && <NfseBlock companyId={companyId} detail={data} onSaved={invalidateAll} />}
      {hasConfig && <StatusBlock companyId={companyId} detail={data} />}

      <ConfirmModal
        visible={showConfirmRemove}
        title={usaNfse ? "Remover a NFC-e e o certificado?" : "Remover configuração fiscal?"}
        message={textoRemover(companyName, usaNfse)}
        danger
        confirmLabel="Remover"
        loading={removeMut.isPending}
        onConfirm={function() { removeMut.mutate(); }}
        onCancel={function() { setShowConfirmRemove(false); }}
      />
    </View>
  );
}

// ─── (a) Dados fiscais ───────────────────────────────────────────────────────────

function FiscalBlock({ companyId, detail, onSaved }: { companyId: string; detail: AuraNotasDetail; onSaved: () => void }) {
  var co = detail.company;
  var cfg = detail.config;
  var [form, setForm] = useState<FiscalUpdateBody>({});

  // Semeia o form a partir do detalhe carregado. Quando a empresa ainda não
  // tem UF de emissão definida (cfg.uf null — sem config ainda), pré-preenche
  // com a UF do endereço cadastrado da empresa, se houver (ajuda o fluxo de
  // "Adicionar empresa": staff normalmente quer a mesma UF do endereço).
  useEffect(function() {
    setForm({
      legal_name: co.legal_name || "",
      trade_name: co.trade_name || "",
      inscricao_estadual: co.inscricao_estadual || "",
      address_street: co.address_street || "",
      address_number: co.address_number || "",
      address_district: co.address_district || "",
      address_city: co.address_city || "",
      address_state: co.address_state || "",
      address_zip: co.address_zip || "",
      ibge_code: co.ibge_code || "",
      tax_regime: co.tax_regime || "",
      serie_nfce: cfg.serie_nfce,
      serie_sefaz_sp: cfg.serie_sefaz_sp,
      next_number_sefaz_sp: cfg.next_number_sefaz_sp,
      ambiente: cfg.ambiente || undefined,
      uf: cfg.uf || co.address_state || "",
      provider: cfg.provider || undefined,
      is_active: cfg.is_active === null ? false : cfg.is_active,
    });
  }, [companyId]);

  var mut = useMutation({
    mutationFn: function(body: FiscalUpdateBody) { return auraNotasApi.updateFiscal(companyId, body); },
    onSuccess: function() { setConfirmar(null); toast.success("Dados fiscais salvos"); onSaved(); },
    onError: function(e: any) { setConfirmar(null); toast.error(e?.message || "Erro ao salvar dados fiscais"); },
  });

  // 12/11/2026: produção e série/número pedem confirmação explícita.
  var [confirmar, setConfirmar] = useState<{ producao: boolean; numeracao: boolean } | null>(null);
  function salvar() {
    var c = precisaConfirmar({
      ambienteAntes: cfg.ambiente, ambienteDepois: form.ambiente,
      serieAntes: cfg.serie_sefaz_sp, serieDepois: form.serie_sefaz_sp,
      numeroAntes: cfg.next_number_sefaz_sp, numeroDepois: form.next_number_sefaz_sp,
    });
    if (c.producao || c.numeracao) { setConfirmar(c); return; }
    mut.mutate(form);
  }

  function set(k: keyof FiscalUpdateBody, v: any) { setForm(function(p) { var n: any = { ...p }; n[k] = v; return n; }); }
  function setNum(k: keyof FiscalUpdateBody, v: string) { set(k, v === "" ? null : Number(v.replace(/\D/g, "")) || null); }

  var providerForced = form.provider && form.provider !== "auto";

  return (
    <View style={s.block}>
      <BlockHead icon="building" color={Colors.violet3} tint={Colors.violetD} title="Dados fiscais" hint={(co.trade_name || co.legal_name) + " · usados no XML da NFC-e"} />

      <View style={s.grid2}>
        <Field label="Razão social"><Inp value={form.legal_name || ""} onChange={function(v) { set("legal_name", v); }} /></Field>
        <Field label="Nome fantasia"><Inp value={form.trade_name || ""} onChange={function(v) { set("trade_name", v); }} /></Field>
        <Field label="CNPJ"><Inp value={fmtCnpj(co.cnpj)} onChange={function() {}} disabled /></Field>
        <Field label="Inscrição estadual (IE)"><Inp value={form.inscricao_estadual || ""} onChange={function(v) { set("inscricao_estadual", v); }} /></Field>
        <Field label="Logradouro" full><Inp value={form.address_street || ""} onChange={function(v) { set("address_street", v); }} /></Field>
        <Field label="Número"><Inp value={form.address_number || ""} onChange={function(v) { set("address_number", v); }} /></Field>
        <Field label="Bairro"><Inp value={form.address_district || ""} onChange={function(v) { set("address_district", v); }} /></Field>
        <Field label="Cidade"><Inp value={form.address_city || ""} onChange={function(v) { set("address_city", v); }} /></Field>
        <Field label="UF"><Inp value={form.address_state || ""} onChange={function(v) { set("address_state", v.toUpperCase().slice(0, 2)); }} /></Field>
        <Field label="CEP"><Inp value={form.address_zip || ""} onChange={function(v) { set("address_zip", v); }} /></Field>
        <Field label="Código IBGE do município"><Inp value={form.ibge_code || ""} onChange={function(v) { set("ibge_code", v); }} /></Field>
        <Field label="Regime tributário" full>
          <Chips
            options={REGIME_OPTS}
            value={form.tax_regime === "simples" ? "simples_nacional" : (form.tax_regime || "")}
            onChange={function(v) { set("tax_regime", v); }}
          />
        </Field>
      </View>

      <Text style={s.sectionCap}>Numeração &amp; roteamento</Text>
      <View style={s.grid3}>
        <Field label="Série NFC-e"><Inp value={form.serie_nfce != null ? String(form.serie_nfce) : ""} onChange={function(v) { setNum("serie_nfce", v); }} keyboard="numeric" /></Field>
        <Field label="Série SEFAZ-SP (engine)"><Inp value={form.serie_sefaz_sp != null ? String(form.serie_sefaz_sp) : ""} onChange={function(v) { setNum("serie_sefaz_sp", v); }} keyboard="numeric" /></Field>
        <Field label="UF de emissão"><Inp value={form.uf || ""} onChange={function(v) { set("uf", v.toUpperCase().slice(0, 2)); }} /></Field>
        <Field label="Próx. nº NFC-e"><Inp value={cfg.next_number != null ? String(cfg.next_number) : "—"} onChange={function() {}} disabled /></Field>
        <Field label="Próx. nº SEFAZ-SP (engine)"><Inp value={form.next_number_sefaz_sp != null ? String(form.next_number_sefaz_sp) : ""} onChange={function(v) { setNum("next_number_sefaz_sp", v); }} keyboard="numeric" placeholder="1" /></Field>
        <Field label="Ambiente">
          <Segmented
            options={[{ key: "homologacao", label: "Homolog." }, { key: "producao", label: "Produção" }]}
            value={form.ambiente || "homologacao"}
            onChange={function(v) { set("ambiente", v); }}
          />
        </Field>
      </View>

      <Text style={s.sectionCap}>Provedor de emissão</Text>
      <View style={s.providerRow}>
        {PROVIDER_OPTS.map(function(opt) {
          var sel = (form.provider || "auto") === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={function() { set("provider", opt.key); }}
              style={[s.providerOpt, sel && s.providerOptSel, isWeb && ({ cursor: "pointer" } as any)]}
            >
              <View style={[s.radio, sel && s.radioSel]}>{sel && <View style={s.radioDot} />}</View>
              <Text style={[s.providerLabel, sel && { color: Colors.ink, fontWeight: "700" }]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {providerForced && (
        <View style={s.warnBox}>
          <Icon name="alert" size={13} color={Colors.amber} />
          <Text style={s.warnText}>
            <Text style={{ fontWeight: "700" }}>AUTO recomendado.</Text> No modo AUTO a emissão usa a engine própria (SEFAZ-SP) quando disponível e cai para a Nuvem Fiscal automaticamente se o circuit breaker abrir. Forçar um provedor desativa o fallback.
          </Text>
        </View>
      )}

      <View style={s.activeRow}>
        <Switch
          value={!!form.is_active}
          onValueChange={function(v) { set("is_active", v); }}
          trackColor={{ true: Colors.violet, false: Colors.border }}
          thumbColor="#fff"
        />
        <Text style={s.activeLabel}>Empresa ativa para emissão fiscal</Text>
      </View>

      <View style={s.btnRow}>
        <Pressable
          onPress={salvar}
          disabled={mut.isPending}
          testID="aura-notas-salvar-fiscal"
          style={[s.btnPrimary, mut.isPending && { opacity: 0.6 }, isWeb && ({ cursor: "pointer" } as any)]}
        >
          <Text style={s.btnPrimaryText}>{mut.isPending ? "Salvando..." : "Salvar dados fiscais"}</Text>
        </Pressable>
      </View>

      <ConfirmModal
        visible={!!confirmar}
        title={confirmar && confirmar.producao ? "Colocar a NFC-e em produção?" : "Mudar a numeração da NFC-e?"}
        message={confirmar ? textoConfirmacao("NFC-e", confirmar) : ""}
        danger
        confirmLabel="Confirmar e salvar"
        loading={mut.isPending}
        onConfirm={function() {
          if (!confirmar) return;
          mut.mutate({ ...form, confirmar_producao: confirmar.producao, confirmar_numeracao: confirmar.numeracao });
        }}
        onCancel={function() { setConfirmar(null); }}
      />
    </View>
  );
}

// ─── (b) CSC ─────────────────────────────────────────────────────────────────────

function CscBlock({ companyId, detail, onSaved }: { companyId: string; detail: AuraNotasDetail; onSaved: () => void }) {
  var [cscId, setCscId] = useState(detail.config.csc_id || "");
  var [cscToken, setCscToken] = useState("");

  var mut = useMutation({
    mutationFn: function() { return auraNotasApi.updateCsc(companyId, { csc_id: cscId.trim(), csc_token: cscToken.trim() }); },
    onSuccess: function() { toast.success("CSC salvo"); setCscToken(""); onSaved(); },
    onError: function(e: any) { toast.error(e?.message || "Erro ao salvar CSC"); },
  });

  function submit() {
    if (!cscId.trim()) { toast.error("Informe o ID do CSC"); return; }
    if (!cscToken.trim()) { toast.error("Informe o token do CSC"); return; }
    mut.mutate();
  }

  return (
    <View style={s.block}>
      <BlockHead icon="lock" color={Colors.green} tint={Colors.greenD} title="CSC — Código de Segurança do Contribuinte" hint="Obtido no portal da SEFAZ · usado no QR Code da NFC-e" />
      <View style={s.cscStatusRow}>
        <Icon name={detail.config.csc_ok ? "check" : "alert"} size={14} color={detail.config.csc_ok ? Colors.green : Colors.amber} />
        <Text style={[s.cscStatusText, { color: detail.config.csc_ok ? Colors.green : Colors.amber }]}>
          {detail.config.csc_ok ? "CSC configurado" : "CSC ausente"}
        </Text>
      </View>
      <View style={s.grid2}>
        <Field label="ID do CSC (idToken)"><Inp value={cscId} onChange={setCscId} placeholder="000001" /></Field>
        <Field label="Token CSC"><Inp value={cscToken} onChange={setCscToken} placeholder="cole o token do CSC" secure /></Field>
      </View>
      <View style={s.infoBox}>
        <Icon name="info" size={12} color={Colors.violet3} />
        <Text style={s.infoText}>O token nunca é exibido de volta após salvo — apenas o status CSC ✓. Reenvie o par completo caso precise trocar.</Text>
      </View>
      <View style={s.btnRow}>
        <Pressable onPress={submit} disabled={mut.isPending} style={[s.btnPrimary, mut.isPending && { opacity: 0.6 }, isWeb && ({ cursor: "pointer" } as any)]}>
          <Text style={s.btnPrimaryText}>{mut.isPending ? "Salvando..." : "Salvar CSC"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── (c) Certificado A1 ──────────────────────────────────────────────────────────

function CertificateBlock({ companyId, detail, onSaved }: { companyId: string; detail: AuraNotasDetail; onSaved: () => void }) {
  var [pfxBase64, setPfxBase64] = useState("");
  var [fileName, setFileName] = useState("");
  var [password, setPassword] = useState("");

  var mut = useMutation({
    mutationFn: function() { return auraNotasApi.uploadCertificate(companyId, { pfx_base64: pfxBase64, password: password }); },
    onSuccess: function(r) {
      toast.success("Certificado enviado — " + r.subject_cn);
      setPfxBase64(""); setFileName(""); setPassword("");
      onSaved();
    },
    onError: function(e: any) { toast.error(e?.message || "Erro ao enviar certificado"); },
  });

  // Reutiliza o mesmo mecanismo de upload do app (input file oculto -> base64),
  // igual a components/screens/nfe/TabConfig.tsx. Sem dependência nova.
  function pickFile() {
    if (Platform.OS !== "web") { toast.error("Upload disponível apenas na web"); return; }
    var input = document.createElement("input");
    input.type = "file";
    input.accept = ".pfx,.p12";
    input.onchange = function(e: any) {
      var file = e.target?.files?.[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function() {
        // readAsDataURL -> "data:...;base64,XXXX"; guardamos só o payload base64
        var result = String(reader.result || "");
        setPfxBase64(result.split(",")[1] || "");
        setFileName(file.name);
        toast.info("Certificado " + file.name + " carregado. Informe a senha.");
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  function submit() {
    if (!pfxBase64) { toast.error("Selecione o arquivo .pfx"); return; }
    if (!password) { toast.error("Informe a senha do certificado"); return; }
    mut.mutate();
  }

  var cert = detail.cert;
  var cl = cert ? certLabel(cert.days_left) : null;

  return (
    <View style={s.block}>
      <BlockHead icon="ribbon" color={Colors.amber} tint={Colors.amberD} title="Certificado digital A1" hint="Arquivo .pfx / .p12 · assina o XML na SEFAZ" />

      {cert ? (
        <View style={s.certCurrent}>
          <View style={s.certIcon}><Icon name="check" size={16} color={Colors.green} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.certCn} numberOfLines={1}>{cert.subject_cn}</Text>
            <Text style={s.certValidity}>
              {cert.not_before ? "Válido " + fmtDate(cert.not_before).split(" ")[0] + " → " : "Vence "}
              {fmtDate(cert.not_after).split(" ")[0]}
              {cert.updated_at ? " · atualizado " + fmtDate(cert.updated_at).split(" ")[0] : ""}
            </Text>
          </View>
          {cl && (
            <View style={[s.validPill, cl.danger ? s.validPillDanger : s.validPillOk]}>
              <Text style={[s.validPillText, { color: cl.danger ? Colors.red : Colors.green }]}>{cl.label}</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={s.certEmpty}>
          <Icon name="alert" size={14} color={Colors.amber} />
          <Text style={s.certEmptyText}>
            {(detail.certificado_fontes || []).length
              ? "Recebemos um certificado antigo desta empresa, de antes da emissão pela Aura. Para emitir, peça o A1 de novo e envie aqui."
              : "Nenhum certificado A1 cadastrado — a emissão fiscal fica bloqueada."}
          </Text>
        </View>
      )}
      {cert && detail.nfse_configurada && (
        <Text style={[s.uploadHint, { marginBottom: 10 }]}>Este certificado vale para a NFC-e e para a NFS-e desta empresa.</Text>
      )}

      <Pressable onPress={pickFile} style={[s.uploadDrop, isWeb && ({ cursor: "pointer" } as any)]}>
        <Icon name="upload" size={16} color={Colors.violet3} />
        <Text style={s.uploadText}>
          {fileName ? fileName : "Selecionar novo .pfx"}
          <Text style={s.uploadHint}>{fileName ? "" : "  — a senha é pedida ao enviar e nunca é exibida"}</Text>
        </Text>
      </Pressable>

      {!!pfxBase64 && (
        <View style={{ marginTop: 10 }}>
          <Field label="Senha do certificado"><Inp value={password} onChange={setPassword} placeholder="senha do .pfx" secure /></Field>
          <View style={s.btnRow}>
            <Pressable onPress={submit} disabled={mut.isPending} style={[s.btnPrimary, mut.isPending && { opacity: 0.6 }, isWeb && ({ cursor: "pointer" } as any)]}>
              <Text style={s.btnPrimaryText}>{mut.isPending ? "Enviando..." : "Enviar certificado"}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Requisitos de emissão (12/11/2026) ─────────────────────────────────────────
// O que está ok e o que falta para emitir NFC-e e NFS-e, item a item. A lista
// vem pronta do backend (services/auraNotas/requisitos.js), que espelha o que
// a emissão de cada documento exige.

function RequisitosBlock({ requisitos }: { requisitos: NonNullable<AuraNotasDetail["requisitos"]> }) {
  var nfce = requisitos.nfce;
  var nfse = requisitos.nfse;
  var faltas = function(itens: Requisito[]) { return itens.filter(function(i) { return i.estado === "falta" || i.estado === "problema"; }).length; };
  var resumo = function(n: number, pronto: boolean, configurada: boolean) {
    if (!configurada) return "ainda não configurada";
    if (pronto && n === 0) return "pronta para emitir";
    return n === 0 ? "quase lá" : (n === 1 ? "falta 1 item" : "faltam " + n + " itens");
  };
  return (
    <View style={s.block} testID="aura-notas-requisitos">
      <BlockHead icon="check" color={Colors.green} tint={Colors.greenD} title="O que falta para emitir" hint="Requisitos da NFC-e e da NFS-e, item a item" />
      <ListaRequisitos doc="nfce" titulo={"NFC-e — " + resumo(faltas(nfce.itens), nfce.pronta, nfce.configurada)} itens={nfce.itens} />
      <View style={{ height: 14 }} />
      <ListaRequisitos doc="nfse" titulo={"NFS-e — " + resumo(faltas(nfse.itens), nfse.apta, nfse.configurada)} itens={nfse.itens} />
    </View>
  );
}

function ListaRequisitos({ doc, titulo, itens }: { doc: string; titulo: string; itens: Requisito[] }) {
  return (
    <View>
      <Text style={s.sectionCapTop}>{titulo}</Text>
      {itens.map(function(i) {
        var e = ESTADO_REQUISITO[i.estado] || ESTADO_REQUISITO.falta;
        var cor = corDoTom(e.tom);
        return (
          <View key={i.chave} style={s.reqRow} testID={"req-" + doc + "-" + i.chave}>
            <View style={[s.reqDot, { backgroundColor: fundoDoTom(e.tom), borderColor: cor + "55" }]}>
              <Text style={[s.reqDotText, { color: cor }]}>{e.simbolo}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.reqTitle}>{i.rotulo}</Text>
              <Text style={s.reqDetail}>{i.detalhe}</Text>
            </View>
            <Text style={[s.reqState, { color: cor }]}>{e.texto}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── NFS-e (emissor nacional) pela equipe (12/11/2026) ──────────────────────────
// Mesmas regras da tela da loja (o backend reaproveita a validação dela). Só
// os campos alterados vão no PUT. Produção e série/número pedem confirmação.

var OP_SIMP_OPTS = [
  { key: "1", label: "Não optante" },
  { key: "2", label: "MEI" },
  { key: "3", label: "ME/EPP (Simples)" },
];

type NfseForm = {
  ambiente: string; is_active: boolean; serie: string; next_dps_number: string;
  municipio_ibge: string; inscricao_municipal: string; op_simp_nac: string; p_tot_trib_sn: string;
  ctribnac_padrao: string; cnbs_padrao: string; outro_emissor: string;
  outro_emissor_serie: string; outro_emissor_ultimo_numero: string;
};

function nfseFormInicial(detail: AuraNotasDetail): NfseForm {
  var n = detail.nfse || null;
  var txt = function(v: any) { return v == null ? "" : String(v); };
  return {
    ambiente: n && n.ambiente === "producao" ? "producao" : "producao_restrita",
    is_active: !!(n && n.is_active && n.provider === "nacional"),
    serie: txt(n && n.serie) || "1",
    next_dps_number: txt(n && n.next_dps_number) || "1",
    municipio_ibge: txt(n && n.municipio_ibge),
    inscricao_municipal: txt(n && n.inscricao_municipal),
    op_simp_nac: txt(n && n.op_simp_nac),
    p_tot_trib_sn: txt(n && n.p_tot_trib_sn),
    ctribnac_padrao: txt(n && n.ctribnac_padrao),
    cnbs_padrao: txt(n && n.cnbs_padrao),
    outro_emissor: n && n.outro_emissor === true ? "sim" : (n && n.outro_emissor === false ? "nao" : ""),
    outro_emissor_serie: txt(n && n.outro_emissor_serie),
    outro_emissor_ultimo_numero: txt(n && n.outro_emissor_ultimo_numero),
  };
}

function numOuNull(v: string): number | null {
  var t = String(v || "").trim().replace(",", ".");
  if (!t) return null;
  var n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Só o que mudou, já no formato do backend. */
export function corpoNfse(antes: NfseForm, depois: NfseForm): NfseUpdateBody {
  var b: NfseUpdateBody = {};
  if (depois.ambiente !== antes.ambiente) b.ambiente = depois.ambiente as any;
  if (depois.is_active !== antes.is_active) {
    b.is_active = depois.is_active;
    // ligar sem dizer o ambiente = produção no backend; aqui é sempre explícito
    if (depois.is_active) b.ambiente = depois.ambiente as any;
  }
  if (depois.serie !== antes.serie) b.serie = depois.serie.trim();
  if (depois.next_dps_number !== antes.next_dps_number) b.next_dps_number = Number(depois.next_dps_number.replace(/\D/g, "")) || 0;
  if (depois.municipio_ibge !== antes.municipio_ibge) b.municipio_ibge = depois.municipio_ibge.trim();
  if (depois.inscricao_municipal !== antes.inscricao_municipal) b.inscricao_municipal = depois.inscricao_municipal.trim() || null;
  if (depois.op_simp_nac !== antes.op_simp_nac) b.op_simp_nac = depois.op_simp_nac ? Number(depois.op_simp_nac) : null;
  if (depois.p_tot_trib_sn !== antes.p_tot_trib_sn) b.p_tot_trib_sn = numOuNull(depois.p_tot_trib_sn);
  if (depois.ctribnac_padrao !== antes.ctribnac_padrao) b.ctribnac_padrao = depois.ctribnac_padrao.trim();
  if (depois.cnbs_padrao !== antes.cnbs_padrao) b.cnbs_padrao = depois.cnbs_padrao.trim() || null;
  if (depois.outro_emissor !== antes.outro_emissor) b.outro_emissor = depois.outro_emissor === "sim" ? true : (depois.outro_emissor === "nao" ? false : null);
  if (depois.outro_emissor === "sim") {
    if (depois.outro_emissor_serie !== antes.outro_emissor_serie) b.outro_emissor_serie = depois.outro_emissor_serie.trim() || null;
    if (depois.outro_emissor_ultimo_numero !== antes.outro_emissor_ultimo_numero) b.outro_emissor_ultimo_numero = numOuNull(depois.outro_emissor_ultimo_numero.replace(/\D/g, ""));
  }
  return b;
}

function NfseBlock({ companyId, detail, onSaved }: { companyId: string; detail: AuraNotasDetail; onSaved: () => void }) {
  var inicial = nfseFormInicial(detail);
  var [form, setForm] = useState<NfseForm>(inicial);
  var [confirmar, setConfirmar] = useState<{ producao: boolean; numeracao: boolean } | null>(null);
  useEffect(function() { setForm(nfseFormInicial(detail)); }, [companyId, detail.nfse]);

  var mut = useMutation({
    mutationFn: function(body: NfseUpdateBody) { return auraNotasApi.updateNfse(companyId, body); },
    onSuccess: function() { setConfirmar(null); toast.success("NFS-e salva"); onSaved(); },
    onError: function(e: any) { setConfirmar(null); toast.error(e?.message || "Não deu para salvar a NFS-e agora. Tente de novo em instantes."); },
  });

  function set(k: keyof NfseForm, v: any) { setForm(function(p) { var n: any = { ...p }; n[k] = v; return n; }); }

  function salvar() {
    var body = corpoNfse(inicial, form);
    if (!Object.keys(body).length) { toast.info("Nada mudou na NFS-e."); return; }
    var c = precisaConfirmar({
      ambienteAntes: detail.nfse ? inicial.ambiente : null, ambienteDepois: body.ambiente !== undefined ? body.ambiente : inicial.ambiente,
      serieAntes: inicial.serie, serieDepois: body.serie,
      numeroAntes: inicial.next_dps_number, numeroDepois: body.next_dps_number,
    });
    if (c.producao || c.numeracao) { setConfirmar(c); return; }
    mut.mutate(body);
  }

  var n = detail.nfse;
  return (
    <View style={s.block} testID="aura-notas-nfse">
      <BlockHead icon="file_text" color={Colors.violet3} tint={Colors.violetD} title="NFS-e — emissor nacional" hint="Mesmas regras da tela da loja · nota de serviço" />

      {!n && (
        <View style={[s.infoBox, { marginTop: 0, marginBottom: 12 }]}>
          <Icon name="info" size={12} color={Colors.violet3} />
          <Text style={s.infoText}>A NFS-e ainda não foi configurada nesta empresa. Ao salvar, ela começa em produção restrita (testes do gov.br).</Text>
        </View>
      )}
      {n && n.ultimo_teste_status && n.ultimo_teste_status !== "ok" && n.ultimo_teste_mensagem ? (
        <View style={[s.warnBox, { marginTop: 0, marginBottom: 12 }]}>
          <Icon name="alert" size={13} color={Colors.amber} />
          <Text style={s.warnText}>Última nota de teste: {n.ultimo_teste_mensagem}</Text>
        </View>
      ) : null}

      <View style={s.grid2}>
        <Field label="Município (código IBGE, 7 dígitos)"><Inp value={form.municipio_ibge} onChange={function(v) { set("municipio_ibge", v.replace(/\D/g, "").slice(0, 7)); }} keyboard="numeric" placeholder={detail.company.ibge_code || "3550308"} /></Field>
        <Field label="Inscrição municipal (opcional)"><Inp value={form.inscricao_municipal} onChange={function(v) { set("inscricao_municipal", v.slice(0, 15)); }} /></Field>
        <Field label="Código de tributação nacional (6 dígitos)"><Inp value={form.ctribnac_padrao} onChange={function(v) { set("ctribnac_padrao", v.replace(/\D/g, "").slice(0, 6)); }} keyboard="numeric" placeholder="010501" /></Field>
        <Field label="NBS padrão (opcional, 9 dígitos)"><Inp value={form.cnbs_padrao} onChange={function(v) { set("cnbs_padrao", v.replace(/\D/g, "").slice(0, 9)); }} keyboard="numeric" /></Field>
        <Field label="Situação no Simples Nacional" full>
          <Chips options={OP_SIMP_OPTS} value={form.op_simp_nac} onChange={function(v) { set("op_simp_nac", v); }} />
        </Field>
        {form.op_simp_nac === "3" && (
          <Field label="Percentual aproximado de tributos do Simples (%)"><Inp value={form.p_tot_trib_sn} onChange={function(v) { set("p_tot_trib_sn", v); }} keyboard="numeric" placeholder="6,00" /></Field>
        )}
      </View>

      <Text style={s.sectionCap}>Numeração da DPS</Text>
      <View style={s.grid2}>
        <Field label="Série da DPS (1 a 49998)"><Inp value={form.serie} onChange={function(v) { set("serie", v.replace(/\D/g, "").slice(0, 5)); }} keyboard="numeric" /></Field>
        <Field label="Próximo número da DPS"><Inp value={form.next_dps_number} onChange={function(v) { set("next_dps_number", v.replace(/\D/g, "")); }} keyboard="numeric" /></Field>
        <Field label="Já emite NFS-e por outro emissor?" full>
          <Chips options={[{ key: "nao", label: "Não" }, { key: "sim", label: "Sim" }]} value={form.outro_emissor} onChange={function(v) { set("outro_emissor", v); }} />
        </Field>
        {form.outro_emissor === "sim" && (
          <Field label="Série usada no outro emissor"><Inp value={form.outro_emissor_serie} onChange={function(v) { set("outro_emissor_serie", v.replace(/\D/g, "").slice(0, 5)); }} keyboard="numeric" /></Field>
        )}
        {form.outro_emissor === "sim" && (
          <Field label="Último número usado lá"><Inp value={form.outro_emissor_ultimo_numero} onChange={function(v) { set("outro_emissor_ultimo_numero", v.replace(/\D/g, "")); }} keyboard="numeric" /></Field>
        )}
      </View>
      <View style={s.infoBox}>
        <Icon name="info" size={12} color={Colors.violet3} />
        <Text style={s.infoText}>O próximo número só anda para frente: número já usado nunca volta.</Text>
      </View>

      <Text style={s.sectionCap}>Ambiente</Text>
      <Segmented
        options={[{ key: "producao_restrita", label: "Testes (gov.br)" }, { key: "producao", label: "Produção" }]}
        value={form.ambiente}
        onChange={function(v) { set("ambiente", v); }}
      />

      <View style={s.activeRow}>
        <Switch
          value={form.is_active}
          onValueChange={function(v) { set("is_active", v); }}
          trackColor={{ true: Colors.violet, false: Colors.border }}
          thumbColor="#fff"
        />
        <Text style={s.activeLabel}>NFS-e ligada nesta empresa</Text>
      </View>
      <Text style={[s.uploadHint, { marginTop: 6 }]}>Para ligar, a nota de teste precisa ter passado — a mesma regra da tela da loja.</Text>

      <View style={s.btnRow}>
        <Pressable onPress={salvar} disabled={mut.isPending} testID="aura-notas-salvar-nfse" style={[s.btnPrimary, mut.isPending && { opacity: 0.6 }, isWeb && ({ cursor: "pointer" } as any)]}>
          <Text style={s.btnPrimaryText}>{mut.isPending ? "Salvando..." : "Salvar NFS-e"}</Text>
        </Pressable>
      </View>

      <ConfirmModal
        visible={!!confirmar}
        title={confirmar && confirmar.producao ? "Colocar a NFS-e em produção?" : "Mudar a numeração da NFS-e?"}
        message={confirmar ? textoConfirmacao("NFS-e", confirmar) : ""}
        danger
        confirmLabel="Confirmar e salvar"
        loading={mut.isPending}
        onConfirm={function() {
          if (!confirmar) return;
          mut.mutate({ ...corpoNfse(inicial, form), confirmar_producao: confirmar.producao, confirmar_numeracao: confirmar.numeracao });
        }}
        onCancel={function() { setConfirmar(null); }}
      />
    </View>
  );
}

// ─── (d) Status ──────────────────────────────────────────────────────────────────

function StatusBlock({ companyId, detail }: { companyId: string; detail: AuraNotasDetail }) {
  var [result, setResult] = useState<TestConexaoResponse | null>(null);

  var mut = useMutation({
    mutationFn: function() { return auraNotasApi.testConexao(companyId); },
    onSuccess: function(r) {
      setResult(r);
      if (r.ok) toast.success("Conexão OK — cStat " + (r.cStat || "?"));
      else toast.error(r.motivo || "Falha na conexão com a SEFAZ");
    },
    onError: function(e: any) { setResult(null); toast.error(e?.message || "Erro ao testar conexão"); },
  });

  var st = detail.stats_30d || { total: 0, engine: 0, gateway: 0, fallbacks: 0 };
  var breakerOpen = detail.breaker_open;

  return (
    <View style={s.block}>
      <BlockHead icon="pulse" color={Colors.violet3} tint={Colors.violetD} title="Status & conexão SEFAZ" hint="Circuit breaker da engine e teste de conexão ao webservice" />

      <View style={[s.breaker, breakerOpen ? s.breakerOpen : s.breakerOk]}>
        <Icon name="power" size={14} color={breakerOpen ? Colors.amber : Colors.green} />
        <Text style={[s.breakerText, { color: breakerOpen ? Colors.amber : Colors.green }]}>
          {breakerOpen ? "Circuit breaker ABERTO — emissão usando fallback (Nuvem Fiscal)" : "Circuit breaker fechado — engine operando normalmente"}
        </Text>
      </View>

      <View style={s.statusGrid}>
        <StatusCell value={st.total} label="Total 30d" />
        <StatusCell value={st.engine} label="Via engine" color={Colors.violet3} />
        <StatusCell value={st.gateway} label="Via gateway" color={Colors.ink3} />
        <StatusCell value={st.fallbacks} label="Fallbacks" color={st.fallbacks > 0 ? Colors.amber : Colors.green} />
      </View>

      <Pressable onPress={function() { mut.mutate(); }} disabled={mut.isPending} style={[s.btnGhost, mut.isPending && { opacity: 0.6 }, isWeb && ({ cursor: "pointer" } as any)]}>
        <Icon name="refresh" size={14} color={Colors.ink} />
        <Text style={s.btnGhostText}>{mut.isPending ? "Testando..." : "Testar conexão SEFAZ-SP"}</Text>
      </Pressable>

      {result && (
        <View style={[s.testResult, result.ok ? s.testResultOk : s.testResultBad]}>
          <Icon name={result.ok ? "check" : "alert"} size={14} color={result.ok ? Colors.green : Colors.red} />
          <Text style={[s.testResultText, { color: result.ok ? Colors.green : Colors.red }]}>
            {result.ok ? "Conexão OK" : "Falha"}
            {result.cStat ? " — cStat " + result.cStat : ""}
            {result.motivo ? " " + result.motivo : ""}
            {result.latency_ms != null ? " · " + result.latency_ms + "ms" : ""}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Subcomponentes de UI ────────────────────────────────────────────────────────

function BlockHead({ icon, color, tint, title, hint }: { icon: string; color: string; tint: string; title: string; hint: string }) {
  return (
    <View style={s.blockHead}>
      <View style={[s.blockIcon, { backgroundColor: tint }]}>
        <Icon name={icon as any} size={15} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.blockTitle}>{title}</Text>
        <Text style={s.blockHint} numberOfLines={1}>{hint}</Text>
      </View>
    </View>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: any }) {
  return (
    <View style={[s.field, full && s.fieldFull]}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Inp({ value, onChange, placeholder, disabled, secure, keyboard }: { value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean; secure?: boolean; keyboard?: "numeric" }) {
  return (
    <TextInput
      style={[s.input, disabled && s.inputDisabled]}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={Colors.ink3}
      editable={!disabled}
      secureTextEntry={!!secure}
      keyboardType={keyboard === "numeric" ? "numeric" : "default"}
    />
  );
}

function Segmented({ options, value, onChange }: { options: { key: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={s.segmented}>
      {options.map(function(o) {
        var sel = o.key === value;
        return (
          <Pressable key={o.key} onPress={function() { onChange(o.key); }} style={[s.segOpt, sel && s.segOptSel, isWeb && ({ cursor: "pointer" } as any)]}>
            <Text style={[s.segText, sel && { color: "#fff", fontWeight: "700" }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Escolha entre poucas opções, quebrando linha em tela estreita (375 px).
function Chips({ options, value, onChange }: { options: { key: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={s.chipsRow}>
      {options.map(function(o) {
        var sel = o.key === value;
        return (
          <Pressable key={o.key} onPress={function() { onChange(o.key); }} style={[s.chipOpt, sel && s.chipOptSel, isWeb && ({ cursor: "pointer" } as any)]}>
            <Text style={[s.chipOptText, sel && { color: "#fff", fontWeight: "700" }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function StatusCell({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <View style={s.statusCell}>
      <Text style={[s.statusVal, color && { color: color }]}>{value}</Text>
      <Text style={s.statusLabel}>{label}</Text>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

var s = StyleSheet.create({
  layout: { flexDirection: "row", gap: 16, alignItems: "flex-start" },
  listCol: { width: 400 },
  detailCol: { flex: 1 },

  loadingBox: { paddingVertical: 60, alignItems: "center", gap: 12 },
  loadingText: { fontSize: 13, color: Colors.ink3 },
  errTitle: { fontSize: 14, fontWeight: "700", color: Colors.ink, marginTop: 4, textAlign: "center" },
  retryBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 16, marginTop: 10 },
  retryText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  // search
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: Platform.OS === "web" ? 10 : 6, marginBottom: 12 },
  searchInput: { flex: 1, color: Colors.ink, fontSize: 13, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}) },
  emptyList: { padding: 24, alignItems: "center" },
  emptyText: { fontSize: 13, color: Colors.ink3 },

  // "Adicionar empresa" CTA (dashed violet, convencao usada em empresas.tsx)
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#7c3aed", borderRadius: 12, paddingVertical: 10, marginBottom: 12 },
  addBtnText: { fontSize: 13, color: "#7c3aed", fontWeight: "700" },

  // picker de empresa (modal "Adicionar empresa")
  pickRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 12, marginBottom: 8 },
  pickName: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  pickMeta: { fontSize: 11, color: Colors.ink3, marginTop: 2 },

  // list card
  card: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 14, marginBottom: 8 },
  cardActive: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  ccTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  ccName: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  ccCnpj: { fontSize: 11, color: Colors.ink3, marginTop: 1 },
  badge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, borderWidth: 1 },
  badgeAura: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  badgeNuvem: { backgroundColor: Colors.bg4, borderColor: Colors.border },
  badgeText: { fontSize: 10, fontWeight: "700" },
  ccMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  chip: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: Colors.bg4, borderRadius: 6, paddingVertical: 3, paddingHorizontal: 7 },
  chipWarn: { backgroundColor: Colors.amberD },
  chipText: { fontSize: 10, fontWeight: "600", color: Colors.ink2 },
  ccStats: { flexDirection: "row", gap: 16, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  stat: {},
  statVal: { fontSize: 15, fontWeight: "800", color: Colors.ink, letterSpacing: -0.3 },
  statLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.3, fontWeight: "600" },
  ccLast: { fontSize: 10, color: Colors.ink3, marginTop: 8 },

  // detail empty
  detailEmpty: { paddingVertical: 80, alignItems: "center", gap: 12, backgroundColor: Colors.bg3, borderRadius: 16, borderWidth: 1, borderColor: Colors.border },
  detailEmptyText: { fontSize: 13, color: Colors.ink3, textAlign: "center", maxWidth: 280, lineHeight: 20 },

  // detail header (nome/cnpj + Remover)
  detailHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  detailHeaderName: { fontSize: 17, fontWeight: "800", color: Colors.ink },
  detailHeaderCnpj: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  removeBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#dc262614", borderWidth: 1, borderColor: "#dc262640", borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  removeBtnText: { fontSize: 12, color: "#dc2626", fontWeight: "700" },

  // banner "empresa nova, sem config ainda"
  newBanner: { flexDirection: "row", gap: 9, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, borderRadius: 12, padding: 13 },
  newBannerText: { flex: 1, fontSize: 12, color: Colors.violet3, lineHeight: 18 },

  // block
  block: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 18 },
  blockHead: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 14 },
  blockIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  blockTitle: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  blockHint: { fontSize: 11, color: Colors.ink3, marginTop: 1 },

  grid2: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  grid3: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  field: { width: IS_WIDE ? "calc(50% - 5px)" as any : "100%", gap: 5 },
  fieldFull: { width: "100%" },
  fieldLabel: { fontSize: 11, fontWeight: "600", color: Colors.ink3 },
  input: { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, borderRadius: 9, paddingHorizontal: 11, paddingVertical: Platform.OS === "web" ? 9 : 7, color: Colors.ink, fontSize: 13, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}) },
  inputDisabled: { opacity: 0.5 },

  sectionCap: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, color: Colors.ink3, fontWeight: "700", marginTop: 20, marginBottom: 10 },

  // provider radios
  providerRow: { gap: 8 },
  providerOpt: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  providerOptSel: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  providerLabel: { fontSize: 13, color: Colors.ink2 },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" },
  radioSel: { borderColor: Colors.violet },
  radioDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.violet },

  warnBox: { flexDirection: "row", gap: 8, backgroundColor: Colors.amberD, borderWidth: 1, borderColor: Colors.amber + "44", borderRadius: 10, padding: 11, marginTop: 10 },
  warnText: { flex: 1, fontSize: 11, color: Colors.amber, lineHeight: 17 },
  infoBox: { flexDirection: "row", gap: 8, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, padding: 11, marginTop: 10 },
  infoText: { flex: 1, fontSize: 11, color: Colors.violet3, lineHeight: 17 },

  activeRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 },
  activeLabel: { fontSize: 13, color: Colors.ink2, fontWeight: "600" },

  // 12/11/2026: requisitos e escolhas em chips
  sectionCapTop: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, color: Colors.ink3, fontWeight: "700", marginBottom: 8 },
  reqRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  reqDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: "center", justifyContent: "center", marginTop: 1 },
  reqDotText: { fontSize: 11, fontWeight: "800" },
  reqTitle: { fontSize: 12, fontWeight: "700", color: Colors.ink },
  reqDetail: { fontSize: 11, color: Colors.ink3, marginTop: 2, lineHeight: 16 },
  reqState: { fontSize: 10, fontWeight: "700", marginTop: 3, maxWidth: 90, textAlign: "right" },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chipOpt: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg },
  chipOptSel: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  chipOptText: { fontSize: 12, color: Colors.ink2, fontWeight: "600" },

  segmented: { flexDirection: "row", backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, borderRadius: 9, padding: 3, gap: 3 },
  segOpt: { flex: 1, paddingVertical: 7, borderRadius: 6, alignItems: "center" },
  segOptSel: { backgroundColor: Colors.violet },
  segText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },

  btnRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 14 },
  btnPrimary: { backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18 },
  btnPrimaryText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  btnGhost: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingVertical: 11 },
  btnGhostText: { color: Colors.ink, fontSize: 13, fontWeight: "700" },

  // csc
  cscStatusRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 12 },
  cscStatusText: { fontSize: 12, fontWeight: "700" },

  // cert
  certCurrent: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, marginBottom: 12 },
  certIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center" },
  certCn: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  certValidity: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  validPill: { paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999 },
  validPillOk: { backgroundColor: Colors.greenD },
  validPillDanger: { backgroundColor: Colors.redD },
  validPillText: { fontSize: 10, fontWeight: "700" },
  certEmpty: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.amberD, borderRadius: 10, padding: 12, marginBottom: 12 },
  certEmptyText: { flex: 1, fontSize: 12, color: Colors.amber, fontWeight: "600" },
  uploadDrop: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderStyle: "dashed", borderColor: Colors.border2, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 12 },
  uploadText: { fontSize: 12, color: Colors.violet3, fontWeight: "700" },
  uploadHint: { fontSize: 11, color: Colors.ink3, fontWeight: "400" },

  // status
  breaker: { flexDirection: "row", alignItems: "center", gap: 9, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 13, marginBottom: 12, borderWidth: 1 },
  breakerOk: { backgroundColor: Colors.greenD, borderColor: Colors.green + "40" },
  breakerOpen: { backgroundColor: Colors.amberD, borderColor: Colors.amber + "4d" },
  breakerText: { flex: 1, fontSize: 12, fontWeight: "600" },
  statusGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  statusCell: { width: IS_WIDE ? "calc(25% - 8px)" as any : "calc(50% - 5px)" as any, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12 },
  statusVal: { fontSize: 20, fontWeight: "800", color: Colors.ink, letterSpacing: -0.4 },
  statusLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.3, fontWeight: "600", marginTop: 2 },
  testResult: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 13, marginTop: 12, borderWidth: 1 },
  testResultOk: { backgroundColor: Colors.greenD, borderColor: Colors.green + "40" },
  testResultBad: { backgroundColor: Colors.redD, borderColor: Colors.red + "40" },
  testResultText: { flex: 1, fontSize: 12, fontWeight: "600" },
});
