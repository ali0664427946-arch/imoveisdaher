# Corrigir falhas temporárias nos agendamentos

## Alterações
- Manter a instância configurada `leads`; não trocar para outra conta.
- Antes do envio, confirmar o estado atual da instância na Evolution API.
- Quando a Evolution responder `Connection Closed` ou outro erro temporário de conexão, tentar novamente com pequenos intervalos.
- Se todas as tentativas falharem por conexão temporária, manter a mensagem como agendada para o próximo processamento, em vez de marcá-la como falha.
- Preservar os limites, horários e intervalos anti-ban já existentes.
- Recolocar somente o teste de 25/09 às 11:50 na fila e validar os registros após a correção.

## Detalhes técnicos
- Alterar apenas a função de processamento de mensagens agendadas.
- Registrar cada tentativa e a causa final para facilitar o diagnóstico.
- Publicar e verificar a função antes de concluir.
