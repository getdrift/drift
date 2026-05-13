import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

export async function GET(req: Request) {
  const c = await cookies();
  c.delete(SESSION_COOKIE);
  return NextResponse.redirect(new URL("/", req.url));
}

export async function POST(req: Request) {
  return GET(req);
}
