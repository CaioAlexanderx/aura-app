// ============================================================
// AURA. — Gera public/modelo-produtos-aura.xlsx (planilha modelo do Estoque)
//
// Uso: node scripts/gerar-modelo-produtos.js
//
// O arquivo é estático (servido de public/), e este script só existe para
// ele poder ser refeito sem abrir o Excel. Os cabeçalhos são EXATAMENTE o
// que o suggestMapping do backend (src/routes/importData.js, PRODUCT_FIELDS)
// reconhece sozinho: mudar o texto de um cabeçalho aqui sem conferir lá faz
// a coluna sumir da importação — __tests__/modeloProdutos.test.ts cobre isso.
//
// Forma da planilha (uma aba, "Produtos"):
//   linha 1  aviso (uma célula só). A importação procura o cabeçalho nas 10
//            primeiras linhas e exige >= 3 células de texto; uma célula
//            sozinha nunca é cabeçalho, e tudo acima do cabeçalho é ignorado.
//   linha 2  cabeçalhos
//   linhas 3+ três produtos de exemplo, marcados "(exemplo)" no nome
//
// Cor e tamanho ficam de fora de propósito: a importação grava as duas
// colunas no produto, mas não cria variantes (product_variants), e duas
// linhas com o mesmo nome + unidade + marca são tratadas como repetidas.
// ============================================================
const path = require("path");
const XLSX = require("xlsx");

const AVISO = "Uma linha por produto. Apague as linhas de exemplo. Cor e tamanho você cadastra depois no Estoque.";

const CABECALHOS = [
  "Nome do produto",
  "Preço de venda",
  "Custo",
  "Estoque",
  "Categoria",
  "Código de barras",
  "Marca",
  "Unidade",
];

function dvEan13(base12) {
  const soma = base12.split("").reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return String((10 - (soma % 10)) % 10);
}

// Código de barras como TEXTO (o Excel come zeros à esquerda e põe número
// grande em notação científica). Os três são EAN-13 com dígito verificador
// válido e de uma "empresa" que não existe (789 0000 00000x), para não
// coincidir com produto real caso alguém importe sem apagar o exemplo.
const ean = n => { const b = "789000000" + String(n).padStart(3, "0"); return b + dvEan13(b); };

const EXEMPLOS = [
  ["Vestido midi floral (exemplo)", 189.9, 95, 8, "Vestidos", ean(1), "Marca exemplo", "un"],
  ["Camiseta básica algodão (exemplo)", 59.9, 24, 20, "Camisetas", ean(2), "Marca exemplo", "un"],
  ["Calça jeans reta (exemplo)", 159.9, 78, 12, "Calças", ean(3), "Marca exemplo", "un"],
];

function montar() {
  const ws = XLSX.utils.aoa_to_sheet([[AVISO], CABECALHOS, ...EXEMPLOS]);
  ws["!cols"] = [{ wch: 36 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 10 }];
  // Preço e custo com duas casas; código de barras sempre texto.
  EXEMPLOS.forEach((_, i) => {
    const linha = i + 3;
    ["B", "C"].forEach(col => { ws[`${col}${linha}`].z = "#,##0.00"; });
    ws[`F${linha}`].t = "s";
    ws[`F${linha}`].z = "@";
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Produtos");
  return wb;
}

if (require.main === module) {
  const destino = path.join(__dirname, "..", "public", "modelo-produtos-aura.xlsx");
  XLSX.writeFile(montar(), destino);
  console.log("gerado:", destino);
}

module.exports = { AVISO, CABECALHOS, EXEMPLOS, montar, dvEan13 };
