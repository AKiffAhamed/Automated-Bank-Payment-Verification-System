import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "https://rbvopqrawurpjqcixsxz.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJidm9wcXJhd3VycGpxY2l4c3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1Mjc3MDQsImV4cCI6MjEwNjEwMzcwNH0.uRJvtlIV8VaIZR_-rLnmuLaIXC93Ln5ihYC03SN7uGQ";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const RECEIPTS_BUCKET = "payment-receipts";
