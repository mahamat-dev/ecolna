-- Add CHECK constraint to ensure joined_on <= exited_on when both dates are present
-- This is a manual migration as mentioned in the requirements

ALTER TABLE enrollment 
ADD CONSTRAINT chk_enrollment_dates_order 
CHECK (exited_on IS NULL OR joined_on IS NULL OR joined_on <= exited_on);

-- Add comment for documentation
COMMENT ON CONSTRAINT chk_enrollment_dates_order ON enrollment IS 
'Ensures that when both joined_on and exited_on dates are present, joined_on must be less than or equal to exited_on';