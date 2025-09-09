import { NextResponse } from "next/server";
import { getChatStats } from "../../../../lib/database";

export async function GET() {
  try {
    const stats = getChatStats();

    return NextResponse.json({
      success: true,
      ...stats
    });
  } catch (error) {
    console.error("Failed to fetch chat stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat stats" },
      { status: 500 }
    );
  }
}

