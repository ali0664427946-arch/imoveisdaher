import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SearchFilters } from "@/components/properties/SearchFilters";
import { PropertyGrid } from "@/components/properties/PropertyGrid";
import { ContactForm } from "@/components/contact/ContactForm";
import { Building2, Users, Award, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import heroBg from "@/assets/hero-bg.jpg";

export default function Index() {
  // Fetch featured properties from database
  const { data: featuredProperties = [], isLoading: loadingFeatured } = useQuery({
    queryKey: ["featured-properties"],
    queryFn: async () => {
      const { data: properties, error } = await supabase
        .from("properties")
        .select(`
          *,
          property_photos (url, sort_order)
        `)
        .eq("status", "active")
        .eq("featured", true)
        .limit(4);

      if (error) throw error;

      return properties.map((p) => ({
        id: p.id,
        title: p.title,
        price: Number(p.price),
        purpose: p.purpose as "rent" | "sale",
        type: p.type,
        neighborhood: p.neighborhood,
        city: p.city,
        bedrooms: p.bedrooms ?? 0,
        bathrooms: p.bathrooms ?? 0,
        parking: p.parking ?? 0,
        area: p.area ? Number(p.area) : undefined,
        imageUrl: p.property_photos?.[0]?.url,
        featured: p.featured ?? false,
        origin: p.origin,
      }));
    },
  });

  // Fetch recent properties from database
  const { data: recentProperties = [], isLoading: loadingRecent } = useQuery({
    queryKey: ["recent-properties"],
    queryFn: async () => {
      const { data: properties, error } = await supabase
        .from("properties")
        .select(`
          *,
          property_photos (url, sort_order)
        `)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(4);

      if (error) throw error;

      return properties.map((p) => ({
        id: p.id,
        title: p.title,
        price: Number(p.price),
        purpose: p.purpose as "rent" | "sale",
        type: p.type,
        neighborhood: p.neighborhood,
        city: p.city,
        bedrooms: p.bedrooms ?? 0,
        bathrooms: p.bathrooms ?? 0,
        parking: p.parking ?? 0,
        area: p.area ? Number(p.area) : undefined,
        imageUrl: p.property_photos?.[0]?.url,
        isNew: true,
        origin: p.origin,
      }));
    },
  });

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img src={heroBg} alt="Imóveis em Jacarepaguá e Zona Sudoeste do Rio de Janeiro" className="w-full h-full object-cover" />
          <div className="hero-overlay absolute inset-0" />
        </div>

        {/* Content */}
        <div className="relative z-10 container mx-auto px-4 py-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto"
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-white mb-6 leading-tight">
              Imobiliária em Jacarepaguá:{" "}
              <span className="text-accent">seu imóvel ideal</span>
            </h1>
            <p className="text-lg md:text-xl text-white/80 mb-10 max-w-2xl mx-auto">
              Compra, venda e aluguel de imóveis em Jacarepaguá e Zona Sudoeste do Rio de Janeiro com atendimento personalizado.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <SearchFilters variant="hero" />
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto"
          >
            {[
              { value: "500+", label: "Imóveis" },
              { value: "1.200+", label: "Clientes Satisfeitos" },
              { value: "15+", label: "Anos de Experiência" },
              { value: "98%", label: "Taxa de Satisfação" },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl md:text-4xl font-heading font-bold text-accent">
                  {stat.value}
                </div>
                <div className="text-sm text-white/70">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-white/30 flex items-start justify-center p-2">
            <div className="w-1 h-2 bg-white/50 rounded-full" />
          </div>
        </div>
      </section>

      {/* Featured Properties */}
      {(loadingFeatured || featuredProperties.length > 0) && (
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
              <div>
                <span className="text-accent font-semibold text-sm uppercase tracking-wider">
                  Destaques
                </span>
                <h2 className="text-3xl md:text-4xl font-heading font-bold mt-2">
                  Imóveis em Destaque no Rio de Janeiro
                </h2>
                <p className="text-muted-foreground mt-2 max-w-lg">
                  Selecionamos as melhores opções de imóveis no estado do Rio de Janeiro para você.
                </p>
              </div>
              <Button variant="outline" asChild>
                <Link to="/imoveis">
                  Ver todos os imóveis
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>

            <PropertyGrid properties={featuredProperties} loading={loadingFeatured} />
          </div>
        </section>
      )}

      {/* Why Choose Us */}
      <section className="py-20 bg-secondary/50">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-accent font-semibold text-sm uppercase tracking-wider">
              Por que nos escolher
            </span>
            <h2 className="text-3xl md:text-4xl font-heading font-bold mt-2">
              Sua imobiliária de confiança no Rio de Janeiro
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Building2,
                title: "Variedade em Jacarepaguá",
                description: "Imóveis para todos os perfis em Jacarepaguá e região, do studio ao alto padrão.",
              },
              {
                icon: Users,
                title: "Atendimento Local",
                description: "Equipe especializada na Zona Sudoeste do RJ pronta para encontrar o imóvel ideal.",
              },
              {
                icon: Award,
                title: "Processo Seguro",
                description: "Documentação digital, análise rápida e suporte completo em todo o Rio de Janeiro.",
              },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-card rounded-2xl p-8 shadow-card hover:shadow-card-hover transition-shadow"
              >
                <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center mb-6">
                  <feature.icon className="w-7 h-7 text-accent" />
                </div>
                <h3 className="text-xl font-heading font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Properties */}
      {(loadingRecent || recentProperties.length > 0) && (
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
              <div>
                <span className="text-accent font-semibold text-sm uppercase tracking-wider">
                  Novidades
                </span>
                <h2 className="text-3xl md:text-4xl font-heading font-bold mt-2">
                  Novos Imóveis em Jacarepaguá
                </h2>
              </div>
              <Button variant="outline" asChild>
                <Link to="/imoveis">
                  Ver mais
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>

            <PropertyGrid properties={recentProperties} loading={loadingRecent} />
          </div>
        </section>
      )}

      {/* Contact Form Section */}
      <ContactForm />

      {/* CTA Section */}
      <section className="py-20 bg-primary">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-primary-foreground mb-6">
              Encontre seu imóvel em Jacarepaguá
            </h2>
            <p className="text-primary-foreground/80 text-lg mb-8 max-w-2xl mx-auto">
              Fale com a Daher Imóveis e encontre a melhor opção de compra ou aluguel na Zona Sudoeste do Rio de Janeiro.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="hero" size="xl" asChild>
                <Link to="/imoveis">Ver Imóveis Disponíveis</Link>
              </Button>
              <Button variant="glass" size="xl" asChild>
                <a href="#contato">Fale Conosco</a>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
