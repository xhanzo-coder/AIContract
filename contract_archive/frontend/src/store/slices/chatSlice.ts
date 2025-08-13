import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type ChatView = 'welcome' | 'chat'

export interface SearchResultItem {
  id: number
  chunk_index: number
  content_text: string
  highlighted_text: string
  chunk_type: string
  chunk_size: number
  relevance_score: number
  contract_id: number
  contract_number: string
  contract_name: string
  file_name: string
  file_format: string
  upload_time: string
  contract_type: string | null
}

export interface DocumentGroupItem {
  file_name: string
  contract_name: string
  contract_number: string
  file_format: string
  upload_time: string
  contract_type: string | null
  chunks: SearchResultItem[]
  totalRelevance: number
}

export interface ChatMessageItem {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  searchResults?: SearchResultItem[]
  documentGroups?: DocumentGroupItem[]
}

export interface ChatState {
  currentView: ChatView
  messages: ChatMessageItem[]
  inputValue: string
  isCanvasOpen: boolean
  selectedDocument: any | null
  currentHighlight: number
  isSearching: boolean
  sessionId: string | null
  isViewingHistory: boolean
  feedbackStatus: { [messageId: string]: 'helpful' | 'not_helpful' | null }
}

const initialState: ChatState = {
  currentView: 'welcome',
  messages: [],
  inputValue: '',
  isCanvasOpen: false,
  selectedDocument: null,
  currentHighlight: 0,
  isSearching: false,
  sessionId: null,
  isViewingHistory: false,
  feedbackStatus: {},
}

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setCurrentView(state, action: PayloadAction<ChatView>) {
      state.currentView = action.payload
    },
    setMessages(state, action: PayloadAction<ChatMessageItem[]>) {
      state.messages = action.payload
    },
    addMessage(state, action: PayloadAction<ChatMessageItem>) {
      state.messages.push(action.payload)
    },
    clearConversation(state) {
      state.messages = []
      state.currentView = 'welcome'
      state.isCanvasOpen = false
      state.selectedDocument = null
      state.sessionId = null
      state.isViewingHistory = false
      state.inputValue = ''
      state.currentHighlight = 0
      state.isSearching = false
      state.feedbackStatus = {}
    },
    setSessionId(state, action: PayloadAction<string | null>) {
      state.sessionId = action.payload
    },
    setIsViewingHistory(state, action: PayloadAction<boolean>) {
      state.isViewingHistory = action.payload
    },
    setIsCanvasOpen(state, action: PayloadAction<boolean>) {
      state.isCanvasOpen = action.payload
    },
    setSelectedDocument(state, action: PayloadAction<any | null>) {
      state.selectedDocument = action.payload
    },
    setCurrentHighlight(state, action: PayloadAction<number>) {
      state.currentHighlight = action.payload
    },
    setIsSearching(state, action: PayloadAction<boolean>) {
      state.isSearching = action.payload
    },
    setInputValue(state, action: PayloadAction<string>) {
      state.inputValue = action.payload
    },
    setFeedbackStatus(state, action: PayloadAction<{ messageId: string; value: 'helpful' | 'not_helpful' | null }>) {
      const { messageId, value } = action.payload
      state.feedbackStatus[messageId] = value
    },
  },
})

export const {
  setCurrentView,
  setMessages,
  addMessage,
  clearConversation,
  setSessionId,
  setIsViewingHistory,
  setIsCanvasOpen,
  setSelectedDocument,
  setCurrentHighlight,
  setIsSearching,
  setInputValue,
  setFeedbackStatus,
} = chatSlice.actions

export default chatSlice.reducer


