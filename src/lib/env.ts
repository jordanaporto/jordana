import "server-only";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente ausente: ${name}`);
  return v;
}

export const env = {
  get databaseUrl() {
    return req("DATABASE_URL");
  },
  get appUrl() {
    return process.env.APP_URL ?? "http://localhost:3000";
  },
  get storageDriver() {
    return (process.env.STORAGE_DRIVER ?? "local") as "local" | "s3";
  },
  get storageLocalDir() {
    return process.env.STORAGE_LOCAL_DIR ?? "./storage";
  },
  get cronSecret() {
    return process.env.CRON_SECRET ?? "";
  },
  get secureCookies() {
    return (process.env.APP_URL ?? "").startsWith("https://");
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
