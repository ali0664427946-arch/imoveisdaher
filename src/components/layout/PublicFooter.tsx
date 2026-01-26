import { Link } from "react-router-dom";
import { Mail, Phone, MapPin, Facebook, Instagram, Linkedin } from "lucide-react";
import logoImage from "@/assets/logo-daher.png";

export function PublicFooter() {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="inline-block">
              <img
                src={logoImage}
                alt="Daher Imóveis"
                className="h-16 w-auto"
              />
            </Link>
            <p className="text-primary-foreground/70 text-sm leading-relaxed">
              Sua plataforma completa para encontrar o imóvel ideal. 
              Trabalhamos com os melhores imóveis para você.
            </p>
            <div className="flex gap-3">
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-accent transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-accent transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-accent transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-heading font-semibold text-lg mb-4">Links Rápidos</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/imoveis" className="text-primary-foreground/70 hover:text-accent transition-colors">
                  Ver Imóveis
                </Link>
              </li>
              <li>
                <Link to="/imoveis?purpose=rent" className="text-primary-foreground/70 hover:text-accent transition-colors">
                  Alugar
                </Link>
              </li>
              <li>
                <Link to="/imoveis?purpose=sale" className="text-primary-foreground/70 hover:text-accent transition-colors">
                  Comprar
                </Link>
              </li>
              <li>
                <Link to="/sobre" className="text-primary-foreground/70 hover:text-accent transition-colors">
                  Sobre Nós
                </Link>
              </li>
            </ul>
          </div>

          {/* Property Types */}
          <div>
            <h4 className="font-heading font-semibold text-lg mb-4">Tipos de Imóveis</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/imoveis?type=apartamento" className="text-primary-foreground/70 hover:text-accent transition-colors">
                  Apartamentos
                </Link>
              </li>
              <li>
                <Link to="/imoveis?type=casa" className="text-primary-foreground/70 hover:text-accent transition-colors">
                  Casas
                </Link>
              </li>
              <li>
                <Link to="/imoveis?type=comercial" className="text-primary-foreground/70 hover:text-accent transition-colors">
                  Comercial
                </Link>
              </li>
              <li>
                <Link to="/imoveis?type=terreno" className="text-primary-foreground/70 hover:text-accent transition-colors">
                  Terrenos
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-heading font-semibold text-lg mb-4">Contato</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                <span className="text-primary-foreground/70 text-sm">
                  Av. Paulista, 1000 - Bela Vista<br />
                  São Paulo - SP
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-accent shrink-0" />
                <a href="tel:+5511999999999" className="text-primary-foreground/70 hover:text-accent transition-colors text-sm">
                  (11) 99999-9999
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-accent shrink-0" />
                <a href="mailto:contato@daherimoveis.com.br" className="text-primary-foreground/70 hover:text-accent transition-colors text-sm">
                  contato@daherimoveis.com.br
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-primary-foreground/50 text-sm">
            © {new Date().getFullYear()} Daher Imóveis. Todos os direitos reservados. CRECI-J 12635
          </p>
          <div className="flex gap-6">
            <Link to="/privacidade" className="text-primary-foreground/50 hover:text-primary-foreground text-sm transition-colors">
              Política de Privacidade
            </Link>
            <Link to="/termos" className="text-primary-foreground/50 hover:text-primary-foreground text-sm transition-colors">
              Termos de Uso
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
