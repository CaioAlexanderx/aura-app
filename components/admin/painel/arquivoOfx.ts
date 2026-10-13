// ============================================================
// Gestão Aura › Hoje › Receita — escolher e ler o arquivo OFX.
//
// Só web (input de arquivo). O backend não tem multipart: o arquivo é lido
// aqui como texto e vai em JSON. OFX de banco brasileiro costuma estar em
// Windows-1252; decodeTextoDoArquivo tenta UTF-8 estrito e cai para ele.
// Fica separado do componente para o teste trocar por um arquivo fixo.
// ============================================================
import { Platform } from "react-native";
import { decodeTextoDoArquivo } from "@/utils/csv";

export var LIMITE_OFX_BYTES = 5 * 1024 * 1024;

export type ArquivoOfx = { nome: string; texto: string };

export function lerOfxDisponivel(): boolean {
  return Platform.OS === "web" && typeof document !== "undefined";
}

// Um OFX de verdade tem o cabeçalho ou ao menos um bloco de transação.
export function pareceOfx(texto: string): boolean {
  return /OFXHEADER|<OFX>|<STMTTRN>/i.test(texto);
}

// null = a pessoa fechou o seletor sem escolher. Rejeita com Error(mensagem
// pronta para a tela) quando o arquivo não serve.
export function escolherArquivoOfx(): Promise<ArquivoOfx | null> {
  return new Promise(function(resolve, reject) {
    if (!lerOfxDisponivel()) { reject(new Error("Anexar extrato só funciona na versão web.")); return; }
    var input = document.createElement("input");
    input.type = "file";
    input.accept = ".ofx,.OFX,.txt,application/x-ofx";
    input.onchange = function() {
      var file = input.files && input.files[0];
      if (!file) { resolve(null); return; }
      if (file.size > LIMITE_OFX_BYTES) { reject(new Error("Arquivo muito grande (máximo 5 MB).")); return; }
      var reader = new FileReader();
      reader.onload = function() {
        try {
          var texto = decodeTextoDoArquivo(reader.result as ArrayBuffer);
          if (!pareceOfx(texto)) { reject(new Error("Esse arquivo não parece um extrato OFX.")); return; }
          resolve({ nome: file!.name, texto: texto });
        } catch { reject(new Error("Não consegui ler o arquivo.")); }
      };
      reader.onerror = function() { reject(new Error("Não consegui ler o arquivo.")); };
      reader.readAsArrayBuffer(file);
    };
    input.click();
  });
}
