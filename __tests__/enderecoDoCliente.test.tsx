// ============================================================
// Endereço do cliente para entrega (09/11/2026, parte 1)
//
//   - regras puras (components/endereco/endereco.ts)
//   - EnderecoForm: CEP primeiro com busca (ViaCEP mockado), "Preencher à
//     mão", CEP não encontrado e falha de rede, modo obrigatório
//   - selo "sem endereço" no seletor de cliente do Caixa (ActionToolbar)
//   - a troca sem regressão: EMPTY_ADDRESS / validateAddress iguais, e o
//     invólucro converte de/para CustomerAddress com o IBGE
// ============================================================
jest.mock("expo-font", () => ({ loadAsync: jest.fn(), isLoaded: () => true, useFonts: () => [true] }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));

import React from "react";
import renderer, { act } from "react-test-renderer";
import {
  ENDERECO_VAZIO, buscarCep, enderecoDoCliente, enderecoParaApi, erroDoEndereco,
  faltandoParaEntrega, formatarCep, resumoDoEndereco, temEnderecoDeEntrega, type Endereco,
} from "@/components/endereco/endereco";
import { EnderecoForm } from "@/components/endereco/EnderecoForm";
import {
  AddressForm, EMPTY_ADDRESS, validateAddress, paraEndereco, paraCustomerAddress,
} from "@/components/screens/pdv/troca/AddressForm";
import { ActPerson } from "@/components/screens/pdv/ActionToolbar";

function porTestID(tree: renderer.ReactTestRenderer, id: string) {
  return tree.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
}
function texto(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(texto).join("");
  return texto(node.children);
}
async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

/** Formulário controlado, como os pais usam. */
function Controlado(props: { inicial?: Endereco; onValor?: (e: Endereco) => void } & Partial<React.ComponentProps<typeof EnderecoForm>>) {
  const { inicial, onValor, ...rest } = props;
  const [v, setV] = React.useState<Endereco>(inicial || ENDERECO_VAZIO);
  return (
    <EnderecoForm
      value={v}
      onChange={(e) => { setV(e); onValor?.(e); }}
      testID="end"
      {...rest}
    />
  );
}

const PAULISTA = { cep: "01310100", rua: "Avenida Paulista", bairro: "Bela Vista", cidade: "São Paulo", uf: "SP", ibge: "3550308" };

describe("regras puras", () => {
  test("lê o cliente do GET e devolve o corpo do PATCH (vazio = null)", () => {
    const e = enderecoDoCliente({
      zip_code: "01310-100", street: "Avenida Paulista", number: "1000", complement: null,
      neighborhood: "Bela Vista", city: "São Paulo", state: "sp", address_reference: "portão azul",
      address_number: "999", postal_code: "99999999",
    });
    expect(e).toMatchObject({ zip: "01310100", number: "1000", state: "SP", complement: "", reference: "portão azul" });
    expect(enderecoParaApi(e)).toEqual({
      zip_code: "01310100", street: "Avenida Paulista", number: "1000", complement: null,
      neighborhood: "Bela Vista", city: "São Paulo", state: "SP", address_reference: "portão azul",
    });
  });

  test("tem endereço = rua ou CEP + número + cidade", () => {
    expect(temEnderecoDeEntrega({ ...ENDERECO_VAZIO, street: "R", number: "1", city: "C" })).toBe(true);
    expect(temEnderecoDeEntrega({ ...ENDERECO_VAZIO, zip: "01310100", number: "1", city: "C" })).toBe(true);
    expect(temEnderecoDeEntrega({ ...ENDERECO_VAZIO, street: "R", city: "C" })).toBe(false);
    expect(faltandoParaEntrega(ENDERECO_VAZIO)).toEqual(["CEP ou rua", "número", "cidade"]);
    expect(faltandoParaEntrega(ENDERECO_VAZIO, { nome: " " })).toEqual(["nome", "CEP ou rua", "número", "cidade"]);
  });

  test("formato: CEP com 8 números, UF com 2 letras, vazio passa", () => {
    expect(erroDoEndereco(ENDERECO_VAZIO)).toBeNull();
    expect(erroDoEndereco({ ...ENDERECO_VAZIO, zip: "1234" })).toMatch(/8 números/);
    expect(erroDoEndereco({ ...ENDERECO_VAZIO, state: "S" })).toMatch(/2 letras/);
    expect(formatarCep("01310100")).toBe("01310-100");
    expect(resumoDoEndereco({ ...ENDERECO_VAZIO, street: "Av. Paulista", number: "1000", neighborhood: "Bela Vista" }))
      .toBe("Av. Paulista, 1000 · Bela Vista");
  });

  test("buscarCep usa o ViaCEP e traz o IBGE", async () => {
    const fake = jest.fn(async () => ({
      ok: true,
      json: async () => ({ logradouro: "Avenida Paulista", bairro: "Bela Vista", localidade: "São Paulo", uf: "SP", ibge: "3550308" }),
    }));
    expect(await buscarCep("123", fake as any)).toBeNull();
    expect(fake).not.toHaveBeenCalled();
    const e = await buscarCep("01310-100", fake as any);
    expect(fake).toHaveBeenCalledWith("https://viacep.com.br/ws/01310100/json/");
    expect(e).toMatchObject({ rua: "Avenida Paulista", cidade: "São Paulo", uf: "SP", ibge: "3550308" });
    const naoExiste = jest.fn(async () => ({ ok: true, json: async () => ({ erro: true }) }));
    expect(await buscarCep("00000000", naoExiste as any)).toBeNull();
  });
});

