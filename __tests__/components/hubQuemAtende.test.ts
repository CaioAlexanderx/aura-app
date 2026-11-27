// Chip de "quem atende" (lista e cabeçalho): só a Aurinha ou OUTRO usuário; com você, nada.
import { quemAtende } from "@/components/screens/hub/types";

describe("quemAtende", () => {
  const eu = "u-eu";
  it("com você (ou sem dono): nada", () => {
    expect(quemAtende({ status: "humano", assigned_user_id: eu }, eu, true)).toBeNull();
    expect(quemAtende({ status: "humano", assigned_user_id: null }, eu, true)).toBeNull();
    expect(quemAtende({ status: "precisa_humano", assigned_user_id: null }, eu, true)).toBeNull();
  });
  it("com a Aurinha: 'Aurinha' no cabeçalho, 'Aurinha atendendo' na lista; Aurinha desligada, nada", () => {
    expect(quemAtende({ status: "ia" }, eu, true)?.rotulo).toBe("Aurinha");
    expect(quemAtende({ status: "ia" }, eu, true, true)?.rotulo).toBe("Aurinha atendendo");
    expect(quemAtende({ status: "ia" }, eu, false)).toBeNull();
  });
  it("com outra pessoa: 'Com <nome>' ou 'Com outra pessoa'", () => {
    expect(quemAtende({ status: "humano", assigned_user_id: "u-lorena", assigned_user_name: "Lorena" }, eu, true)?.rotulo).toBe("Com Lorena");
    expect(quemAtende({ status: "humano", assigned_user_id: "u-lorena", assigned_user_name: "" }, eu, true)?.rotulo).toBe("Com outra pessoa");
  });
});