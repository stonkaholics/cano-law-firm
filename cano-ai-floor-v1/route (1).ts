import { NextRequest, NextResponse } from "next/server";
import {
  buildStoredMatter,
  getAllMatters,
} from "../../../lib/supabase/matters";
import { getLatestSpecialistState } from "../../../lib/supabase/agents";

export async function GET(request: NextRequest) {
  const rawLimit = Number(
    request.nextUrl.searchParams.get("limit") || 100
  );
  const limit = Math.max(1, Math.min(rawLimit || 100, 250));

  try {
    const rows = await getAllMatters(limit);

    const matters = await Promise.all(
      rows.map(async (row) => {
        const stored = await buildStoredMatter(row);
        const specialists = await getLatestSpecialistState(row.id);

        return {
          ...stored,
          record: {
            databaseId: row.id,
            matterName: row.matter_name,
            detaineeName: row.detainee_name,
            pncName: row.pnc_name,
            practiceArea: row.practice_area,
            matterType: row.matter_type,
            assignedAttorney: row.assigned_attorney,
            status: row.status,
            currentRoute: row.current_route,
            updatedAt: row.updated_at,
            createdAt: row.created_at,
          },
          specialists,
        };
      })
    );

    const summary = {
      total: matters.length,
      processing: matters.filter(
        (matter) =>
          matter?.caseBrainStatus === "case_brain_processing"
      ).length,
      reviewReady: matters.filter(
        (matter) =>
          matter?.caseBrainStatus === "review_ready"
      ).length,
      errors: matters.filter(
        (matter) =>
          matter?.caseBrainStatus === "case_brain_error"
      ).length,
    };

    return NextResponse.json({
      ok: true,
      summary,
      matters,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load shared matters.",
      },
      { status: 500 }
    );
  }
}