describe("EnderecoForm", () => {
  test("CEP primeiro: no 8º dígito busca, preenche e só falta o número", async () => {
    const buscar = jest.fn(async () => PAULISTA);
    let ultimo: Endereco = ENDERECO_VAZIO;
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<Controlado buscarCep={buscar} onValor={(e) => { ultimo = e; }} />); });

    // Antes do CEP, os campos ficam escondidos e o atalho "Preencher à mão" aparece.
    expect(porTestID(tree, "end-campos").length).toBe(0);
    expect(porTestID(tree, "end-manual").length).toBe(1);

    act(() => { porTestID(tree, "end-cep")[0].props.onChangeText("01310-10"); });
    expect(buscar).not.toHaveBeenCalled();
    act(() => { porTestID(tree, "end-cep")[0].props.onChangeText("01310-100"); });
    await flush();

    expect(buscar).toHaveBeenCalledWith("01310100");
    expect(texto(porTestID(tree, "end-status")[0].children)).toContain("Encontramos o endereço");
    expect(ultimo).toMatchObject({ zip: "01310100", street: "Avenida Paulista", neighborhood: "Bela Vista", city: "São Paulo", state: "SP" });
    expect(porTestID(tree, "end-street")[0].props.value).toBe("Avenida Paulista");
    expect(porTestID(tree, "end-number")[0].props.value).toBe("");

    act(() => { porTestID(tree, "end-number")[0].props.onChangeText("1000"); });
    expect(ultimo.number).toBe("1000");
    expect(ultimo.street).toBe("Avenida Paulista");
    tree.unmount();
  });

  test("Preencher à mão abre os campos sem buscar nada", () => {
    const buscar = jest.fn();
    let ultimo: Endereco = ENDERECO_VAZIO;
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<Controlado buscarCep={buscar as any} onValor={(e) => { ultimo = e; }} />); });
    act(() => { porTestID(tree, "end-manual")[0].props.onPress(); });
    expect(porTestID(tree, "end-campos").length).toBe(1);
    act(() => { porTestID(tree, "end-street")[0].props.onChangeText("Rua das Flores"); });
    act(() => { porTestID(tree, "end-number")[0].props.onChangeText("45"); });
    act(() => { porTestID(tree, "end-city")[0].props.onChangeText("Campinas"); });
    act(() => { porTestID(tree, "end-state")[0].props.onChangeText("sp1"); });
    expect(ultimo).toMatchObject({ street: "Rua das Flores", number: "45", city: "Campinas", state: "SP" });
    expect(temEnderecoDeEntrega(ultimo)).toBe(true);
    expect(buscar).not.toHaveBeenCalled();
    tree.unmount();
  });

  test("CEP que não existe: avisa e deixa preencher à mão", async () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<Controlado buscarCep={async () => null} />); });
    act(() => { porTestID(tree, "end-cep")[0].props.onChangeText("99999999"); });
    await flush();
    expect(texto(porTestID(tree, "end-status")[0].children)).toContain("Não achamos esse CEP");
    expect(porTestID(tree, "end-campos").length).toBe(1);
    tree.unmount();
  });

  test("falha de rede: 'Tentar de novo' busca outra vez", async () => {
    const buscar = jest.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(PAULISTA);
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<Controlado buscarCep={buscar} />); });
    act(() => { porTestID(tree, "end-cep")[0].props.onChangeText("01310100"); });
    await flush();
    expect(texto(porTestID(tree, "end-status")[0].children)).toContain("Não deu para buscar");
    await act(async () => { porTestID(tree, "end-tentar")[0].props.onPress(); });
    await flush();
    expect(buscar).toHaveBeenCalledTimes(2);
    expect(texto(porTestID(tree, "end-status")[0].children)).toContain("Encontramos o endereço");
    tree.unmount();
  });

  test("endereço que já existe (editar cliente) mostra os campos de cara", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<Controlado inicial={{ ...ENDERECO_VAZIO, street: "Rua A", number: "1", city: "X" }} />);
    });
    expect(porTestID(tree, "end-campos").length).toBe(1);
    expect(porTestID(tree, "end-manual").length).toBe(0);
    expect(porTestID(tree, "end-reference").length).toBe(1);
    tree.unmount();
  });

  test("modo obrigatório pinta o que falta (para a trava do frete)", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <Controlado modo="obrigatorio" mostrarErros inicial={{ ...ENDERECO_VAZIO, street: "Rua A" }} />,
      );
    });
    expect(texto(porTestID(tree, "end-falta")[0].children)).toBe("Falta: número, cidade.");
    expect(porTestID(tree, "end-number")[0].props.placeholder).toBe("Número (obrigatório)");
    tree.unmount();
  });
});

