ALTER TABLE transactions ADD COLUMN user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
