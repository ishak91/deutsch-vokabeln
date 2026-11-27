// Helpers for route handlers: who is calling, and the login cookie.
import { COOKIE, userFromToken } from "./auth.js";

export const tokenOf = (req) => req.cookies?.get(COOKIE)?.value;
export const getUser = (req) => userFromToken(tokenOf(req));
export const clientIp = (req) => (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";

// Wraps a handler so it only runs for a logged-in user (or an admin): handler(req, user)
export function withUser(handler, { admin = false } = {}) {
  return async (req) => {
    const user = await getUser(req);
    if (!user) return Response.json({ error: "Please log in." }, { status: 401 });
    if (admin && !user.admin) return Response.json({ error: "Admins only." }, { status: 403 });
    try { return await handler(req, user); }
    catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
  };
}

// Secure cookies need HTTPS; behind Caddy the original scheme arrives in X-Forwarded-Proto.
export function sessionCookie(req, token) {
  const https = (req.headers.get("x-forwarded-proto") || new URL(req.url).protocol.replace(":", "")) === "https";
  const parts = [`${COOKIE}=${token || ""}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${token ? 90 * 86400 : 0}`];
  if (https) parts.push("Secure");
  return parts.join("; ");
}
