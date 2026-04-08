import { useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { companiesApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import type { Conversation, Message, Automation, Campaign } from "@/components/screens/whatsapp/types";
import { MOCK_CONVERSATIONS, MOCK_MESSAGES, MOCK_AUTOMATIONS, MOCK_CAMPAIGNS } from "@/components/screens/whatsapp/types";

export function useWhatsApp() {
  const { company, token, isDemo } = useAuthStore();
  const companyId = company?.id;

  // Future: fetch real conversations from WhatsApp Business API via backend proxy
  // GET /companies/:id/whatsapp/conversations
  const { data: apiConversations, isLoading: loadingConvos } = useQuery({
    queryKey: ["whatsapp-conversations", companyId],
    queryFn: () => (companiesApi as any).whatsappConversations?.(companyId!) || Promise.resolve(null),
    enabled: !!companyId && !!token && !isDemo,
    retry: 1,
    staleTime: 30000,
  });

  // Future: fetch automations config
  const { data: apiAutomations } = useQuery({
    queryKey: ["whatsapp-automations", companyId],
    queryFn: () => (companiesApi as any).whatsappAutomations?.(companyId!) || Promise.resolve(null),
    enabled: !!companyId && !!token && !isDemo,
    retry: 1,
    staleTime: 60000,
  });

  const result = useMemo(() => {
    const conversations: Conversation[] = apiConversations?.conversations || MOCK_CONVERSATIONS;
    const automations: Automation[] = apiAutomations?.automations || MOCK_AUTOMATIONS;
    const campaigns: Campaign[] = MOCK_CAMPAIGNS; // Future: fetch from API
    const messages: Message[] = MOCK_MESSAGES; // Future: fetch per conversation

    const unreadCount = conversations.reduce((s, c) => s + c.unread, 0);
    const openCount = conversations.filter(c => c.status === "open").length;
    const activeAutomations = automations.filter(a => a.enabled).length;
    const totalSent = automations.reduce((s, a) => s + a.sent, 0);

    // Connection status (future: check via API)
    const isConnected = !isDemo; // Mock: connected if logged in

    return {
      conversations, messages, automations, campaigns,
      unreadCount, openCount, activeAutomations, totalSent,
      isConnected, isDemo: isDemo || false,
    };
  }, [apiConversations, apiAutomations, isDemo]);

  const toggleAutomation = useCallback((id: string) => {
    // Future: PATCH /companies/:id/whatsapp/automations/:aid
    toast.success("Automacao atualizada");
  }, []);

  const sendMessage = useCallback((conversationId: string, text: string) => {
    // Future: POST /companies/:id/whatsapp/messages
    toast.success("Mensagem enviada");
  }, []);

  return { ...result, isLoading: loadingConvos, toggleAutomation, sendMessage };
}
