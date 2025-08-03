# 合约档案智能检索系统 - 前端技术实现指南

## 🚀 项目概述

本文档为前端工程师提供详细的技术实现指导，包括项目搭建、API集成、组件开发等具体实现细节。

---

## 🛠️ 技术栈选择

### 推荐方案A: React生态
```json
{
  "framework": "React 18.2+",
  "ui_library": "Ant Design 5.x",
  "state_management": "Redux Toolkit",
  "routing": "React Router 6.x",
  "http_client": "Axios",
  "charts": "ECharts for React",
  "build_tool": "Vite",
  "styling": "Styled Components + CSS Modules",
  "testing": "Jest + React Testing Library"
}
```

### 推荐方案B: Vue生态
```json
{
  "framework": "Vue 3.3+",
  "ui_library": "Element Plus",
  "state_management": "Pinia",
  "routing": "Vue Router 4.x",
  "http_client": "Axios",
  "charts": "Vue ECharts",
  "build_tool": "Vite",
  "styling": "SCSS + CSS Modules",
  "testing": "Vitest + Vue Test Utils"
}
```

---

## 📁 项目结构

```
contract-archive-frontend/
├── public/
│   ├── index.html
│   ├── favicon.ico
│   └── manifest.json
├── src/
│   ├── api/                    # API接口层
│   │   ├── index.js
│   │   ├── auth.js
│   │   ├── documents.js
│   │   ├── search.js
│   │   └── analytics.js
│   ├── components/             # 组件库
│   │   ├── common/            # 通用组件
│   │   │   ├── Button/
│   │   │   ├── Input/
│   │   │   ├── Modal/
│   │   │   └── Loading/
│   │   ├── layout/            # 布局组件
│   │   │   ├── Header/
│   │   │   ├── Sidebar/
│   │   │   └── Footer/
│   │   ├── business/          # 业务组件
│   │   │   ├── DocumentCard/
│   │   │   ├── SearchBox/
│   │   │   ├── UploadArea/
│   │   │   └── ChartWidget/
│   │   └── index.js
│   ├── pages/                 # 页面组件
│   │   ├── Login/
│   │   ├── Dashboard/
│   │   ├── Upload/
│   │   ├── Search/
│   │   ├── Analytics/
│   │   └── Settings/
│   ├── hooks/                 # 自定义Hooks
│   │   ├── useAuth.js
│   │   ├── useApi.js
│   │   └── useDebounce.js
│   ├── store/                 # 状态管理
│   │   ├── index.js
│   │   ├── authSlice.js
│   │   ├── documentsSlice.js
│   │   └── searchSlice.js
│   ├── utils/                 # 工具函数
│   │   ├── request.js
│   │   ├── constants.js
│   │   ├── helpers.js
│   │   └── validators.js
│   ├── styles/                # 样式文件
│   │   ├── globals.css
│   │   ├── variables.css
│   │   └── components.css
│   ├── assets/                # 静态资源
│   │   ├── images/
│   │   ├── icons/
│   │   └── fonts/
│   ├── App.jsx
│   ├── main.jsx
│   └── router.jsx
├── package.json
├── vite.config.js
├── .env.development
├── .env.production
└── README.md
```

---

## 🔌 API集成指南

### 1. API基础配置

```javascript
// src/utils/request.js
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const request = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器
request.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      // 处理认证失败
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default request;
```

### 2. API接口定义

