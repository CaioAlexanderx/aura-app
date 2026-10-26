// Fuso dos lojistas, fixo para os testes de data valerem em qualquer máquina.
// Tem que ser aqui, no processo principal: process.env.TZ dentro do teste não
// pega no sandbox do Jest (ver __tests__/creditSimulation.test.ts).
process.env.TZ = 'America/Sao_Paulo';

module.exports = {
  testEnvironment: 'jsdom',
  setupFiles: ['./jest.setup.js'],
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|@tanstack|zustand)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^react-native$': 'react-native-web',
    '^react-native/(.*)$': 'react-native-web',
    // 25/09/2026: react-native-calendars importa as setas em PNG.
    '\\.(png|jpe?g|gif|webp|ttf|otf)$': '<rootDir>/__mocks__/arquivoEstatico.js',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    'services/**/*.{ts,tsx}',
    'stores/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    '!**/*.d.ts',
  ],
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  // 19/10/2026 (tq-37): o limite de 5 s do Jest estoura com o cache de
  // transformação frio (primeiro run no CI, ou máquina ocupada) em testes de
  // tela que passam sozinhos em segundos (PainelHoje, gestaoAuraClientesLoja,
  // vendaIdempotenteNaOtica). 15 s cobre isso sem esconder teste travado.
  testTimeout: 15000,
  // Suítes isoladas no tq-37 voltaram no tq-40 (relógio fixo nos testes e
  // rótulo "Também" no CategoryTreePicker). Se uma suíte precisar sair de
  // novo, entra aqui com o motivo e o card.
  testPathIgnorePatterns: [
    '/node_modules/',
  ],
};
