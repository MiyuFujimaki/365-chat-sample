import { NextResponse } from "next/server";
import { getSurveyResponses } from "../../../../lib/database";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    const responses = getSurveyResponses(limit, offset);

    return NextResponse.json({
      success: true,
      responses,
      pagination: {
        limit,
        offset,
        total: responses.length
      }
    });
  } catch (error) {
    console.error("Failed to fetch survey responses:", error);
    return NextResponse.json(
      { error: "Failed to fetch survey responses" },
      { status: 500 }
    );
  }
}
