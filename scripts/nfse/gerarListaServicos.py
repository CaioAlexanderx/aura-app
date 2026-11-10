#!/usr/bin/env python3
"""
Gera constants/nfseListaServicos.ts a partir da planilha oficial do
Sistema Nacional NFS-e (Anexo B - Lista de Servicos Nacional).

Uso (rodar com -I, de fora da pasta do download):
  python -I scripts/nfse/gerarListaServicos.py <ANEXO_B...xlsx> constants/nfseListaServicos.ts

Fonte: https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual
Requer openpyxl. Ao trocar de versao, atualize ARQUIVO, VERSAO e
DESCRICAO_VERSAO e rode __tests__/nfseCadastroServico.test.tsx (confere
a contagem e os sinonimos).
"""
import hashlib
import json
import re
import sys

import openpyxl

ARQUIVO = "ANEXO_B-NBS2-LISTA_SERVICO_NACIONAL-SNNFSe-v1.01-20260122.xlsx"
VERSAO = "v1.01-20260122"
DESCRICAO_VERSAO = "Versão v1.01 de 22/01/2026, baixada em 10/11/2026."
URL = "https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual"


def limpar(s):
    return re.sub(r"\s+", " ", str(s).replace("\xa0", " ")).strip()


def extrair(src):
    wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
    ws = wb["LISTA.SERV.NAC."]
    itens, subs, lista, vistos = {}, {}, [], set()
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i == 0 or not any(v is not None for v in row):
            continue
        cod, it, sub, des, desc = row[:5]
        desc = limpar(desc or "")
        if cod is None:
            # linha de titulo: item (sub 0, desdobro 0) ou subitem (desdobro 0)
            if sub == 0 and des == 0:
                itens[int(it)] = desc
            elif des == 0:
                subs[(int(it), int(sub))] = desc
            continue
        c = (str(int(cod)) if isinstance(cod, (int, float)) else str(cod).strip()).zfill(6)
        esperado = "%02d%02d%02d" % (int(it), int(sub), int(des))
        if c != esperado or not re.fullmatch(r"\d{6}", c):
            raise SystemExit("codigo inesperado: %r (esperado %s)" % (row, esperado))
        if c in vistos:
            raise SystemExit("codigo repetido: " + c)
        vistos.add(c)
        s = subs.get((int(it), int(sub)), "")
        lista.append([c, desc] + ([s] if s and s != desc else []))
    return itens, lista


def gerar(itens, lista, sha):
    j = lambda x: json.dumps(x, ensure_ascii=False)
    L = [
        "// ============================================================",
        "// AURA. — Lista de Serviços Nacional da NFS-e (código de tributação nacional)",
        "//",
        "// ARQUIVO GERADO. Não edite à mão: troque pela versão nova da planilha.",
        "//",
        "// Fonte oficial: Sistema Nacional NFS-e, Documentação Técnica Atual (Produção)",
        "//   " + URL,
        "//   Anexo de domínio: " + ARQUIVO,
        "//   (aba \"LISTA.SERV.NAC.\", colunas código de tributação nacional, item,",
        "//   subitem, desdobro nacional e descrição).",
        "//   " + DESCRICAO_VERSAO,
        "//   SHA-256 da planilha: " + sha,
        "//",
        "// O código tem 6 dígitos: item (2) + subitem (2) + desdobro nacional (2),",
        "// o mesmo cTribNac da DPS. Só as linhas COM código entraram (%d); as linhas" % len(lista),
        "// de título de item viraram ITENS_DA_LISTA (%d itens, usados na busca)." % len(itens),
        "// Cada linha: [código, descrição do desdobro, descrição do subitem quando",
        "// ela é diferente]. Textos copiados da planilha, só com espaços aparados.",
        "//",
        "// Carregado sob demanda (hooks/useListaServicosNfse.ts): não entra no",
        "// bundle de quem nunca abre o cadastro de um serviço.",
        "// ============================================================",
        "",
        "export const FONTE_LISTA_SERVICOS = {",
        '  arquivo: "%s",' % ARQUIVO,
        '  versao: "%s",' % VERSAO,
        '  url: "%s",' % URL,
        "} as const;",
        "",
        "/** Título de cada item da lista (os dois primeiros dígitos do código). */",
        "export const ITENS_DA_LISTA: Record<string, string> = {",
    ]
    for k in sorted(itens):
        L.append("  %s: %s," % (j(str(k).zfill(2)), j(itens[k])))
    L += [
        "};",
        "",
        "export type LinhaDaLista = readonly [codigo: string, descricao: string, subitem?: string];",
        "",
        "export const LISTA_SERVICOS_NACIONAL: ReadonlyArray<LinhaDaLista> = [",
    ]
    for e in lista:
        L.append("  [" + ", ".join(j(x) for x in e) + "],")
    L += ["];", "", "export default LISTA_SERVICOS_NACIONAL;", ""]
    return "\n".join(L)


if __name__ == "__main__":
    src, destino = sys.argv[1], sys.argv[2]
    sha = hashlib.sha256(open(src, "rb").read()).hexdigest()
    itens, lista = extrair(src)
    open(destino, "w", encoding="utf8", newline="\n").write(gerar(itens, lista, sha))
    print("%d codigos, %d itens -> %s" % (len(lista), len(itens), destino))
