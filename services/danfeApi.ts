import { request } from "./api";

export interface DanfeItem {
  idx: number;
  description: string;
  quantity: number;
  unit_cost: number;
  unit: string;
  ncm: string | null;
  supplier_code: string | null;
  ean: string | null;
}

export interface DanfeXmlResult {
  items: DanfeItem[];
  supplier_name: string | null;
  supplier_cnpj: string | null;
  invoice_number: string | null;
  invoice_series: string | null;
  invoice_date: string | null;
  total_value: number;
  stats: {
    extracted_count: number;
    elapsed_ms: number;
    source: "xml";
  };
  warning?: string;
}

export var danfeApi = {
  parseXml: function (companyId: string, xmlContent: string) {
    return request<DanfeXmlResult>(
      "/companies/" + companyId + "/products/import-danfe-xml",
      { method: "POST", body: { xml_content: xmlContent }, timeout: 15000 }
    );
  },
};
