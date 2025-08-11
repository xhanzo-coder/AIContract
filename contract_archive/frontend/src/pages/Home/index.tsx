import React, { useState, useRef, useEffect } from 'react';
import { Button, Input, Card, Modal, Drawer } from 'antd';
import { 
  MenuOutlined,
  SendOutlined,
  SearchOutlined,
  UserOutlined,
  RobotOutlined,
  CloseOutlined,
  UpOutlined,
  DownOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { qaAPI } from '../../services/api';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  searchResults?: SearchResult[];
  documentGroups?: DocumentGroup[];
}

interface SearchResult {
  id: number;
  chunk_index: number;
  content_text: string;
  highlighted_text: string;
  chunk_type: string;
  chunk_size: number;
  relevance_score: number;
  contract_id: number;
  contract_number: string;
  contract_name: string;
  file_name: string;
  file_format: string;
  upload_time: string;
  contract_type: string | null;
}

interface DocumentGroup {
  file_name: string;
  contract_name: string;
  contract_number: string;
  file_format: string;
  upload_time: string;
  contract_type: string | null;
  chunks: SearchResult[];
  totalRelevance: number;
}

interface ChatHistory {
  session_id: string;
  session_title?: string;
  first_message: string;
  created_at: string;
  message_count: number;
}

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [currentView, setCurrentView] = useState<'welcome' | 'chat'>('welcome');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<SearchResult | null>(null);
  const [currentHighlight, setCurrentHighlight] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // 聊天历史数据
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // 搜索状态
  const [isSearching, setIsSearching] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  // 反馈状态
  const [feedbackStatus, setFeedbackStatus] = useState<{[messageId: string]: 'helpful' | 'not_helpful' | null}>({});

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 获取会话列表
  const loadChatHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await qaAPI.listSessions(1, 20);
      if (response.success) {
        setChatHistory(response.data.sessions);
      }
    } catch (error) {
      console.error('加载会话历史失败:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // 组件挂载时加载会话历史
  useEffect(() => {
    loadChatHistory();
  }, []);

  // 加载历史会话
  const loadHistorySession = async (sessionId: string) => {
    try {
      const response = await qaAPI.getSessionHistory(sessionId);
      if (response.success) {
        const historyMessages: ChatMessage[] = response.data.messages.map(msg => ({
          id: msg.id.toString(),
          type: msg.question ? 'user' : 'assistant',
          content: msg.question || msg.answer || '',
          timestamp: new Date(msg.created_at),
          searchResults: msg.elasticsearch_results ? extractSearchResults(msg.elasticsearch_results) : undefined,
          documentGroups: msg.elasticsearch_results ? groupChunksByFile(extractSearchResults(msg.elasticsearch_results)) : undefined
        }));
        
        setMessages(historyMessages);
        setSessionId(sessionId);
        setCurrentView('chat');
      }
    } catch (error) {
      console.error('加载历史会话失败:', error);
    }
  };

  // 从elasticsearch结果中提取搜索结果
  const extractSearchResults = (esResults: any): SearchResult[] => {
    const hits: any[] = esResults?.hits?.hits ?? [];
    return hits.map((hit: any) => {
      const src = hit._source || {};
      const highlight = hit.highlight || {};
      const highlighted = Array.isArray(highlight.content_text)
        ? highlight.content_text.join(' ... ')
        : (highlight.content_text || '');
      const contentText: string = src.content_text || '';
      return {
        id: src.chunk_id ?? src.id ?? 0,
        chunk_index: src.chunk_index ?? 0,
        content_text: contentText,
        highlighted_text: highlighted || contentText,
        chunk_type: src.chunk_type ?? '',
        chunk_size: contentText.length,
        relevance_score: hit._score ?? 0,
        contract_id: src.contract_id ?? 0,
        contract_number: src.contract_number ?? '',
        contract_name: src.contract_name ?? '',
        file_name: src.file_name ?? src.contract_name ?? '未知文件',
        file_format: src.file_format ?? '',
        upload_time: src.upload_time ?? new Date().toISOString(),
        contract_type: src.contract_type ?? null
      } as SearchResult;
    });
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;
    
    // 添加用户消息
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: query,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setCurrentView('chat');
    setIsSearching(true);
    
    try {
      // 调用QA问答接口（后端会返回ES搜索结果作为占位回答）
      const payload = { question: query, session_id: sessionId ?? undefined };
      const resp = await qaAPI.ask(payload);
      const data = resp.data;

      // 首次会话，记录生成的session_id
      if (!sessionId && data.session_id) {
        setSessionId(data.session_id);
        // 重新加载会话列表以显示新创建的会话
        loadChatHistory();
      }

      // 从Elasticsearch原始结果中提取内容块
      const es = data.elasticsearch_results as any;
      const hits: any[] = es?.hits?.hits ?? [];

      const chunks: SearchResult[] = hits.map((hit: any) => {
        const src = hit._source || {};
        const highlight = hit.highlight || {};
        const highlighted = Array.isArray(highlight.content_text)
          ? highlight.content_text.join(' ... ')
          : (highlight.content_text || '');
        const contentText: string = src.content_text || '';
        return {
          id: src.chunk_id ?? src.id ?? 0,
          chunk_index: src.chunk_index ?? 0,
          content_text: contentText,
          highlighted_text: highlighted || contentText,
          chunk_type: src.chunk_type ?? '',
          chunk_size: contentText.length,
          relevance_score: hit._score ?? 0,
          contract_id: src.contract_id ?? 0,
          contract_number: src.contract_number ?? '',
          contract_name: src.contract_name ?? '',
          file_name: src.file_name ?? src.contract_name ?? '未知文件',
          file_format: src.file_format ?? '',
          upload_time: src.upload_time ?? new Date().toISOString(),
          contract_type: src.contract_type ?? null
        } as SearchResult;
      });
      
      // 按文件分组
      const documentGroups = groupChunksByFile(chunks);
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: chunks.length > 0 
          ? `根据您的查询"${query}"，我为您找到了以下相关文档信息：`
          : `抱歉，没有找到与"${query}"相关的文档信息。`,
        timestamp: new Date(),
        searchResults: chunks,
        documentGroups: documentGroups
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('搜索失败:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: '抱歉，搜索服务暂时不可用，请稍后再试。',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsSearching(false);
    }
  };

  // 按文件分组函数
  const groupChunksByFile = (chunks: SearchResult[]): DocumentGroup[] => {
    const groupMap = new Map<string, DocumentGroup>();
    
    chunks.forEach(chunk => {
      const key = chunk.file_name;
      
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          file_name: chunk.file_name,
          contract_name: chunk.contract_name,
          contract_number: chunk.contract_number,
          file_format: chunk.file_format,
          upload_time: chunk.upload_time,
          contract_type: chunk.contract_type,
          chunks: [],
          totalRelevance: 0
        });
      }
      
      const group = groupMap.get(key)!;
      group.chunks.push(chunk);
      group.totalRelevance += chunk.relevance_score;
    });
    
    // 按总相关度排序
    return Array.from(groupMap.values()).sort((a, b) => b.totalRelevance - a.totalRelevance);
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSearch(suggestion);
  };

  const handleDocumentClick = (group: DocumentGroup) => {
    // 将DocumentGroup转换为兼容的格式用于预览
    const docForPreview = {
      id: group.chunks[0].id.toString(),
      title: group.file_name,
      snippet: group.chunks.map(chunk => chunk.content_text).join('\n\n'),
      relevanceScore: Math.round(group.totalRelevance / group.chunks.length * 100) / 100,
      fileType: group.file_format,
      modifiedTime: new Date(group.upload_time).toLocaleDateString('zh-CN'),
      highlights: group.chunks.flatMap(chunk => 
        chunk.highlighted_text.match(/<em>(.*?)<\/em>/g)?.map(match => 
          match.replace(/<\/?em>/g, '')
        ) || []
      ),
      documentGroup: group // 保存完整的分组信息
    };
    
    setSelectedDocument(docForPreview as any);
    setIsCanvasOpen(true);
    setCurrentHighlight(0);
  };

  const handleNewChat = () => {
    setMessages([]);
    setCurrentView('welcome');
    setIsCanvasOpen(false);
    setSelectedDocument(null);
    setSessionId(null);
  };

  // 删除会话
  const deleteSession = async (targetSessionId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // 阻止事件冒泡
    try {
      const response = await qaAPI.deleteSession(targetSessionId);
      if (response.success) {
        // 重新加载会话列表
        await loadChatHistory();
        // 如果删除的是当前会话，则重置到欢迎页面
        if (targetSessionId === sessionId) {
          handleNewChat();
        }
      }
    } catch (error) {
      console.error('删除会话失败:', error);
    }
  };

  // 发送用户反馈
  const sendFeedback = async (messageId: string, feedback: 'helpful' | 'not_helpful') => {
    if (!sessionId) return;
    
    try {
      const response = await qaAPI.sendFeedback(sessionId, parseInt(messageId), { feedback });
      if (response.success) {
        setFeedbackStatus(prev => ({
          ...prev,
          [messageId]: feedback
        }));
      }
    } catch (error) {
      console.error('发送反馈失败:', error);
    }
  };

  const handleSendMessage = () => {
    if (inputValue.trim()) {
      handleSearch(inputValue);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const navigateHighlight = (direction: 'prev' | 'next') => {
    if (!selectedDocument) return;
    
    const totalHighlights = selectedDocument.highlights.length;
    if (direction === 'prev') {
      setCurrentHighlight(prev => prev > 0 ? prev - 1 : totalHighlights - 1);
    } else {
      setCurrentHighlight(prev => prev < totalHighlights - 1 ? prev + 1 : 0);
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) return '刚刚';
    if (hours < 24) return `${hours}小时前`;
    return `${Math.floor(hours / 24)}天前`;
  };

  return (
    <HomeContainer>
      {/* 左侧边栏 - 历史对话 */}
      <Sidebar className={sidebarCollapsed ? 'collapsed' : ''}>
        <SidebarHeader>
          <Button 
            type="primary" 
            className="new-chat-btn"
            onClick={handleNewChat}
          >
            + 新建对话
          </Button>
          <Button 
            type="text" 
            className="sidebar-toggle"
            icon={<MenuOutlined />}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </SidebarHeader>
        
        <ChatHistoryContainer>
          {isLoadingHistory ? (
            <div className="loading-history">加载中...</div>
          ) : (
            chatHistory.map(chat => (
              <ChatItem 
                key={chat.session_id} 
                className={`chat-item ${chat.session_id === sessionId ? 'active' : ''}`}
                onClick={() => loadHistorySession(chat.session_id)}
              >
                <div className="chat-content">
                  <div className="chat-title">{chat.session_title || chat.first_message}</div>
                  <div className="chat-time">{formatTime(new Date(chat.created_at))}</div>
                  <div className="chat-count">{chat.message_count} 条消息</div>
                </div>
                <Button 
                  type="text" 
                  size="small" 
                  className="delete-btn"
                  onClick={(e) => deleteSession(chat.session_id, e)}
                >
                  ×
                </Button>
              </ChatItem>
            ))
          )}
        </ChatHistoryContainer>
      </Sidebar>

      {/* 右侧主要内容区域 */}
      <ContentArea className={isCanvasOpen ? 'canvas-active' : ''}>
        <MainContent>
          {/* 欢迎界面 - 初始状态 */}
          {currentView === 'welcome' && (
            <WelcomeScreen className="main-content">
              <div className="welcome-title">智能合约问答助手</div>
              <div className="welcome-subtitle">
                基于先进的AI技术，为您提供精准的合约信息检索。输入您的问题，
                我将帮助您从文档中找到相关的答案。
              </div>
              
              {/* 中央搜索框 - 按照Sophia的原设计 */}
              <SearchContainer>
                <Input
                  className="search-input"
                  placeholder="输入您的问题，开始智能合约问答..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  suffix={
                    <Button 
                    className="search-btn"
                    type="primary"
                    icon={isSearching ? undefined : <SendOutlined />}
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || isSearching}
                    loading={isSearching}
                  />
                  }
                />
              </SearchContainer>
              
              <SuggestionsContainer>
                <SuggestionTag onClick={() => handleSuggestionClick('合同条款查询')}>合同条款查询</SuggestionTag>
                <SuggestionTag onClick={() => handleSuggestionClick('文档搜索')}>文档搜索</SuggestionTag>
                <SuggestionTag onClick={() => handleSuggestionClick('关键词检索')}>关键词检索</SuggestionTag>
              </SuggestionsContainer>
            </WelcomeScreen>
          )}

          {/* 对话界面 - 激活状态 */}
          {currentView === 'chat' && (
            <ChatScreen className="active main-content">
              <ChatHeader>
                <div className="chat-title-area">
                  <Button 
                    type="text" 
                    className="sidebar-toggle-btn"
                    icon={<MenuOutlined />}
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  />
                  <div className="current-chat-title">智能合约问答</div>
                </div>
                <div className="chat-actions">
                  <Button className="action-btn">清空对话</Button>
                  <Button className="action-btn">导出对话</Button>
                </div>
              </ChatHeader>
              
              <MessagesArea>
                {messages.map(message => (
                  <Message key={message.id} className={message.type}>
                    <div className="message-avatar">
                      {message.type === 'user' ? <UserOutlined /> : <RobotOutlined />}
                    </div>
                    <div className="message-content">
                      {message.content}
                      
                      {/* 助理消息的反馈按钮 */}
                      {message.type === 'assistant' && sessionId && (
                        <div className="message-feedback">
                          <span className="feedback-label">这个回答对您有帮助吗？</span>
                          <div className="feedback-buttons">
                            <Button 
                              type={feedbackStatus[message.id] === 'helpful' ? 'primary' : 'text'}
                              size="small"
                              className="feedback-btn helpful"
                              onClick={() => sendFeedback(message.id, 'helpful')}
                              disabled={feedbackStatus[message.id] !== null}
                            >
                              👍 有帮助
                            </Button>
                            <Button 
                              type={feedbackStatus[message.id] === 'not_helpful' ? 'primary' : 'text'}
                              size="small"
                              className="feedback-btn not-helpful"
                              onClick={() => sendFeedback(message.id, 'not_helpful')}
                              disabled={feedbackStatus[message.id] !== null}
                            >
                              👎 没帮助
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {/* 搜索结果区域 */}
                      {message.documentGroups && (
                        <SearchResults>
                          <div className="results-header">
                            <span className="source-badge">文档检索</span>
                            找到 {message.documentGroups.length} 个相关文档
                          </div>
                          
                          {message.documentGroups.map((group, index) => (
                            <ResultItem 
                              key={`${group.file_name}-${index}`} 
                              onClick={() => handleDocumentClick(group)}
                            >
                              <div className="result-header">
                                <div className="result-title">
                                  <span className="file-icon">📄</span>
                                  {group.contract_name}
                                </div>
                              </div>
                              
                              <div className="result-meta">
                                <span>文件名: {group.file_name}</span>
                                <span>类型: {group.file_format}</span>
                                <span>合同编号: {group.contract_number}</span>
                                <span>上传时间: {new Date(group.upload_time).toLocaleDateString('zh-CN')}</span>
                                <span className="relevance-score">{Math.round(group.totalRelevance / group.chunks.length * 100) / 100} 相关度</span>
                              </div>
                              
                              <div className="result-snippet">
                                {group.chunks[0].content_text.substring(0, 200)}...
                                <div className="highlights">
                                  <strong>匹配内容 ({group.chunks.length}个片段):</strong>
                                  <div className="highlight-preview" 
                                       dangerouslySetInnerHTML={{ 
                                         __html: group.chunks[0].highlighted_text.substring(0, 300) + '...' 
                                       }} 
                                  />
                                </div>
                              </div>
                              
                              <div className="result-actions">
                                <span className="action-chip">
                                  📖 查看原文
                                </span>
                                <span className="action-chip">
                                  🔗 相关文档
                                </span>
                              </div>
                            </ResultItem>
                          ))}
                        </SearchResults>
                      )}
                    </div>
                  </Message>
                ))}
                <div ref={messagesEndRef} />
              </MessagesArea>
              
              <InputArea>
                <div className="input-container">
                  <Input.TextArea
                    className="chat-input"
                    placeholder="输入您的问题..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    autoSize={{ minRows: 1, maxRows: 4 }}
                  />
                  <Button 
                    className="send-btn"
                    type="primary"
                    icon={isSearching ? undefined : <SendOutlined />}
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || isSearching}
                    loading={isSearching}
                  />
                </div>
              </InputArea>
            </ChatScreen>
          )}
        </MainContent>
        
        {/* 文档详情面板 */}
        <DocumentPanel className={isCanvasOpen ? 'open' : ''}>
          <div className="panel-header">
            <div className="panel-title">
              <span>📄</span>
              {selectedDocument?.documentGroup?.contract_name || selectedDocument?.title || '文档详情'}
            </div>
            <Button 
              type="text" 
              icon={<CloseOutlined />} 
              onClick={() => setIsCanvasOpen(false)}
              className="close-btn"
            />
          </div>
          <div className="panel-content">
            {selectedDocument && selectedDocument.documentGroup && (
              <>
                <DocumentInfo>
                  <h3>文档信息</h3>
                  <div className="document-meta">
                    <div className="meta-item">
                      <span className="meta-label">文件名:</span>
                      <span>{selectedDocument.documentGroup.file_name}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">合同编号:</span>
                      <span>{selectedDocument.documentGroup.contract_number}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">文件类型:</span>
                      <span>{selectedDocument.documentGroup.file_format}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">上传时间:</span>
                      <span>{new Date(selectedDocument.documentGroup.upload_time).toLocaleDateString('zh-CN')}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">匹配片段:</span>
                      <span>{selectedDocument.documentGroup.chunks.length}个</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">平均相关度:</span>
                      <span>{Math.round(selectedDocument.documentGroup.totalRelevance / selectedDocument.documentGroup.chunks.length * 100) / 100}</span>
                    </div>
                  </div>
                </DocumentInfo>
                
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ color: '#2d3748', marginBottom: '12px', fontSize: '16px' }}>匹配内容</h3>
                  {selectedDocument.documentGroup.chunks.map((chunk, index) => (
                    <div key={chunk.id} style={{ 
                      marginBottom: '16px', 
                      padding: '12px', 
                      background: 'rgba(255, 255, 255, 0.6)', 
                      borderRadius: '8px',
                      border: '1px solid rgba(0, 0, 0, 0.1)'
                    }}>
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#718096', 
                        marginBottom: '8px' 
                      }}>
                        片段 {index + 1} (相关度: {Math.round(chunk.relevance_score * 100) / 100})
                      </div>
                      <DocumentContent>
                        <div className="document-text" 
                             dangerouslySetInnerHTML={{ 
                               __html: chunk.highlighted_text.replace(/<em>/g, '<span class="highlight">').replace(/<\/em>/g, '</span>') 
                             }} 
                        />
                      </DocumentContent>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </DocumentPanel>
      </ContentArea>
    </HomeContainer>
  );
};

// Styled Components
const HomeContainer = styled.div`
  display: flex;
  height: 100vh;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e0 100%);
  color: #2d3748;
  position: relative;
  overflow: hidden;
`;

const Sidebar = styled.div`
  width: 320px;
  background: rgba(255, 255, 255, 0.8);
  border-right: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(20px);
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.05);

  &.collapsed {
    width: 60px;
    
    .new-chat-btn {
      display: none;
    }
    
    .chat-history {
      display: none;
    }
  }
`;

const SidebarHeader = styled.div`
  padding: 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: center;

  .new-chat-btn {
    flex: 1;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    color: white;
    border-radius: 8px;
    font-weight: 500;
    
    &:hover {
      background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }
  }

  .sidebar-toggle {
    color: #4a5568;
    
    &:hover {
      color: #2d3748;
      background: rgba(0, 0, 0, 0.05);
    }
  }
`;

const ChatHistoryContainer = styled.div`
  flex: 1;
  padding: 8px;
  overflow-y: auto;
  
  .loading-history {
    text-align: center;
    padding: 20px;
    color: #718096;
    font-size: 14px;
  }
`;

const ChatItem = styled.div`
  padding: 12px;
  margin-bottom: 4px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: space-between;

  &:hover {
    background: rgba(0, 0, 0, 0.05);
    
    .delete-btn {
      opacity: 1;
    }
  }
  
  &.active {
    background: rgba(102, 126, 234, 0.1);
    border: 1px solid rgba(102, 126, 234, 0.2);
  }

  .chat-content {
    flex: 1;
    min-width: 0;
  }

  .chat-title {
    font-size: 14px;
    color: #2d3748;
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
  }

  .chat-time {
    font-size: 12px;
    color: #718096;
    margin-bottom: 2px;
  }
  
  .chat-count {
    font-size: 11px;
    color: #a0aec0;
  }
  
  .delete-btn {
    opacity: 0;
    transition: opacity 0.2s ease;
    color: #e53e3e;
    font-size: 16px;
    padding: 4px;
    
    &:hover {
      background: rgba(229, 62, 62, 0.1);
      color: #c53030;
    }
  }
`;

const ContentArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: row;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  height: 100vh;
`;

const MainContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 0;
`;

const DocumentPanel = styled.div`
  width: 0;
  background: rgba(255, 255, 255, 0.95);
  border-left: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  backdrop-filter: blur(10px);
  
  &.open {
    width: 500px;
  }
  
  .panel-header {
    padding: 16px 20px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(255, 255, 255, 0.8);
    
    .panel-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 500;
      color: #2d3748;
    }
    
    .close-btn {
      color: #718096;
      
      &:hover {
        color: #2d3748;
        background: rgba(0, 0, 0, 0.05);
      }
    }
  }
  
  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e0 100%);
  }
`;

const WelcomeScreen = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 40px;
  text-align: center;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e0 100%);
  position: relative;
  overflow: hidden;
  color: #2d3748;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  width: 100%;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
      radial-gradient(circle at 30% 70%, rgba(102, 126, 234, 0.08) 0%, transparent 50%),
      radial-gradient(circle at 70% 30%, rgba(139, 92, 246, 0.05) 0%, transparent 50%);
    pointer-events: none;
  }

  .welcome-title {
    font-size: 3.5rem;
    font-weight: 800;
    margin-bottom: 24px;
    background: linear-gradient(45deg, #2d3748, #4a5568, #667eea);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    text-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    letter-spacing: -0.02em;
    position: relative;
    z-index: 1;
  }

  .welcome-subtitle {
    font-size: 1.3rem;
    margin-bottom: 48px;
    opacity: 0.8;
    max-width: 650px;
    line-height: 1.7;
    font-weight: 400;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    position: relative;
    z-index: 1;
    color: #4a5568;
  }
`;

const ChatScreen = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e0 100%);
  color: #2d3748;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  width: 100%;
`;

const ChatHeader = styled.div`
  padding: 16px 24px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  
  .chat-title-area {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .sidebar-toggle-btn {
    color: #718096;
    
    &:hover {
      color: #2d3748;
      background: rgba(0, 0, 0, 0.05);
    }
  }
  
  .current-chat-title {
    font-size: 16px;
    font-weight: 500;
    color: #2d3748;
  }
  
  .chat-actions {
    display: flex;
    gap: 8px;
  }
  
  .action-btn {
    color: #718096;
    border: 1px solid rgba(0, 0, 0, 0.2);
    background: transparent;
    
    &:hover {
      color: #2d3748;
      border-color: rgba(0, 0, 0, 0.3);
      background: rgba(0, 0, 0, 0.05);
    }
  }
`;

const MessagesArea = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
`;

const Message = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  
  &.user {
    flex-direction: row-reverse;
    
    .message-content {
      background: rgba(102, 126, 234, 0.1);
      border: 1px solid rgba(102, 126, 234, 0.2);
      color: #2d3748;
      max-width: 80%;
      width: fit-content;
    }
  }
  
  &.assistant {
    .message-content {
      background: rgba(255, 255, 255, 0.8);
      border: 1px solid rgba(0, 0, 0, 0.1);
      color: #2d3748;
      max-width: 85%;
      width: fit-content;
    }
  }
  
  .message-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #4a5568;
    flex-shrink: 0;
  }
  
  .message-content {
    padding: 12px 16px;
    border-radius: 12px;
    line-height: 1.6;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
`;

const FeedbackButtons = styled.div`
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 8px;
  
  .feedback-text {
    font-size: 12px;
    color: #718096;
    margin-right: 4px;
  }
  
  .feedback-btn {
    border: 1px solid rgba(0, 0, 0, 0.15);
    background: transparent;
    color: #718096;
    font-size: 14px;
    padding: 4px 8px;
    height: 28px;
    min-width: 28px;
    
    &:hover:not(:disabled) {
      color: #2d3748;
      border-color: rgba(0, 0, 0, 0.25);
      background: rgba(0, 0, 0, 0.05);
    }
    
    &.helpful {
      &:hover:not(:disabled) {
        color: #38a169;
        border-color: #38a169;
        background: rgba(56, 161, 105, 0.1);
      }
      
      &.active {
        color: #38a169;
        border-color: #38a169;
        background: rgba(56, 161, 105, 0.1);
      }
    }
    
    &.not-helpful {
      &:hover:not(:disabled) {
        color: #e53e3e;
        border-color: #e53e3e;
        background: rgba(229, 62, 62, 0.1);
      }
      
      &.active {
        color: #e53e3e;
        border-color: #e53e3e;
        background: rgba(229, 62, 62, 0.1);
      }
    }
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
`;

const SearchResults = styled.div`
  margin-top: 16px;
  
  .results-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    font-size: 14px;
    color: #718096;
  }
  
  .source-badge {
    background: rgba(102, 126, 234, 0.2);
    color: #2d3748;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
  }
`;

const ResultItem = styled.div`
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.8);
    border-color: rgba(0, 0, 0, 0.2);
  }
  
  .result-header {
    margin-bottom: 8px;
  }
  
  .result-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
    color: #2d3748;
  }
  
  .file-icon {
    font-size: 16px;
  }
  
  .result-meta {
    display: flex;
    gap: 16px;
    margin-bottom: 8px;
    font-size: 12px;
    color: #718096;
  }
  
  .relevance-score {
    color: #48bb78;
    font-weight: 500;
  }
  
  .result-snippet {
    color: #4a5568;
    line-height: 1.5;
    margin-bottom: 8px;
  }
  
  .highlights {
    margin-top: 8px;
    
    strong {
      color: #4a5568;
      font-size: 12px;
      display: block;
      margin-bottom: 6px;
    }
    
    .highlight-preview {
      background: rgba(255, 235, 59, 0.1);
      border: 1px solid rgba(255, 235, 59, 0.3);
      border-radius: 4px;
      padding: 8px;
      font-size: 13px;
      line-height: 1.4;
      color: #4a5568;
      
      em, .highlight {
        background: rgba(255, 235, 59, 0.6);
        color: #b45309;
        padding: 1px 3px;
        border-radius: 2px;
        font-style: normal;
        font-weight: 500;
      }
    }
  }
  
  .result-actions {
    display: flex;
    gap: 8px;
  }
  
  .action-chip {
    background: rgba(0, 0, 0, 0.1);
    color: #718096;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover {
      background: rgba(0, 0, 0, 0.15);
      color: #2d3748;
    }
  }
`;

const InputArea = styled.div`
  padding: 16px 24px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  background: transparent;
  
  .input-container {
    display: flex;
    gap: 8px;
    align-items: flex-end;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 16px;
    padding: 8px;
    border: 1px solid rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(10px);
  }
  
  .chat-input {
    flex: 1;
    background: transparent;
    border: none;
    border-radius: 12px;
    color: #2d3748;
    padding: 8px 12px;
    
    &::placeholder {
      color: #718096;
    }
    
    &:focus {
      outline: none;
      box-shadow: none;
    }
  }
  
  .send-btn {
    background: linear-gradient(135deg, #2d3748 0%, #4a5568 100%);
    border: none;
    border-radius: 12px;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    transition: all 0.2s ease;
    
    &:hover:not(:disabled) {
      background: linear-gradient(135deg, #1a202c 0%, #2d3748 100%);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(45, 55, 72, 0.3);
    }
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      background: linear-gradient(135deg, #a0aec0 0%, #cbd5e0 100%);
    }
  }
`;

const DocumentCanvas = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  width: 400px;
  height: 100%;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e0 100%);
  backdrop-filter: blur(20px);
  border-left: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 10;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.1);
