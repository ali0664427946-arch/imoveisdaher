# Project Architecture Rules

- Scheduled Evolution sends must probe available WhatsApp sessions and use only an instance whose messaging session responds successfully; this prevents a stale `open` status from blocking the queue.