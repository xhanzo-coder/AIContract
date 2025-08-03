import axios from 'axios'
import { ApiResponse, SearchResult, Contract, UploadResponse, Statistics } from '../types'

// 创建axios实例
const api = axios.create({
  baseURL: '/api',
  timeout: 60000, // 增加超时时间，因为OCR处理可能需要更长时间
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 可以在这里添加认证信息等
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`)
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`)
    return response
  },
  (error) => {
    // 处理错误响应
    if (error.response) {
      // 服务器返回错误
      console.error('API Error:', error.response.status, error.response.data)
    } else if (error.request) {
      // 请求未收到响应
      console.error('Network Error:', error.request)
    } else {
      // 请求配置错误
      console.error('Request Error:', error.message)
    }
    return Promise.reject(error)
  }
)

// 搜索API
export const searchAPI = {
  // 自然语言搜索
  naturalSearch: async (query: string, limit = 10, filters?: any): Promise<ApiResponse<SearchResult>> => {
    try {
      const response = await api.post('/search/natural', { query, limit, ...filters })
      return response.data
    } catch (error) {
      console.error('Natural search error:', error)
      throw error
    }
  },

  // 关键词搜索
  keywordSearch: async (keyword: string, limit = 10): Promise<ApiResponse<SearchResult>> => {
    try {
      const response = await api.get(`/search/keyword?q=${encodeURIComponent(keyword)}&limit=${limit}`)
      return response.data
    } catch (error) {
      console.error('Keyword search error:', error)
      throw error
    }
  }
}

// 合约API - 对接Alex Chen的后端接口
export const contractAPI = {
  // 健康检查
  healthCheck: async (): Promise<any> => {
    try {
      const response = await api.get('/health')
      return response.data
    } catch (error) {
      console.error('Health check error:', error)
      throw error
    }
  },

  // 获取合约列表
  getContracts: async (page = 1, limit = 10): Promise<any> => {
    try {
      const response = await api.get(`/v1/contracts/?page=${page}&limit=${limit}`)
      return response.data
    } catch (error) {
      console.error('Get contracts error:', error)
      throw error
    }
  },

  // 获取单个合约详情
  getContractById: async (id: string): Promise<any> => {
    try {
      const response = await api.get(`/v1/contracts/${id}`)
      return response.data
    } catch (error) {
      console.error('Get contract error:', error)
      throw error
    }
  },

  // 上传合约文件
  uploadContract: async (
    file: File, 
    title: string, 
    description: string, 
    onProgress?: (progress: number) => void
  ): Promise<any> => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', title)
      formData.append('description', description)

      const response = await api.post('/v1/contracts/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total && onProgress) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            onProgress(progress)
          }
        }
      })
      return response.data
    } catch (error) {
      console.error('Upload contract error:', error)
      throw error
    }
  },

  // 查询OCR处理状态
  getOcrStatus: async (contractId: string): Promise<any> => {
    try {
      const response = await api.get(`/v1/contracts/${contractId}/ocr-status`)
      return response.data
    } catch (error) {
      console.error('Get OCR status error:', error)
      throw error
    }
  },

  // 手动触发OCR处理
  processOcr: async (contractId: string): Promise<any> => {
    try {
      const response = await api.post(`/v1/contracts/${contractId}/process-ocr`)
      return response.data
    } catch (error) {
      console.error('Process OCR error:', error)
      throw error
    }
  },

  // 删除合约
  deleteContract: async (id: string): Promise<any> => {
    try {
      const response = await api.delete(`/v1/contracts/${id}`)
      return response.data
    } catch (error) {
      console.error('Delete contract error:', error)
      throw error
    }
  },

  // 获取合约HTML内容 - Alex Chen新增的接口
  getHtmlContent: async (contractId: string): Promise<any> => {
    try {
      const response = await api.get(`/v1/contracts/${contractId}/html-content`)
      return response.data
    } catch (error) {
      console.error('Get HTML content error:', error)
      throw error
    }
  },

  // 获取统计数据 (暂时使用模拟数据，等待后端实现)
  getStatistics: async (): Promise<ApiResponse<Statistics>> => {
    try {
      // 暂时返回模拟数据，后续可以对接真实的统计接口
      return {
        success: true,
        data: mockAPI.mockStatistics()
      }
    } catch (error) {
      console.error('Get statistics error:', error)
      throw error
    }
  }
}

// 模拟API响应（当后端API未实现时使用）
export const mockAPI = {
  // 模拟搜索响应
  mockSearch: (query: string): SearchResult => {
    return {
      documents: [
        {
          id: 'doc_001',
          title: '设备采购合同',
          content_summary: '关于办公设备采购的合同...',
          contract_info: {
            contract_type: '采购合同',
            amount: '50万元',
            parties: ['公司A', '供应商B'],
            sign_date: '2024-01-15'
          },
          similarity: 0.95,
          highlights: ['设备', '采购', '合同'],
          upload_date: '2024-01-16'
        },
        {
          id: 'doc_002',
          title: '软件开发协议',
          content_summary: '关于企业管理系统开发的协议...',
          contract_info: {
            contract_type: '服务合同',
            amount: '120万元',
            parties: ['公司A', '开发商C'],
            sign_date: '2023-11-20'
          },
          similarity: 0.82,
          highlights: ['软件', '开发', '协议'],
          upload_date: '2023-11-25'
        }
      ],
      total: 2,
      query: query,
      search_time: 0.35
    }
  },

  // 模拟统计数据
  mockStatistics: (): Statistics => {
    return {
      total_documents: 156,
      total_amount: '1,256万元',
      contract_types: {
        '采购合同': 45,
        '服务合同': 38,
        '劳务合同': 29,
        '租赁合同': 22,
        '其他合同': 22
      },
      monthly_uploads: [
        { month: '2023-07', count: 12 },
        { month: '2023-08', count: 15 },
        { month: '2023-09', count: 18 },
        { month: '2023-10', count: 22 },
        { month: '2023-11', count: 25 },
        { month: '2023-12', count: 30 }
      ],
      recent_activities: [
        {
          id: 'act_001',
          type: 'upload',
          description: '上传了"设备采购合同"',
          timestamp: '2024-01-16 14:30:25'
        },
        {
          id: 'act_002',
          type: 'search',
          description: '搜索了"软件开发"',
          timestamp: '2024-01-15 10:15:42'
        }
      ]
    }
  }
}

export default api