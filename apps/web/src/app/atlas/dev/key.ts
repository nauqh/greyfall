// The dev cookie holds this hash, never the password; without DEV_PASSWORD there is no key and the dev route stays shut.

export const DEV_COOKIE = "greyfall-dev";

export async function hash(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function devKey(): Promise<string | null> {
  const password = process.env.DEV_PASSWORD;
  return password ? hash(password) : null;
}
