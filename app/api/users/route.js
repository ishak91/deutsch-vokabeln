import { createUser, deleteUser, listUsers, updateUser, getConfig, setConfig } from "@/lib/auth";
import { userStats } from "@/lib/db";
import { withUser } from "@/lib/session";
export const dynamic = "force-dynamic";
const ADMIN = { admin: true };

// List accounts with a short summary of each one's progress
export const GET = withUser(async () => {
  const users = await listUsers();
  return Response.json({ users: await Promise.all(users.map(async u => ({ ...u, ...(await userStats(u.id)) }))), config: await getConfig() });
}, ADMIN);

export const POST = withUser(async (req) => Response.json({ user: await createUser(await req.json()) }), ADMIN);

// { id, password?, admin?, name? }  or  { config: { signup } }
export const PUT = withUser(async (req, me) => {
  const { id, config, ...patch } = await req.json();
  if (config) return Response.json({ config: await setConfig(config) });
  if (id === me.id && patch.admin === false) throw new Error("You can't remove your own admin rights.");
  return Response.json({ user: await updateUser(id, patch) });
}, ADMIN);

export const DELETE = withUser(async (req, me) => {
  const id = new URL(req.url).searchParams.get("id");
  if (id === me.id) throw new Error("You can't delete your own account.");
  await deleteUser(id);
  return Response.json({ ok: true });
}, ADMIN);
