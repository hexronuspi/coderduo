-- Migration to add chat column to questions_user table
-- and update the RLS policies

-- First check if the chat column already exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'questions_user' AND column_name = 'chat'
  ) THEN
    -- Add the chat column as a JSONB array
    ALTER TABLE questions_user 
    ADD COLUMN IF NOT EXISTS chat JSONB DEFAULT '[]'::jsonb;
    
    -- Update the RLS policies to include the chat column
    -- Drop existing policies that need to be updated
    DROP POLICY IF EXISTS "Users can view their own questions" ON questions_user;
    DROP POLICY IF EXISTS "Users can update their own questions" ON questions_user;
    
    -- Recreate the policies with chat column access
    CREATE POLICY "Users can view their own questions" 
      ON questions_user FOR SELECT 
      USING (auth.uid() = user_id);
    
    CREATE POLICY "Users can update their own questions" 
      ON questions_user FOR UPDATE 
      USING (auth.uid() = user_id);

    -- Add specific policy for chat updates if needed
    CREATE POLICY "Users can update chat on their own questions" 
      ON questions_user FOR UPDATE 
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
