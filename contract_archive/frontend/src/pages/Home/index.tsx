import React, { useState, useRef, useEffect } from 'react';
import { Button, Input } from 'antd';
import { 
  MenuOutlined,
  SendOutlined,
  UserOutlined,
  RobotOutlined,
  CloseOutlined
} from '@ant-design/icons';
//
import styled from 'styled-components';
import { qaAPI } from '../../services/api';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import {
  setCurrentView as setCurrentViewGlobal,
  setMessages as setMessagesGlobal,
  addMessage as addMessageGlobal,
  clearConversation as clearConversationGlobal,
  setSessionId as setSessionIdGlobal,
  setIsViewingHistory as setIsViewingHistoryGlobal,
  setIsCanvasOpen as setIsCanvasOpenGlobal,
  setSelectedDocument as setSelectedDocumentGlobal,
  setCurrentHighlight as setCurrentHighlightGlobal,
  setIsSearching as setIsSearchingGlobal,
  setInputValue as setInputValueGlobal,
  setFeedbackStatus as setFeedbackStatusGlobal,
} from '../../store/slices/chatSlice'

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
  
  const dispatch = useDispatch();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const {
    currentView,
    messages,
    inputValue,
    isCanvasOpen,
    selectedDocument,
    // currentHighlight, // not used directly in this component
    isSearching,
    sessionId,
    isViewingHistory,
    feedbackStatus,
  } = useSelector((state: RootState) => state.chat);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // 聊天历史数据
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // 搜索状态、会话状态、反馈状态统一由全局store管理

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

  // 监听窗口大小变化，自动调整侧边栏状态
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768 && !sidebarCollapsed) {
        // 桌面端时确保侧边栏可见
      } else if (window.innerWidth <= 768) {
        // 移动端时默认折叠侧边栏
        setSidebarCollapsed(true);
      }
    };

    window.addEventListener('resize', handleResize);
    // 初始检查
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarCollapsed]);

  // 加载历史会话
  const loadHistorySession = async (sessionId: string) => {
    try {
      const response = await qaAPI.getSessionHistory(sessionId);
      if (response.success) {
        // 分离用户问题和AI回答为独立的消息
        const historyMessages: ChatMessage[] = [];
        response.data.messages.forEach(msg => {
          // 添加用户问题
          if (msg.question) {
            historyMessages.push({
              id: `${msg.id}-question`,
              type: 'user',
              content: msg.question,
              timestamp: new Date(msg.created_at),
            });
          }
          
          // 添加AI回答（包含搜索结果）
          if (msg.answer) {
            historyMessages.push({
              id: `${msg.id}-answer`,
              type: 'assistant',
              content: msg.answer,
              timestamp: new Date(msg.created_at),
              searchResults: msg.elasticsearch_results ? extractSearchResults(msg.elasticsearch_results) : undefined,
              documentGroups: msg.elasticsearch_results ? groupChunksByFile(extractSearchResults(msg.elasticsearch_results)) : undefined
            });
          }
        });
        
        dispatch(setMessagesGlobal(historyMessages as any));
        dispatch(setSessionIdGlobal(sessionId));
        dispatch(setCurrentViewGlobal('chat'));
      }
    } catch (error) {
      console.error('加载历史会话失败:', error);
    }
  };

  // 从elasticsearch结果中提取搜索结果
  const extractSearchResults = (esResults: any): SearchResult[] => {
    const esDoc = esResults?.es ?? esResults;
    const hits: any[] = esDoc?.hits?.hits ?? [];
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
    
    dispatch(addMessageGlobal(userMessage as any));
    dispatch(setInputValueGlobal(''));
    dispatch(setCurrentViewGlobal('chat'));
    dispatch(setIsSearchingGlobal(true));
    
    try {
      // 调用QA问答接口（使用混合RAG流程）
      const payload = { question: query, session_id: sessionId ?? undefined };
      const resp = await qaAPI.ask(payload);
      const data = resp.data;

      // 首次会话，记录生成的session_id
      if (!sessionId && data.session_id) {
        dispatch(setSessionIdGlobal(data.session_id));
        // 重新加载会话列表以显示新创建的会话
        loadChatHistory();
      }

      // 获取AI生成的回答（这是最重要的内容）
      const aiAnswer = data.answer || '';
      
      // 从Elasticsearch原始结果中提取内容块用于展示来源
      const es = (data.elasticsearch_results as any)?.es ?? (data.elasticsearch_results as any);
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
      
      // 创建助手消息，优先显示AI回答
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: aiAnswer || (chunks.length > 0 
          ? `根据您的查询"${query}"，我为您找到了以下相关文档信息：`
          : `抱歉，没有找到与"${query}"相关的文档信息。`),
        timestamp: new Date(),
        searchResults: chunks,
        documentGroups: documentGroups
      };
      
      dispatch(addMessageGlobal(assistantMessage as any));
    } catch (error) {
      console.error('搜索失败:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: '抱歉，搜索服务暂时不可用，请稍后再试。',
        timestamp: new Date()
      };
      dispatch(addMessageGlobal(errorMessage as any));
    } finally {
      dispatch(setIsSearchingGlobal(false));
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
    
    dispatch(setSelectedDocumentGlobal(docForPreview as any));
    dispatch(setIsCanvasOpenGlobal(true));
    dispatch(setCurrentHighlightGlobal(0));
  };

  const handleNewChat = () => {
    dispatch(clearConversationGlobal());
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
      // 提取原始消息ID（去除后缀）
      const originalMessageId = messageId.includes('-') ? messageId.split('-')[0] : messageId;
      
      const response = await qaAPI.sendFeedback(sessionId, parseInt(originalMessageId), { feedback });
      if (response.success) {
        dispatch(setFeedbackStatusGlobal({ messageId, value: feedback }));
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
    // ESC键关闭侧边栏（移动端）
    if (e.key === 'Escape' && !sidebarCollapsed && window.innerWidth <= 768) {
      setSidebarCollapsed(true);
    }
  };

  // 未使用的辅助函数移除以通过Lint

  return (
    <HomeContainer>
      {/* 移动端遮罩层 */}
      {!sidebarCollapsed && (
        <MobileOverlay onClick={() => setSidebarCollapsed(true)} />
      )}
      
      {/* 左侧边栏 - 历史对话 */}
      <Sidebar className={sidebarCollapsed ? 'collapsed' : ''}>
        {/* 折叠时仅保留一个展开按钮，隐藏其余所有内容 */}
        <SidebarHeader>
          {!sidebarCollapsed && (
            <Button 
              type="primary" 
              className="new-chat-btn"
              onClick={handleNewChat}
            >
              + 新建对话
            </Button>
          )}
            <Button 
            type="text" 
            className="sidebar-toggle"
            icon={<MenuOutlined />}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </SidebarHeader>
        
        {!sidebarCollapsed && (
          <ChatHistoryContainer>
            {isLoadingHistory ? (
              <div className="loading-history">加载中...</div>
            ) : (
              chatHistory.map(chat => (
                <ChatItem 
                  key={chat.session_id} 
                  className={`chat-item ${chat.session_id === sessionId ? 'active' : ''}`}
                  onClick={() => { dispatch(setIsViewingHistoryGlobal(true)); loadHistorySession(chat.session_id); }}
                >
                  <div className="chat-content">
                    <div className="chat-title">{chat.session_title || chat.first_message}</div>
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
        )}
      </Sidebar>

      {/* 右侧主要内容区域 */}
      <ContentArea className={isCanvasOpen ? 'canvas-active' : ''}>
        <MainContent>
          {/* 欢迎界面 - 初始状态 */}
          {currentView === 'welcome' && !isViewingHistory && (
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
                  onChange={(e) => dispatch(setInputValueGlobal(e.target.value))}
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
              {/* 移除标题框，仅保留操作按钮（非历史查看时显示） */}
              {!isViewingHistory && (
                <QuickActions>
                  <Button className="action-btn">清空对话</Button>
                  <Button className="action-btn">导出对话</Button>
                </QuickActions>
              )}
              
              <MessagesArea>
                {messages.map(message => (
                  <Message key={message.id} className={message.type}>
                    <div className="message-avatar">
                      {message.type === 'user' ? <UserOutlined /> : <RobotOutlined />}
                    </div>
                    <div className="message-content">
                      {message.content}
                      
                      {/* 助理消息的反馈按钮（历史查看时隐藏） */}
                      {message.type === 'assistant' && sessionId && !isViewingHistory && (
                        <MessageFeedback>
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
                        </MessageFeedback>
                      )}
                      
                      {/* 搜索结果区域 */}
                      {message.documentGroups && (
                        <SearchResults>
                          <div className="results-header">
                            <span className="source-badge">文档检索</span>
                            找到 {message.documentGroups.length} 个相关文档
                          </div>
                          
                          {message.documentGroups.map((group: any, index: number) => (
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
                    onChange={(e) => dispatch(setInputValueGlobal(e.target.value))}
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
              onClick={() => dispatch(setIsCanvasOpenGlobal(false))}
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
                  {selectedDocument.documentGroup.chunks.map((chunk: any, index: number) => (
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
  
  /* 移动端触摸优化 */
  @media (max-width: 768px) {
    -webkit-overflow-scrolling: touch;
    touch-action: manipulation;
  }
  
  /* 确保在小屏幕上不会出现水平滚动 */
  @media (max-width: 480px) {
    min-width: 100vw;
  }
`;

const MobileOverlay = styled.div`
  display: none;
  
  @media (max-width: 768px) {
    display: block;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999;
  }
`;

const Sidebar = styled.div`
  width: 320px;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e0 100%);
  border-right: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(20px);
  box-shadow: 2px 0 15px rgba(0, 0, 0, 0.08);
  height: 100vh;
  position: relative;
  z-index: 10;
  overflow: hidden;

  &.collapsed {
    width: 60px;
    
    .new-chat-btn {
      display: none;
    }
    
    .chat-history {
      display: none;
    }
  }

  @media (max-width: 768px) {
    position: fixed;
    left: 0;
    top: 0;
    z-index: 1000;
    transform: translateX(-100%);
    box-shadow: 4px 0 20px rgba(0, 0, 0, 0.15);
    
    &:not(.collapsed) {
      transform: translateX(0);
      width: 300px;
    }
    
    &.collapsed {
      transform: translateX(-100%);
      width: 0;
    }
  }

  @media (max-width: 480px) {
    &:not(.collapsed) {
      width: 280px;
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
    
    @media (max-width: 768px) {
      font-size: 13px;
      padding: 8px 12px;
    }
  }

  .sidebar-toggle {
    color: #4a5568;
    
    &:hover {
      color: #2d3748;
      background: rgba(0, 0, 0, 0.05);
    }
    
    @media (max-width: 768px) {
      color: #2d3748;
      background: rgba(0, 0, 0, 0.05);
    }
  }
  
  @media (max-width: 768px) {
    padding: 12px;
  }
`;

const ChatHistoryContainer = styled.div`
  flex: 1;
  padding: 8px;
  overflow-y: auto;
  overflow-x: hidden;
  
  /* 自定义滚动条 */
  &::-webkit-scrollbar {
    width: 4px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.05);
    border-radius: 2px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 2px;
    
    &:hover {
      background: rgba(0, 0, 0, 0.3);
    }
  }
  
  .loading-history {
    text-align: center;
    padding: 20px;
    color: #718096;
    font-size: 14px;
  }
`;

const ChatItem = styled.div`
  padding: 10px;
  margin-bottom: 4px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;

  &:hover {
    background: rgba(102, 126, 234, 0.08);
    transform: translateX(2px);
    
    .delete-btn {
      opacity: 1;
    }
  }
  
  &.active {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%);
    border: 1px solid rgba(102, 126, 234, 0.3);
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
    
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 3px;
      height: 60%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 0 2px 2px 0;
    }
  }

  .chat-content {
    flex: 1;
    min-width: 0;
    padding-left: 8px;
  }

  .chat-title {
    font-size: 13px;
    color: #2d3748;
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
    line-height: 1.3;
    
    @media (max-width: 768px) {
      font-size: 12px;
    }
  }

  .chat-time {
    font-size: 11px;
    color: #718096;
    margin-bottom: 2px;
    
    @media (max-width: 768px) {
      font-size: 10px;
    }
  }
  
  .chat-count {
    font-size: 10px;
    color: #a0aec0;
    
    @media (max-width: 768px) {
      font-size: 9px;
    }
  }
  
  .delete-btn {
    opacity: 0;
    transition: all 0.2s ease;
    color: #e53e3e;
    font-size: 14px;
    padding: 4px;
    border-radius: 4px;
    min-width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    
    &:hover {
      background: rgba(229, 62, 62, 0.15);
      color: #c53030;
      transform: scale(1.1);
    }
    
    @media (max-width: 768px) {
      opacity: 0.6;
      font-size: 12px;
      min-width: 20px;
      height: 20px;
    }
  }
  
  @media (max-width: 768px) {
    padding: 8px;
    margin-bottom: 3px;
  }
`;

const ContentArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: row;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  height: 100vh;
  min-width: 0;
  
  @media (max-width: 768px) {
    width: 100%;
    margin-left: 0;
  }
`;

const MainContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 0;
  position: relative;
  
  @media (max-width: 768px) {
    width: 100%;
  }
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
    
    @media (max-width: 1200px) {
      width: 400px;
    }
    
    @media (max-width: 768px) {
      position: fixed;
      top: 0;
      right: 0;
      width: 100%;
      height: 100vh;
      z-index: 1001;
      border-left: none;
    }
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
      
      @media (max-width: 768px) {
        font-size: 14px;
      }
    }
    
    .close-btn {
      color: #718096;
      
      &:hover {
        color: #2d3748;
        background: rgba(0, 0, 0, 0.05);
      }
      
      @media (max-width: 768px) {
        color: #2d3748;
        background: rgba(0, 0, 0, 0.05);
        border: 1px solid rgba(0, 0, 0, 0.1);
        width: 32px;
        height: 32px;
      }
    }
    
    @media (max-width: 768px) {
      padding: 12px 16px;
    }
  }
  
  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e0 100%);
    
    @media (max-width: 768px) {
      padding: 16px;
    }
    
    @media (max-width: 480px) {
      padding: 12px;
    }
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
    
    @media (max-width: 768px) {
      font-size: 2.5rem;
      margin-bottom: 16px;
    }
    
    @media (max-width: 480px) {
      font-size: 2rem;
    }
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
    
    @media (max-width: 768px) {
      font-size: 1.1rem;
      margin-bottom: 32px;
      max-width: 90%;
    }
    
    @media (max-width: 480px) {
      font-size: 1rem;
      margin-bottom: 24px;
    }
  }
  
  @media (max-width: 768px) {
    padding: 20px;
  }
`;

const ChatScreen = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0; /* 关键：允许内部可滚动区域正确计算高度 */
  height: 100%;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e0 100%);
  color: #2d3748;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  width: 100%;
`;

// 简化的快捷操作区域组件
const QuickActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);

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
    
    @media (max-width: 768px) {
      color: #2d3748;
      background: rgba(0, 0, 0, 0.05);
      border: 1px solid rgba(0, 0, 0, 0.1);
    }
  }
  
  .current-chat-title {
    font-size: 16px;
    font-weight: 500;
    color: #2d3748;
    
    @media (max-width: 768px) {
      font-size: 14px;
    }
  }
  
  .chat-actions {
    display: flex;
    gap: 8px;
    
    @media (max-width: 768px) {
      display: none;
    }
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
  
  @media (max-width: 768px) {
    padding: 16px;
  }
  
  @media (max-width: 480px) {
    padding: 12px;
  }
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
      
      @media (max-width: 768px) {
        max-width: 90%;
      }
    }
  }
  
  &.assistant {
    .message-content {
      background: rgba(255, 255, 255, 0.8);
      border: 1px solid rgba(0, 0, 0, 0.1);
      color: #2d3748;
      max-width: 85%;
      width: fit-content;
      
      @media (max-width: 768px) {
        max-width: 95%;
      }
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
    
    @media (max-width: 768px) {
      width: 28px;
      height: 28px;
    }
  }
  
  .message-content {
    padding: 12px 16px;
    border-radius: 12px;
    line-height: 1.6;
    word-wrap: break-word;
    overflow-wrap: break-word;
    
    @media (max-width: 768px) {
      padding: 10px 14px;
      font-size: 14px;
    }
  }
  
  @media (max-width: 768px) {
    gap: 8px;
    margin-bottom: 20px;
  }
`;

const MessageFeedback = styled.div`
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 8px;
  
  .feedback-label {
    font-size: 12px;
    color: #718096;
    
    @media (max-width: 768px) {
      font-size: 11px;
    }
  }
  
  .feedback-buttons {
    display: flex;
    gap: 8px;
    
    @media (max-width: 768px) {
      gap: 6px;
    }
  }
  
  .feedback-btn {
    border: 1px solid rgba(0, 0, 0, 0.15);
    background: transparent;
    color: #718096;
    font-size: 12px;
    padding: 4px 8px;
    height: 28px;
    
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
      
      &.ant-btn-primary {
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
      
      &.ant-btn-primary {
        color: #e53e3e;
        border-color: #e53e3e;
        background: rgba(229, 62, 62, 0.1);
      }
    }
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    @media (max-width: 768px) {
      font-size: 11px;
      padding: 3px 6px;
      height: 24px;
    }
  }
`;

// Unused styled components retained for potential future features
/* eslint-disable @typescript-eslint/no-unused-vars */
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
    
    @media (max-width: 768px) {
      font-size: 13px;
      margin-bottom: 10px;
    }
  }
  
  .source-badge {
    background: rgba(102, 126, 234, 0.2);
    color: #2d3748;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
    
    @media (max-width: 768px) {
      font-size: 11px;
      padding: 1px 6px;
    }
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
    
    @media (max-width: 768px) {
      font-size: 14px;
    }
  }
  
  .file-icon {
    font-size: 16px;
    
    @media (max-width: 768px) {
      font-size: 14px;
    }
  }
  
  .result-meta {
    display: flex;
    gap: 16px;
    margin-bottom: 8px;
    font-size: 12px;
    color: #718096;
    flex-wrap: wrap;
    
    @media (max-width: 768px) {
      gap: 12px;
      font-size: 11px;
    }
    
    @media (max-width: 480px) {
      gap: 8px;
      font-size: 10px;
    }
  }
  
  .relevance-score {
    color: #48bb78;
    font-weight: 500;
  }
  
  .result-snippet {
    color: #4a5568;
    line-height: 1.5;
    margin-bottom: 8px;
    
    @media (max-width: 768px) {
      font-size: 13px;
      line-height: 1.4;
    }
  }
  
  .highlights {
    margin-top: 8px;
    
    strong {
      color: #4a5568;
      font-size: 12px;
      display: block;
      margin-bottom: 6px;
      
      @media (max-width: 768px) {
        font-size: 11px;
      }
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
      
      @media (max-width: 768px) {
        padding: 6px;
        font-size: 12px;
      }
    }
  }
  
  .result-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    
    @media (max-width: 768px) {
      gap: 6px;
    }
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
    
    @media (max-width: 768px) {
      font-size: 11px;
      padding: 3px 6px;
    }
  }
  
  @media (max-width: 768px) {
    padding: 10px;
    margin-bottom: 6px;
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
    
    @media (max-width: 768px) {
      font-size: 14px;
      padding: 6px 10px;
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
    
    @media (max-width: 768px) {
      width: 36px;
      height: 36px;
    }
  }
  
  @media (max-width: 768px) {
    padding: 12px 16px;
    
    .input-container {
      padding: 6px;
      gap: 6px;
    }
  }
  
  @media (max-width: 480px) {
    padding: 10px 12px;
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
    
    @media (max-width: 768px) {
      font-size: 14px;
      margin-bottom: 10px;
    }
  }
  
  .document-meta {
    display: flex;
    flex-direction: column;
    gap: 8px;
    
    @media (max-width: 768px) {
      gap: 6px;
    }
  }
  
  .meta-item {
    display: flex;
    justify-content: space-between;
    font-size: 14px;
    color: #2d3748;
    
    @media (max-width: 768px) {
      font-size: 13px;
      flex-direction: column;
      gap: 2px;
    }
  }
  
  .meta-label {
    color: #718096;
    
    @media (max-width: 768px) {
      font-size: 12px;
    }
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
    
    @media (max-width: 768px) {
      font-size: 14px;
      line-height: 1.5;
    }
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
    
    @media (max-width: 768px) {
      padding: 16px 50px 16px 20px;
      font-size: 14px;
    }
    
    @media (max-width: 480px) {
      padding: 14px 45px 14px 16px;
      font-size: 14px;
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
    
    @media (max-width: 768px) {
      width: 38px;
      height: 38px;
      right: 6px;
    }
    
    @media (max-width: 480px) {
      width: 34px;
      height: 34px;
      right: 5px;
    }
  }
  
  @media (max-width: 768px) {
    max-width: 90%;
    margin-bottom: 32px;
  }
  
  @media (max-width: 480px) {
    max-width: 95%;
    margin-bottom: 24px;
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
  
  @media (max-width: 768px) {
    gap: 12px;
    margin-bottom: 32px;
  }
  
  @media (max-width: 480px) {
    gap: 8px;
    margin-bottom: 24px;
  }
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
  
  @media (max-width: 768px) {
    padding: 10px 16px;
    font-size: 13px;
  }
  
  @media (max-width: 480px) {
    padding: 8px 14px;
    font-size: 12px;
  }
`;

























export default Home