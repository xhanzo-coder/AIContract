export interface Contract {
  id: number
  title: string
  description: string
  file_path: string
  file_size: number
  file_type: string
  file_format?: string
  file_name?: string
  upload_date: string
  upload_time?: string
  ocr_status: 'pending' | 'processing' | 'completed' | 'failed'
  content_status?: 'pending' | 'processing' | 'completed' | 'failed'
  vector_status?: 'pending' | 'processing' | 'completed' | 'failed'
  elasticsearch_sync_status?: 'pending' | 'processing' | 'completed' | 'failed'
  ocr_content?: string
  ocr_error?: string
  processed_at?: string
  processing_steps?: {
    [key: string]: {
      status: 'pending' | 'processing' | 'completed' | 'failed'
      message?: string
    }
  }
  // 兼容旧版本的字段
  content_summary?: string
  contract_info?: {
    contract_type: string
    amount: string
    parties: string[]
    sign_date: string
    status?: string
  }
  similarity?: number
  highlights?: string[]
  tags?: string[]
  content?: string
  matchedClauses?: any[]
}

export interface SearchResult {
  documents: Contract[]
  total: number
  query: string
  search_time: number
}

export interface UploadResponse {
  success: boolean
  message: string
  contract_id: number
  file_path: string
  ocr_status: string
}

export interface OcrStatusResponse {
  contract_id: number
  ocr_status: 'pending' | 'processing' | 'completed' | 'failed'
  ocr_content?: string
  ocr_error?: string
  processed_at?: string
}

export interface OcrProcessResponse {
  message: string
  contract_id: number
  status: string
  model?: string
}

export interface Statistics {
  total_documents: number
  total_amount: string
  contract_types: { [key: string]: number }
  monthly_uploads: { month: string; count: number }[]
  recent_activities: Activity[]
}

export interface Activity {
  id: string
  type: 'upload' | 'search' | 'view'
  description: string
  timestamp: string
  user?: string
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
  error?: string
}

// QA Session related types
export interface QASessionCreate {
  session_id?: string
  question: string
}

export interface QASessionResponse {
  id: number
  session_id: string
  session_title?: string
  message_order: number
  question: string
  answer?: string
  source_contracts?: number[]
  source_chunks?: number[]
  elasticsearch_results?: any
  search_method?: string
  ai_response_type?: string
  response_time?: number
  user_feedback?: string
  created_at: string
  updated_at: string
}

export interface SessionListResponse {
  sessions: Array<{
    session_id: string
    session_title?: string
    first_message: string
    created_at: string
    message_count: number
  }>
  total: number
}

export interface SessionHistoryResponse {
  session_id: string
  session_title?: string
  messages: QASessionResponse[]
  total_messages: number
}

export interface FeedbackRequest {
  feedback: 'helpful' | 'not_helpful'
}