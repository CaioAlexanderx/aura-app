// ============================================================
// Hub — "É ela": liga o número da conversa a um cadastro de Clientes da
// MESMA loja. Três estados:
//   - ligado: cartão do cliente (telefone, desde, última compra, aniversário)
//     com "Trocar" e "Desfazer";
//   - sugestão (mesmo telefone no cadastro): "Este número é da X?" com
//     "É ela" e "Não é";
//   - sem ligação: "Ligar a um cliente", que abre a busca.
// Depois de ligar, o servidor passa a devolver o nome do cadastro no lugar
// do nome do perfil (lista e thread). Multi-CNPJ: a busca é da loja aberta.
// ============================================================
import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { fmt } from "@/constants/helpers";
import { formatarTelefone } from "@/utils/telefone";
import { hubApi, type HubCliente } from "@/services/hubApi";

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

export function ClienteConversa({ companyId, convId, onChanged, onError }: {
  companyId: string; convId: string; onChanged: () => void; onError: (m: string) => void;
}) {
  const qc = useQueryClient();
  const [buscando, setBuscando] = useState(false);
  const [q, setQ] = useState("");
  const [recusada, setRecusada] = useState(false);

  const { data } = useQuery({
    queryKey: ["hub-cliente", companyId, convId],
    queryFn: () => hubApi.clienteDaConversa(companyId, convId),
  });
  const { data: achados } = useQuery({
    queryKey: ["hub-clientes-busca", companyId, q.trim()],
    queryFn: () => hubApi.buscarClientes(companyId, q.trim()),
    enabled: buscando && q.trim().length >= 2,
  });

  const mLigar = useMutation({
    mutationFn: (customerId: string | null) => hubApi.ligarCliente(companyId, convId, customerId),
    onSuccess: () => {
      setBuscando(false); setQ(""); setRecusada(false);
      qc.invalidateQueries({ queryKey: ["hub-cliente", companyId, convId] });
      onChanged();
    },
    onError: (e: any) => onError(e?.message || "Não foi possível ligar o cliente."),
  });

  const cliente = data?.cliente || null;
  const sugestao = !cliente && !recusada ? data?.sugestao || null : null;

  const busca = buscando && (
    <View testID="hub-cliente-busca" style={s.busca}>
      <TextInput testID="hub-cliente-busca-input" style={s.input} value={q} onChangeText={setQ}
        placeholder="Buscar cliente por nome, telefone ou e-mail" placeholderTextColor={Colors.ink3} autoFocus />
      {(achados?.clientes || []).map((c) => (
        <Pressable key={c.id} testID={`hub-cliente-achado-${c.id}`} style={s.achado}
          disabled={mLigar.isPending} onPress={() => mLigar.mutate(c.id)}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.achadoNome} numberOfLines={1}>{c.name}</Text>
            <Text style={s.achadoSub} numberOfLines={1}>{[formatarTelefone(c.phone), c.email].filter(Boolean).join(" · ") || "sem telefone"}</Text>
          </View>
          <Text style={s.acao}>É ela</Text>
        </Pressable>
      ))}
      {achados && achados.clientes.length === 0 && <Text style={s.vazio}>Nenhum cliente encontrado nesta loja.</Text>}
    </View>
  );

  if (cliente) {
    return (
      <View testID="hub-cliente" style={s.card}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={s.rotulo}>Cliente</Text>
          <Text testID="hub-cliente-nome" style={s.nome} numberOfLines={1}>{cliente.name}</Text>
          <Text style={s.sub}>
            {[
              formatarTelefone(cliente.phone),
              cliente.since ? `desde ${mesAno(cliente.since)}` : "",
              cliente.last_purchase_at ? `última compra ${new Date(cliente.last_purchase_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}` : "ainda sem compra",
              cliente.total_spent ? `${fmt(cliente.total_spent)} em compras` : "",
              diaMes(cliente.birth_date) ? `aniversário ${diaMes(cliente.birth_date)}` : "",
            ].filter(Boolean).join(" · ")}
          </Text>
          {busca}
        </View>
        <View style={s.acoes}>
          <Pressable testID="hub-cliente-trocar" onPress={() => setBuscando((v) => !v)}><Text style={s.link}>Trocar</Text></Pressable>
          <Pressable testID="hub-cliente-desfazer" disabled={mLigar.isPending} onPress={() => mLigar.mutate(null)}>
            <Text style={[s.link, { color: Colors.ink3 }]}>Desfazer</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (sugestao) {
    return (
      <View testID="hub-cliente-sugestao" style={s.card}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={s.pergunta}>
            Este número é da <Text style={s.nome}>{sugestao.name}</Text>?
          </Text>
          <Text style={s.sub}>Mesmo telefone do cadastro{sugestao.since ? `, cliente desde ${mesAno(sugestao.since)}` : ""}.</Text>
        </View>
        <View style={s.acoes}>
          <Pressable testID="hub-cliente-e-ela" disabled={mLigar.isPending} style={s.botao} onPress={() => mLigar.mutate(sugestao.id)}>
            <Text style={s.botaoText}>É ela</Text>
          </Pressable>
          <Pressable testID="hub-cliente-nao-e" onPress={() => setRecusada(true)}><Text style={[s.link, { color: Colors.ink3 }]}>Não é</Text></Pressable>
        </View>
      </View>
    );
  }

  return (
    <View testID="hub-cliente-sem" style={s.semCard}>
      <Text style={s.sub}>Ainda sem cadastro ligado.</Text>
      <Pressable testID="hub-cliente-ligar" onPress={() => setBuscando((v) => !v)}><Text style={s.link}>Ligar a um cliente</Text></Pressable>
      {busca}
    </View>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 10, marginTop: 8, backgroundColor: Colors.bg3, flexWrap: "wrap" },
  semCard: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" },
  rotulo: { fontSize: 10.5, fontWeight: "800", color: Colors.ink3, letterSpacing: 0.4, textTransform: "uppercase" },
  nome: { fontSize: 13.5, fontWeight: "800", color: Colors.ink },
  pergunta: { fontSize: 13, color: Colors.ink2 },
  sub: { fontSize: 11.5, color: Colors.ink3, lineHeight: 16 },
  acoes: { flexDirection: "row", alignItems: "center", gap: 12 },
  link: { fontSize: 12, fontWeight: "800", color: Colors.violet3 },
  acao: { fontSize: 12, fontWeight: "800", color: Colors.violet3 },
  botao: { backgroundColor: Colors.violet, borderRadius: 8, paddingHorizontal: 13, paddingVertical: 7 },
  botaoText: { color: "#fff", fontSize: 12.5, fontWeight: "700" },
  busca: { gap: 6, marginTop: 6, minWidth: 240 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8, fontSize: 13, color: Colors.ink, backgroundColor: Colors.bg2 },
  achado: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: Colors.border },
  achadoNome: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  achadoSub: { fontSize: 11.5, color: Colors.ink3 },
  vazio: { fontSize: 12, color: Colors.ink3 },
});