```javascript
// src/api/documents.js
import request from '../utils/request';

export const documentsAPI = {
  // 上传文档
  uploadDocument: (formData) => {
    return request.post('/api/v1/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // 获取文档列表
  getDocuments: (params) => {
    return request.get('/api/v1/documents', { params });
  },

  // 获取文档详情
  getDocumentById: (id) => {
    return request.get(`/api/v1/documents/${id}`);
  },

  // 删除文档
  deleteDocument: (id) => {
    return request.delete(`/api/v1/documents/${id}`);
  },

  // 更新文档信息
  updateDocument: (id, data) => {
    return request.put(`/api/v1/documents/${id}`, data);
  },
};

// src/api/search.js
export const searchAPI = {
  // 智能搜索
  intelligentSearch: (query, filters = {}) => {
    return request.post('/api/v1/search/intelligent', {
      query,
      filters,
    });
  },

  // 关键词搜索
  keywordSearch: (keywords, filters = {}) => {
    return request.post('/api/v1/search/keyword', {
      keywords,
      filters,
    });
  },

  // 向量搜索
  vectorSearch: (query, filters = {}) => {
    return request.post('/api/v1/search/vector', {
      query,
      filters,
    });
  },

  // 获取搜索建议
  getSearchSuggestions: (query) => {
    return request.get('/api/v1/search/suggestions', {
      params: { q: query },
    });
  },
};

// src/api/analytics.js
export const analyticsAPI = {
  // 获取仪表板数据
  getDashboardStats: () => {
    return request.get('/api/v1/analytics/dashboard');
  },

  // 获取文档统计
  getDocumentStats: (timeRange) => {
    return request.get('/api/v1/analytics/documents', {
      params: { time_range: timeRange },
    });
  },

  // 获取搜索统计
  getSearchStats: (timeRange) => {
    return request.get('/api/v1/analytics/search', {
      params: { time_range: timeRange },
    });
  },
};
```

---

## 🎯 核心组件实现

### 1. 文档上传组件

```jsx
// src/components/business/UploadArea/index.jsx
import React, { useState, useCallback } from 'react';
import { Upload, message, Progress, Form, Input, Select } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { documentsAPI } from '../../../api/documents';

const { Dragger } = Upload;
const { Option } = Select;

const UploadArea = ({ onUploadSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [form] = Form.useForm();

  const handleUpload = useCallback(async (file, formData) => {
    setUploading(true);
    setUploadProgress(0);

    try {
      const uploadData = new FormData();
      uploadData.append('file', file);
      uploadData.append('contract_type', formData.contract_type);
      uploadData.append('tags', formData.tags);
      uploadData.append('amount', formData.amount);

      const response = await documentsAPI.uploadDocument(uploadData);
      
      message.success('文档上传成功！');
      form.resetFields();
      onUploadSuccess?.(response);
    } catch (error) {
      message.error('上传失败：' + error.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [form, onUploadSuccess]);

  const uploadProps = {
    name: 'file',
    multiple: false,
    accept: '.pdf,.doc,.docx,.txt,.jpg,.png,.jpeg',
    beforeUpload: (file) => {
      const isValidType = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'image/jpeg',
        'image/png',
      ].includes(file.type);

      if (!isValidType) {
        message.error('只支持 PDF、DOC、DOCX、TXT、JPG、PNG 格式的文件！');
        return false;
      }

      const isLt50M = file.size / 1024 / 1024 < 50;
      if (!isLt50M) {
        message.error('文件大小不能超过 50MB！');
        return false;
      }

      return false; // 阻止自动上传
    },
    onDrop: (e) => {
      console.log('Dropped files', e.dataTransfer.files);
    },
  };

  const onFinish = (values) => {
    const fileList = form.getFieldValue('file');
    if (!fileList || fileList.length === 0) {
      message.error('请选择要上传的文件！');
      return;
    }

    handleUpload(fileList[0].originFileObj, values);
  };

  return (
    <div className="upload-area">
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item
          name="file"
          label="选择文件"
          rules={[{ required: true, message: '请选择要上传的文件！' }]}
        >
          <Dragger {...uploadProps} disabled={uploading}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
            <p className="ant-upload-hint">
              支持 PDF、DOC、DOCX、TXT、JPG、PNG 格式，文件大小不超过 50MB
            </p>
          </Dragger>
        </Form.Item>

        <Form.Item
          name="contract_type"
          label="合约类型"
          rules={[{ required: true, message: '请选择合约类型！' }]}
        >
          <Select placeholder="请选择合约类型">
            <Option value="purchase">采购合同</Option>
            <Option value="sales">销售合同</Option>
            <Option value="service">服务合同</Option>
            <Option value="lease">租赁合同</Option>
            <Option value="labor">劳务合同</Option>
            <Option value="other">其他</Option>
          </Select>
        </Form.Item>

        <Form.Item name="tags" label="标签">
          <Input placeholder="请输入标签，多个标签用逗号分隔" />
        </Form.Item>

        <Form.Item name="amount" label="合约金额（万元）">
          <Input type="number" placeholder="请输入合约金额" />
        </Form.Item>

        {uploading && (
          <Progress
            percent={uploadProgress}
            status="active"
            strokeColor={{
              from: '#108ee9',
              to: '#87d068',
            }}
          />
        )}

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={uploading}
            size="large"
            block
          >
            {uploading ? '上传中...' : '开始上传'}
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default UploadArea;
```

