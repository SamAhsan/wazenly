-- Meta's webhook sends type: "button" for quick-reply button taps, which crashed
-- message.create() since it wasn't a valid MessageType, failing the whole webhook
-- job (and blocking flow automation) for that message.
ALTER TYPE "MessageType" ADD VALUE 'BUTTON';
ALTER TYPE "MessageType" ADD VALUE 'UNKNOWN';
