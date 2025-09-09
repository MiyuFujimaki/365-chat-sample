import { NextResponse } from "next/server";
import { getChatMessages } from "../../../../lib/database";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    const messages = getChatMessages(limit, offset);

    return NextResponse.json({
      success: true,
      messages,
      pagination: {
        limit,
        offset,
        total: messages.length
      }
    });
  } catch (error) {
    console.error("Failed to fetch chat messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat messages" },
      { status: 500 }
    );
  }
}

