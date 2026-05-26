/** Live app URL — used for invite emails when APP_URL secret is not set. */
export const PRODUCTION_APP_URL = "https://quotegen-mail-extension-update-v-4.vercel.app";

export function getAppUrl(): string {
  const raw = Deno.env.get("APP_URL") || PRODUCTION_APP_URL;
  return raw.replace(/\/$/, "");
}
