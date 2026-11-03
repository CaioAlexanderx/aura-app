import { useMemo, useState } from "react";
import { WarrantyTermsEditor } from "./WarrantyTermsEditor";
import { View, Text, StyleSheet, Switch, ActivityIndicator, Pressable, TextInput, Platform } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { pdvSettingsApi, companiesApi, type PdvSettings } from "@/services/api";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { lerVendaSemEstoque } from "@/utils/vendaSemEstoque";
import { lerComandaEnabled } from "@/utils/comanda";
import { lerFreteEnabled } from "@/utils/frete";
import {
  lerValeTrocaLigado, marcarValeTrocaMigrado, formatarDiaBR,
  VALE_TROCA_VENDAS_DE, VALE_TROCA_VENDAS_ATE, VALE_TROCA_PRAZO_ATE,
} from "@/utils/valeTroca";
import { Card } from "@/components/screens/configuracoes/shared";
import { CardFeeSection, type CardFeePalette } from "@/components/screens/configuracoes/CardFeeSection";
import { CardPriceSection } from "@/components/screens/configuracoes/CardPriceSection";
import { FrenteDaLoja, nomeDaFrente } from "@/components/screens/configuracoes/FrenteDaLoja";
import { MiniaturaDesenhoEtiqueta } from "@/components/screens/configuracoes/MiniaturaDesenhoEtiqueta";
import { tourTarget } from "@/utils/tourTarget";
import { parsePercent, formatPercent } from "@/utils/parsePercent";
import { alvoDaSecao } from "@/utils/focoNaSecao";
import {
  LABEL_DESIGN_SIZES, LABEL_SIZE_KEYS, DEFAULT_LABEL_SIZE, LABEL_SIZE_PRESETS, labelDesignPadrao,
  type LabelDesign, type LabelSizeKey,
} from "@/components/screens/estoque/labels/buildLabelHtml";

// 18/10/2026 (card f1-16): desenho da etiqueta, opção da loja. Só muda o
// texto da etiqueta; tamanho, vão e código de barras são os mesmos.
const DESENHOS_DA_ETIQUETA: Array<{ key: LabelDesign; nome: string; hint: string }> = [
  { key: "classico", nome: "Clássico", hint: "Código de barras no meio, nome e preço embaixo" },
  { key: "editorial", nome: "Editorial", hint: "Loja no topo, nome inteiro do produto, preço em destaque e código no rodapé" },
];

// ============================================================
// AURA. — Configurações do Caixa (PDV) por empresa
//
// Toggles:
//   - Obrigar identificação do cliente em toda venda
//   - Obrigar identificação da vendedora em toda venda
//   - Ativar módulo de Abertura/Fechamento de Caixa
//   - Ativar Crediário (fiado por cliente) — 09/05/2026
//   - Modal de troco em venda dinheiro — 12/05/2026
//   - Vender sem estoque — 06/10/2026
//   - Taxa da maquininha (crédito/débito) — 17/08/2026
//   - Cobro mais no cartão (preço no cartão) — 22/09/2026
//   - Vale-troca no cupom (QR de fim de ano) — 13/10/2026; pdv_settings.
//     vale_troca_enabled (Aura-backend#813), o mesmo caminho dos outros
//     toggles (ver utils/valeTroca.ts)
//   - Restaurante (Fase 7): NFC-e manual, comanda auto-print, taxa servico
//
// Persistido em companies.pdv_settings (jsonb).
// ============================================================

// Paleta do shell varejo pra CardFeeSection — mesmas cores que o bloco
// inline usava antes da extracao (Switch violeta, hints ink4).
const CARD_FEE_PALETTE: CardFeePalette = {
  label:       Colors.ink,
  desc:        Colors.ink3,
  // 23/09/2026 (QA em produção): Colors.ink4 não existe em constants/
  // colors.ts (só ink/ink2/ink3) — o hint, o rodapé e o placeholder
  // caíam pra undefined e renderizavam com a cor padrão do texto,
  // quase ilegível contra o fundo do card. ink3 é o secundário de
  // verdade do tema, já legível em claro e escuro.
  hint:        Colors.ink3,
  trackOff:    Colors.bg4,
  trackOn:     Colors.violet + "66",
  thumbOff:    Colors.ink3,
  thumbOn:     Colors.violet,
  inputBg:     Colors.bg3,
  inputBorder: Colors.border,
  inputText:   Colors.ink,
  boxBorder:   Colors.border2,
};

