import { saveSettings } from "@/lib/db";
export async function PUT(req) { return Response.json(await saveSettings(await req.json())); }
