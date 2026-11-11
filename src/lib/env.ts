import "server-only";
import { appDatabaseUrl } from "./db-url";

export const env = {
  get databaseUrl() {
    const url = appDatabaseUrl();
    if (!url) throw new Error("Variável de ambiente ausente: DATABASE_URL (ou NETLIFY_DB_URL + APP_DB_PASSWORD)");
    return url;
  },
  get appUrl() {
    return process.env.APP_URL ?? process.env.URL ?? "http://localhost:3000";
  },
  get storageDriver() {
    return (process.env.STORAGE_DRIVER ?? "local") as "local" | "s3" | "netlify";
  },
  get storageLocalDir() {
    return process.env.STORAGE_LOCAL_DIR ?? "./storage";
  },
  get cronSecret() {
    return process.env.CRON_SECRET ?? "";
  },
  get secureCookies() {
    return (process.env.APP_URL ?? process.env.URL ?? "").startsWith("https://");
  },
  /** Limite de upload por arquivo (MB). No Netlify as funções aceitam ~6 MB por requisição. */
  get maxUploadMb() {
    return Number(process.env.MAX_UPLOAD_MB ?? 100);
  },
  whatsapp: {
    get phoneNumberId() {
      return process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
    },
    get accessToken() {
      return process.env.WHATSAPP_ACCESS_TOKEN ?? "";
    },
    get appSecret() {
      return process.env.WHATSAPP_APP_SECRET ?? "";
    },
    get verifyToken() {
      return process.env.WHATSAPP_VERIFY_TOKEN ?? "";
    },
    get apiVersion() {
      return process.env.WHATSAPP_API_VERSION ?? "v21.0";
    },
    get configured() {
      return Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);
    },
  },
};
