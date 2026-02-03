import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MessageCircle, CheckCircle } from "lucide-react";

const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome muito longo"),
  phone: z
    .string()
    .trim()
    .min(10, "Telefone deve ter pelo menos 10 dígitos com DDD")
    .max(20, "Telefone muito longo")
    .regex(/^[\d\s()+-]+$/, "Telefone inválido"),
});

type ContactFormData = z.infer<typeof contactSchema>;

interface WhatsAppContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: {
    id: string;
    title: string;
    neighborhood: string;
    city: string;
    price: number;
    purpose: "rent" | "sale";
  };
}

export function WhatsAppContactDialog({
  open,
  onOpenChange,
  property,
}: WhatsAppContactDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      phone: "",
    },
  });

  const formatPrice = (price: number, purpose: string) => {
    const formatted = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(price);
    return purpose === "rent" ? `${formatted}/mês` : formatted;
  };

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    try {
      const response = await supabase.functions.invoke("initiate-whatsapp-contact", {
        body: {
          name: data.name,
          phone: data.phone,
          propertyId: property.id,
          propertyTitle: property.title,
          propertyNeighborhood: property.neighborhood,
          propertyPrice: property.price,
          propertyPurpose: property.purpose,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Erro ao enviar mensagem");
      }

      if (!response.data?.success) {
        throw new Error(response.data?.error || "Erro ao enviar mensagem");
      }

      setSuccess(true);
      toast.success("Mensagem enviada!", {
        description: "Em breve entraremos em contato pelo WhatsApp.",
      });

      // Reset form after 2 seconds and close dialog
      setTimeout(() => {
        form.reset();
        setSuccess(false);
        onOpenChange(false);
      }, 2000);
    } catch (error) {
      console.error("Error initiating WhatsApp contact:", error);
      toast.error("Erro ao enviar mensagem", {
        description: error instanceof Error ? error.message : "Por favor, tente novamente.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
      setSuccess(false);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-600" />
            Contato via WhatsApp
          </DialogTitle>
          <DialogDescription>
            Preencha seus dados para receber informações sobre este imóvel diretamente no seu WhatsApp.
          </DialogDescription>
        </DialogHeader>

        {/* Property Info */}
        <div className="bg-secondary/50 rounded-lg p-3 text-sm">
          <p className="font-medium text-foreground line-clamp-1">{property.title}</p>
          <p className="text-muted-foreground">
            {property.neighborhood}, {property.city}
          </p>
          <p className="text-accent font-semibold mt-1">
            {formatPrice(property.price, property.purpose)}
          </p>
        </div>

        {success ? (
          <div className="py-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <p className="text-lg font-semibold">Mensagem enviada!</p>
            <p className="text-muted-foreground">
              Aguarde nosso contato pelo WhatsApp.
            </p>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Seu nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Como podemos te chamar?" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WhatsApp (com DDD)</FormLabel>
                    <FormControl>
                      <Input placeholder="(21) 99999-9999" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Receber no WhatsApp
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Ao enviar, você autoriza nosso contato via WhatsApp.
              </p>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
