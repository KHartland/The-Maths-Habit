import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://kxvtiqkmxhqwqckjikje.supabase.co';
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4dnRpcWtteGhxd3Fja2ppa2plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MDcxMTEsImV4cCI6MjA4NDM4MzExMX0.AP5MvYUCHYZ5V-kmtCRrOyK0bHV2iqUbnGnVhXqpAeo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;
