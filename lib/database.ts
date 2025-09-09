import fs from 'fs';
import path from 'path';

// データファイルのパス
const surveyDataPath = path.join(process.cwd(), 'data', 'survey-responses.json');
const chatDataPath = path.join(process.cwd(), 'data', 'chat-messages.json');
const sessionsDataPath = path.join(process.cwd(), 'data', 'chat-sessions.json');

// データディレクトリとファイルの初期化
function ensureDataFile(filePath: string) {
  const dataDir = path.dirname(filePath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify([], null, 2));
  }
}

// アンケートデータを読み込み
function loadSurveyData(): SurveyResponse[] {
  ensureDataFile(surveyDataPath);
  try {
    const data = fs.readFileSync(surveyDataPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to load survey data:', error);
    return [];
  }
}

// アンケートデータを保存
function saveSurveyData(data: SurveyResponse[]) {
  ensureDataFile(surveyDataPath);
  try {
    fs.writeFileSync(surveyDataPath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Failed to save survey data:', error);
    throw error;
  }
}

// チャットデータを読み込み
function loadChatData(): ChatMessage[] {
  ensureDataFile(chatDataPath);
  try {
    const data = fs.readFileSync(chatDataPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to load chat data:', error);
    return [];
  }
}

// チャットデータを保存
function saveChatData(data: ChatMessage[]) {
  ensureDataFile(chatDataPath);
  try {
    fs.writeFileSync(chatDataPath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Failed to save chat data:', error);
    throw error;
  }
}

// セッションデータを読み込み
function loadSessionsData(): ChatSession[] {
  ensureDataFile(sessionsDataPath);
  try {
    const data = fs.readFileSync(sessionsDataPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to load sessions data:', error);
    return [];
  }
}

// セッションデータを保存
function saveSessionsData(data: ChatSession[]) {
  ensureDataFile(sessionsDataPath);
  try {
    fs.writeFileSync(sessionsDataPath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Failed to save sessions data:', error);
    throw error;
  }
}

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

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  user_ip: string;
}

// チャットメッセージを保存
export function saveChatMessage(
  messageId: string,
  role: 'user' | 'assistant',
  content: string,
  userIp?: string,
  userAgent?: string,
  sessionId?: string
): number {
  const data = loadChatData();
  const newId = data.length > 0 ? Math.max(...data.map(item => item.id)) + 1 : 1;
  
  const newMessage: ChatMessage = {
    id: newId,
    message_id: messageId,
    role,
    content,
    created_at: new Date().toISOString(),
    user_ip: userIp || 'unknown',
    user_agent: userAgent || 'unknown',
    session_id: sessionId
  };
  
  data.push(newMessage);
  saveChatData(data);
  
  return newId;
}

// チャットメッセージにアンケート評価を追加
export function updateChatMessageWithSurvey(
  messageId: string,
  rating: 'good' | 'bad'
): boolean {
  const data = loadChatData();
  const messageIndex = data.findIndex(item => item.message_id === messageId);
  
  if (messageIndex === -1) {
    return false;
  }
  
  data[messageIndex].survey_rating = rating;
  data[messageIndex].survey_responded_at = new Date().toISOString();
  
  saveChatData(data);
  return true;
}

// セッションを作成または更新
export function createOrUpdateSession(
  sessionId: string,
  title: string,
  userIp?: string
): ChatSession {
  const sessions = loadSessionsData();
  const existingSession = sessions.find(s => s.id === sessionId);
  
  if (existingSession) {
    // 既存セッションを更新
    existingSession.title = title;
    existingSession.updated_at = new Date().toISOString();
    existingSession.message_count = getChatMessagesBySession(sessionId).length;
    saveSessionsData(sessions);
    return existingSession;
  } else {
    // 新しいセッションを作成
    const newSession: ChatSession = {
      id: sessionId,
      title,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      message_count: 0,
      user_ip: userIp || 'unknown'
    };
    sessions.push(newSession);
    saveSessionsData(sessions);
    return newSession;
  }
}

// セッション一覧を取得
export function getChatSessions(limit: number = 50, offset: number = 0): ChatSession[] {
  const sessions = loadSessionsData();
  
  // 更新日時で降順ソート
  const sortedSessions = sessions.sort((a, b) => 
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
  
  // ページネーション
  return sortedSessions.slice(offset, offset + limit);
}

// セッションを削除
export function deleteSession(sessionId: string): boolean {
  const sessions = loadSessionsData();
  const sessionIndex = sessions.findIndex(s => s.id === sessionId);
  
  if (sessionIndex === -1) {
    return false;
  }
  
  // セッションに関連するメッセージも削除
  const chatData = loadChatData();
  const filteredChatData = chatData.filter(msg => msg.session_id !== sessionId);
  saveChatData(filteredChatData);
  
  // セッションを削除
  sessions.splice(sessionIndex, 1);
  saveSessionsData(sessions);
  
  return true;
}

// アンケート回答を保存（チャットメッセージも更新）
export function saveSurveyResponse(
  messageId: string, 
  rating: 'good' | 'bad',
  userIp?: string,
  userAgent?: string
): number {
  // チャットメッセージに評価を追加
  updateChatMessageWithSurvey(messageId, rating);
  
  // アンケート回答も別途保存（既存の機能との互換性のため）
  const data = loadSurveyData();
  const newId = data.length > 0 ? Math.max(...data.map(item => item.id)) + 1 : 1;
  
  const newResponse: SurveyResponse = {
    id: newId,
    message_id: messageId,
    rating,
    created_at: new Date().toISOString(),
    user_ip: userIp || 'unknown',
    user_agent: userAgent || 'unknown'
  };
  
  data.push(newResponse);
  saveSurveyData(data);
  
  return newId;
}

// チャットメッセージを取得
export function getChatMessages(limit: number = 100, offset: number = 0): ChatMessage[] {
  const data = loadChatData();
  
  // 作成日時で降順ソート
  const sortedData = data.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  
  // ページネーション
  return sortedData.slice(offset, offset + limit);
}

// セッション別チャット履歴を取得
export function getChatMessagesBySession(sessionId: string): ChatMessage[] {
  const data = loadChatData();
  
  return data
    .filter(item => item.session_id === sessionId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

// アンケート回答を取得
export function getSurveyResponses(limit: number = 100, offset: number = 0): SurveyResponse[] {
  const data = loadSurveyData();
  
  // 作成日時で降順ソート
  const sortedData = data.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  
  // ページネーション
  return sortedData.slice(offset, offset + limit);
}

// アンケート統計を取得
export function getSurveyStats() {
  const data = loadSurveyData();
  
  const total = data.length;
  const ratings = data.reduce((acc, item) => {
    acc[item.rating] = (acc[item.rating] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // 過去30日間の日別統計
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const daily = data
    .filter(item => new Date(item.created_at) >= thirtyDaysAgo)
    .reduce((acc, item) => {
      const date = new Date(item.created_at).toISOString().split('T')[0];
      const key = `${date}-${item.rating}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  
  const dailyArray = Object.entries(daily).map(([key, count]) => {
    const [date, rating] = key.split('-');
    return { date, rating, count };
  }).sort((a, b) => b.date.localeCompare(a.date));
  
  return {
    total,
    ratings,
    daily: dailyArray
  };
}

// チャット統計を取得
export function getChatStats() {
  const data = loadChatData();
  
  const total = data.length;
  const userMessages = data.filter(item => item.role === 'user').length;
  const assistantMessages = data.filter(item => item.role === 'assistant').length;
  
  // 評価統計
  const assistantMessagesWithSurvey = data.filter(item => item.role === 'assistant');
  const surveyResponses = assistantMessagesWithSurvey.filter(item => item.survey_rating);
  const goodRatings = surveyResponses.filter(item => item.survey_rating === 'good').length;
  const badRatings = surveyResponses.filter(item => item.survey_rating === 'bad').length;
  const surveyResponseRate = assistantMessagesWithSurvey.length > 0 
    ? (surveyResponses.length / assistantMessagesWithSurvey.length * 100).toFixed(1)
    : '0.0';
  
  // 過去30日間の日別統計
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const daily = data
    .filter(item => new Date(item.created_at) >= thirtyDaysAgo)
    .reduce((acc, item) => {
      const date = new Date(item.created_at).toISOString().split('T')[0];
      const key = `${date}-${item.role}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  
  const dailyArray = Object.entries(daily).map(([key, count]) => {
    const [date, role] = key.split('-');
    return { date, role, count };
  }).sort((a, b) => b.date.localeCompare(a.date));
  
  return {
    total,
    userMessages,
    assistantMessages,
    surveyResponses: surveyResponses.length,
    goodRatings,
    badRatings,
    surveyResponseRate: parseFloat(surveyResponseRate),
    daily: dailyArray
  };
}
