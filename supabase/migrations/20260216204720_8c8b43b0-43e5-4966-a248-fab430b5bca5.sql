ALTER TABLE analyses DROP CONSTRAINT IF EXISTS analyses_current_step_check;
ALTER TABLE analyses ADD CONSTRAINT analyses_current_step_check CHECK (current_step >= 1 AND current_step <= 13);