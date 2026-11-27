// ============================================================
// Hub — "É ela": liga o número da conversa a um cadastro de Clientes da
// MESMA loja. Duas peças, como no mockup (Main.dc.html):
//
//   FaixaEhEla    — dentro da conversa: "Este número é da X? [É ela] [Criar
//                   cliente novo]" quando o servidor acha o mesmo telefone.
//   ClientePainel — coluna "Sobre o cliente": nome, telefone, última compra,
//                   crediário (limite livre), aniversário. Sem cadastro ligado:
//                   "Ainda sem cadastro" e a busca para ligar.
//
// Depois de ligar, o servidor passa a devolver o nome do cadastro no lugar
// do nome do perfil (lista e thread). Multi-CNPJ: a busca é da loja aberta.
// Só aparece o que o servidor tem: sem limite de crediário, sem a linha.
// ============================================================
import { useState } from "react";
import { View, Pressable, TextInput } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fmt } from "@/constants/helpers";
import { formatarTelefone } from "@/utils/telefone";
import { tourTarget } from "@/utils/tourTarget";
import { hubApi, type HubCliente } from "@/services/hubApi";
import { creditApi } from "@/services/creditApi";
import { K, Tx, Meta, Pilula, Ico, superficie, web, SANS } from "./conversasUi";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "mar/2025" a partir de um ISO; "" se inválido. */
export function mesAno(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : `${MESES[d.getMonth()]}/${d.getFullYear()}`;
}

