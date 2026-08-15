export const realtimeTools = [
  {
    type: "function",
    name: "wait_for_user",
    description:
      "Não fala nada e aguarda a próxima fala quando o último áudio foi silêncio, ruído, conversa lateral ou não trouxe palavras úteis.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {},
      required: [],
    },
  },
  {
    type: "function",
    name: "complete_onboarding",
    description:
      "Sinaliza que a conversa terminou depois de uma confirmação curta. Não inclua rotina, resumo ou outras informações nos argumentos; a rotina será organizada separadamente a partir da transcrição.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {},
      required: [],
    },
  },
] as const;
