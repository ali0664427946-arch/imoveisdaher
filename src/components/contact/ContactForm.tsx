import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Loader2, Send, Phone, Mail, MapPin, Clock } from "lucide-react";
import { motion } from "framer-motion";

const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome muito longo"),
  email: z
    .string()
    .trim()
    .email("Email inválido")
    .max(255, "Email muito longo"),
  phone: z
    .string()
    .trim()
    .min(10, "Telefone deve ter pelo menos 10 dígitos")
    .max(20, "Telefone muito longo")
    .regex(/^[\d\s()+-]+$/, "Telefone inválido"),
  message: z
    .string()
    .trim()
    .min(10, "Mensagem deve ter pelo menos 10 caracteres")
    .max(1000, "Mensagem muito longa"),
});

type ContactFormData = z.infer<typeof contactSchema>;

export function ContactForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      message: "",
    },
  });

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    try {
      // Create a lead from the contact form
      const normalizedPhone = data.phone.replace(/\D/g, "");
      
      const { error } = await supabase.from("leads").insert({
        name: data.name,
        email: data.email,
        phone: data.phone,
        phone_normalized: normalizedPhone ? `+55${normalizedPhone}` : null,
        origin: "site_contato",
        notes: data.message,
        status: "entrou_em_contato",
      });

      if (error) throw error;

      toast.success("Mensagem enviada!", {
        description: "Entraremos em contato em breve.",
      });

      form.reset();
    } catch (error) {
      console.error("Error submitting contact form:", error);
      toast.error("Erro ao enviar mensagem", {
        description: "Por favor, tente novamente.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contato" className="py-20 bg-secondary/50">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-accent font-semibold text-sm uppercase tracking-wider">
            Contato
          </span>
          <h2 className="text-3xl md:text-4xl font-heading font-bold mt-2 mb-4">
            Fale Conosco
          </h2>
          <p className="text-muted-foreground">
            Entre em contato e nossa equipe retornará o mais breve possível.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="space-y-8"
          >
            <div>
              <h3 className="text-xl font-heading font-semibold mb-6">
                Informações de Contato
              </h3>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium">Telefone / WhatsApp</p>
                    <a
                      href="https://wa.me/5521982095993"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-accent transition-colors"
                    >
                      (21) 98209-5993
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium">Email</p>
                    <a
                      href="mailto:contato@daherimoveis.com.br"
                      className="text-muted-foreground hover:text-accent transition-colors"
                    >
                      contato@daherimoveis.com.br
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium">Localização</p>
                    <p className="text-muted-foreground">
                      Jacarepaguá, Rio de Janeiro - RJ
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium">Horário de Atendimento</p>
                    <p className="text-muted-foreground">
                      Segunda a Sábado: 9h às 18h
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="bg-card rounded-2xl p-6 md:p-8 shadow-card"
          >
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome completo</FormLabel>
                      <FormControl>
                        <Input placeholder="Seu nome" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="seu@email.com"
                            {...field}
                          />
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
                        <FormLabel>Telefone</FormLabel>
                        <FormControl>
                          <Input placeholder="(21) 99999-9999" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mensagem</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Como podemos ajudar?"
                          className="min-h-[120px] resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  variant="hero"
                  size="lg"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Enviar Mensagem
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
