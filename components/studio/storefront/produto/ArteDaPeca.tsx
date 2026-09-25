// ============================================================
// components/studio/storefront/produto/ArteDaPeca.tsx
//
// A seção "Como você quer resolver a arte?" da página nova (Telas 3 e
// 4): os três caminhos como cartões com preço, o briefing nos pagos, e
// "A arte em cada lado" com as abas Frente · Verso · Meio — as MESMAS
// abas que ficam em cima do mockup (o lado é um só, da página).
//
// Regras mantidas, só com outro desenho:
//   - os três caminhos saem do config (FieldArtService), com os textos
//     de artService.ts (choiceHint, priceLabel, briefingFor);
//   - "Criem a arte pra mim" dispensa e LIMPA o envio (Agente J, no
//     ProductConfigurator) — e, como no mockup, a arte pronta também;
//   - arquivo OU arte pronta, um basta (S0); a arte pronta só aparece no
//     caminho "pronta" e sem arquivo;
//   - verso e meio com opt-in cobrado quando a lojista cobra;
//   - texto com a cor da arte na chave lateral `<campo>_cor` (FieldText).
// ============================================================
import { Platform, Pressable, TextInput, View } from "react-native";
import type { CustomizationConfig, CustomizationField, StudioStoreProduct } from "../types";
import { useTemaDaVitrine } from "../TemaDaVitrine";
import { Texto, Numero } from "../TipografiaVitrine";
import { contraste, wash } from "../theme";
import { Icon } from "@/components/Icon";
import { dinheiro } from "../moeda";
import { FieldOption } from "../fields/FieldOption";
import { FieldColor } from "../fields/FieldColor";
import {
  ART_ADJUST, ART_DESIGNER, ART_NONE, ART_SERVICE_BRIEF_ID, briefingFor, choiceHint, priceLabel,
} from "@/components/studio/artService";
import {
  camposDoLado, origensDoLado, ladoPreenchido, nomeDoLado,
  type Lado, type NomeDaPeca,
} from "./regrasDaPagina";
import { EnvioDaArte, type EstadoDoEnvio } from "./EnvioDaArte";
import { PilulaDePreco, Rotulo, borda2, transicao } from "./kitDaPagina";

const NOME_DO_LADO: Record<Lado, string> = { front: "Frente", back: "Verso", middle: "Meio" };
const ICONE_DO_CAMINHO: Record<string, string> = { [ART_NONE]: "upload", [ART_ADJUST]: "edit", [ART_DESIGNER]: "sparkles" };

/** Os três caminhos (Tela 3). */
export function CaminhosDaArte({
  campo, valor, brief, desktop, onEscolher, onBrief,
}: {
  campo: CustomizationField;
  /** O caminho escolhido; sem escolha, "pronta" aparece marcado (é o incluso). */
  valor: string;
  brief: string;
  desktop: boolean;
  onEscolher: (v: string) => void;
  onBrief: (v: string) => void;
}) {
  const t = useTemaDaVitrine();
  const choices: Array<{ value: string; label: string; price_delta?: number }> = campo.config?.choices || [];
  const b = briefingFor(valor);
  return (
    <View style={{ gap: 10 }}>
      <View accessibilityRole="radiogroup" accessibilityLabel="Como resolver a arte" style={{ gap: 10 }}>
        {choices.map((c) => {
          const sel = valor === c.value;
          const etiqueta = priceLabel(c.price_delta);
          const dica = choiceHint(c.value);
          return (
            <Pressable
              key={c.value}
              onPress={() => onEscolher(c.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: sel }}
              accessibilityLabel={c.label + (etiqueta ? ", " + etiqueta : ", incluso")}
              style={({ hovered }: any) => [
                {
                  flexDirection: "row", alignItems: "center", gap: 12, minHeight: 68,
                  paddingVertical: 13, paddingHorizontal: 14, borderRadius: 14,
                  borderWidth: sel ? 2 : 1,
                  borderColor: sel ? t.marcaTexto : hovered ? t.ink3 : borda2(t),
                  backgroundColor: sel ? t.marcaWash : t.bg2,
                  margin: sel ? 0 : 1,
                },
                transicao("border-color, background-color"),
              ]}
            >
              <View style={{ width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: sel ? t.marcaFill : t.bg3 }}>
                <Icon name={(ICONE_DO_CAMINHO[c.value] || "image") as any} size={20} color={sel ? t.sobreMarca : t.ink2} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Texto style={{ fontSize: 14.5, fontWeight: "600", lineHeight: 19, color: t.ink }}>{c.label}</Texto>
                {dica && (desktop || sel) ? <Texto style={{ fontSize: 12.5, lineHeight: 17, color: t.ink3 }}>{dica}</Texto> : null}
              </View>
              <PilulaDePreco texto={etiqueta || "Incluso"} gratis={!etiqueta} />
            </Pressable>
          );
        })}
      </View>
      {b ? (
        <View style={{ marginTop: 4, gap: 6 }}>
          <Texto style={{ fontSize: 13, fontWeight: "600", color: t.ink2 }}>{b.title}</Texto>
          <Texto style={{ fontSize: 12.5, color: t.ink3 }}>{b.hint}</Texto>
          <TextInput
            multiline
            numberOfLines={4}
            value={brief}
            onChangeText={(v) => onBrief(v.slice(0, 600))}
            maxLength={600}
            placeholder={b.placeholder}
            placeholderTextColor={t.ink4}
            accessibilityLabel={b.title}
            style={[{
              minHeight: 108, borderRadius: 12, borderWidth: 1, borderColor: borda2(t), backgroundColor: t.bg2,
              paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, lineHeight: 22, color: t.ink, textAlignVertical: "top",
            }, Platform.OS === "web" ? ({ outlineStyle: "none", resize: "vertical" } as any) : null]}
          />
          <Numero style={{ alignSelf: "flex-end", fontSize: 11.5, color: t.ink3 }}>{brief.length}/600</Numero>
        </View>
      ) : null}
    </View>
  );
}

