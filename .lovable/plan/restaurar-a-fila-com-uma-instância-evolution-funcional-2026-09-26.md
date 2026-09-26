# Restaurar a fila com uma instância Evolution funcional

## Alterações
- Consultar as instâncias disponíveis na Evolution API antes de cada envio agendado.
- Validar a sessão de cada instância conectada com uma chamada real de WhatsApp, não apenas pelo estado “open”.
- Manter `leads` quando ela estiver funcional; caso contrário, selecionar automaticamente outra instância que aceite mensagens.
- Usar a instância validada no endpoint de envio e registrar qual foi escolhida e o código exato da resposta.
- Se nenhuma instância aceitar mensagens, preservar o agendamento como pendente, sem bloquear os próximos da fila.

## Validação
- Publicar somente o processador de mensagens agendadas.
- Liberar um agendamento pendente para um único teste.
- Confirmar nos registros o endpoint escolhido, o código da Evolution e o estado final da mensagem.
