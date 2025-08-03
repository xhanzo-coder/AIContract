import { configureStore } from '@reduxjs/toolkit'
import contractReducer from './slices/contractSlice'
import searchReducer from './slices/searchSlice'
import uiReducer from './slices/uiSlice'

export const store = configureStore({
  reducer: {
    contract: contractReducer,
    search: searchReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch