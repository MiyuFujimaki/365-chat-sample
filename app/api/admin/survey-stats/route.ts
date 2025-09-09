import { NextResponse } from "next/server";
import { getSurveyStats } from "../../../../lib/database";

export async function GET() {
  try {
    const stats = getSurveyStats();

    return NextResponse.json({
      success: true,
      ...stats
    });
  } catch (error) {
    console.error("Failed to fetch survey stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch survey stats" },
      { status: 500 }
    );
  }
}
