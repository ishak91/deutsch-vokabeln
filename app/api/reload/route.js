import { seedWords } from "@/lib/db";
export async function POST() { return Response.json(await seedWords(true)); }