`;

const CanvasHeader = styled.div`
  padding: 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  
  .canvas-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
    color: #2d3748;
  }
  
  .canvas-close {
    color: #718096;
    border: none;
    background: transparent;
    
    &:hover {
      color: #2d3748;
      background: rgba(0, 0, 0, 0.05);
    }
  }
`;

const CanvasContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
`;

const DocumentInfo = styled.div`
  margin-bottom: 16px;
  
  h3 {
    color: #2d3748;
    margin-bottom: 12px;
    font-size: 16px;
  }
  
  .document-meta {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .meta-item {
    display: flex;
    justify-content: space-between;
    font-size: 14px;
    color: #2d3748;
  }
  
  .meta-label {
    color: #718096;
  }
`;

const HighlightNavigation = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  
  .highlight-counter {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
  }
  
  .highlight-controls {
    display: flex;
    gap: 4px;
  }
`;

const DocumentContent = styled.div`
  .document-text {
    line-height: 1.6;
    color: #2d3748;
  }
  
  .highlight {
    background: rgba(255, 235, 59, 0.6);
    color: #2d3748;
    padding: 1px 2px;
    border-radius: 2px;
    font-weight: 500;
    
    &.current {
      background: rgba(255, 193, 7, 0.8);
      color: #2d3748;
      box-shadow: 0 0 0 2px rgba(255, 193, 7, 0.5);
    }
  }
