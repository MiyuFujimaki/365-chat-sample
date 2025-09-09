"use client";

import { useEffect, useState } from "react";

interface SurveyResponse {
  id: number;
  message_id: string;
  rating: 'good' | 'bad';
  created_at: string;
  user_ip: string;
  user_agent: string;
}

interface ChatMessage {
  id: number;
  message_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  user_ip: string;
  user_agent: string;
  session_id?: string;
  survey_rating?: 'good' | 'bad';
  survey_responded_at?: string;
}

interface SurveyStats {
  total: number;
  ratings: Record<string, number>;
  daily: Array<{
    date: string;
    rating: string;
    count: number;
  }>;
}

interface ChatStats {
  total: number;
  userMessages: number;
  assistantMessages: number;
  surveyResponses: number;
  goodRatings: number;
  badRatings: number;
  surveyResponseRate: number;
  daily: Array<{
    date: string;
    role: string;
    count: number;
  }>;
}

export default function AdminPage() {
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [stats, setStats] = useState<SurveyStats | null>(null);
  const [chatStats, setChatStats] = useState<ChatStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'survey' | 'chat'>('survey');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [responsesRes, statsRes, messagesRes, chatStatsRes] = await Promise.all([
        fetch('/api/admin/survey-responses'),
        fetch('/api/admin/survey-stats'),
        fetch('/api/admin/chat-messages'),
        fetch('/api/admin/chat-stats')
      ]);

      if (!responsesRes.ok || !statsRes.ok || !messagesRes.ok || !chatStatsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const [responsesData, statsData, messagesData, chatStatsData] = await Promise.all([
        responsesRes.json(),
        statsRes.json(),
        messagesRes.json(),
        chatStatsRes.json()
      ]);

      setResponses(responsesData.responses || []);
      setStats(statsData);
      setMessages(messagesData.messages || []);
      setChatStats(chatStatsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP');
  };

  const getRatingText = (rating: string) => {
    return rating === 'good' ? 'よかった' : '悪かった';
  };

  const getRatingColor = (rating: string) => {
    return rating === 'good' ? 'text-green-600' : 'text-red-600';
  };

  const getRoleText = (role: string) => {
    return role === 'user' ? 'ユーザー' : 'アシスタント';
  };

  const getRoleColor = (role: string) => {
    return role === 'user' ? 'text-blue-600' : 'text-purple-600';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">データを読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">エラーが発生しました</div>
          <p className="text-gray-600">{error}</p>
          <button 
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            管理画面
          </h1>
          <p className="text-gray-600">
            アンケート回答とチャット履歴を確認できます
          </p>
        </div>

        {/* タブ */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('survey')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'survey'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                アンケート回答
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'chat'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                チャット履歴
              </button>
            </nav>
          </div>
        </div>

        {/* 統計情報 */}
        {activeTab === 'survey' && stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">総回答数</h3>
              <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">よかった</h3>
              <p className="text-3xl font-bold text-green-600">{stats.ratings.good || 0}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">悪かった</h3>
              <p className="text-3xl font-bold text-red-600">{stats.ratings.bad || 0}</p>
            </div>
          </div>
        )}

        {activeTab === 'chat' && chatStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">総メッセージ数</h3>
              <p className="text-3xl font-bold text-blue-600">{chatStats.total}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">ユーザーメッセージ</h3>
              <p className="text-3xl font-bold text-blue-600">{chatStats.userMessages}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">AIメッセージ</h3>
              <p className="text-3xl font-bold text-purple-600">{chatStats.assistantMessages}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">アンケート回答率</h3>
              <p className="text-3xl font-bold text-green-600">{chatStats.surveyResponseRate}%</p>
            </div>
          </div>
        )}

        {activeTab === 'chat' && chatStats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">アンケート回答数</h3>
              <p className="text-3xl font-bold text-blue-600">{chatStats.surveyResponses}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">よかった</h3>
              <p className="text-3xl font-bold text-green-600">{chatStats.goodRatings}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">悪かった</h3>
              <p className="text-3xl font-bold text-red-600">{chatStats.badRatings}</p>
            </div>
          </div>
        )}

        {/* コンテンツ */}
        {activeTab === 'survey' && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">アンケート回答一覧</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      メッセージID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      評価
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      回答日時
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      IPアドレス
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {responses.map((response) => (
                    <tr key={response.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {response.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {response.message_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${getRatingColor(response.rating)}`}>
                          {getRatingText(response.rating)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(response.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {response.user_ip}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {responses.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  まだアンケート回答がありません
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">チャット履歴一覧</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      メッセージID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      送信者
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      内容
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      評価
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      送信日時
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      IPアドレス
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {messages.map((message) => (
                    <tr key={message.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {message.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {message.message_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${getRoleColor(message.role)}`}>
                          {getRoleText(message.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {message.content}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {message.survey_rating ? (
                          <span className={`text-sm font-medium ${getRatingColor(message.survey_rating)}`}>
                            {getRatingText(message.survey_rating)}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">未回答</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(message.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {message.user_ip}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {messages.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  まだチャット履歴がありません
                </div>
              )}
            </div>
          </div>
        )}

        {/* 更新ボタン */}
        <div className="mt-6 text-center">
          <button
            onClick={fetchData}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            データを更新
          </button>
        </div>
      </div>
    </div>
  );
}
