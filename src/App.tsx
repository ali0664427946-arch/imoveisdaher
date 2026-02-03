import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";
import Index from "./pages/Index";
import PropertiesList from "./pages/PropertiesList";
import PropertyDetail from "./pages/PropertyDetail";
import InterestForm from "./pages/InterestForm";
import About from "./pages/About";
import Auth from "./pages/Auth";
import Dashboard from "./pages/admin/Dashboard";
import Inbox from "./pages/admin/Inbox";
import Leads from "./pages/admin/Leads";
import Properties from "./pages/admin/Properties";
import Fichas from "./pages/admin/Fichas";
import FichaDetail from "./pages/admin/FichaDetail";
import Templates from "./pages/admin/Templates";
import Settings from "./pages/admin/Settings";
import InstallApp from "./pages/InstallApp";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/imoveis" element={<PropertiesList />} />
              <Route path="/imovel/:id" element={<PropertyDetail />} />
              <Route path="/ficha/:propertyId" element={<InterestForm />} />
              <Route path="/ficha" element={<InterestForm />} />
              <Route path="/sobre" element={<About />} />
              <Route path="/contato" element={<Index />} />
            </Route>
            
            {/* Auth & Install */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/instalar" element={<InstallApp />} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="inbox" element={<Inbox />} />
              <Route path="leads" element={<Leads />} />
              <Route path="imoveis" element={<Properties />} />
              <Route path="fichas" element={<Fichas />} />
              <Route path="fichas/:id" element={<FichaDetail />} />
              <Route path="templates" element={<Templates />} />
              <Route path="configuracoes" element={<Settings />} />
            </Route>
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
