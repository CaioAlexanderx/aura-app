// react-native-svg sob Jest (tq-37).
//
// O pacote puxa 'react-native/Libraries/...' (codegenNativeComponent,
// SvgTouchableMixin), e o moduleNameMapper do jest.config.js manda todo
// 'react-native/...' para o react-native-web. Resultado: qualquer teste que
// importe o Icon sem mockar o svg quebra no carregamento ("Cannot read
// properties of undefined (reading 'Mixin')" / "codegenNativeComponent is not
// a function"), sem ter nada a ver com o que o teste verifica.
//
// Este mock fica ao lado do node_modules, então o Jest o usa sozinho. Cada
// elemento vira uma tag com o mesmo nome (Svg, Path, Circle...), que é o que
// os mocks locais dos testes já faziam. Teste que precisar de outro formato
// continua podendo chamar jest.mock("react-native-svg", factory).
const React = require("react");

const stub = (nome) => {
  const Componente = (props) => React.createElement(nome, props, props.children);
  Componente.displayName = nome;
  return Componente;
};

const cache = {};
const modulo = new Proxy(
  { __esModule: true },
  {
    get(alvo, chave) {
      if (chave in alvo) return alvo[chave];
      if (typeof chave !== "string") return undefined;
      if (chave === "default") chave = "Svg";
      if (!cache[chave]) cache[chave] = stub(chave);
      return cache[chave];
    },
  },
);

module.exports = modulo;
