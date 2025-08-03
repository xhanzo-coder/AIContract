import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { Contract, SearchResult } from '../../types'
import { searchAPI } from '../../services/api'

interface SearchState {
  query: string
  results: Contract[]
  total: number
  loading: boolean
  error: string | null
  searchHistory: string[]
  sortOrder: 'asc' | 'desc'
  filters: {
    contract_type?: string
    date_range?: [string, string]
    amount_range?: [number, number]
  }
}

const initialState: SearchState = {
  query: '',
  results: [],
  total: 0,
  loading: false,
  error: null,
  searchHistory: [],
  sortOrder: 'desc',
  filters: {}
}

// 异步搜索操作
export const searchContracts = createAsyncThunk(
  'search/searchContracts',
  async (params: { query: string; limit?: number; filters?: any }) => {
    const response = await searchAPI.naturalSearch(params.query, params.limit, params.filters)
    return response.data
  }
)

export const keywordSearch = createAsyncThunk(
  'search/keywordSearch',
  async (params: { keyword: string; limit?: number }) => {
    const response = await searchAPI.keywordSearch(params.keyword, params.limit)
    return response.data
  }
)

const searchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {
    setQuery: (state, action: PayloadAction<string>) => {
      state.query = action.payload
    },
    clearResults: (state) => {
      state.results = []
      state.total = 0
      state.error = null
    },
    addToHistory: (state, action: PayloadAction<string>) => {
      const query = action.payload.trim()
      if (query && !state.searchHistory.includes(query)) {
        state.searchHistory.unshift(query)
        if (state.searchHistory.length > 10) {
          state.searchHistory = state.searchHistory.slice(0, 10)
        }
      }
    },
    setFilters: (state, action: PayloadAction<SearchState['filters']>) => {
      state.filters = action.payload
    },
    clearFilters: (state) => {
      state.filters = {}
    },
    setSortOrder: (state, action: PayloadAction<'asc' | 'desc'>) => {
      state.sortOrder = action.payload
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(searchContracts.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(searchContracts.fulfilled, (state, action: PayloadAction<SearchResult>) => {
        state.loading = false
        state.results = action.payload.documents
        state.total = action.payload.total
        state.error = null
      })
      .addCase(searchContracts.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || '搜索失败'
      })
      .addCase(keywordSearch.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(keywordSearch.fulfilled, (state, action: PayloadAction<SearchResult>) => {
        state.loading = false
        state.results = action.payload.documents
        state.total = action.payload.total
        state.error = null
      })
      .addCase(keywordSearch.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || '搜索失败'
      })
  }
})

export const { setQuery, clearResults, addToHistory, setFilters, clearFilters, setSortOrder } = searchSlice.actions
export default searchSlice.reducer