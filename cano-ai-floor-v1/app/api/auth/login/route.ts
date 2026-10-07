import { NextRequest, NextResponse } from "next/server";
import { createAuthServerClient } from "../../../../lib/supabase/auth-server";

function safeNextPath(value: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const email = String(
      formData.get("email") || ""
    ).trim().toLowerCase();

    const password = String(
      formData.get("password") || ""
    );

    const next = safeNextPath(
      String(formData.get("next") || "/")
    );

    if (!email || !password) {
      const url = new URL("/login", request.url);
      url.searchParams.set(
        "error",
        "Email and password are required."
      );
      url.searchParams.set("next", next);

      return NextResponse.redirect(url, { status: 303 });
    }

    const supabase = await createAuthServerClient();

    const { error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      const url = new URL("/login", request.url);
      url.searchParams.set(
        "error",
        "Invalid email or password."
      );
      url.searchParams.set("next", next);

      return NextResponse.redirect(url, { status: 303 });
    }

    return NextResponse.redirect(
      new URL(next, request.url),
      { status: 303 }
    );
  } catch (error) {
    const url = new URL("/login", request.url);
    url.searchParams.set(
      "error",
      error instanceof Error
        ? error.message
        : "Unable to sign in."
    );

    return NextResponse.redirect(url, { status: 303 });
  }
}
