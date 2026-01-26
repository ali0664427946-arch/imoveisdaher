import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SendWhatsAppParams {
  phone: string;
  message: string;
  fichaId?: string;
}

interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export function useSendWhatsApp() {
  return useMutation({
    mutationFn: async ({ phone, message, fichaId }: SendWhatsAppParams): Promise<WhatsAppResponse> => {
      const response = await supabase.functions.invoke("send-whatsapp", {
        body: { phone, message, fichaId },
      });

      if (response.error) {
        throw new Error(response.error.message || "Erro ao enviar mensagem");
      }

      return response.data as WhatsAppResponse;
    },
    onSuccess: () => {
      toast.success("Mensagem enviada!", {
        description: "A mensagem foi enviada via WhatsApp com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast.error("Erro ao enviar mensagem", {
        description: error.message,
      });
    },
  });
}
