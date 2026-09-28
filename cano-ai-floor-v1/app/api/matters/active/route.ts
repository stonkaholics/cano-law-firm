import { NextResponse } from "next/server";
import { buildStoredMatter, getLatestMatter } from "../../../../lib/supabase/matters";

export async function GET() {
  try {
    const matter = await getLatestMatter();
    const storedMatter = await buildStoredMatter(matter);

    return NextResponse.json({
      ok: true,
      matter: storedMatter,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load the shared active matter.",
      },
      { status: 500 }
    );
  }
}
