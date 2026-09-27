import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "https://rbvopqrawurpjqcixsxz.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJydnZvcHFyYXd1cnBqcWNpeHN4eiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzkwNTI3NzA0LCJleHAiOjIxMDYxMDM3MDR9.uRJvtlIV8VaIZR_-rLnmuLaIXC93Ln5ihYC03SN7uGQ";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const RECEIPTS_BUCKET = "payment-receipts";
