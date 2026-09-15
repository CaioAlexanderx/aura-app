// Seletor do nº de parcelas do crediário no PDV (15/09/2026).
// Sob react-native-web o PDV é web: o componente tem que render um <select>
// com uma opção por parcela, e não mais uma grade de botões.
import React from "react";
import renderer, { act } from "react-test-renderer";
import { InstallmentCountSelect } from "../../components/screens/pdv/InstallmentCountSelect";

const brl = (v: number) => "R$ " + v.toFixed(2).replace(".", ",");

function mount(props: Partial<React.ComponentProps<typeof InstallmentCountSelect>> = {}) {
  const onChange = jest.fn();
  let t!: renderer.ReactTestRenderer;
  act(() => {
    t = renderer.create(
      <InstallmentCountSelect
        value={3}
        onChange={onChange}
        max={500}
        total={1000}
        formatMoney={brl}
        testID="pdv-crediario-parcelas"
        {...props}
      />
    );
  });
  return { t, onChange };
}

describe("InstallmentCountSelect", () => {
  it("renderiza um select com uma opção por parcela até o teto", () => {
    const { t } = mount();
    const select = t.root.findByType("select");
    expect(select.props["data-testid"]).toBe("pdv-crediario-parcelas");
    expect(select.props.value).toBe("3");
    const options = t.root.findAllByType("option");
    expect(options).toHaveLength(500);
    expect(options[2].props.children).toBe("3x de R$ 333,33");
  });

  it("não renderiza mais a grade de botões", () => {
    const { t } = mount();
    const pressables = t.root.findAll((n) => n.props?.accessibilityRole === "button" || n.props?.role === "button");
    expect(pressables).toHaveLength(0);
  });

  it("escolher uma opção devolve o número, dentro do teto", () => {
    const { t, onChange } = mount({ max: 12 });
    const select = t.root.findByType("select");
    act(() => { select.props.onChange({ target: { value: "7" } }); });
    expect(onChange).toHaveBeenLastCalledWith(7);
    act(() => { select.props.onChange({ target: { value: "99" } }); });
    expect(onChange).toHaveBeenLastCalledWith(12);
  });

  it("sem total, as opções mostram só a quantidade", () => {
    const { t } = mount({ max: 3, total: 0 });
    expect(t.root.findAllByType("option").map((o) => o.props.children)).toEqual(["1x", "2x", "3x"]);
  });
});