`;

const SearchContainer = styled.div`
  position: relative;
  width: 100%;
  max-width: 600px;
  margin-bottom: 40px;
  z-index: 1;

  .search-input {
    width: 100%;
    padding: 20px 60px 20px 24px;
    font-size: 16px;
    border: 2px solid rgba(102, 126, 234, 0.2);
    border-radius: 50px;
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(20px);
    color: #2d3748;
    outline: none;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
    font-weight: 400;
    letter-spacing: 0.3px;

    &::placeholder {
      color: #718096;
      font-weight: 300;
    }

    &:focus {
      border-color: rgba(102, 126, 234, 0.5);
      background: rgba(255, 255, 255, 0.95);
      box-shadow: 0 12px 40px rgba(102, 126, 234, 0.15);
      transform: translateY(-2px);
    }
  }

  .search-btn {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    width: 44px;
    height: 44px;
    border: none;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);

    &:hover {
      transform: translateY(-50%) scale(1.05);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
    }
  }
`;

const SuggestionsContainer = styled.div`
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 50px;
  position: relative;
  z-index: 1;
`;

const SuggestionTag = styled.div`
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(15px);
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 25px;
  color: #4a5568;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
  letter-spacing: 0.3px;

  &:hover {
    background: rgba(102, 126, 234, 0.1);
    border-color: rgba(102, 126, 234, 0.4);
    transform: translateY(-3px);
    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.2);
    color: #2d3748;
  }
`;

























export default Home