### 2. 智能搜索组件

```jsx
// src/components/business/SearchBox/index.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Input, AutoComplete, Button, Space, Tag } from 'antd';
import { SearchOutlined, FilterOutlined } from '@ant-design/icons';
import { searchAPI } from '../../../api/search';
import { useDebounce } from '../../../hooks/useDebounce';

const SearchBox = ({ onSearch, onFilterToggle }) => {
  const [searchValue, setSearchValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);

  const debouncedSearchValue = useDebounce(searchValue, 300);

  // 获取搜索建议
  useEffect(() => {
    if (debouncedSearchValue && debouncedSearchValue.length > 2) {
      fetchSuggestions(debouncedSearchValue);
    } else {
      setSuggestions([]);
    }
  }, [debouncedSearchValue]);

  const fetchSuggestions = useCallback(async (query) => {
    try {
      const response = await searchAPI.getSearchSuggestions(query);
      setSuggestions(response.suggestions || []);
    } catch (error) {
      console.error('获取搜索建议失败:', error);
    }
  }, []);

  const handleSearch = useCallback((value) => {
    if (!value.trim()) return;

    // 保存到最近搜索
    const newRecentSearches = [
      value,
      ...recentSearches.filter(item => item !== value)
    ].slice(0, 5);
    setRecentSearches(newRecentSearches);
    localStorage.setItem('recentSearches', JSON.stringify(newRecentSearches));

    onSearch?.(value);
  }, [recentSearches, onSearch]);

  const handleSelect = (value) => {
    setSearchValue(value);
    handleSearch(value);
  };

  const options = [
    ...suggestions.map(item => ({
      value: item,
      label: (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{item}</span>
          <Tag color="blue">建议</Tag>
        </div>
      ),
    })),
    ...recentSearches.map(item => ({
      value: item,
      label: (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{item}</span>
          <Tag color="orange">最近</Tag>
        </div>
      ),
    })),
  ];

  return (
    <div className="search-box">
      <Space.Compact style={{ width: '100%' }}>
        <AutoComplete
          style={{ flex: 1 }}
          value={searchValue}
          options={options}
          onSelect={handleSelect}
          onChange={setSearchValue}
          onSearch={setSearchValue}
          placeholder="输入关键词或描述您要查找的合约..."
        >
          <Input
            size="large"
            prefix={<SearchOutlined />}
            onPressEnter={() => handleSearch(searchValue)}
          />
        </AutoComplete>
        <Button
          size="large"
          type="primary"
          onClick={() => handleSearch(searchValue)}
          loading={loading}
        >
          搜索
        </Button>
        <Button
          size="large"
          icon={<FilterOutlined />}
          onClick={onFilterToggle}
        >
          筛选
        </Button>
      </Space.Compact>
    </div>
  );
};

export default SearchBox;
```

### 3. 数据图表组件

```jsx
// src/components/business/ChartWidget/index.jsx
import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

const ChartWidget = ({ 
  type = 'bar', 
  data = [], 
  title = '', 
  height = 300,
  options = {} 
}) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // 初始化图表
    chartInstance.current = echarts.init(chartRef.current);

    // 配置图表选项
    const defaultOptions = {
      title: {
        text: title,
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 'normal',
        },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderColor: '#ccc',
        borderWidth: 1,
        textStyle: {
          color: '#333',
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      ...getChartConfig(type, data),
      ...options,
    };

    chartInstance.current.setOption(defaultOptions);

    // 响应式处理
    const handleResize = () => {
      chartInstance.current?.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
    };
  }, [type, data, title, options]);

  const getChartConfig = (chartType, chartData) => {
    switch (chartType) {
      case 'bar':
        return {
          xAxis: {
            type: 'category',
            data: chartData.map(item => item.name),
          },
          yAxis: {
            type: 'value',
          },
          series: [{
            data: chartData.map(item => item.value),
            type: 'bar',
            itemStyle: {
              color: '#1890ff',
            },
          }],
        };

      case 'line':
        return {
          xAxis: {
            type: 'category',
            data: chartData.map(item => item.name),
          },
          yAxis: {
            type: 'value',
          },
          series: [{
            data: chartData.map(item => item.value),
            type: 'line',
            smooth: true,
            itemStyle: {
              color: '#1890ff',
            },
          }],
        };

      case 'pie':
        return {
          series: [{
            type: 'pie',
            radius: '50%',
            data: chartData,
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: 'rgba(0, 0, 0, 0.5)',
              },
            },
          }],
        };

      default:
        return {};
    }
  };

  return (
    <div
      ref={chartRef}
      style={{ width: '100%', height: `${height}px` }}
    />
  );
};

export default ChartWidget;
```

