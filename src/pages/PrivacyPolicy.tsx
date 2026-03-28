export default function PrivacyPolicy() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl">
      <h1 className="text-3xl font-heading font-bold mb-8">Política de Privacidade</h1>
      <p className="text-muted-foreground mb-4">Última atualização: 28 de março de 2026</p>

      <div className="prose prose-lg max-w-none space-y-6 text-foreground/80">
        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">1. Introdução</h2>
          <p>A Daher Imóveis ("nós", "nosso") está comprometida em proteger a privacidade dos usuários ("você") do nosso site e serviços. Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e compartilhamos suas informações pessoais.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">2. Informações que Coletamos</h2>
          <p>Podemos coletar as seguintes informações:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Dados de identificação:</strong> nome completo, CPF, RG, data de nascimento.</li>
            <li><strong>Dados de contato:</strong> e-mail, telefone, endereço, número de WhatsApp.</li>
            <li><strong>Dados financeiros:</strong> renda, tipo de emprego, informações profissionais.</li>
            <li><strong>Dados de navegação:</strong> endereço IP, tipo de navegador, páginas acessadas.</li>
            <li><strong>Mensagens:</strong> conteúdo de mensagens trocadas via WhatsApp através da nossa plataforma.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">3. Como Usamos suas Informações</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Gerenciar cadastros e fichas de interesse em imóveis.</li>
            <li>Comunicar-nos com você via WhatsApp, e-mail ou telefone.</li>
            <li>Melhorar nossos serviços e experiência do usuário.</li>
            <li>Cumprir obrigações legais e regulatórias.</li>
            <li>Analisar imóveis compatíveis com seu perfil.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">4. Compartilhamento de Dados</h2>
          <p>Não vendemos seus dados pessoais. Podemos compartilhar informações com:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Proprietários de imóveis para análise cadastral.</li>
            <li>Prestadores de serviço que auxiliam nossas operações (hospedagem, comunicação).</li>
            <li>Autoridades competentes, quando exigido por lei.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">5. Integração com WhatsApp/Meta</h2>
          <p>Utilizamos a API do WhatsApp Business (Meta) para comunicação. Ao interagir conosco pelo WhatsApp:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Suas mensagens são processadas pela Meta conforme a política de privacidade da Meta.</li>
            <li>Armazenamos o conteúdo das conversas para fins de atendimento e histórico.</li>
            <li>Não compartilhamos suas mensagens com terceiros não autorizados.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">6. Armazenamento e Segurança</h2>
          <p>Seus dados são armazenados em servidores seguros com criptografia. Adotamos medidas técnicas e organizacionais para proteger suas informações contra acesso não autorizado, perda ou destruição.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">7. Seus Direitos (LGPD)</h2>
          <p>Conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você tem direito a:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Confirmar a existência de tratamento de dados.</li>
            <li>Acessar, corrigir ou excluir seus dados pessoais.</li>
            <li>Revogar consentimento a qualquer momento.</li>
            <li>Solicitar portabilidade dos dados.</li>
          </ul>
          <p>Para exercer seus direitos, entre em contato: <a href="mailto:contato@daherimob.com" className="text-accent hover:underline">contato@daherimob.com</a></p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">8. Contato</h2>
          <p>Daher Imóveis — CRECI-J 12635</p>
          <p>Condomínio Mix Mall — R. Lopo Saraiva, 179, Bloco 02 Sl 432, Pechincha, Rio de Janeiro — RJ, 22740-220</p>
          <p>E-mail: <a href="mailto:contato@daherimob.com" className="text-accent hover:underline">contato@daherimob.com</a></p>
          <p>Telefone: (21) 3274-6226</p>
        </section>
      </div>
    </div>
  );
}