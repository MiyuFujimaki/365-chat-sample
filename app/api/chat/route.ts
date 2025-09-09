import { NextResponse } from "next/server";
import { saveSurveyResponse, saveChatMessage } from "../../../lib/database";

// アンケート送信用のエンドポイント
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { messageId, rating } = body;
    
    if (!messageId || !rating) {
      return NextResponse.json(
        { error: "messageId and rating are required" },
        { status: 400 }
      );
    }
    
    if (rating !== 'good' && rating !== 'bad') {
      return NextResponse.json(
        { error: "rating must be 'good' or 'bad'" },
        { status: 400 }
      );
    }
    
    // ユーザー情報を取得
    const userIp = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    // データベースにアンケート結果を保存
    const responseId = saveSurveyResponse(messageId, rating, userIp, userAgent);
    
    console.log(`Survey response saved: ID ${responseId}, Message ${messageId} rated as ${rating}`);
    
    return NextResponse.json({ 
      success: true, 
      responseId,
      message: "Survey response saved successfully" 
    });
  } catch (error) {
    console.error("Failed to save survey response:", error);
    return NextResponse.json(
      { error: "Failed to process survey response" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const apiUrl = process.env.CHAT_API_URL;
  const apiKey = process.env.CHAT_API_KEY;

  if (!apiUrl) {
    return NextResponse.json(
      { error: "CHAT_API_URL is not configured" },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  try {
    const isAzureOpenAI = /\.azure\.com\//.test(apiUrl || "");
    const isOpenAIPlatform = /api\.openai\.com\//.test(apiUrl || "");

    // Body の補正: OpenAI では model が必須。未指定なら環境変数から補完。
    const bodyObject: Record<string, unknown> =
      body && typeof body === "object" ? (body as Record<string, unknown>) : {};

    // 注意: 上流が { message, pastConversations } を必須とする場合があるため、
    // そのまま透過的に転送する（変換しない）。

    if (!("model" in bodyObject) || !bodyObject.model) {
      const defaultModel = process.env.CHAT_MODEL;
      if (defaultModel) {
        bodyObject.model = defaultModel;
      } else if (isOpenAIPlatform) {
        // OpenAI (platform) では model が必須。未指定の場合は 400。
        return NextResponse.json(
          { error: "model が指定されていません。リクエストボディの model か、環境変数 CHAT_MODEL を設定してください。" },
          { status: 400 }
        );
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    // Azure OpenAI uses `api-key`, OpenAI uses `Authorization: Bearer`.
    if (apiKey) {
      if (isAzureOpenAI) {
        headers["api-key"] = `${apiKey}`;
      } else if (isOpenAIPlatform) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }
      // その他の独自APIの場合、キー不要のケースを想定して何も追加しない
    }

    const upstream = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyObject),
    });

    const text = await upstream.text();
    const contentType = upstream.headers.get("content-type") || "application/json";

    if (!upstream.ok) {
      try {
        const json = JSON.parse(text);
        const errorObj = json?.error || json;
        const code = errorObj?.code;
        const status = upstream.status;
        const retryAfter = upstream.headers.get("retry-after");

        // Localize well-known errors
        if (code === "insufficient_quota") {
          const message =
            "現在の利用枠（クォータ）を超えています。プラン/請求情報をご確認のうえ、別のAPIキーを使用するか、課金の有効化・上限引き上げをご検討ください。";
          return NextResponse.json(
            { error: { message, code } },
            { status: status === 429 ? 429 : 402 }
          );
        }

        if (status === 429) {
          const message =
            "リクエストが多すぎます（Rate limit）。しばらく時間をおいて再試行してください。" +
            (retryAfter ? ` 再試行目安: ${retryAfter} 秒後` : "");
          return NextResponse.json(
            { error: { message, code: "rate_limit" } },
            { status: 429 }
          );
        }

        return NextResponse.json({ error: errorObj }, { status });
      } catch {
        return new NextResponse(text, { status: upstream.status, headers: { "content-type": contentType } });
      }
    }

    // 成功時: JSONならそのまま返し、非JSONならテキストとして返す
    try {
      const json = JSON.parse(text);
      return NextResponse.json(json);
    } catch {
      return new NextResponse(text, { status: 200, headers: { "content-type": contentType } });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 