export interface Contract {
  id: number
  title: string
  description: string
  file_path: string
  file_size: number
  file_type: string
  upload_date: string
  ocr_status: 'pending' | 'processing' | 'completed' | 'failed'
  ocr_content?: string
  ocr_error?: string
  processed_at?: string
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