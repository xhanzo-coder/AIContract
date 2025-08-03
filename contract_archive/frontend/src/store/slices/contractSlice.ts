import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { Contract, Statistics } from '../../types'
import { contractAPI } from '../../services/api'

interface ContractState {
  contracts: Contract[]
  currentContract: Contract | null
  statistics: Statistics | null
  loading: boolean
  error: string | null
  uploadProgress: number
}

const initialState: ContractState = {
  contracts: [],
  currentContract: null,
  statistics: null,
  loading: false,
  error: null,
  uploadProgress: 0
}

// 异步操作
export const fetchContracts = createAsyncThunk(
  'contract/fetchContracts',
  async (params?: { page?: number; limit?: number }) => {
    const response = await contractAPI.getContracts(params?.page, params?.limit)
    return response.data
  }
)

export const fetchContractById = createAsyncThunk(
  'contract/fetchContractById',
  async (id: string) => {
    const response = await contractAPI.getContractById(id)
    return response.data
  }
)

export const uploadContract = createAsyncThunk(
  'contract/uploadContract',
  async (formData: FormData, { dispatch }) => {
    const response = await contractAPI.uploadContract(formData, (progress) => {
      dispatch(setUploadProgress(progress))
    })
    return response.data
  }
)

export const deleteContract = createAsyncThunk(
  'contract/deleteContract',
  async (id: string) => {
    await contractAPI.deleteContract(id)
    return id
  }
)

export const fetchStatistics = createAsyncThunk(
  'contract/fetchStatistics',
  async () => {
    const response = await contractAPI.getStatistics()
    return response.data
  }
)

const contractSlice = createSlice({
  name: 'contract',
  initialState,
  reducers: {
    setCurrentContract: (state, action: PayloadAction<Contract | null>) => {
      state.currentContract = action.payload
    },
    clearError: (state) => {
      state.error = null
    },
    setUploadProgress: (state, action: PayloadAction<number>) => {
      state.uploadProgress = action.payload
    },
    resetUploadProgress: (state) => {
      state.uploadProgress = 0
    }
  },
  extraReducers: (builder) => {
    builder
      // 获取合约列表
      .addCase(fetchContracts.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchContracts.fulfilled, (state, action) => {
        state.loading = false
        state.contracts = action.payload.contracts || action.payload
        state.error = null
      })
      .addCase(fetchContracts.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || '获取合约列表失败'
      })
      // 获取单个合约
      .addCase(fetchContractById.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchContractById.fulfilled, (state, action) => {
        state.loading = false
        state.currentContract = action.payload
        state.error = null
      })
      .addCase(fetchContractById.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || '获取合约详情失败'
      })
      // 上传合约
      .addCase(uploadContract.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(uploadContract.fulfilled, (state, action) => {
        state.loading = false
        state.error = null
        state.uploadProgress = 0
        // 可以在这里添加新上传的合约到列表
      })
      .addCase(uploadContract.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || '上传合约失败'
        state.uploadProgress = 0
      })
      // 删除合约
      .addCase(deleteContract.fulfilled, (state, action) => {
        state.contracts = state.contracts.filter(contract => contract.id !== action.payload)
      })
      // 获取统计数据
      .addCase(fetchStatistics.fulfilled, (state, action) => {
        state.statistics = action.payload
      })
  }
})

export const { setCurrentContract, clearError, setUploadProgress, resetUploadProgress } = contractSlice.actions
export default contractSlice.reducer