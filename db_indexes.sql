-- ============================================================
-- VGN Fairmont Bot — Database Performance Index Migration
-- Run this in your Supabase SQL Editor (one time only).
-- All statements use IF NOT EXISTS so it is safe to re-run.
-- ============================================================

-- 1. Speed up conversation lookup by phone number (most frequent query — every single message)
CREATE INDEX IF NOT EXISTS idx_conversations_phone
  ON conversations(phone);

-- 2. Speed up message history fetch (ORDER BY created_at DESC LIMIT 20 per conversation)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages(conversation_id, created_at DESC);

-- 3. Speed up rate-limit count query (count user messages per conversation within a time window)
CREATE INDEX IF NOT EXISTS idx_messages_convo_role_created
  ON messages(conversation_id, role, created_at);

-- 4. Speed up duplicate message check (whatsapp_msg_id unique lookup on every webhook)
CREATE INDEX IF NOT EXISTS idx_messages_whatsapp_msg_id
  ON messages(whatsapp_msg_id);

-- 5. Speed up ticket lookups by phone (used in feedback flow)
CREATE INDEX IF NOT EXISTS idx_tickets_phone
  ON tickets(phone);

-- 6. Partial index for pending feedback check (only indexes PENDING rows — tiny and very fast)
CREATE INDEX IF NOT EXISTS idx_tickets_feedback_pending
  ON tickets(phone, feedback_comment)
  WHERE feedback_comment = 'PENDING';

-- 7. Speed up bot message lookup (used in concurrency/race-condition check)
CREATE INDEX IF NOT EXISTS idx_messages_role_convo_created
  ON messages(role, conversation_id, created_at DESC);

-- ============================================================
-- OPTIONAL: Archive messages older than 6 months
-- Uncomment and run manually if your messages table is large.
-- This reduces table size and speeds up all message queries.
-- ============================================================
-- DELETE FROM messages
-- WHERE created_at < NOW() - INTERVAL '6 months';

-- ============================================================
-- VERIFY: Check all indexes were created
-- ============================================================
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
