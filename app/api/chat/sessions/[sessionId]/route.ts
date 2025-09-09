import { NextResponse } from "next/server";
import { getChatMessagesBySession } from "../../../../../lib/database";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    
    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }
    
    const messages = getChatMessagesBySession(sessionId);
    
    return NextResponse.json({
      success: true,
      sessionId,
      messages
    });
  } catch (error) {
    console.error("Failed to fetch session messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch session messages" },
      { status: 500 }
    );
  }
}