// 05/10/2026 (frente da empresa): Materiais de construção, Ótica e Ordem de
// Serviço deixam de ser switches do cliente — a frente é escolhida no
// cadastro. 07/10/2026 (decisão do fundador): o cliente troca a própria
// frente aqui, pela seta da linha "Sua frente" (FrenteDaLoja). Staff
// (is_staff, suporte) continua alternando as flags nos switches abaixo.
export { nomeDaFrente };

export function PdvSettingsCard() {
  const { company, isStaff } = useAuthStore();
  const { settings: serverSettings, isLoading, invalidate } = usePdvSettings();
  const [pendingSettings, setPendingSettings] = useState<PdvSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [feeInput, setFeeInput] = useState<string | null>(null);

  // Usa pendingSettings durante save (optimistic), senao usa o do server
  const display = pendingSettings || serverSettings;
  // 13/10/2026: vale-troca no cupom (padrão ligado), de pdv_settings.
  const valeTrocaLigado = lerValeTrocaLigado(company?.id, display);
  const isFoodVertical = (company as any)?.vertical_active === "food";

  // 22/09/2026 (preço no cartão): "342 produtos seguem os 11% · 18 com preço
  // no cartão ajustado à mão". Mesma chave do useProducts (cache
  // compartilhado com o Estoque) e só busca com a opção ligada — desligada,
  // esta tela não faz requisição nenhuma a mais.
  // 25/09/2026 (decisão do Caio): o recurso é só de lojas Matcon — sem
  // matcon_enabled a opção não existe, mesmo com card_price_enabled salvo.
  const cartaoLigado = display.card_price_enabled === true && display.matcon_enabled === true;
  const { data: produtosData } = useQuery({
    queryKey: ["products", company?.id],
    queryFn: () => companiesApi.products(company!.id),
    enabled: !!company?.id && cartaoLigado,
    staleTime: 30000,
  });
  const contagemDoCartao = useMemo(() => {
    const arr: any = (produtosData as any)?.products || (produtosData as any)?.rows || produtosData;
    if (!Array.isArray(arr)) return null;
    let manual = 0;
    arr.forEach((p: any) => { const c = parseFloat(p?.card_price); if (isFinite(c) && c > 0) manual++; });
    return { auto: arr.length - manual, manual };
  }, [produtosData]);

  // Desenho da etiqueta: a escolha salva ou, sem escolha (null), o padrão do
  // modelo da loja — o que ela imprime hoje.
  const rawSize = (display as any).label_size;
  const modeloDaLoja: LabelSizeKey = (LABEL_SIZE_KEYS as string[]).indexOf(rawSize) >= 0 ? rawSize : DEFAULT_LABEL_SIZE;
  const desenhoAtivo: LabelDesign = display.label_design === "classico" || display.label_design === "editorial"
    ? display.label_design
    : labelDesignPadrao(modeloDaLoja);
  const modeloAceitaDesenho = LABEL_DESIGN_SIZES.indexOf(modeloDaLoja) >= 0;

  async function toggle(key: keyof PdvSettings, value: boolean | number | string) {
    if (!company?.id || saving) return;
    const next: PdvSettings = { ...display, [key]: value } as PdvSettings;
    setPendingSettings(next);
    setSaving(true);
    try {
      await pdvSettingsApi.save(company.id, next);
      // O servidor passou a ser a fonte: o valor antigo do navegador não conta mais.
      if (key === "vale_troca_enabled") marcarValeTrocaMigrado(company.id);
      invalidate();
      setPendingSettings(null);
    } catch (err: any) {
      setPendingSettings(null);
      toast.error(err?.data?.error || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <View style={s.loadingBox}>
          <ActivityIndicator color={Colors.violet3} size="small" />
          <Text style={s.loadingText}>Carregando configurações...</Text>
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <View style={s.header}>
        <View style={s.iconBox}>
          <Icon name="cart" size={16} color={Colors.violet3} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Políticas do Caixa</Text>
          <Text style={s.desc}>Defina o que é obrigatório em cada venda e quais funcionalidades sua loja usa</Text>
        </View>
      </View>

      {/* Toggle: identificar cliente */}
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowLabel}>Identificar cliente</Text>
          <Text style={s.rowDesc}>Bloqueia finalizar venda sem selecionar cliente</Text>
        </View>
        <Switch
          value={display.require_customer}
          onValueChange={function(v) { toggle("require_customer", v); }}
          trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
          thumbColor={display.require_customer ? Colors.violet : Colors.ink3}
          disabled={saving}
        />
      </View>

      <View style={s.divider} />

      {/* Toggle: identificar vendedora */}
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowLabel}>Identificar vendedora</Text>
          <Text style={s.rowDesc}>Bloqueia finalizar venda sem informar quem vendeu</Text>
        </View>
        <Switch
          value={display.require_seller}
          onValueChange={function(v) { toggle("require_seller", v); }}
          trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
          thumbColor={display.require_seller ? Colors.violet : Colors.ink3}
          disabled={saving}
        />
      </View>

      <View style={s.divider} />

      {/* Toggle: módulo de caixa */}
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowLabel}>Módulo de caixa</Text>
          <Text style={s.rowDesc}>Habilita abertura e fechamento de caixa por turno</Text>
        </View>
        <Switch
          value={display.caixa_enabled}
          onValueChange={function(v) { toggle("caixa_enabled", v); }}
          trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
          thumbColor={display.caixa_enabled ? Colors.violet : Colors.ink3}
          disabled={saving}
        />
      </View>

      {/* Link para a tela de caixa — visivel apenas quando habilitado */}
      {display.caixa_enabled && (
        <Pressable onPress={function() { router.push("/caixa"); }} style={s.caixaLink}>
          <Icon name="receipt" size={14} color={Colors.violet3} />
          <Text style={s.caixaLinkText}>Gerenciar caixa</Text>
          <Icon name="chevron_right" size={14} color={Colors.ink3} />
        </Pressable>
      )}

      <View style={s.divider} />

      {/* 12/05/2026: Toggle modal de troco em venda dinheiro */}
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowLabel}>Calculadora de troco</Text>
          <Text style={s.rowDesc}>Ao finalizar uma venda em dinheiro, abre uma conta do troco, também quando só uma parte da venda é paga em dinheiro</Text>
        </View>
        <Switch
          value={display.cash_tender_modal_enabled !== false}
          onValueChange={function(v) { toggle("cash_tender_modal_enabled", v); }}
          trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
          thumbColor={display.cash_tender_modal_enabled !== false ? Colors.violet : Colors.ink3}
          disabled={saving}
        />
      </View>

      <View style={s.divider} />

      {/* 06/10/2026: Toggle vender sem estoque */}
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowLabel}>Vender sem estoque</Text>
          <Text style={s.rowDesc}>Permite vender produto com o estoque zerado. O estoque não fica negativo: continua em zero até você lançar a quantidade</Text>
        </View>
        <Switch
          testID="toggle-vender-sem-estoque"
          value={lerVendaSemEstoque(display)}
          onValueChange={function(v) { toggle("allow_sale_without_stock", v); }}
          trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
          thumbColor={lerVendaSemEstoque(display) ? Colors.violet : Colors.ink3}
          disabled={saving}
        />
      </View>

      <View style={s.divider} />

      {/* 13/10/2026: Vale-troca no cupom (QR de fim de ano). Só imprime nas
          vendas do período; o switch só desliga o bloco. */}
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowLabel}>Vale-troca no cupom</Text>
          <Text style={s.rowDesc}>
            {"Nas vendas de " + formatarDiaBR(VALE_TROCA_VENDAS_DE) + " a " + formatarDiaBR(VALE_TROCA_VENDAS_ATE) +
              ", o cupom sai com um QR. Quem ganhou o presente troca até " + formatarDiaBR(VALE_TROCA_PRAZO_ATE) +
              " sem o comprador: você bipa o QR no Caixa e a troca abre com a venda carregada. Vale para todos os computadores da loja."}
          </Text>
        </View>
        <Switch
          testID="toggle-vale-troca"
          value={valeTrocaLigado}
          onValueChange={function(v) { toggle("vale_troca_enabled", v); }}
          trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
          thumbColor={valeTrocaLigado ? Colors.violet : Colors.ink3}
          disabled={saving}
        />
      </View>

      <View style={s.divider} />

      {/* 09/10/2026: Comandas (bar, adega, lanchonete) */}
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowLabel}>Comandas</Text>
          <Text style={s.rowDesc}>Lança o consumo no número da comanda e cobra tudo no fim. No Caixa aparecem "Adicionar à comanda" e "Comandas", com as abertas (no lugar de Orçamento; com o Matcon ligado o Orçamento fica e as comandas viram o atalho ao lado de "Adicionar à comanda")</Text>
        </View>
        <Switch
          testID="toggle-comandas"
          value={lerComandaEnabled(display)}
          onValueChange={function(v) { toggle("comanda_enabled", v); }}
          trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
          thumbColor={lerComandaEnabled(display) ? Colors.violet : Colors.ink3}
          disabled={saving}
        />
      </View>

      <View style={s.divider} />

      {/* 30/10/2026: Frete / entrega (mockup docs/mockups/frete-no-caixa.html) */}
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowLabel}>Frete / entrega</Text>
          <Text style={s.rowDesc}>Cobra a entrega na própria venda. No Caixa aparece o atalho "Frete": o operador digita o valor e pode vincular a venda a um cliente. O desconto vale só sobre os produtos</Text>
        </View>
        <Switch
          testID="toggle-frete"
          value={lerFreteEnabled(display)}
          onValueChange={function(v) { toggle("frete_enabled", v); }}
          trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
          thumbColor={lerFreteEnabled(display) ? Colors.violet : Colors.ink3}
          disabled={saving}
        />
      </View>

      <View style={s.divider} />

      {/* 09/05/2026: Toggle Crediário (fiado) */}
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowLabel}>Crediário (fiado)</Text>
          <Text style={s.rowDesc}>Permite vender no fiado e registrar pagamento posterior pelo cadastro do cliente</Text>
        </View>
        <Switch
          value={display.crediario_enabled}
          onValueChange={function(v) { toggle("crediario_enabled", v); }}
          trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
          thumbColor={display.crediario_enabled ? Colors.violet : Colors.ink3}
          disabled={saving}
        />
      </View>

      {/* Link para a lista de saldos — visivel apenas quando habilitado */}
      {display.crediario_enabled && (
        <Pressable onPress={function() { router.push("/clientes?tab=crediario" as any); }} style={s.caixaLink}>
          <Icon name="users" size={14} color={Colors.violet3} />
          <Text style={s.caixaLinkText}>Ver clientes com saldo</Text>
          <Icon name="chevron_right" size={14} color={Colors.ink3} />
        </Pressable>
      )}

      <View style={s.divider} />

      {/* 31/08/2026: Ordem de Servico (migration 313). Opt-in deliberado —
          nem toda loja emite OS; desligado, o modulo inteiro fica invisivel.
          A OS nasce na ENTRADA do equipamento (antes da venda) e so encosta
          numa venda ao ser entregue — ver CONTRACT_ORDEM_DE_SERVICO.md. */}
      {/* Frente: o dono/admin troca pela seta; os switches abaixo só pra staff. */}
      <FrenteDaLoja display={display} onChanged={invalidate} />

      {isStaff && (
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowLabel}>Ordem de Serviço</Text>
          <Text style={s.rowDesc}>Registre a entrada de equipamentos para conserto: defeito, orçamento, prazo e garantia, com impressão em A4 com a sua marca</Text>
        </View>
        <Switch
          value={display.os_enabled === true}
          onValueChange={function(v) { toggle("os_enabled", v); }}
          trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
          thumbColor={display.os_enabled === true ? Colors.violet : Colors.ink3}
          disabled={saving}
          testID="pdv-settings-os"
        />
      </View>
      )}

      {/* Link para a lista de OS — visivel apenas quando habilitado */}
      {display.os_enabled === true && (
        <Pressable onPress={function() { router.push("/os" as any); }} style={s.caixaLink}>
          <Icon name="tool" size={14} color={Colors.violet3} />
          <Text style={s.caixaLinkText}>Ver ordens de serviço</Text>
          <Icon name="chevron_right" size={14} color={Colors.ink3} />
        </Pressable>
      )}
      {/* Garantia de produto (extensão da OS): modelo dos termos impressos */}
      {display.os_enabled === true && <WarrantyTermsEditor />}

      {/* 15/09/2026: Otica (migration 334). Semi-vertical sobre o shell
          Negocio, opt-in como a OS: ligada, aparece a secao "Otica" no menu
          (Laboratorio e Receitas). Nao depende do toggle de OS acima — a
          OS de oculos e um tipo proprio (kind='otica') com etapa de
          laboratorio e sinal na abertura. */}
      {isStaff && (
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowLabel}>Ótica</Text>
          <Text style={s.rowDesc}>Receituário do cliente, OS de óculos com etapa de laboratório, sinal na abertura e aviso de "óculos prontos" pelo WhatsApp</Text>
        </View>
        <Switch
          value={display.otica_enabled === true}
          onValueChange={function(v) { toggle("otica_enabled", v); }}
          trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
          thumbColor={display.otica_enabled === true ? Colors.violet : Colors.ink3}
          disabled={saving}
          testID="pdv-settings-otica"
        />
      </View>
      )}

      {display.otica_enabled === true && (
        <>
          <Pressable onPress={function() { router.push("/otica" as any); }} style={s.caixaLink}>
            <Icon name="glasses" size={14} color={Colors.violet3} />
            <Text style={s.caixaLinkText}>Abrir o laboratório</Text>
            <Icon name="chevron_right" size={14} color={Colors.ink3} />
          </Pressable>
          <Pressable onPress={function() { router.push("/otica/config" as any); }} style={s.caixaLink}>
            <Icon name="settings" size={14} color={Colors.violet3} />
            <Text style={s.caixaLinkText}>Laboratórios, validade da receita e garantia</Text>
            <Icon name="chevron_right" size={14} color={Colors.ink3} />
          </Pressable>
        </>
      )}

      {/* 22/09/2026: Matcon (materiais de construção), migration ainda a
          definir no backend — ver docs/CONTRACT_MATCON.md. Mesmo desenho de
          opt-in da Ótica acima: ligado, aparecem unidades fracionadas
          (m, m², sc...) no Estoque/Carrinho e a linha de config abaixo.
          M0 (docs/matcon-faseamento-po-ux.md) só traz este toggle + link —
          "/matcon/config" ainda não existe, chega no próximo PR (M0
          front, telas).
          22/09/2026: a descrição só promete o que o M0 entrega (regra do
          produto, §4b do doc — a tela não vende o que não existe). Ela
          cresce a cada fase: M1 acrescenta "orçamento que vira pedido,
          entrega parcial"; M3 acrescenta "profissionais parceiros". */}
      {isStaff && (
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowLabel}>Materiais de construção</Text>
          {/* 23/09/2026 (QA final Matcon): "estoque fracionado e conversão
              de caixa para m²" era jargão. Agora diz, na língua do lojista,
              o que vale em todos os planos (orçamentos, entregas, compras e
              parceiros são do Negócio e não entram aqui — premissa do
              Essencial sem promessa do que o plano não tem). */}
          <Text style={s.rowDesc}>Venda por metro, m², saco e milheiro, e a conta de quantas caixas de piso o cliente leva</Text>
        </View>
        <Switch
          value={display.matcon_enabled === true}
          onValueChange={function(v) { toggle("matcon_enabled", v); }}
          trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
          thumbColor={display.matcon_enabled === true ? Colors.violet : Colors.ink3}
          disabled={saving}
          testID="pdv-settings-matcon"
        />
      </View>
      )}

      {display.matcon_enabled === true && (
        // 22/09/2026: "/matcon/config" ainda não existe — nasce no PR de M0
        // que traz as telas (unidades habilitadas, perda padrão, arredondar
        // pra embalagem, prazo de entrega padrão). Link já fica pronto.
        <Pressable onPress={function() { router.push("/matcon/config" as any); }} style={s.caixaLink}>
          <Icon name="settings" size={14} color={Colors.violet3} />
          <Text style={s.caixaLinkText}>Unidades, entrega e parceiros</Text>
          <Icon name="chevron_right" size={14} color={Colors.ink3} />
        </Pressable>
      )}

      <View style={s.divider} />

      {/* 17/08/2026: Taxa da maquininha.
          NAO e gated por vertical de proposito — vale pro shell Negocio e
          pro shell Studio. Ligada, toda venda no cartao lanca sozinha a
          despesa do que a adquirente retem, com aliquotas SEPARADAS de
          credito e debito. A receita bruta fica intacta: a taxa e uma
          despesa a parte, na data da venda (competencia, nao repasse).
          18/08/2026: secao extraida pra CardFeeSection — o Studio renderiza
          a mesma secao com tokens proprios em app/studio/(estudio)/configuracoes. */}
      {/* 18/10/2026 (card f1-16): desenho da etiqueta (pdv_settings.
          label_design). Sem escolha = padrão do modelo; vale em todos os
          computadores da loja. */}
      {/* 18/10/2026 (card p-36): miniatura de cada desenho, e o texto diz
          primeiro a quais modelos a escolha vale (LABEL_DESIGN_SIZES:
          99x21 e 105x21, ambos 33x21, e 30x25). A aba Etiquetas do Estoque
          traz "Desenho: ... · mudar", que abre esta seção pelo foco
          (/configuracoes?foco=desenho-etiqueta, utils/focoNaSecao). */}
      <Text style={s.groupHeader}>Etiquetas</Text>
      <View style={s.rowCol} {...tourTarget(alvoDaSecao("desenho-etiqueta"))}>
        <Text style={s.rowLabel}>Desenho da etiqueta</Text>
        <Text style={s.rowDescForte} testID="desenho-etiqueta-modelos">Vale para as etiquetas 33x21mm (com ou sem vão) e 30x25mm.</Text>
        <Text style={s.rowDesc}>
          {"As de 40x25mm, a bobina 58mm e a Minha medida têm desenho fixo. O tamanho e o código de barras não mudam. A escolha vale em todos os computadores da loja." +
            (modeloAceitaDesenho ? "" : " O seu modelo (" + LABEL_SIZE_PRESETS[modeloDaLoja].uiLabel + ") continua com o desenho de hoje.")}
        </Text>
        <View style={s.chips}>
          {DESENHOS_DA_ETIQUETA.map(function(d) {
            const ativo = desenhoAtivo === d.key;
            return (
              <Pressable
                key={d.key}
                testID={"desenho-etiqueta-" + d.key}
                accessibilityRole="radio"
                accessibilityState={{ selected: ativo, disabled: saving }}
                disabled={saving}
                onPress={function() { if (display.label_design !== d.key) toggle("label_design", d.key); }}
                style={[s.chip, ativo && s.chipOn]}
              >
                <View style={s.chipCorpo}>
                  <MiniaturaDesenhoEtiqueta desenho={d.key} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[s.chipNome, ativo && s.chipNomeOn]}>{d.nome}</Text>
                    <Text style={s.chipHint}>{d.hint}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={s.divider} />

      <Text style={s.groupHeader}>Cartão</Text>
      <CardFeeSection display={display} saving={saving} onToggle={toggle} palette={CARD_FEE_PALETTE} />

      {/* 22/09/2026: preço no cartão (docs/mockups/preco-no-cartao.html,
          tela 1). Mora junto da taxa da maquininha, no quadro "Cartão" —
          uma não liga a outra. Desligada = só esta linha.
          25/09/2026 (decisão do Caio): "Cobro mais no cartão" é só de lojas
          com Matcon ligado — sem Matcon a seção não aparece. */}
      {display.matcon_enabled === true && (
        <CardPriceSection
          display={display}
          saving={saving}
          onToggle={toggle}
          palette={CARD_FEE_PALETTE}
          contagem={cartaoLigado ? contagemDoCartao : null}
        />
      )}

      {/* Fase 7 (Restaurante): so aparece se vertical_active === "food" */}
      {isFoodVertical && (
        <>
          <View style={s.restaurantHeader}>
            <Text style={s.restaurantHeaderText}>🍽️  RESTAURANTE</Text>
          </View>

          {/* NFC-e manual */}
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>Emitir NFC-e ao fechar mesa</Text>
              <Text style={s.rowDesc}>Mostra um botão no fechamento da mesa pra gerar cupom fiscal (NFC-e). Recurso do plano Negócio+.</Text>
            </View>
            <Switch
              value={display.food_nfce_manual_enabled === true}
              onValueChange={function(v) { toggle("food_nfce_manual_enabled", v); }}
              trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
              thumbColor={display.food_nfce_manual_enabled === true ? Colors.violet : Colors.ink3}
              disabled={saving}
            />
          </View>

          <View style={s.divider} />

          {/* Comanda auto-print */}
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>Imprimir comanda automaticamente</Text>
              <Text style={s.rowDesc}>Ao confirmar um pedido, manda a comanda 80mm pra impressora da cozinha (apenas no navegador desktop).</Text>
            </View>
            <Switch
              value={display.food_comanda_print_enabled === true}
              onValueChange={function(v) { toggle("food_comanda_print_enabled", v); }}
              trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
              thumbColor={display.food_comanda_print_enabled === true ? Colors.violet : Colors.ink3}
              disabled={saving}
            />
          </View>

          {Platform.OS !== "web" && display.food_comanda_print_enabled && (
            <View style={s.warnBox}>
              <Icon name="info" size={11} color={Colors.amber} />
              <Text style={s.warnText}>Auto-impressão só funciona no navegador desktop. No iPad/celular, gerencie comandas manualmente pelo KDS.</Text>
            </View>
          )}

          <View style={s.divider} />

          {/* Taxa de servico (food_service_fee_pct — campo dedicado food, separado do service_fee_pct legacy) */}
          <View style={[s.row, { alignItems: "flex-start" }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>Taxa de serviço padrão</Text>
              <Text style={s.rowDesc}>Sugestão de gorjeta calculada sobre o subtotal da comanda. 0 = desativada. Aparece como linha separada no fechamento (fora da NFC-e).</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
                <TextInput
                  value={feeInput ?? formatPercent(display.food_service_fee_pct)}
                  onChangeText={setFeeInput}
                  onBlur={() => {
                    if (feeInput === null) return;
                    const n = parsePercent(feeInput, 30);
                    setFeeInput(null);
                    if (n !== Number(display.food_service_fee_pct || 0)) {
                      toggle("food_service_fee_pct" as keyof PdvSettings, n);
                    }
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={Colors.ink4}
                  style={s.feeInput}
                />
                <Text style={{ color: Colors.ink3, fontSize: 13, fontWeight: "700" }}>%</Text>
                <Text style={{ color: Colors.ink4, fontSize: 11, marginLeft: 4 }}>(0–30)</Text>
              </View>
            </View>
          </View>
        </>
      )}

      {saving && (
        <View style={s.savingHint}>
          <ActivityIndicator color={Colors.violet3} size="small" />
          <Text style={s.savingText}>Salvando...</Text>
        </View>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  loadingBox:  { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  loadingText: { fontSize: 12, color: Colors.ink3 },
  header:      { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 12, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconBox:     { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border2 },
  title:       { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  desc:        { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  row:         { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  rowLabel:    { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  rowDesc:     { fontSize: 11, color: Colors.ink3, marginTop: 2, lineHeight: 15 },
  divider:     { height: 1, backgroundColor: Colors.border, marginVertical: 2 },
  rowCol:      { paddingVertical: 10 },
  chips:       { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip:        { flexGrow: 1, flexBasis: 200, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3 },
  chipOn:      { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  chipNome:    { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  chipNomeOn:  { color: Colors.violet3 },
  chipHint:    { fontSize: 11, color: Colors.ink3, marginTop: 3, lineHeight: 15 },
  chipCorpo:   { flexDirection: "row", alignItems: "center", gap: 10 },
  rowDescForte:{ fontSize: 12, color: Colors.ink, fontWeight: "600", marginTop: 2, lineHeight: 16 },
  groupHeader: { fontSize: 10, color: Colors.ink3, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", marginTop: 6 },
  caixaLink:   {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginTop: 10, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  caixaLinkText: { flex: 1, fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  savingHint:  { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  savingText:  { fontSize: 11, color: Colors.ink3 },
  // Fase 7 — Restaurante
  restaurantHeader: {
    marginTop: 12, marginBottom: 6,
    paddingTop: 12, paddingBottom: 6,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  restaurantHeaderText: {
    fontSize: 10, color: Colors.red, fontWeight: "800",
    letterSpacing: 1,
  },
  feeInput: {
    backgroundColor: Colors.bg3, color: Colors.ink,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
    borderWidth: 1, borderColor: Colors.border,
    fontSize: 14, fontWeight: "700", minWidth: 80, textAlign: "center",
  },
  warnBox: {
    flexDirection: "row", gap: 6, alignItems: "flex-start",
    backgroundColor: Colors.amberD || "rgba(245,158,11,0.1)", padding: 8, borderRadius: 6,
    borderLeftWidth: 2, borderLeftColor: Colors.amber, marginTop: 4,
  },
  warnText: { fontSize: 10, color: Colors.amber, flex: 1, lineHeight: 14 },
});

export default PdvSettingsCard;
