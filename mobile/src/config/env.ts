/**
 * Environment config: dev / staging / prod.
 * Use EXPO_PUBLIC_* in .env or app.config.js for build-time values.
 */

export type EnvName = "dev" | "staging" | "prod";

export interface EnvConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  envName: EnvName;
}

const dev: EnvConfig = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  envName: "dev",
};

const staging: EnvConfig = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  envName: "staging",
};

const prod: EnvConfig = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  envName: "prod",
};

const envMap: Record<EnvName, EnvConfig> = { dev, staging, prod };

function getEnvName(): EnvName {
  const v = process.env.EXPO_PUBLIC_APP_ENV;
  if (v === "staging" || v === "prod") return v;
  return "dev";
}

export const env = envMap[getEnvName()];
