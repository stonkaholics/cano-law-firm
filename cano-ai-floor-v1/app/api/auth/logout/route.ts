import { NextRequest, NextResponse } from "next/server";
import { createAuthServerClient } from "../../../../lib/supabase/auth-server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createAuthServerClient();
    await supabase.auth.signOut();
  } catch (error) {
    console.error("Cano AI logout error:", error);
  }

  return NextResponse.redirect(
    new URL("/login", request.url),
    { status: 303 }
  );
}
