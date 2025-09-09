import { NextResponse } from "next/server";
import { saveChatMessage } from "../../../../lib/database";

// チャットメッセージ保存用のエンドポイント
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messageId, role, content, sessionId } = body;
    
    if (!messageId || !role || !content) {
      return NextResponse.json(
        { error: "messageId, role, and content are required" },
        { status: 400 }
      );
    }
    
    if (role !== 'user' && role !== 'assistant') {
      return NextResponse.json(
        { error: "role must be 'user' or 'assistant'" },
        { status: 400 }
      );
    }
    
    // ユーザー情報を取得
    const userIp = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    // データベースにチャットメッセージを保存
    const messageId_db = saveChatMessage(messageId, role, content, userIp, userAgent, sessionId);
    
    console.log(`Chat message saved: ID ${messageId_db}, Message ${messageId} from ${role}`);
    
    return NextResponse.json({ 
      success: true, 
      messageId_db,
      message: "Chat message saved successfully" 
    });
  } catch (error) {
    console.error("Failed to save chat message:", error);
    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 }
    );
  }
}