describe("a troca sem regressão", () => {
  test("EMPTY_ADDRESS e validateAddress continuam iguais", () => {
    expect(EMPTY_ADDRESS).toEqual({ street: "", number: "", neighborhood: "", city: "", state: "", zip: "", ibge: "" });
    expect(validateAddress(EMPTY_ADDRESS)).toEqual(["rua", "bairro", "cidade", "UF", "CEP", "código IBGE", "número"]);
    expect(validateAddress({
      street: "R", number: "1", neighborhood: "B", city: "C", state: "SP", zip: "01310100", ibge: "3550308",
    })).toEqual([]);
  });

  test("ida e volta CustomerAddress ↔ Endereco sem perder o IBGE", () => {
    const a = { street: "R", number: "1", neighborhood: "B", city: "C", state: "SP", zip: "01310100", ibge: "3550308" };
    expect(paraCustomerAddress(paraEndereco(a))).toEqual(a);
  });

  test("o invólucro da troca devolve CustomerAddress (com IBGE do CEP) e sem complemento/referência", async () => {
    const global_: any = globalThis as any;
    const fetchAntes = global_.fetch;
    global_.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ logradouro: "Avenida Paulista", bairro: "Bela Vista", localidade: "São Paulo", uf: "SP", ibge: "3550308" }),
    }));
    const onChange = jest.fn();
    function Pai() {
      const [v, setV] = React.useState(EMPTY_ADDRESS);
      return <AddressForm value={v} onChange={(n) => { setV(n); onChange(n); }} />;
    }
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<Pai />); });
    act(() => { porTestID(tree, "troca-endereco-cep")[0].props.onChangeText("01310100"); });
    await flush();
    expect(onChange).toHaveBeenLastCalledWith({
      street: "Avenida Paulista", number: "", neighborhood: "Bela Vista", city: "São Paulo",
      state: "SP", zip: "01310100", ibge: "3550308",
    });
    expect(porTestID(tree, "troca-endereco-complement").length).toBe(0);
    expect(porTestID(tree, "troca-endereco-reference").length).toBe(0);
    // IBGE veio do CEP: o campo manual não aparece.
    expect(porTestID(tree, "troca-endereco-ibge").length).toBe(0);
    tree.unmount();
    global_.fetch = fetchAntes;
  });
});

describe("seletor de cliente do Caixa", () => {
  test("bairro na linha e selo 'sem endereço' quando falta", () => {
    let tree!: renderer.ReactTestRenderer;
    const ref = React.createRef<any>();
    act(() => {
      tree = renderer.create(
        <ActPerson
          ref={ref}
          kind="cliente"
          shortcut="F2"
          value={null}
          onChange={() => {}}
          searchable
          options={[
            { id: "a", name: "Cliente Um", subtitle: "(11) 98888-1234 · Av. Paulista, 1000 · Bela Vista", semEndereco: false },
            { id: "b", name: "Cliente Dois", subtitle: "(11) 97777-5678", semEndereco: true },
          ]}
        />,
      );
    });
    // Abre o popover pela mesma porta do rodapé do carrinho.
    act(() => { ref.current.open(); });
    expect(porTestID(tree, "cliente-sem-endereco-b").length).toBe(1);
    expect(porTestID(tree, "cliente-sem-endereco-a").length).toBe(0);
    expect(porTestID(tree, "cliente-com-endereco-a").length).toBe(1);
    expect(JSON.stringify(tree.toJSON())).toContain("Bela Vista");
    tree.unmount();
  });
});

describe("ficha do cliente", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { QueryClient, QueryClientProvider } = require("@tanstack/react-query");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { EnderecoNaFicha } = require("@/components/endereco/EnderecoNaFicha");

  test("sem endereço: 'Adicionar endereço' abre o formulário e salva só o endereço, na loja do cadastro", async () => {
    const salvar = jest.fn(async () => ({}));
    const qc = new QueryClient();
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <QueryClientProvider client={qc}>
          <EnderecoNaFicha customerId="c1" companyId="loja-b" endereco={ENDERECO_VAZIO} salvar={salvar} buscarCep={async () => PAULISTA} />
        </QueryClientProvider>,
      );
    });
    expect(porTestID(tree, "cliente-endereco-c1-vazio").length).toBe(1);
    act(() => { porTestID(tree, "cliente-endereco-c1-editar")[0].props.onPress(); });
    act(() => { porTestID(tree, "cliente-endereco-c1-form-cep")[0].props.onChangeText("01310100"); });
    await flush();
    act(() => { porTestID(tree, "cliente-endereco-c1-form-number")[0].props.onChangeText("1000"); });
    await act(async () => { await porTestID(tree, "cliente-endereco-c1-salvar")[0].props.onPress(); });
    expect(salvar).toHaveBeenCalledWith("loja-b", "c1", {
      zip_code: "01310100", street: "Avenida Paulista", number: "1000", complement: null,
      neighborhood: "Bela Vista", city: "São Paulo", state: "SP", address_reference: null,
    });
    tree.unmount();
  });
});
