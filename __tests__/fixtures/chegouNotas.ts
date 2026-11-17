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