---

## 🔄 状态管理

### Redux Toolkit 实现

```javascript
// src/store/index.js
import { configureStore } from '@reduxjs/toolkit';
import authSlice from './authSlice';
import documentsSlice from './documentsSlice';
import searchSlice from './searchSlice';

export const store = configureStore({
  reducer: {
    auth: authSlice,
    documents: documentsSlice,
    search: searchSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// src/store/documentsSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { documentsAPI } from '../api/documents';

// 异步操作
export const fetchDocuments = createAsyncThunk(
  'documents/fetchDocuments',
  async (params, { rejectWithValue }) => {
    try {
      const response = await documentsAPI.getDocuments(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const uploadDocument = createAsyncThunk(
  'documents/uploadDocument',
  async (formData, { rejectWithValue }) => {
    try {
      const response = await documentsAPI.uploadDocument(formData);
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const documentsSlice = createSlice({
  name: 'documents',
  initialState: {
    list: [],
    total: 0,
    loading: false,
    error: null,
    uploadProgress: 0,
  },
  reducers: {
    setUploadProgress: (state, action) => {
      state.uploadProgress = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDocuments.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDocuments.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.documents;
        state.total = action.payload.total;
      })
      .addCase(fetchDocuments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(uploadDocument.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(uploadDocument.fulfilled, (state, action) => {
        state.loading = false;
        state.list.unshift(action.payload);
        state.total += 1;
      })
      .addCase(uploadDocument.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { setUploadProgress, clearError } = documentsSlice.actions;
export default documentsSlice.reducer;
```

---

## 🎨 样式管理

### CSS变量定义

```css
/* src/styles/variables.css */
:root {
  /* 色彩系统 */
  --primary-color: #1890ff;
  --primary-light: #40a9ff;
  --primary-dark: #096dd9;
  
  --success-color: #52c41a;
  --warning-color: #faad14;
  --error-color: #ff4d4f;
  --info-color: #1890ff;
  
  --text-primary: #262626;
  --text-secondary: #595959;
  --text-disabled: #bfbfbf;
  
  --border-color: #d9d9d9;
  --background-color: #fafafa;
  --card-background: #ffffff;
  
  /* 字体系统 */
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-size-xs: 12px;
  --font-size-sm: 14px;
  --font-size-base: 16px;
  --font-size-lg: 18px;
  --font-size-xl: 20px;
  --font-size-xxl: 24px;
  
  /* 间距系统 */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-base: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-xxl: 48px;
  
  /* 圆角和阴影 */
  --border-radius-sm: 4px;
  --border-radius-base: 6px;
  --border-radius-lg: 8px;
  
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.03);
  --shadow-base: 0 1px 8px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 4px 12px rgba(0, 0, 0, 0.15);
}
```

### 组件样式示例

```scss
// src/components/business/SearchBox/index.module.scss
.searchBox {
  .searchInput {
    .ant-input {
      border-radius: var(--border-radius-lg);
      border: 2px solid var(--border-color);
      transition: all 0.3s ease;
      
      &:focus {
        border-color: var(--primary-color);
        box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
      }
    }
  }
  
  .searchButton {
    border-radius: var(--border-radius-lg);
    height: 48px;
    padding: 0 var(--spacing-lg);
    font-weight: 500;
    
    &:hover {
      transform: translateY(-1px);
      box-shadow: var(--shadow-lg);
    }
  }
  
  .suggestions {
    .suggestionItem {
      padding: var(--spacing-sm) var(--spacing-base);
      border-bottom: 1px solid var(--border-color);
      cursor: pointer;
      
      &:hover {
        background-color: var(--background-color);
      }
      
      .suggestionText {
        color: var(--text-primary);
        font-size: var(--font-size-base);
      }
      
      .suggestionTag {
        margin-left: auto;
      }
    }
  }
}
```

---

