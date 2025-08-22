import { NextResponse } from "next/server";

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
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["api-key"] = `${apiKey}`;
    }

    const upstream = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const text = await upstream.text();
    const contentType = upstream.headers.get("content-type") || "application/json";

    if (!upstream.ok) {
      try {
        const json = JSON.parse(text);
        return NextResponse.json({ error: json?.error || json }, { status: upstream.status });
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