/** As artes prontas (galeria de templates), como na Tela 3. */
export function ArtesProntas({
  templates, valor, onEscolher,
}: {
  templates: StudioStoreProduct["templates"];
  valor: any;
  onEscolher: (url: string) => void;
}) {
  const t = useTemaDaVitrine();
  if (!templates?.length) return null;
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Artes prontas" style={{ flexDirection: "row", flexWrap: Platform.OS === "web" ? "nowrap" : "wrap", gap: 10, ...(Platform.OS === "web" ? ({ overflowX: "auto" } as any) : null) }}>
      {templates.map((tp) => {
        const sel = valor === tp.image_url;
        return (
          <Pressable
            key={tp.id}
            onPress={() => onEscolher(sel ? "" : tp.image_url)}
            accessibilityRole="radio"
            accessibilityState={{ checked: sel }}
            accessibilityLabel={tp.name}
            style={{ width: 78, alignItems: "center", gap: 6 }}
          >
            <View style={{
              width: 78, height: 78, borderRadius: 12, overflow: "hidden", backgroundColor: t.bg2,
              borderWidth: sel ? 2 : 1, borderColor: sel ? t.marcaTexto : t.border, alignItems: "center", justifyContent: "center",
            }}>
              {Platform.OS === "web" ? (
                // @ts-ignore — img nativo no web, como no FieldTemplate
                <img src={tp.thumb_url || tp.image_url} alt="" style={{ width: "80%", height: "80%", objectFit: "contain" }} />
              ) : null}
            </View>
            <Texto numberOfLines={1} style={{ fontSize: 12, color: sel ? t.ink : t.ink2, fontWeight: sel ? "600" : "400" }}>{tp.name}</Texto>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * O campo de texto da página nova (Tela 4): contador dentro do campo e a
 * cor da arte em bolinhas. Regra do FieldText: `max_chars` (30 quando a
 * lojista não disse), a paleta só com hex válido, e a cor na chave
 * `<campo>_cor`. Novo: a frase de quando a cor some na peça (contraste
 * abaixo de 1,8:1 com a cor escolhida da peça).
 */
export function CampoDeTexto({
  field, value, cor, corDaPeca, lado, onChange, onCor, destacar,
}: {
  field: CustomizationField;
  value: any;
  cor?: string;
  corDaPeca?: string | null;
  lado: Lado;
  onChange: (v: string) => void;
  onCor: (c: string) => void;
  destacar?: boolean;
}) {
  const t = useTemaDaVitrine();
  const maxChars = field.config?.max_chars || 30;
  const paleta: string[] = (field.config?.colors || []).filter((c: any) => typeof c === "string" && /^#[0-9A-Fa-f]{3,8}$/.test(c.trim()));
  const corAtual = cor || paleta[0];
  const texto = String(value || "");
  const quaseSome = !!(corDaPeca && corAtual && /^#/.test(corDaPeca) && contraste(corDaPeca, corAtual) < 1.8);
  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 6 }}>
        <Texto style={{ fontSize: 13, fontWeight: "600", color: t.ink2 }}>
          {field.label}{field.required ? "" : <Texto style={{ fontWeight: "400", color: t.ink3 }}> (opcional)</Texto>}
        </Texto>
        <View style={{ position: "relative", justifyContent: "center" }}>
          <TextInput
            value={texto}
            onChangeText={(v) => onChange(v.slice(0, maxChars))}
            maxLength={maxChars}
            placeholder={lado === "front" ? "Ex.: Te amo, mãe" : lado === "back" ? "Ex.: Com amor, Helena" : "Ex.: Bom dia"}
            placeholderTextColor={t.ink4}
            accessibilityLabel={field.label}
            autoComplete="off"
            style={[{
              height: 48, borderRadius: 12, borderWidth: 1, backgroundColor: t.bg2,
              borderColor: destacar ? t.amber : borda2(t),
              paddingLeft: 14, paddingRight: 62, fontSize: 15, color: t.ink,
            }, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null,
              destacar && Platform.OS === "web" ? ({ boxShadow: `0 0 0 5px ${wash(t.amber, 0.14)}` } as any) : null,
              transicao("border-color, box-shadow", 300)]}
          />
          <View pointerEvents="none" style={{ position: "absolute", right: 14 }}>
            <Numero style={{ fontSize: 11.5, color: t.ink3 }}>{texto.length}/{maxChars}</Numero>
          </View>
        </View>
      </View>
      {paleta.length > 1 ? (
        <View style={{ gap: 6 }}>
          <Texto style={{ fontSize: 13, fontWeight: "600", color: t.ink2 }}>Cor da arte</Texto>
          <View accessibilityRole="radiogroup" accessibilityLabel="Cor da arte" style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 }}>
            {paleta.map((c) => {
              const sel = c.toLowerCase() === String(corAtual || "").toLowerCase();
              return (
                <Pressable key={c} onPress={() => onCor(c)} accessibilityRole="radio" accessibilityState={{ checked: sel }} accessibilityLabel={`Cor da arte ${c}`}
                  style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                  <View style={[{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, borderWidth: 1, borderColor: wash(t.ink, 0.12) },
                    sel && Platform.OS === "web" ? ({ outline: `2px solid ${t.marcaTexto}`, outlineOffset: 2 } as any) : sel ? { borderWidth: 2, borderColor: t.marcaTexto } : null]} />
                </Pressable>
              );
            })}
          </View>
          {quaseSome ? <Texto style={{ fontSize: 12.5, color: t.amber }}>Essa cor quase some nesta peça. Experimente outra.</Texto> : null}
        </View>
      ) : null}
    </View>
  );
}

/** "Personalizar também o verso (+R$ 8,00)" — o opt-in cobrado. */
export function OptInDoLado({ lado, ligado, preco, onTrocar }: { lado: Lado; ligado: boolean; preco: number; onTrocar: () => void }) {
  const t = useTemaDaVitrine();
  const nome = lado === "back" ? "o verso" : "o meio";
  return (
    <Pressable
      onPress={onTrocar}
      accessibilityRole="switch"
      accessibilityState={{ checked: ligado }}
      accessibilityLabel={`Personalizar também ${nome}` + (preco > 0 ? `, mais ${dinheiro(preco)}` : "")}
      style={({ hovered }: any) => [{
        flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14,
        borderWidth: ligado ? 2 : 1, margin: ligado ? 0 : 1,
        borderColor: ligado ? t.marcaTexto : hovered ? t.ink3 : borda2(t),
        backgroundColor: ligado ? t.marcaWash : t.bg2,
      }, transicao("border-color, background-color")]}
    >
      <View style={{ width: 24, height: 24, borderRadius: 7, alignItems: "center", justifyContent: "center", backgroundColor: ligado ? t.marcaFill : t.bg2, borderWidth: ligado ? 0 : 1.5, borderColor: t.ink4 }}>
        {ligado ? <Icon name="check" size={16} color={t.sobreMarca} /> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Texto style={{ fontSize: 14.5, fontWeight: "600", color: t.ink }}>Personalizar também {nome}</Texto>
        <Texto style={{ fontSize: 12.5, color: t.ink3 }}>
          {ligado && preco > 0 ? `+${dinheiro(preco)} no total` : lado === "back" ? "Opcional · adiciona arte no lado de trás da peça" : "Opcional · arte na faixa do meio da peça"}
        </Texto>
      </View>
      {preco > 0 ? <PilulaDePreco texto={"+" + dinheiro(preco)} /> : null}
    </Pressable>
  );
}

function NotaDoLado({ icone, texto }: { icone: string; texto: string }) {
  const t = useTemaDaVitrine();
  return (
    <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", padding: 12, borderRadius: 12, backgroundColor: t.bg3 }}>
      <View style={{ marginTop: 1 }}><Icon name={icone as any} size={18} color={t.marcaTexto} /></View>
      <Texto style={{ flex: 1, fontSize: 13.5, lineHeight: 19, color: t.ink2 }}>{texto}</Texto>
    </View>
  );
}

/** Os lados que têm o que preencher — as abas do formulário e do mockup. */
export function ladosComConteudo(cfg: CustomizationConfig | null | undefined): Lado[] {
  const tem = (l: Lado) => camposDoLado(cfg, l).length > 0 || !!origensDoLado(cfg, l).envio || !!origensDoLado(cfg, l).pronta;
  const out: Lado[] = ["front"];
  if (cfg?.has_back === true && tem("back")) out.push("back");
  if (cfg?.has_middle === true && tem("middle")) out.push("middle");
  return out;
}

/**
 * "A arte em cada lado": as abas e o painel do lado escolhido.
 */
export function LadosDaArte({
  cfg, values, lados, lado, onLado, setValor, caminho, templates, slug, peca, limiar, desktop,
  versoLigado, meioLigado, onVerso, onMeio, corDaPeca, onEnvio, pedirAjuste, destaque,
}: {
  cfg: CustomizationConfig;
  values: Record<string, any>;
  lados: Lado[];
  lado: Lado;
  onLado: (l: Lado) => void;
  setValor: (id: string, v: any) => void;
  caminho: string;
  templates: StudioStoreProduct["templates"];
  slug: string;
  peca: NomeDaPeca;
  limiar: number;
  desktop: boolean;
  versoLigado: boolean;
  meioLigado: boolean;
  onVerso: () => void;
  onMeio: () => void;
  corDaPeca: string | null;
  onEnvio: (lado: Lado, e: EstadoDoEnvio) => void;
  pedirAjuste: { preco: number; onPress: () => void } | null;
  /** O campo que a barra mandou acender. */
  destaque: string | null;
}) {
  const t = useTemaDaVitrine();
  const ladoAtual = lados.includes(lado) ? lado : "front";

  const cobrado = ladoAtual === "back" ? cfg.back_charge_enabled === true : ladoAtual === "middle" ? cfg.middle_charge_enabled === true : false;
  const precoDoLado = ladoAtual === "back" ? Number(cfg.back_price_delta) || 0 : ladoAtual === "middle" ? Number(cfg.middle_price_delta) || 0 : 0;
  const ligado = ladoAtual === "back" ? versoLigado : ladoAtual === "middle" ? meioLigado : true;
  const aberto = !cobrado || ligado;
  const designer = caminho === ART_DESIGNER;
  const { envio, pronta } = origensDoLado(cfg, ladoAtual);
  const temArquivo = !!(envio && values[envio.id]);

  const campo = (f: CustomizationField) => {
    const dest = destaque === f.id;
    if (f.type === "text") {
      return (
        <CampoDeTexto
          key={f.id} field={f} value={values[f.id]} cor={values[f.id + "_cor"]} corDaPeca={corDaPeca}
          lado={ladoAtual} destacar={dest}
          onChange={(v) => setValor(f.id, v)} onCor={(c) => setValor(f.id + "_cor", c)}
        />
      );
    }
    if (f.type === "option") return <FieldOption key={f.id} field={f} value={values[f.id]} onChange={(v) => setValor(f.id, v)} />;
    if (f.type === "color") return <FieldColor key={f.id} field={f} value={values[f.id]} onChange={(v) => setValor(f.id, v)} />;
    return null;
  };

  return (
    <View style={{ gap: 14 }}>
      {lados.length > 1 ? (
        <>
          <Rotulo>A arte em cada lado</Rotulo>
          <View accessibilityRole="tablist" style={{ flexDirection: "row", padding: 4, gap: 4, borderRadius: 14, backgroundColor: t.bg3 }}>
            {lados.map((l) => {
              const sel = l === ladoAtual;
              const cobra = l === "back" ? cfg.back_charge_enabled === true && !versoLigado && Number(cfg.back_price_delta) > 0
                : l === "middle" ? cfg.middle_charge_enabled === true && !meioLigado && Number(cfg.middle_price_delta) > 0 : false;
              const preco = l === "back" ? Number(cfg.back_price_delta) : Number(cfg.middle_price_delta);
              return (
                <Pressable
                  key={l}
                  onPress={() => onLado(l)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: sel }}
                  accessibilityLabel={NOME_DO_LADO[l]}
                  style={[{
                    flex: 1, minHeight: 44, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                    backgroundColor: sel ? t.bg2 : "transparent",
                  }, sel && Platform.OS === "web" ? ({ boxShadow: "0 1px 2px rgba(26,23,20,.06),0 1px 1px rgba(26,23,20,.04)" } as any) : null, transicao("background-color")]}
                >
                  <Texto style={{ fontSize: 14, fontWeight: "600", color: sel ? t.ink : t.ink2 }}>{NOME_DO_LADO[l]}</Texto>
                  {cobra ? <Numero style={{ fontSize: 11, color: t.ink3 }}>+{dinheiro(preco).replace(",00", "")}</Numero> : null}
                  {ladoPreenchido(cfg, l, values) ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.marcaTexto }} /> : null}
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      <View accessibilityRole={lados.length > 1 ? ("tabpanel" as any) : undefined} style={{ gap: 16 }}>
        {ladoAtual !== "front" ? (
          cobrado ? (
            <OptInDoLado lado={ladoAtual} ligado={ligado} preco={precoDoLado} onTrocar={ladoAtual === "back" ? onVerso : onMeio} />
          ) : (
            <NotaDoLado icone="check" texto={ladoAtual === "back" ? "Verso incluso, sem custo adicional." : "Meio incluso, sem custo adicional."} />
          )
        ) : null}

        {aberto ? (
          <>
            {designer && (envio || pronta) ? (
              ladoAtual === "front" ? (
                <NotaDoLado icone="sparkles" texto="A loja cria a arte a partir da sua ideia e manda o mockup para você aprovar antes de produzir." />
              ) : null
            ) : (
              <>
                {envio ? (
                  <EnvioDaArte
                    key={envio.id}
                    field={envio}
                    value={values[envio.id]}
                    slug={slug}
                    lado={ladoAtual}
                    peca={peca}
                    limiar={limiar}
                    desktop={desktop}
                    destacar={destaque === envio.id}
                    onChange={(url) => {
                      setValor(envio.id, url);
                      // Arquivo e arte pronta são o mesmo lugar (S0): um
                      // arquivo novo tira a arte pronta escolhida antes.
                      if (url && pronta && values[pronta.id]) setValor(pronta.id, "");
                    }}
                    onEstado={(e) => onEnvio(ladoAtual, e)}
                    pedirAjuste={pedirAjuste}
                    jaPediuAjuste={caminho === ART_ADJUST}
                  />
                ) : null}
                {pronta && caminho !== ART_ADJUST && !temArquivo && templates?.length ? (
                  <View style={{ gap: 10 }}>
                    {envio ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View style={{ flex: 1, height: 1, backgroundColor: t.border }} />
                        <Texto style={{ fontSize: 13, color: t.ink3 }}>ou escolha uma arte pronta</Texto>
                        <View style={{ flex: 1, height: 1, backgroundColor: t.border }} />
                      </View>
                    ) : (
                      <Texto style={{ fontSize: 13, fontWeight: "600", color: t.ink2 }}>Escolha uma arte pronta</Texto>
                    )}
                    <ArtesProntas templates={templates} valor={values[pronta.id]} onEscolher={(url) => setValor(pronta.id, url)} />
                  </View>
                ) : null}
              </>
            )}
            {camposDoLado(cfg, ladoAtual).map(campo)}
          </>
        ) : null}
      </View>
    </View>
  );
}

/** A frase curta da etiqueta da seção da arte. */
export function etiquetaDaArte(opcoes: { enviando: boolean; faltaArte: boolean; designer: boolean; temArte: boolean }): { tipo: "falta" | "ok"; texto: string } | null {
  if (opcoes.enviando) return { tipo: "falta", texto: "Enviando" };
  if (opcoes.faltaArte) return { tipo: "falta", texto: "Falta a arte" };
  if (opcoes.designer) return { tipo: "ok", texto: "A loja cria" };
  if (opcoes.temArte) return { tipo: "ok", texto: "Pronta" };
  return null;
}

export { ART_SERVICE_BRIEF_ID, nomeDoLado };
