/** Production deployment — invite links & docs. */
export const PRODUCTION_APP_URL = "https://quotegen-mail-extension-update-v-4.vercel.app";

export function getAppOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return PRODUCTION_APP_URL;
}
