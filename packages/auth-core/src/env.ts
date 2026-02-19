export type AppEnvironment = "development" | "production";

export function getAppEnvironment(): AppEnvironment {
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_APP_ENV === "production") {
    return "production";
  }
  return "development";
}

export function isDevelopment(): boolean {
  return getAppEnvironment() === "development";
}

export function isProduction(): boolean {
  return getAppEnvironment() === "production";
}
