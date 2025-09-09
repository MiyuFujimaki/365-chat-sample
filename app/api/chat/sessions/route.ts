import { NextResponse } from "next/server";
import { getChatSessions, createOrUpdateSession, deleteSession } from "../../../../lib/database";

// セッション一覧を取得
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const sessions = getChatSessions(limit, offset);

    return NextResponse.json({
      success: true,
      sessions,
      pagination: {
        limit,
        offset,
        total: sessions.length
      }
    });
  } catch (error) {
    console.error("Failed to fetch chat sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat sessions" },
      { status: 500 }
    );
  }
}

// セッションを作成または更新
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, title } = body;
    
    if (!sessionId || !title) {
      return NextResponse.json(
        { error: "sessionId and title are required" },
        { status: 400 }
      );
    }
    
    // ユーザー情報を取得
    const userIp = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown';
    
    const session = createOrUpdateSession(sessionId, title, userIp);
    
    return NextResponse.json({
      success: true,
      session
    });
  } catch (error) {
    console.error("Failed to create/update session:", error);
    return NextResponse.json(
      { error: "Failed to create/update session" },
      { status: 500 }
    );
  }
}

// セッションを削除
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    
    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }
    
    const success = deleteSession(sessionId);
    
    if (!success) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: "Session deleted successfully"
    });
  } catch (error) {
    console.error("Failed to delete session:", error);
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 }
    );
  }
}
