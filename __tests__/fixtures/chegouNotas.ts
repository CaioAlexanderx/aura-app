// Fixtures do "Chegou mercadoria" (não é suíte: não termina em .test).

/** Nota da Distribuidora Alfa: 3 itens (código de barras, código do fornecedor com desconto, quantidade zero). */
export const XML_ALFA = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe><infNFe Id="NFe35261112345678000190550010000045121000045120" versao="4.00">
  <ide><nNF>004512</nNF><serie>1</serie><dhEmi>2026-11-14T10:20:00-03:00</dhEmi></ide>
  <emit><CNPJ>11222333000181</CNPJ><xNome>Distribuidora Alfa Ltda</xNome><xFant>Distribuidora Alfa</xFant><enderEmit><fone>1133334444</fone></enderEmit></emit>
  <dest><CNPJ>99999999000199</CNPJ></dest>
  <det nItem="1"><prod><cProd>AL-0100</cProd><cEAN>7891234567895</cEAN><xProd>ESMALTE CREM VERM 8ML</xProd><NCM>33043000</NCM><uCom>UN</uCom><qCom>24.0000</qCom><vUnCom>6.0000000000</vUnCom><vProd>144.00</vProd></prod></det>
  <det nItem="2"><prod><cProd>AL-0391</cProd><cEAN>SEM GTIN</cEAN><cEANTrib>SEM GTIN</cEANTrib><xProd>ACETONA 100ML</xProd><NCM>29141100</NCM><uCom>UN</uCom><qCom>12</qCom><vUnCom>3.40</vUnCom><vProd>40.80</vProd><vDesc>2.40</vDesc></prod></det>
  <det nItem="3"><prod><cProd>AL-0500</cProd><cEAN></cEAN><xProd>REMOV CUTICULA 60ML</xProd><qCom>0</qCom><vUnCom>4.10</vUnCom><vProd>0.00</vProd></prod></det>
  <total><ICMSTot><vProd>184.80</vProd><vDesc>2.40</vDesc><vNF>190.00</vNF></ICMSTot></total>
</infNFe></NFe><protNFe><infProt><chNFe>35261112345678000190550010000045121000045120</chNFe></infProt></protNFe></nfeProc>`;

/**
 * Nota da conferência (passo 3): esmalte pelo código de barras (GTIN-14 com
 * zero na frente), acetona pelo código do fornecedor, lixa pelo nome e com
 * custo bem acima, base sem par, removedor com quantidade zero.
 */
export const XML_CONFERENCIA = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe35261111222333000181550010000077311000077310">
  <ide><nNF>7731</nNF><dhEmi>2026-11-14T10:20:00-03:00</dhEmi></ide>
  <emit><CNPJ>11222333000181</CNPJ><xNome>Distribuidora Alfa</xNome></emit>
  <det nItem="1"><prod><cProd>AL-0100</cProd><cEAN>07891234567895</cEAN><xProd>ESMALTE CREM VERM 8ML</xProd><qCom>24</qCom><vUnCom>6.00</vUnCom><vProd>144.00</vProd></prod></det>
  <det nItem="2"><prod><cProd>AL-0391</cProd><cEAN>SEM GTIN</cEAN><xProd>ACETONA 100ML</xProd><qCom>12</qCom><vUnCom>3.20</vUnCom><vProd>38.40</vProd></prod></det>
  <det nItem="3"><prod><cProd>AL-0555</cProd><cEAN></cEAN><xProd>Lixa de unha (pacote com 12)</xProd><qCom>10</qCom><vUnCom>48.00</vUnCom><vProd>480.00</vProd></prod></det>
  <det nItem="4"><prod><cProd>AL-1120</cProd><cEAN></cEAN><xProd>BASE FORTALECEDORA 10ML</xProd><NCM>33043000</NCM><qCom>18</qCom><vUnCom>7.40</vUnCom><vProd>133.20</vProd></prod></det>
  <det nItem="5"><prod><cProd>AL-0500</cProd><cEAN></cEAN><xProd>REMOV CUTICULA 60ML</xProd><qCom>0</qCom><vUnCom>4.10</vUnCom><vProd>0.00</vProd></prod></det>
  <total><ICMSTot><vProd>795.60</vProd><vNF>795.60</vNF></ICMSTot></total>
</infNFe></NFe></nfeProc>`;

/** Produtos da loja para a nota da conferência. */
export const PRODUTOS_CONFERENCIA: any[] = [
  { id: "p-esmalte", name: "Esmalte Cremoso Vermelho 8 ml", barcode: "7891234567895", code: "ESM-1", stock: 12, cost: 5.5, price: 12.9, unit: "un", has_variants: false, variant_barcodes: [] },
  { id: "p-acetona", name: "Acetona 100 ml", barcode: "", code: "ACE-1", stock: 4, cost: 3.1, price: 7.9, unit: "un" },
  { id: "p-lixa", name: "Lixa de unha (pacote com 12)", barcode: "", code: "", stock: 3, cost: 4.8, price: 9.9, unit: "un" },
  { id: "p-algodao", name: "Algodão em disco 50 un", barcode: "7890000000017", code: "", stock: 8, cost: 2.4, price: 5.9, unit: "un" },
];
