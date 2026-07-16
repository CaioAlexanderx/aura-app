import { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Platform, TextInput, ActivityIndicator, Switch } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/Toast";
import { IS_WIDE } from "@/constants/helpers";
import {
  auraNotasApi,
  type AuraNotasCompany,
  type AuraNotasDetail,
  type ProviderMode,
  type FiscalUpdateBody,
  type TestConexaoResponse,
} from "@/services/auraNotasApi";

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
          return (
            <Pressable
              key={c.company_id}
              onPress={function() { setSelectedId(c.company_id); }}
              style={[s.card, active && s.cardActive, isWeb && ({ cursor: "pointer" } as any)]}
            >
              <View style={s.ccTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.ccName} numberOfLines={1}>{c.name}</Text>
                  <Text style={s.ccCnpj}>{fmtCnpj(c.cnpj)}</Text>
                </View>
                <View style={[s.badge, isEngine ? s.badgeAura : s.badgeNuvem]}>
                  <Text style={[s.badgeText, { color: isEngine ? Colors.violet3 : Colors.ink3 }]}>
                    {isEngine ? "Aura Notas" : "Nuvem Fiscal"}
                  </Text>
                </View>
              </View>

              <View style={s.ccMeta}>
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
              </View>

              <View style={s.ccStats}>
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
              </View>

              <Text style={s.ccLast}>
                {c.last_emission
                  ? "Última: " + fmtDate(c.last_emission.at) + " · " + c.last_emission.provider_used + " · " + c.last_emission.status
                  : "Sem emissões nos últimos 30 dias"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── Detalhe ── */}
      <View style={[s.detailCol, !IS_WIDE && { width: "100%" }]}>
        {selectedId ? (
          <CompanyDetail key={selectedId} companyId={selectedId} onSaved={function() { qc.invalidateQueries({ queryKey: ["aura-notas-companies"] }); }} />
        ) : (
          <View style={s.detailEmpty}>
            <Icon name="file_text" size={30} color={Colors.ink3} />
            <Text style={s.detailEmptyText}>Selecione uma empresa para gerenciar sua configuração fiscal.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Detalhe de uma empresa ─────────────────────────────────────────────────────

function CompanyDetail({ companyId, onSaved }: { companyId: string; onSaved: () => void }) {
  var qc = useQueryClient();
  var { data, isLoading, isError, refetch } = useQuery<AuraNotasDetail>({
    queryKey: ["aura-notas-detail", companyId],
    queryFn: function() { return auraNotasApi.detail(companyId); },
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

  return (
    <View style={{ gap: 14 }}>
      <FiscalBlock companyId={companyId} detail={data} onSaved={invalidateAll} />
      <CscBlock companyId={companyId} detail={data} onSaved={invalidateAll} />
      <CertificateBlock companyId={companyId} detail={data} onSaved={invalidateAll} />
      <StatusBlock companyId={companyId} detail={data} />
    </View>
  );
}

// ─── (a) Dados fiscais ───────────────────────────────────────────────────────────

function FiscalBlock({ companyId, detail, onSaved }: { companyId: string; detail: AuraNotasDetail; onSaved: () => void }) {
  var co = detail.company;
  var cfg = detail.config;
  var [form, setForm] = useState<FiscalUpdateBody>({});

  // Semeia o form a partir do detalhe carregado
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
      ambiente: cfg.ambiente,
      uf: cfg.uf || "",
      provider: cfg.provider,
      is_active: cfg.is_active,
    });
  }, [companyId]);

  var mut = useMutation({
    mutationFn: function(body: FiscalUpdateBody) { return auraNotasApi.updateFiscal(companyId, body); },
    onSuccess: function() { toast.success("Dados fiscais salvos"); onSaved(); },
    onError: function(e: any) { toast.error(e?.message || "Erro ao salvar dados fiscais"); },
  });

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
        <Field label="Regime tributário"><Inp value={form.tax_regime || ""} onChange={function(v) { set("tax_regime", v); }} placeholder="Simples Nacional" /></Field>
      </View>

      <Text style={s.sectionCap}>Numeração &amp; roteamento</Text>
      <View style={s.grid3}>
        <Field label="Série NFC-e"><Inp value={form.serie_nfce != null ? String(form.serie_nfce) : ""} onChange={function(v) { setNum("serie_nfce", v); }} keyboard="numeric" /></Field>
        <Field label="Série SEFAZ-SP (engine)"><Inp value={form.serie_sefaz_sp != null ? String(form.serie_sefaz_sp) : ""} onChange={function(v) { setNum("serie_sefaz_sp", v); }} keyboard="numeric" /></Field>
        <Field label="UF de emissão"><Inp value={form.uf || ""} onChange={function(v) { set("uf", v.toUpperCase().slice(0, 2)); }} /></Field>
        <Field label="Próx. nº NFC-e"><Inp value={cfg.next_number != null ? String(cfg.next_number) : "—"} onChange={function() {}} disabled /></Field>
        <Field label="Próx. nº SEFAZ-SP"><Inp value={cfg.next_number_sefaz_sp != null ? String(cfg.next_number_sefaz_sp) : "—"} onChange={function() {}} disabled /></Field>
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
          onPress={function() { mut.mutate(form); }}
          disabled={mut.isPending}
          style={[s.btnPrimary, mut.isPending && { opacity: 0.6 }, isWeb && ({ cursor: "pointer" } as any)]}
        >
          <Text style={s.btnPrimaryText}>{mut.isPending ? "Salvando..." : "Salvar dados fiscais"}</Text>
        </Pressable>
      </View>
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
          <Text style={s.certEmptyText}>Nenhum certificado A1 cadastrado — a emissão fiscal fica bloqueada.</Text>
        </View>
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
