import { Colors } from "@/constants/colors";

export type Conversation = {
  id: string; name: string; phone: string; lastMsg: string;
  time: string; unread: number; avatar: string; status: "open" | "resolved" | "auto";
};

export type Message = {
  id: string; from: "client" | "user" | "aura"; text: string; time: string; auto?: boolean;
};

export type Automation = {
  id: string; name: string; desc: string; trigger: string;
  enabled: boolean; sent: number; icon: string;
};

export type Campaign = {
  id: string; name: string; status: "sent" | "draft";
  recipients: number; delivered: number; read: number; date: string | null;
};

export const TABS = ["Conversas", "Automações", "Campanhas", "Configurações"];

// WhatsApp Business API config (for future integration)
export const WHATSAPP_API = {
  // Meta Business Manager config — to be set during setup
  phoneNumberId: null as string | null,
  businessAccountId: null as string | null,
  accessToken: null as string | null,
  webhookVerifyToken: null as string | null,
  // API endpoints (production)
  baseUrl: "https://graph.facebook.com/v21.0",
  // Template message types approved by Meta
  templateCategories: ["MARKETING", "UTILITY", "AUTHENTICATION"] as const,
};

// Mock data
export const MOCK_CONVERSATIONS: Conversation[] = [
  { id: "1", name: "Maria Silva", phone: "(12) 99887-1234", lastMsg: "Obrigada! Vou passar ai na quinta.", time: "14:32", unread: 0, avatar: "M", status: "resolved" },
  { id: "2", name: "Pedro Costa", phone: "(12) 99776-5678", lastMsg: "Qual o valor do combo corte+barba?", time: "13:15", unread: 2, avatar: "P", status: "open" },
  { id: "3", name: "Ana Oliveira", phone: "(12) 99665-9012", lastMsg: "Confirma meu horário de amanhã?", time: "11:47", unread: 1, avatar: "A", status: "open" },
  { id: "4", name: "Joao Santos", phone: "(12) 99554-3456", lastMsg: "[Cobrança automática enviada]", time: "10:20", unread: 0, avatar: "J", status: "auto" },
  { id: "5", name: "Carlos Lima", phone: "(12) 99443-7890", lastMsg: "Tem pomada modeladora em estoque?", time: "Ontem", unread: 0, avatar: "C", status: "resolved" },
  { id: "6", name: "Lucia Ferreira", phone: "(12) 99332-1122", lastMsg: "[Pos-venda automática enviada]", time: "Ontem", unread: 0, avatar: "L", status: "auto" },
];

export const MOCK_MESSAGES: Message[] = [
  { id: "1", from: "client", text: "Oi! Qual o valor do combo corte+barba?", time: "13:10" },
  { id: "2", from: "aura", text: "Ola, Pedro! O combo corte+barba esta por R$ 70,00. Deseja agendar um horário?", time: "13:12", auto: true },
  { id: "3", from: "client", text: "Tem horário hoje a tarde?", time: "13:14" },
  { id: "4", from: "user", text: "Temos as 15h e 16h30. Qual prefere?", time: "13:15" },
];

export const MOCK_AUTOMATIONS: Automation[] = [
  { id: "1", name: "Boas-vindas", desc: "Mensagem automática para novos clientes após primeira compra", trigger: "Primeira compra", enabled: true, sent: 47, icon: "star" },
  { id: "2", name: "Cobrança gentil", desc: "Lembrete de pagamento 3 dias após vencimento", trigger: "Fatura vencida +3d", enabled: true, sent: 12, icon: "wallet" },
  { id: "3", name: "Aniversário", desc: "Mensagem de parabéns + cupom de desconto no aniversário", trigger: "Data de aniversário", enabled: true, sent: 8, icon: "users" },
  { id: "4", name: "Pos-venda", desc: "Pesquisa de satisfacao 24h após atendimento", trigger: "Venda confirmada +24h", enabled: false, sent: 0, icon: "check" },
  { id: "5", name: "Reativação", desc: "Convite para voltar após 30 dias sem visita", trigger: "Inativo 30+ dias", enabled: true, sent: 5, icon: "trending_up" },
  { id: "6", name: "Lembrete agendamento", desc: "Confirmação automática 2h antes do horário agendado", trigger: "Agendamento -2h", enabled: false, sent: 0, icon: "alert" },
];

export const MOCK_CAMPAIGNS: Campaign[] = [
  { id: "1", name: "Promoção de verao", status: "sent", recipients: 156, delivered: 148, read: 89, date: "25/03/2026" },
  { id: "2", name: "Lancamento combo", status: "sent", recipients: 203, delivered: 195, read: 134, date: "20/03/2026" },
  { id: "3", name: "Reativação marco", status: "draft", recipients: 42, delivered: 0, read: 0, date: null },
];
