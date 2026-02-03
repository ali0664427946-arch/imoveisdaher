import { motion } from "framer-motion";
import { MapPin, Users, Shield, Heart } from "lucide-react";

export default function About() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="bg-primary py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl"
          >
            <span className="text-accent font-semibold text-sm uppercase tracking-wider">
              Quem Somos
            </span>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-primary-foreground mt-2 mb-6">
              Daher Imóveis
            </h1>
            <p className="text-lg text-primary-foreground/80">
              Uma imobiliária em Jacarepaguá criada para oferecer um atendimento mais humano, transparente e seguro.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="prose prose-lg max-w-none"
            >
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                A Daher Imóveis é uma imobiliária localizada em Jacarepaguá, no Rio de Janeiro, criada para oferecer um atendimento imobiliário mais humano, transparente e seguro para quem deseja comprar, vender ou alugar imóveis na região.
              </p>

              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                Nossa história começou como <strong className="text-foreground">Daher Assessor Imobiliário</strong>, com um foco muito claro: assessorar o cliente em cada etapa do processo, explicando com clareza, evitando riscos e garantindo decisões seguras. Desde o início, atuamos com forte presença em Jacarepaguá e bairros da Zona Sudoeste do Rio de Janeiro, sempre valorizando o relacionamento e a confiança.
              </p>

              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                Com o crescimento da demanda e a consolidação da marca, evoluímos naturalmente para <strong className="text-foreground">Daher Imóveis</strong> — uma imobiliária completa, preparada para atender desde a primeira visita até a entrega das chaves, seja na compra, venda ou locação de imóveis residenciais e comerciais em Jacarepaguá e no Rio de Janeiro.
              </p>

              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                Hoje, a Daher Imóveis une conhecimento do mercado imobiliário local, atendimento personalizado e estratégia, ajudando clientes a encontrar imóveis em bairros como <strong className="text-foreground">Jacarepaguá, Freguesia, Taquara, Barra da Tijuca</strong> e região, sempre com foco em segurança jurídica, transparência e agilidade.
              </p>
            </motion.div>

            {/* Highlight Quote */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="my-12 p-8 bg-accent/10 rounded-2xl border-l-4 border-accent"
            >
              <p className="text-xl font-heading font-semibold text-foreground italic">
                "Mudamos o nome, mas mantivemos o que sempre nos definiu: ética, compromisso e cuidado real com cada cliente."
              </p>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-lg text-muted-foreground leading-relaxed"
            >
              Se você procura uma imobiliária em Jacarepaguá, com atuação sólida no Rio de Janeiro, a Daher Imóveis está pronta para te ajudar a fazer um bom negócio com tranquilidade e confiança.
            </motion.p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 bg-secondary/50">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-accent font-semibold text-sm uppercase tracking-wider">
              Nossos Valores
            </span>
            <h2 className="text-3xl md:text-4xl font-heading font-bold mt-2">
              O que nos move
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              {
                icon: Shield,
                title: "Ética",
                description: "Transparência e honestidade em todas as negociações.",
              },
              {
                icon: Heart,
                title: "Compromisso",
                description: "Dedicação total para encontrar o melhor para você.",
              },
              {
                icon: Users,
                title: "Cuidado",
                description: "Atendimento humanizado e personalizado.",
              },
              {
                icon: MapPin,
                title: "Conhecimento Local",
                description: "Especialistas em Jacarepaguá e região.",
              },
            ].map((value, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-card rounded-2xl p-6 text-center shadow-card"
              >
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <value.icon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-lg font-heading font-semibold mb-2">{value.title}</h3>
                <p className="text-sm text-muted-foreground">{value.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Location */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <span className="text-accent font-semibold text-sm uppercase tracking-wider">
              Áreas de Atuação
            </span>
            <h2 className="text-3xl md:text-4xl font-heading font-bold mt-2 mb-8">
              Onde atuamos
            </h2>
            <div className="flex flex-wrap justify-center gap-3">
              {[
                "Jacarepaguá",
                "Freguesia",
                "Taquara",
                "Barra da Tijuca",
                "Recreio",
                "Pechincha",
                "Tanque",
                "Praça Seca",
                "Vila Valqueire",
                "Cidade de Deus",
              ].map((bairro, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="px-4 py-2 bg-secondary rounded-full text-sm font-medium"
                >
                  {bairro}
                </motion.span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
