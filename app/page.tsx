"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import Image from "next/image";

type ChatRole = "user" | "assistant" | "system";

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  showSurvey?: boolean;
}

interface SurveyResponse {
  messageId: string;
  rating: 'good' | 'bad';
}

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  user_ip: string;
}

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// 簡易Markdown → HTML 変換（安全のため一度エスケープし、必要なタグのみ付与）
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function markdownToHtml(markdown: string): string {
  if (!markdown) return "";
  let src = markdown.replace(/\r\n/g, "\n");

  // 1) 見出しの処理（最初に行う）
  src = src.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  src = src.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  src = src.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  src = src.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  src = src.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  src = src.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // 2) コードブロック抽出
  const codeBlocks: string[] = [];
  src = src.replace(/```([\s\S]*?)```/g, (_m, p1: string) => {
    const code = escapeHtml((p1 || "").trim());
    const idx = codeBlocks.push(`<pre class="bg-gray-900 text-gray-100 rounded-md p-3 overflow-auto text-sm"><code>${code}</code></pre>`) - 1;
    return `{{CODE_BLOCK_${idx}}}`;
  });

  // 3) 箇条書きの処理
  src = src.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');
  
  // 4) インライン要素の処理
  src = src.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  src = src.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  src = src.replace(/`([^`]+)`/g, '<code>$1</code>');
  src = src.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // 5) 残りをエスケープ
  let html = escapeHtml(src);

  // 6) HTMLタグを復元（見出し、リスト、インライン要素）
  html = html.replace(/&lt;h1&gt;(.*?)&lt;\/h1&gt;/g, '<h1>$1</h1>');
  html = html.replace(/&lt;h2&gt;(.*?)&lt;\/h2&gt;/g, '<h2>$1</h2>');
  html = html.replace(/&lt;h3&gt;(.*?)&lt;\/h3&gt;/g, '<h3>$1</h3>');
  html = html.replace(/&lt;h4&gt;(.*?)&lt;\/h4&gt;/g, '<h4>$1</h4>');
  html = html.replace(/&lt;h5&gt;(.*?)&lt;\/h5&gt;/g, '<h5>$1</h5>');
  html = html.replace(/&lt;h6&gt;(.*?)&lt;\/h6&gt;/g, '<h6>$1</h6>');
  html = html.replace(/&lt;li&gt;(.*?)&lt;\/li&gt;/g, '<li>$1</li>');
  html = html.replace(/&lt;strong&gt;(.*?)&lt;\/strong&gt;/g, '<strong>$1</strong>');
  html = html.replace(/&lt;em&gt;(.*?)&lt;\/em&gt;/g, '<em>$1</em>');
  html = html.replace(/&lt;code&gt;(.*?)&lt;\/code&gt;/g, '<code>$1</code>');
  html = html.replace(/&lt;a href="(.*?)" target="_blank" rel="noopener noreferrer"&gt;(.*?)&lt;\/a&gt;/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$2</a>');

  // 7) リストの整形
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
  html = html.replace(/<\/ul>\s*<ul>/g, '');

  // 8) テーブル変換
  html = convertTablesToHtml(html);

  // 9) 段落の処理
  const lines = html.split('\n');
  const out: string[] = [];
  for (const line of lines) {
    if (line.trim() === '') {
      out.push('<div class="h-2"></div>');
    } else if (line.startsWith('<h') || line.startsWith('<ul') || line.startsWith('</ul') || line.startsWith('<li') || line.startsWith('</li>') || line.startsWith('<pre')) {
      out.push(line);
    } else {
      out.push(`<p>${line}</p>`);
    }
  }
  html = out.join('\n');

  // 10) コードブロック復元
  html = html.replace(/\{\{CODE_BLOCK_(\d+)\}\}/g, (_m, i: string) => codeBlocks[Number(i)] || "");

  return html;
}

// Markdownテーブル → HTMLテーブル変換
function convertTablesToHtml(html: string): string {
  const lines = html.split('\n');
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    
    // テーブルの開始を検出（| で始まり | で終わる行）
    if (line.includes('|') && line.startsWith('|') && line.endsWith('|')) {
      const tableLines: string[] = [];
      let j = i;
      
      // 連続するテーブル行を収集
      while (j < lines.length) {
        const currentLine = lines[j].trim();
        if (currentLine.includes('|') && currentLine.startsWith('|') && currentLine.endsWith('|')) {
          tableLines.push(currentLine);
          j++;
        } else {
          break;
        }
      }
      
      if (tableLines.length >= 2) {
        // テーブルHTMLを生成
        const tableHtml = generateTableHtml(tableLines);
        result.push(tableHtml);
        i = j; // テーブル行をスキップ
        continue;
      }
    }
    
    result.push(lines[i]);
    i++;
  }
  
  return result.join('\n');
}

function generateTableHtml(tableLines: string[]): string {
  if (tableLines.length < 2) return tableLines.join('\n');
  
  // ヘッダー行（1行目）
  const headerLine = tableLines[0];
  const separatorLine = tableLines[1]; // 2行目はセパレーター（通常 |---|---|）
  const dataLines = tableLines.slice(2); // 3行目以降がデータ
  
  // セパレーター行がテーブル形式かチェック
  if (!separatorLine.includes('-')) {
    // セパレーターがない場合は通常のテーブルとして処理
    return generateSimpleTable([headerLine, ...dataLines]);
  }
  
  // ヘッダーセルを抽出
  const headerCells = headerLine.split('|')
    .slice(1, -1) // 最初と最後の空文字を除去
    .map(cell => cell.trim());
  
  // データ行を処理
  const rows = dataLines.map(line => 
    line.split('|')
      .slice(1, -1) // 最初と最後の空文字を除去
      .map(cell => cell.trim())
  );
  
  // HTMLテーブルを生成
  let tableHtml = '<table class="min-w-full border-collapse border border-gray-300 my-4">';
  
  // ヘッダー
  tableHtml += '<thead class="bg-gray-50">';
  tableHtml += '<tr>';
  headerCells.forEach(cell => {
    tableHtml += `<th class="border border-gray-300 px-4 py-2 text-left font-medium">${cell}</th>`;
  });
  tableHtml += '</tr>';
  tableHtml += '</thead>';
  
  // ボディ
  tableHtml += '<tbody>';
  rows.forEach(row => {
    tableHtml += '<tr>';
    row.forEach(cell => {
      tableHtml += `<td class="border border-gray-300 px-4 py-2">${cell}</td>`;
    });
    tableHtml += '</tr>';
  });
  tableHtml += '</tbody>';
  
  tableHtml += '</table>';
  
  return tableHtml;
}

function generateSimpleTable(lines: string[]): string {
  let tableHtml = '<table class="min-w-full border-collapse border border-gray-300 my-4">';
  
  lines.forEach((line, index) => {
    const cells = line.split('|')
      .slice(1, -1) // 最初と最後の空文字を除去
      .map(cell => cell.trim());
    
    const tag = index === 0 ? 'th' : 'td';
    const bgClass = index === 0 ? 'bg-gray-50' : '';
    const fontClass = index === 0 ? 'font-medium' : '';
    
    tableHtml += `<tr class="${bgClass}">`;
    cells.forEach(cell => {
      tableHtml += `<${tag} class="border border-gray-300 px-4 py-2 text-left ${fontClass}">${cell}</${tag}>`;
    });
    tableHtml += '</tr>';
  });
  
  tableHtml += '</table>';
  
  return tableHtml;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: generateMessageId(),
      role: "assistant",
      content: "こんにちは！はまぎん365照会AIチャットです。ご用件を入力してください。",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [inputRows, setInputRows] = useState(1);
  const [surveyResponses, setSurveyResponses] = useState<SurveyResponse[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => generateSessionId());
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending]);

  // 入力内容に応じて行数を調整
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    
    // 行数を計算（改行文字の数 + 1）
    const lines = value.split('\n').length;
    const newRows = Math.min(Math.max(lines, 1), 6); // 最小1行、最大6行
    setInputRows(newRows);
  };

  // 送信後に入力欄を元の大きさに戻す
  const resetInputSize = () => {
    setInputRows(1);
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // セッション一覧を読み込み
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const response = await fetch('/api/chat/sessions');
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  // メッセージ送信時とAI応答完了時にスクロール
  useEffect(() => {
    if (scrollRef.current) {
      const scrollToBottom = () => {
        scrollRef.current?.scrollTo({ 
          top: scrollRef.current.scrollHeight, 
          behavior: "smooth" 
        });
      };
      
      // 少し遅延を入れてスクロール（レンダリング完了後）
      const timeoutId = setTimeout(scrollToBottom, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [messages.length, isSending]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isSending) return;

    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: "user",
      content: text,
    };

    setInput("");
    setIsSending(true);
    setMessages((prev: ChatMessage[]) => [...prev, userMessage]);
    
    // ユーザーメッセージをデータベースに保存
    try {
      await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: userMessage.id,
          role: "user",
          content: userMessage.content,
          sessionId: currentSessionId,
        }),
      });
      
      // セッションを更新（最初のメッセージの場合はタイトルを設定）
      const sessionTitle = messages.length === 1 ? text.slice(0, 30) + (text.length > 30 ? '...' : '') : 'チャット';
      await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSessionId,
          title: sessionTitle,
        }),
      });
    } catch (error) {
      console.error("Failed to save user message:", error);
    }

    try {
      // まずAPIを試行
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          // マクロ仕様に合わせ、履歴は空配列で送信
          pastConversations: [],
        }),
      });

      if (response.ok) {
        // APIが正常に動作する場合
        const data = await response.json().catch(() => ({}));
        // 優先して `response` フィールドを参照（マクロ仕様）
        const replyText: string | undefined =
          data?.response ?? data?.reply ?? data?.message?.content ?? data?.choices?.[0]?.message?.content;
        const assistantMessage: ChatMessage = {
          id: generateMessageId(),
          role: "assistant",
          content: replyText || "（応答形式を解釈できませんでした）",
          showSurvey: true,
        };
        setMessages((prev: ChatMessage[]) => [...prev, assistantMessage]);
        
        // アシスタントメッセージをデータベースに保存
        try {
          await fetch("/api/chat/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messageId: assistantMessage.id,
              role: "assistant",
              content: assistantMessage.content,
              sessionId: currentSessionId,
            }),
          });
        } catch (error) {
          console.error("Failed to save assistant message:", error);
        }
      } else {
        // APIエラーの場合、Mockモードに切り替え
        const text = await response.text().catch(() => "");
        throw new Error(text || `API Error: ${response.status}`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "エラーが発生しました";
      const assistantMessage: ChatMessage = {
        id: generateMessageId(),
        role: "assistant",
        content: `エラーが発生しました。時間をおいて再試行してください。\n詳細: ${message}`,
        showSurvey: false,
      };
      setMessages((prev: ChatMessage[]) => [...prev, assistantMessage]);
    } finally {
      setIsSending(false);
      resetInputSize(); // 送信後に入力欄を元の大きさに戻す
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  // セッションを選択
  const selectSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/chat/sessions/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        const sessionMessages = data.messages.map((msg: any) => ({
          id: msg.message_id,
          role: msg.role,
          content: msg.content,
          showSurvey: msg.role === 'assistant' && !msg.survey_rating // アンケート未回答のアシスタントメッセージのみアンケートを表示
        }));
        
        setCurrentSessionId(sessionId);
        setMessages(sessionMessages);
        setSidebarOpen(false);
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  };

  // 新しいチャットを開始
  const startNewChat = () => {
    const newSessionId = generateSessionId();
    setCurrentSessionId(newSessionId);
    setMessages([
      {
        id: generateMessageId(),
        role: "assistant",
        content: "こんにちは！はまぎん365照会AIチャットです。ご用件を入力してください。",
      },
    ]);
    setSidebarOpen(false);
  };

  // セッションを削除
  const deleteSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/chat/sessions?sessionId=${sessionId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        await loadSessions();
        if (sessionId === currentSessionId) {
          startNewChat();
        }
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  // アンケート回答処理
  async function handleSurveyResponse(messageId: string, rating: 'good' | 'bad') {
    setSurveyResponses(prev => [...prev, { messageId, rating }]);
    
    // アンケートを非表示にする
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, showSurvey: false } : msg
    ));
    
    // アンケート結果をAPIに送信
    try {
      await fetch("/api/chat", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, rating }),
      });
    } catch (error) {
      console.error("Failed to send survey response:", error);
    }
    
    // お礼メッセージを追加
    const thankYouMessage: ChatMessage = {
      id: generateMessageId(),
      role: "assistant",
      content: "ご回答ありがとうございます。",
      showSurvey: false,
    };
    setMessages(prev => [...prev, thankYouMessage]);
  }

  return (
    <div className="min-h-dvh bg-white text-black flex">
      {/* オーバーレイ（モバイル用） */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* サイドバー */}
      <div className={`fixed inset-y-0 left-0 z-50 w-80 bg-gray-50 border-r border-gray-200 transform transition-transform duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 lg:static lg:inset-0`}>
        <div className="flex flex-col h-full">
          {/* サイドバーヘッダー */}
          <div className="p-4 border-b border-gray-200 pt-20">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">チャット履歴</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-1 rounded-md hover:bg-gray-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <button
              onClick={startNewChat}
              className="w-full mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              新しいチャット
            </button>
          </div>
          
          {/* セッション一覧 */}
          <div className="flex-1 overflow-y-auto p-4">
            {sessions.length === 0 ? (
              <p className="text-gray-500 text-center">まだチャット履歴がありません</p>
            ) : (
              <div className="space-y-2">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      session.id === currentSessionId
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => selectSession(session.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {session.title}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(session.updated_at).toLocaleDateString('ja-JP')}
                        </p>
                        <p className="text-xs text-gray-400">
                          {session.message_count} メッセージ
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSession(session.id);
                        }}
                        className="ml-2 p-1 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col">
        {/* 固定ヘッダー */}
        <header className="header-fixed">
          <div className="header-container">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden mr-3 p-2 rounded-md hover:bg-gray-100"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <h1 className="header-title" style={{ fontFamily: '"Noto Sans JP"' }}>
                  はまぎん365照会AIチャット
                </h1>
              </div>
            </div>
          </div>
        </header>

        {/* 固定フッター（入力部分と戻るボタン） */}
        <div className="footer-fixed">
          <div className="footer-container">
            <div className="input-group">
              <textarea
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="メッセージを入力（Enterで送信、Shift+Enterで改行）"
                className="input-textarea"
                rows={inputRows}
              />
              <button
                onClick={handleSend}
                disabled={!canSend}
                className="send-button"
                aria-busy={isSending}
              >
                {isSending ? "送信中..." : "送信"}
              </button>
            </div>
          </div>
        </div>

        {/* メインコンテンツエリア（スクロール可能） */}
        <div className="main-container">
          <div ref={scrollRef} className="chat-scroll-area">
          {messages.map((m) => (
            <div key={m.id} className="message-container">
              {m.role === "user" ? (
                <>
                  <div className="flex-1"></div>
                  <div className="user-message-wrapper">
                    <div className="user-message-bubble">
                      <div className="message-content" dangerouslySetInnerHTML={{ __html: markdownToHtml(m.content) }} />
                      {/* 吹き出しの尻尾 */}
                      <div className="bubble-tail-right"></div>
                    </div>
                    <div className="avatar-user">
                      <Image
                        src="/images/avatar-user.png"
                        alt="紹介するお客様"
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // 画像読み込みエラー時は文字を表示
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.innerHTML = '<span class="text-gray-600 text-sm font-bold">客</span>';
                          }
                        }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="avatar-assistant">
                    <Image
                      src="/images/avatar-assistant.png"
                      alt="紹介を受ける人"
                      width={40}
                      height={40}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // 画像読み込みエラー時は文字を表示
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = '<span class="text-blue-600 text-sm font-bold">受</span>';
                        }
                      }}
                    />
                  </div>
                  <div className="assistant-message-bubble">
                    <div className="message-content" dangerouslySetInnerHTML={{ __html: markdownToHtml(m.content) }} />
                    {/* アンケート表示 */}
                    {m.showSurvey && (
                      <div className="survey-container">
                        <div className="survey-question">回答の精度はいかがでしたでしょうか？</div>
                        <div className="survey-buttons">
                          <button
                            onClick={() => handleSurveyResponse(m.id, 'good')}
                            className="survey-button survey-button-good"
                          >
                            よかった
                          </button>
                          <button
                            onClick={() => handleSurveyResponse(m.id, 'bad')}
                            className="survey-button survey-button-bad"
                          >
                            悪かった
                          </button>
                        </div>
                      </div>
                    )}
                    {/* アンケート回答済み表示 */}
                    {!m.showSurvey && m.role === 'assistant' && (m as any).survey_rating && (
                      <div className="survey-container">
                        <div className="survey-response">
                          <span className={`text-sm font-medium ${
                            (m as any).survey_rating === 'good' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            評価: {(m as any).survey_rating === 'good' ? 'よかった' : '悪かった'}
                          </span>
                          <span className="text-xs text-gray-500 ml-2">
                            ({new Date((m as any).survey_responded_at).toLocaleString('ja-JP')})
                          </span>
                        </div>
                      </div>
                    )}
                    {/* 吹き出しの尻尾 */}
                    <div className="bubble-tail-left"></div>
                  </div>
                  <div className="flex-1"></div>
                </>
              )}
            </div>
          ))}
          
          {/* AIが考えている間のローディングインジケーター */}
          {isSending && (
            <div className="message-container">
              <div className="avatar-assistant">
                <Image
                  src="/images/avatar-assistant.png"
                  alt="紹介を受ける人"
                  width={40}
                  height={40}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // 画像読み込みエラー時は文字を表示
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = '<span class="text-blue-600 text-sm font-bold">受</span>';
                    }
                  }}
                />
              </div>
              <div className="assistant-message-bubble">
                <div className="loading-dots">
                  <div className="loading-dot" style={{ animationDelay: '0ms' }}></div>
                  <div className="loading-dot" style={{ animationDelay: '150ms' }}></div>
                  <div className="loading-dot" style={{ animationDelay: '300ms' }}></div>
                </div>
                {/* 吹き出しの尻尾 */}
                <div className="bubble-tail-left"></div>
              </div>
              <div className="flex-1"></div>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
} 