/** Which integrations are configured. Everything degrades to a clear message when a key is missing. */
export const supabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const supabaseConfigured = () => !!(supabaseUrl() && supabaseAnonKey());
export const serviceRoleConfigured = () => supabaseConfigured() && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

export const razorpayConfigured = () => !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
export const webhookSecret = () => process.env.RAZORPAY_WEBHOOK_SECRET ?? "";

/** The AI solver must never be open to everyone in production: it spends API credits. */
export const solverNeedsLogin = () => process.env.NODE_ENV === "production" || supabaseConfigured();