## 🔧 自定义Hooks

```javascript
// src/hooks/useApi.js
import { useState, useEffect, useCallback } from 'react';

export const useApi = (apiFunction, dependencies = []) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async (...args) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiFunction(...args);
      setData(result);
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, dependencies);

  return { data, loading, error, execute };
};

// src/hooks/useDebounce.js
import { useState, useEffect } from 'react';

export const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// src/hooks/useAuth.js
import { useSelector, useDispatch } from 'react-redux';
import { useCallback } from 'react';
import { login, logout, refreshToken } from '../store/authSlice';

export const useAuth = () => {
  const dispatch = useDispatch();
  const { user, token, isAuthenticated, loading } = useSelector(state => state.auth);

  const handleLogin = useCallback(async (credentials) => {
    return dispatch(login(credentials)).unwrap();
  }, [dispatch]);

  const handleLogout = useCallback(() => {
    dispatch(logout());
  }, [dispatch]);

  const handleRefreshToken = useCallback(async () => {
    return dispatch(refreshToken()).unwrap();
  }, [dispatch]);

  return {
    user,
    token,
    isAuthenticated,
    loading,
    login: handleLogin,
    logout: handleLogout,
    refreshToken: handleRefreshToken,
  };
};
```

---

## 🚀 部署配置

### Vite配置

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@pages': resolve(__dirname, 'src/pages'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@api': resolve(__dirname, 'src/api'),
      '@assets': resolve(__dirname, 'src/assets'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          antd: ['antd'],
          charts: ['echarts'],
        },
      },
    },
  },
});
```

### 环境变量配置

```bash
# .env.development
VITE_API_BASE_URL=http://localhost:8000
VITE_APP_TITLE=合约档案智能检索系统
VITE_UPLOAD_MAX_SIZE=52428800
VITE_ENABLE_MOCK=false

# .env.production
VITE_API_BASE_URL=https://api.contract-archive.com
VITE_APP_TITLE=合约档案智能检索系统
VITE_UPLOAD_MAX_SIZE=52428800
VITE_ENABLE_MOCK=false
```

---

## 📋 开发规范

### 代码规范

1. **组件命名**: 使用PascalCase
2. **文件命名**: 组件文件夹使用PascalCase，其他文件使用camelCase
3. **变量命名**: 使用camelCase
4. **常量命名**: 使用UPPER_SNAKE_CASE
5. **CSS类名**: 使用kebab-case或BEM规范

### Git提交规范

```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
test: 测试相关
chore: 构建工具或辅助工具的变动
```

### 性能优化建议

1. **代码分割**: 使用React.lazy()和Suspense
2. **组件优化**: 使用React.memo()和useMemo()
3. **图片优化**: 使用WebP格式，实现懒加载
4. **打包优化**: 配置合理的chunk分割
5. **缓存策略**: 合理使用浏览器缓存

---

## 🧪 测试指南

### 单元测试示例

```javascript
// src/components/business/SearchBox/__tests__/index.test.jsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { store } from '../../../store';
import SearchBox from '../index';

const renderWithProvider = (component) => {
  return render(
    <Provider store={store}>
      {component}
    </Provider>
  );
};

describe('SearchBox', () => {
  test('renders search input', () => {
    renderWithProvider(<SearchBox />);
    const searchInput = screen.getByPlaceholderText(/输入关键词/i);
    expect(searchInput).toBeInTheDocument();
  });

  test('calls onSearch when search button is clicked', async () => {
    const mockOnSearch = jest.fn();
    renderWithProvider(<SearchBox onSearch={mockOnSearch} />);
    
    const searchInput = screen.getByPlaceholderText(/输入关键词/i);
    const searchButton = screen.getByText('搜索');
    
    fireEvent.change(searchInput, { target: { value: '测试搜索' } });
    fireEvent.click(searchButton);
    
    await waitFor(() => {
      expect(mockOnSearch).toHaveBeenCalledWith('测试搜索');
    });
  });
});
```

---

## 📞 技术支持

**后端开发**: Alex Chen  
**API文档**: http://localhost:8000/docs  
**项目仓库**: 待定  
**技术文档**: `e:\AICode\Trae_Test\Report\Alex_Chen_Backend_Reports\`

---

*本文档将随着项目进展持续更新，请前端工程师及时关注最新版本。如有技术问题，请及时沟通。*