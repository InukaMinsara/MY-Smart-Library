import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'd:/library/.env' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  const { data, error } = await supabase.rpc('get_books_columns'); // doesn't exist probably
  
  // Actually, just fetch one book and print its keys
  const { data: book, error: err } = await supabase.from('books').select('*').limit(1).single();
  if (err) console.error("Error fetching book:", err);
  else console.log("Columns:", Object.keys(book));
}

checkSchema();