/** Aniversário "12/12" (sem ano) a partir de yyyy-mm-dd; "" se inválido. */
export function diaMes(iso: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}` : "";
}

/** "R$ 320" (inteiro) ou "R$ 320,50". */
export function reais(n: number): string {
  return Number.isInteger(n) ? `R$ ${n.toLocaleString("pt-BR")}` : fmt(n);
}

/** Cadastro ligado + limite livre do crediário (quando a loja tem crediário para ele). */
export function useClienteDaConversa(companyId: string, convId: string, ativo = true) {
  const { data } = useQuery({
    queryKey: ["hub-cliente", companyId, convId],
    queryFn: () => hubApi.clienteDaConversa(companyId, convId),
    enabled: ativo,
  });
  const cliente = data?.cliente || null;
  const { data: perfil } = useQuery({
    queryKey: ["hub-cliente-credito", companyId, cliente?.id],
    queryFn: () => creditApi.getCustomerProfile(companyId, cliente!.id),
    enabled: ativo && !!cliente?.id,
    staleTime: 60000,
    retry: false,
  });
  let livre: number | null = null;
  if (perfil && Number(perfil.credit_limit) > 0) {
    const l = perfil.available_limit ?? Number(perfil.credit_limit) - Number(perfil.credit_used || 0);
    livre = Number.isFinite(l) ? Math.max(0, l) : null;
  }
  return { cliente, sugestaoServidor: data?.sugestao || null, livre, carregado: !!data };
}

function useLigar(companyId: string, convId: string, onChanged: () => void, onError: (m: string) => void, depois?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (customerId: string | null) => hubApi.ligarCliente(companyId, convId, customerId),
    onSuccess: () => {
      depois?.();
      qc.invalidateQueries({ queryKey: ["hub-cliente", companyId, convId] });
      onChanged();
    },
    onError: (e: any) => onError(e?.message || "Não foi possível ligar o cliente."),
  });
}

/** "Este número é da Ana Paula Ribeiro?" — só quando o servidor sugere e ninguém está ligado. */
export function FaixaEhEla({ companyId, convId, onChanged, onError }: {
  companyId: string; convId: string; onChanged: () => void; onError: (m: string) => void;
}) {
  const [recusada, setRecusada] = useState(false);
  const { cliente, sugestaoServidor } = useClienteDaConversa(companyId, convId);
  const mLigar = useLigar(companyId, convId, onChanged, onError, () => setRecusada(false));
  const sugestao = !cliente && !recusada ? sugestaoServidor : null;
  if (!sugestao) return null;
  return (
    <View testID="hub-cliente-sugestao"
      style={[superficie.seca(20), { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 12, paddingLeft: 16, paddingRight: 12, marginBottom: 6 }]}>
      <Tx style={{ flexGrow: 1, flexShrink: 1, flexBasis: 260, minWidth: 0, fontSize: 14, color: K.ink2, lineHeight: 20 }}>
        {"Este número é da "}<Tx style={{ fontSize: 14, fontWeight: "700", lineHeight: 20 }}>{sugestao.name}</Tx>
        {`? Mesmo telefone do cadastro${sugestao.since ? `, cliente desde ${mesAno(sugestao.since)}` : ""}.`}
      </Tx>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
        <Pilula testID="hub-cliente-e-ela" {...tourTarget("wa.ligar_cadastro")} pequena on disabled={mLigar.isPending} onPress={() => mLigar.mutate(sugestao.id)}>É ela</Pilula>
        {/* Rótulo do mockup; a ação é a de sempre do "Não é": solta a sugestão e o cadastro se liga ou se cria pela coluna ao lado. */}
        <Pilula testID="hub-cliente-nao-e" pequena onPress={() => setRecusada(true)}>Criar cliente novo</Pilula>
      </View>
    </View>
  );
}

function Linha({ rotulo, children, cor }: { rotulo: string; children: string; cor?: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
      <Tx style={{ fontSize: 14, color: K.ink2, lineHeight: 20 }}>{rotulo}</Tx>
      <Tx style={{ fontSize: 14, fontWeight: "700", lineHeight: 20, color: cor || K.ink, textAlign: "right", flexShrink: 1 }}>{children}</Tx>
    </View>
  );
}

/** Bloco "Cliente" da coluna "Sobre o cliente". */
export function ClientePainel({ companyId, convId, onChanged, onError }: {
  companyId: string; convId: string; onChanged: () => void; onError: (m: string) => void;
}) {
  const [buscando, setBuscando] = useState(false);
  const [q, setQ] = useState("");
  const { cliente, sugestaoServidor, livre } = useClienteDaConversa(companyId, convId);
  const mLigar = useLigar(companyId, convId, onChanged, onError, () => { setBuscando(false); setQ(""); });
  const { data: achados } = useQuery({
    queryKey: ["hub-clientes-busca", companyId, q.trim()],
    queryFn: () => hubApi.buscarClientes(companyId, q.trim()),
    enabled: buscando && q.trim().length >= 2,
  });

  const busca = buscando && (
    <View testID="hub-cliente-busca" style={{ gap: 6, marginTop: 8 }}>
      <View style={[superficie.seca(999), { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, paddingHorizontal: 14 }]}>
        <Ico nome="busca" size={16} cor={K.ink3} />
        <TextInput testID="hub-cliente-busca-input" value={q} onChangeText={setQ} autoFocus
          placeholder="Buscar cliente por nome, telefone ou e-mail" placeholderTextColor={K.ink3}
          style={[{ flex: 1, minWidth: 0, fontSize: 14, color: K.ink, fontFamily: SANS }, web({ outlineStyle: "none", border: 0, background: "none" })]} />
      </View>
      {(achados?.clientes || []).map((c: Pick<HubCliente, "id" | "name" | "phone" | "email">) => (
        <Pressable key={c.id} testID={`hub-cliente-achado-${c.id}`} disabled={mLigar.isPending} onPress={() => mLigar.mutate(c.id)}
          style={[{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 18, borderWidth: 1, borderColor: "transparent" }, web({ cursor: "pointer" })]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Tx numberOfLines={1} style={{ fontWeight: "700" }}>{c.name}</Tx>
            <Tx numberOfLines={1} style={{ fontSize: 13, color: K.ink2, lineHeight: 18 }}>{[formatarTelefone(c.phone), c.email].filter(Boolean).join(" · ") || "sem telefone"}</Tx>
          </View>
          <Tx style={{ fontSize: 13, fontWeight: "700", color: K.acc, lineHeight: 18 }}>É ela</Tx>
        </Pressable>
      ))}
      {achados && achados.clientes.length === 0 && <Tx style={{ fontSize: 13, color: K.ink2 }}>Nenhum cliente encontrado nesta loja.</Tx>}
    </View>
  );

  if (cliente) {
    const tel = formatarTelefone(cliente.phone);
    const sub = [tel, cliente.since ? `desde ${mesAno(cliente.since)}` : ""].filter(Boolean).join(" · ");
    const ultima = cliente.last_purchase_at
      ? new Date(cliente.last_purchase_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
      : "";
    const aniv = diaMes(cliente.birth_date);
    return (
      <View testID="hub-cliente" style={{ gap: 18 }}>
        <View style={{ gap: 4 }}>
          <Meta>Cliente</Meta>
          <Tx testID="hub-cliente-nome" style={{ fontSize: 20, fontWeight: "800", letterSpacing: -0.4, lineHeight: 26 }}>{cliente.name}</Tx>
          {!!sub && <Tx style={{ fontSize: 13, color: K.ink2, lineHeight: 18 }}>{sub}</Tx>}
        </View>
        <View style={{ gap: 10 }}>
          <Linha rotulo="Última compra">{ultima ? (cliente.last_purchase_amount != null ? `${fmt(cliente.last_purchase_amount)} · ${ultima}` : ultima) : "ainda sem compra"}</Linha>
          {!!cliente.total_spent && <Linha rotulo="Em compras">{fmt(cliente.total_spent)}</Linha>}
          {livre != null && <Linha rotulo="Crediário" cor={K.ok}>{`${reais(livre)} livres`}</Linha>}
          {!!aniv && <Linha rotulo="Aniversário">{aniv}</Linha>}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Pressable testID="hub-cliente-trocar" onPress={() => setBuscando((v) => !v)} style={{ minHeight: 32, justifyContent: "center" }}>
            <Tx style={{ fontSize: 13, fontWeight: "600", color: K.acc, lineHeight: 18 }}>Trocar</Tx>
          </Pressable>
          <Pressable testID="hub-cliente-desfazer" disabled={mLigar.isPending} onPress={() => mLigar.mutate(null)} style={{ minHeight: 32, justifyContent: "center" }}>
            <Tx style={{ fontSize: 13, fontWeight: "600", color: K.ink3, lineHeight: 18 }}>Desfazer</Tx>
          </Pressable>
        </View>
        {busca}
      </View>
    );
  }

  return (
    <View testID="hub-cliente-sem" style={{ gap: 6 }}>
      <Meta>Cliente</Meta>
      <Tx style={{ fontSize: 18, fontWeight: "700", lineHeight: 24 }}>Ainda sem cadastro</Tx>
      <Tx style={{ fontSize: 14, color: K.ink2, lineHeight: 20 }}>
        {sugestaoServidor
          ? 'Toque em "É ela" na conversa e a compra, o crediário e o aniversário aparecem aqui.'
          : "Ligue a um cliente e a compra, o crediário e o aniversário aparecem aqui."}
      </Tx>
      <Pressable testID="hub-cliente-ligar" onPress={() => setBuscando((v) => !v)} style={{ minHeight: 36, justifyContent: "center", alignSelf: "flex-start" }}>
        <Tx style={{ fontSize: 14, fontWeight: "600", color: K.acc, lineHeight: 18 }}>Ligar a um cliente</Tx>
      </Pressable>
      {busca}
    </View>
  );
}
