export default function TermsOfService() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl">
      <h1 className="text-3xl font-heading font-bold mb-8">Termos de Uso</h1>
      <p className="text-muted-foreground mb-4">Última atualização: 28 de março de 2026</p>

      <div className="prose prose-lg max-w-none space-y-6 text-foreground/80">
        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">1. Aceitação dos Termos</h2>
          <p>Ao acessar e utilizar o site e serviços da Daher Imóveis, você concorda com estes Termos de Uso. Caso não concorde, por favor não utilize nossos serviços.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">2. Descrição dos Serviços</h2>
          <p>A Daher Imóveis oferece:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Listagem e busca de imóveis para venda e locação.</li>
            <li>Cadastro de fichas de interesse para análise cadastral.</li>
            <li>Comunicação via WhatsApp Business para atendimento ao cliente.</li>
            <li>Agendamento de visitas a imóveis.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">3. Cadastro e Informações</h2>
          <p>Ao preencher fichas de interesse ou formulários em nosso site, você declara que:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Todas as informações fornecidas são verdadeiras e precisas.</li>
            <li>Os documentos enviados são autênticos.</li>
            <li>Autoriza a Daher Imóveis a utilizar os dados para análise cadastral.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">4. Comunicação via WhatsApp</h2>
          <p>Ao fornecer seu número de WhatsApp, você consente em:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Receber mensagens relacionadas aos imóveis de seu interesse.</li>
            <li>Receber atualizações sobre o andamento de suas solicitações.</li>
            <li>Ser contatado pela equipe da Daher Imóveis para atendimento.</li>
          </ul>
          <p>Você pode solicitar a interrupção das comunicações a qualquer momento.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">5. Propriedade Intelectual</h2>
          <p>Todo o conteúdo do site, incluindo textos, imagens, logotipos e layout, é de propriedade da Daher Imóveis e protegido por leis de direitos autorais. É proibida a reprodução sem autorização prévia.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">6. Imóveis e Informações</h2>
          <p>As informações sobre imóveis apresentadas no site são fornecidas de boa-fé, porém:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Podem sofrer alterações sem aviso prévio.</li>
            <li>Fotos e descrições são ilustrativas.</li>
            <li>Valores estão sujeitos a confirmação.</li>
            <li>A disponibilidade deve ser confirmada com nossa equipe.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">7. Limitação de Responsabilidade</h2>
          <p>A Daher Imóveis não se responsabiliza por:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Indisponibilidade temporária do site.</li>
            <li>Decisões tomadas com base nas informações do site.</li>
            <li>Problemas técnicos fora do nosso controle.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">8. Legislação Aplicável</h2>
          <p>Estes termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da Comarca do Rio de Janeiro — RJ para dirimir quaisquer controvérsias.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">9. Contato</h2>
          <p>Daher Imóveis — CRECI-J 12635</p>
          <p>E-mail: <a href="mailto:contato@daherimob.com" className="text-accent hover:underline">contato@daherimob.com</a></p>
          <p>Telefone: (21) 3274-6226</p>
        </section>
      </div>
    </div>
  );
}