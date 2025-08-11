import React, { useState, useEffect } from 'react'
import { 
  Input, 
  Button, 
  Card, 
  List, 
  Tag, 
  Space, 
  Tabs, 
  Divider, 
  Typography, 
  Empty, 
  Spin, 
  Drawer,
  Form,
  Select,
  DatePicker,
  Radio,
  Tooltip,
  Badge,
  message,
  Pagination,
  Modal,
  Progress
} from 'antd'
import { useSelector, useDispatch } from 'react-redux'
import {
  SearchOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  FilterOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
  DownloadOutlined,
  EyeOutlined,
  HighlightOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  CloseOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'
import styled from 'styled-components'
import { RootState } from '../../store'
import { 
  searchContracts, 
  keywordSearch,
  setQuery,
  clearResults,
  setFilters,
  setSortOrder
} from '../../store/slices/searchSlice'
import { contractAPI } from '../../services/api'
import { Contract } from '../../types'
import dayjs from 'dayjs'

const { Title, Paragraph, Text } = Typography
const { RangePicker } = DatePicker

const Search: React.FC = () => {
  const dispatch = useDispatch()
  const { 
    query, 
    results, 
    loading, 
    error, 
    searchHistory,
    filters,
    sortOrder
  } = useSelector((state: RootState) => state.search)
  

  const [filterDrawerVisible, setFilterDrawerVisible] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<any>(null)

  const [allContracts, setAllContracts] = useState<Contract[]>([])
  const [contractsLoading, setContractsLoading] = useState(false)
  const [displayContracts, setDisplayContracts] = useState<Contract[]>([])

  // 切片相关状态
  const [contractChunkStatus, setContractChunkStatus] = useState<{[key: string]: any}>({})
  const [previewMode, setPreviewMode] = useState<'document' | 'chunks'>('document')
  const [chunkData, setChunkData] = useState<any>(null)
  const [chunkLoading, setChunkLoading] = useState(false)
  const [chunkPage, setChunkPage] = useState(1)
  const [chunkTotal, setChunkTotal] = useState(0)

  // 获取所有合同
  const fetchAllContracts = async () => {
    try {
      setContractsLoading(true)
      const response = await contractAPI.getContracts()
      console.log('获取合同列表响应:', response)
      
      // 根据后端API响应结构处理数据
      const contracts = Array.isArray(response) ? response : 
                      (response.data && response.data.contracts && Array.isArray(response.data.contracts)) ? response.data.contracts :
                      (response.data && Array.isArray(response.data)) ? response.data :
                      (response.contracts && Array.isArray(response.contracts)) ? response.contracts : []
      
      // 为每个合同获取自动化处理状态
      const contractsWithStatus = await Promise.all(
        contracts.map(async (contract: any) => {
          try {
            const statusResponse = await contractAPI.getAutomatedProcessingStatus(contract.id.toString())
            console.log(`合同 ${contract.id} 状态响应:`, statusResponse)
            console.log(`processing_steps:`, statusResponse.data?.processing_steps)
            return {
              ...contract,
              processing_steps: statusResponse.data?.processing_steps || null
            }
          } catch (error) {
            console.error(`获取合同${contract.id}状态失败:`, error)
            return contract
          }
        })
      )
      
      setAllContracts(contractsWithStatus)
      setDisplayContracts(contractsWithStatus)
      
      // 批量获取合同的切片状态
      await fetchContractsChunkStatus(contractsWithStatus)
    } catch (error) {
      console.error('获取合同列表失败:', error)
      message.error('获取合同列表失败')
    } finally {
      setContractsLoading(false)
    }
  }

  // 批量获取合同切片状态
  const fetchContractsChunkStatus = async (contracts: Contract[]) => {
    console.log('开始获取合同切片状态，合同数量:', contracts.length)
    const statusMap: {[key: string]: any} = {}
    
    // 并发获取所有合同的切片状态
    const statusPromises = contracts.map(async (contract) => {
      try {
        console.log(`正在获取合同 ${contract.id} 的切片状态`)
        const response = await contractAPI.getContentStatus(contract.id.toString())
        console.log(`合同 ${contract.id} 切片状态响应:`, response)
        if (response.success) {
          statusMap[contract.id] = response.data
          console.log(`合同 ${contract.id} 切片状态:`, response.data)
        }
      } catch (error) {
        console.log(`获取合同 ${contract.id} 切片状态失败:`, error)
        statusMap[contract.id] = { status: 'not_processed', chunk_count: 0 }
      }
    })
    
    await Promise.all(statusPromises)
    console.log('所有合同切片状态获取完成:', statusMap)
    setContractChunkStatus(statusMap)
  }

  // 处理合同内容分块
  const handleProcessContent = async (contractId: string) => {
    try {
      message.loading('正在处理合同内容...', 0)
      
      // 立即更新本地状态为处理中
      const updateContractState = (contracts: Contract[]) => 
        contracts.map(contract => 
          contract.id.toString() === contractId 
            ? {
                ...contract,
                processing_steps: {
                  ...contract.processing_steps,
                  content_chunking: {
                    ...contract.processing_steps?.content_chunking,
                    status: 'processing',
                    completed: false
                  }
                }
              }
            : contract
        )
      
      setAllContracts(updateContractState)
      setDisplayContracts(updateContractState)
      
      const response = await contractAPI.processContent(contractId)
      message.destroy()
      
      if (response.success) {
        message.success('合同内容处理成功')
        // 3秒后刷新状态
        setTimeout(() => fetchAllContracts(), 3000)
        // 重新获取该合同的切片状态
        const statusResponse = await contractAPI.getContentStatus(contractId)
        if (statusResponse.success) {
          setContractChunkStatus(prev => ({
            ...prev,
            [contractId]: statusResponse.data
          }))
        }
      } else {
        message.error(response.message || '处理失败')
        // 恢复原状态
        fetchAllContracts()
      }
    } catch (error) {
      message.destroy()
      console.error('处理合同内容失败:', error)
      message.error('处理合同内容失败')
      // 恢复原状态
      fetchAllContracts()
    }
  }

  // 重新识别OCR
  const handleReprocessOCR = async (contractId: string) => {
    try {
      message.loading('正在重新识别...', 0)
      
      // 立即更新本地状态为处理中
      setAllContracts(prev => prev.map(contract => 
        contract.id.toString() === contractId 
          ? {
              ...contract,
              processing_steps: {
                ...contract.processing_steps,
                ocr_recognition: {
                  ...contract.processing_steps?.ocr_recognition,
                  status: 'processing',
                  completed: false
                }
              }
            }
          : contract
      ))
      setDisplayContracts(prev => prev.map(contract => 
        contract.id.toString() === contractId 
          ? {
              ...contract,
              processing_steps: {
                ...contract.processing_steps,
                ocr_recognition: {
                  ...contract.processing_steps?.ocr_recognition,
                  status: 'processing',
                  completed: false
                }
              }
            }
          : contract
      ))
      
      const response = await fetch(`/api/v1/contracts/${contractId}/process-ocr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      message.destroy()
      
      if (response.ok) {
        message.success('重新识别任务已启动')
        // 3秒后刷新状态
        setTimeout(() => fetchAllContracts(), 3000)
      } else {
        const errorData = await response.json()
        message.error(errorData.message || '重新识别失败')
        // 恢复原状态
        fetchAllContracts()
      }
    } catch (error) {
      message.destroy()
      console.error('重新识别失败:', error)
      message.error('重新识别失败')
      // 恢复原状态
      fetchAllContracts()
    }
  }

  // 重新切片
  const handleReprocessChunks = async (contractId: string) => {
    try {
      message.loading('正在重新切片...', 0)
      
      // 立即更新本地状态为处理中
      const updateContractState = (contracts: Contract[]) => 
        contracts.map(contract => 
          contract.id.toString() === contractId 
            ? {
                ...contract,
                processing_steps: {
                  ...contract.processing_steps,
                  content_chunking: {
                    ...contract.processing_steps?.content_chunking,
                    status: 'processing',
                    completed: false
                  }
                }
              }
            : contract
        )
      
      setAllContracts(updateContractState)
      setDisplayContracts(updateContractState)
      
      const response = await fetch(`/api/v1/contracts/${contractId}/content/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      message.destroy()
      
      if (response.ok) {
        message.success('重新切片任务已启动')
        // 3秒后刷新状态
        setTimeout(() => fetchAllContracts(), 3000)
      } else {
        const errorData = await response.json()
        message.error(errorData.message || '重新切片失败')
        // 恢复原状态
        fetchAllContracts()
      }
    } catch (error) {
      message.destroy()
      console.error('重新切片失败:', error)
      message.error('重新切片失败')
      // 恢复原状态
      fetchAllContracts()
    }
  }

  // 同步到Elasticsearch
  const handleSyncToElasticsearch = async (contractId: string) => {
    try {
      message.loading('正在同步到Elasticsearch...', 0)
      
      // 立即更新本地状态为处理中
      const updateContractState = (contracts: Contract[]) => 
        contracts.map(contract => 
          contract.id.toString() === contractId 
            ? {
                ...contract,
                processing_steps: {
                  ...contract.processing_steps,
                  elasticsearch_sync: {
                    ...contract.processing_steps?.elasticsearch_sync,
                    status: 'processing',
                    completed: false
                  }
                },
                elasticsearch_sync_status: 'processing'
              }
            : contract
        )
      
      setAllContracts(updateContractState)
      setDisplayContracts(updateContractState)
      
      const response = await fetch(`/api/v1/contracts/${contractId}/elasticsearch/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      message.destroy()
      
      if (response.ok) {
        message.success('同步任务已启动')
        // 3秒后刷新状态
        setTimeout(() => fetchAllContracts(), 3000)
      } else {
        const errorData = await response.json()
        message.error(errorData.message || '同步失败')
        // 恢复原状态
        fetchAllContracts()
      }
    } catch (error) {
      message.destroy()
      console.error('同步失败:', error)
      message.error('同步失败')
      // 恢复原状态
      fetchAllContracts()
    }
  }

  // 获取合同切片数据
  const fetchChunkData = async (contractId: string, page = 1) => {
    try {
      setChunkLoading(true)
      const response = await contractAPI.getContractChunks(contractId, page, 10)
      
      if (response.success) {
        setChunkData(response.data)
        setChunkTotal(response.data.total || 0)
        setChunkPage(page)
      } else {
        message.error('获取切片数据失败')
      }
    } catch (error) {
      console.error('获取切片数据失败:', error)
      message.error('获取切片数据失败')
    } finally {
      setChunkLoading(false)
    }
  }

  // 切换预览模式
  const handlePreviewModeChange = async (mode: 'document' | 'chunks') => {
    setPreviewMode(mode)
    
    if (mode === 'chunks' && selectedDocument) {
      await fetchChunkData(selectedDocument.id.toString())
    }
  }

  // 删除合同
  const handleDeleteContract = (contract: Contract) => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>您确定要删除合同 <strong>{contract.file_name || contract.title || '未知文件'}</strong> 吗？</p>
          <p style={{ color: '#ff4d4f', fontSize: '14px' }}>此操作不可撤销，删除后将无法恢复。</p>
        </div>
      ),
      okText: '确定删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await contractAPI.deleteContract(contract.id.toString())
          message.success('合同删除成功')
          // 从列表中移除已删除的合同
          const updatedContracts = allContracts.filter(c => c.id !== contract.id)
          setAllContracts(updatedContracts)
          setDisplayContracts(updatedContracts)
          // 如果当前预览的是被删除的合同，关闭预览
          if (selectedDocument && selectedDocument.id === contract.id) {
            setSelectedDocument(null)
          }
        } catch (error) {
          console.error('删除合同失败:', error)
          message.error('删除合同失败，请重试')
        }
      }
    })
  }

  // 组件加载时获取所有合同
  useEffect(() => {
    fetchAllContracts()
  }, [])

  // 定时监控处理状态更新
  useEffect(() => {
    const interval = setInterval(() => {
      // 检查是否有正在处理的合同
      const hasProcessingContracts = allContracts.some(contract => {
        const steps = contract.processing_steps
        if (!steps) return false
        
        return (
          steps.ocr_recognition?.status === 'processing' ||
          steps.content_chunking?.status === 'processing' ||
          steps.elasticsearch_sync?.status === 'processing'
        )
      })
      
      // 如果有正在处理的合同，刷新状态
      if (hasProcessingContracts) {
        console.log('检测到正在处理的合同，刷新状态...')
        fetchAllContracts()
      }
    }, 3000) // 每3秒检查一次
    
    return () => clearInterval(interval)
  }, [allContracts])
  


  const handleFilterSubmit = (values: any) => {
    setFilterDrawerVisible(false)
    
    const newFilters = { ...values }
    if (values.uploadDateRange && values.uploadDateRange.length === 2) {
      newFilters.uploadDateStart = values.uploadDateRange[0].format('YYYY-MM-DD')
      newFilters.uploadDateEnd = values.uploadDateRange[1].format('YYYY-MM-DD')
      delete newFilters.uploadDateRange
    }
    
    if (values.signDateRange && values.signDateRange.length === 2) {
      newFilters.signDateStart = values.signDateRange[0].format('YYYY-MM-DD')
      newFilters.signDateEnd = values.signDateRange[1].format('YYYY-MM-DD')
      delete newFilters.signDateRange
    }
    
    dispatch(setFilters(newFilters))
    
    // 对合同列表应用筛选
    let filteredContracts = [...allContracts];
    
    // 按上传日期筛选
    if (newFilters.uploadDateStart && newFilters.uploadDateEnd) {
      const startDate = new Date(newFilters.uploadDateStart).getTime();
      const endDate = new Date(newFilters.uploadDateEnd).getTime();
      filteredContracts = filteredContracts.filter(contract => {
        const uploadDate = new Date(contract.upload_date).getTime();
        return uploadDate >= startDate && uploadDate <= endDate;
      });
    }
    
    // 按OCR状态筛选
    if (newFilters.ocrStatus) {
      filteredContracts = filteredContracts.filter(contract => 
        contract.ocr_status === newFilters.ocrStatus
      );
    }
    
    // 按文件类型筛选
    if (newFilters.fileType) {
      filteredContracts = filteredContracts.filter(contract => 
        contract.file_type === newFilters.fileType
      );
    }
    
    setDisplayContracts(filteredContracts);
  }

  // 文件预览状态
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [previewError, setPreviewError] = useState<string>('');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handlePreviewDocument = async (document: any) => {
    // 如果是同一个文档，直接返回
    if (selectedDocument && selectedDocument.id === document.id) {
      return;
    }
    
    // 如果已经有选中的文档，先触发切换动画
    if (selectedDocument) {
      setIsTransitioning(true);
      // 等待淡出动画完成，与CSS过渡时间匹配
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    setSelectedDocument(document);
    setPreviewLoading(true);
    setPreviewError('');
    // 不要立即清空内容，保持旧内容直到新内容加载完成
    if (!selectedDocument) {
      setPreviewContent('');
    }

    try {
      // 检查OCR状态
      if (document.ocr_status !== 'completed') {
        setPreviewError('文档OCR处理未完成，无法预览内容');
        setPreviewContent(''); // 清空内容
        return;
      }

      // 根据文件类型决定预览方式
      const fileFormat = document.file_format?.toLowerCase();
      
      if (['jpg', 'jpeg', 'png'].includes(fileFormat)) {
        // 图片文件直接显示，不需要获取内容
        setPreviewContent(''); // 图片不需要文本内容
        return;
      }

      // 优先尝试获取HTML格式内容（Alex Chen的新接口）
      try {
        const htmlResponse = await contractAPI.getHtmlContent(document.id);
        if (htmlResponse && htmlResponse.data && htmlResponse.data.html_content) {
          setPreviewContent(htmlResponse.data.html_content);
          return;
        }
      } catch (htmlError) {
        console.log('HTML内容获取失败，尝试其他方式:', htmlError);
      }

      // 如果HTML获取失败，尝试获取原始文本内容
      try {
        const response = await fetch(`/api/v1/contracts/${document.id}/download`);
        if (response.ok) {
          const text = await response.text();
          setPreviewContent(text);
        } else {
          setPreviewError('无法获取文件内容');
          setPreviewContent(''); // 清空内容
        }
      } catch (error) {
        console.error('获取文件内容失败:', error);
        setPreviewError('获取文件内容失败');
        setPreviewContent(''); // 清空内容
      }
    } catch (error) {
      console.error('预览文档失败:', error);
      setPreviewError('预览文档失败');
      setPreviewContent(''); // 清空内容
    } finally {
      setPreviewLoading(false);
      // 确保在所有情况下都重置切换状态
      setIsTransitioning(false);
    }
  }

  const toggleSortOrder = () => {
    const newOrder = sortOrder === 'desc' ? 'asc' : 'desc'
    dispatch(setSortOrder(newOrder))
    
    // 对合同列表进行排序
    const sortedContracts = [...displayContracts].sort((a, b) => {
      const dateA = new Date(a.upload_date).getTime()
      const dateB = new Date(b.upload_date).getTime()
      return newOrder === 'desc' ? dateB - dateA : dateA - dateB
    })
    setDisplayContracts(sortedContracts)
  }

  const renderHighlightedContent = (content: string, highlights: string[]) => {
    if (!highlights || highlights.length === 0) {
      return <p>{content}</p>
    }

    // 简单的高亮实现，实际项目中可能需要更复杂的处理
    let highlightedContent = content
    highlights.forEach(highlight => {
      const regex = new RegExp(highlight, 'gi')
      highlightedContent = highlightedContent.replace(
        regex, 
        match => `<mark>${match}</mark>`
      )
    })

    return <p dangerouslySetInnerHTML={{ __html: highlightedContent }} />
  }

  return (
    <SearchContainer>
      <MainContent>
        <Card variant="borderless">
          <Paragraph>
            管理和浏览所有合同文件，支持预览、下载和基本筛选
          </Paragraph>
          
          <SearchBox>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Title level={4} style={{ margin: 0 }}>
                <FileTextOutlined style={{ marginRight: 8 }} />
                文件列表
              </Title>
              <Button 
                icon={<ReloadOutlined />} 
                onClick={fetchAllContracts}
                loading={contractsLoading}
                size="small"
              >
                刷新
              </Button>
            </div>
          </SearchBox>
          
          <Divider />
        
        {/* 合同文件列表 */}
        {contractsLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              正在加载文件列表...
            </div>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<span style={{ color: '#ff4d4f' }}>{error}</span>}
            />
          </div>
        ) : displayContracts.length > 0 ? (
          <ResultsContainer>
            <ResultsHeader>
              <div>
                共有 <Text strong>{displayContracts.length}</Text> 个文件
                {Object.keys(filters).some(key => !!filters[key]) && (
                  <Button 
                    type="link" 
                    size="small" 
                    onClick={() => {
                      dispatch(setFilters({}))
                      setDisplayContracts(allContracts)
                    }}
                  >
                    清除筛选条件
                  </Button>
                )}
              </div>
              <Button 
                icon={sortOrder === 'desc' ? <SortDescendingOutlined /> : <SortAscendingOutlined />}
                onClick={toggleSortOrder}
                size="small"
              >
                {sortOrder === 'desc' ? '按上传时间降序' : '按上传时间升序'}
              </Button>
            </ResultsHeader>
            
            <ContentWithPreview previewVisible={!!selectedDocument}>
              <FileListContainer previewVisible={!!selectedDocument}>
                <List
                  itemLayout="vertical"
                  dataSource={displayContracts}
                  renderItem={(item) => (
                    <ResultItem>
                      <List.Item
                        actions={[
                          <Button 
                            type="link" 
                            icon={<EyeOutlined />}
                            onClick={() => handlePreviewDocument(item)}
                          >
                            预览
                          </Button>,
                          <Button 
                            type="link" 
                            icon={<DownloadOutlined />}
                            onClick={() => window.open(`/api/v1/contracts/${item.id}/download`, '_blank')}
                          >
                            下载
                          </Button>,
                          <Button 
                            type="link" 
                            icon={<DeleteOutlined />}
                            onClick={() => handleDeleteContract(item)}
                            danger
                          >
                            删除
                          </Button>
                        ]}
                      >
                        <List.Item.Meta
                          avatar={<FileIcon><FileTextOutlined /></FileIcon>}
                          title={
                            (() => {
                              const steps = item.processing_steps;
                              const totalSteps = steps ? Object.keys(steps).length : 0;
                              const completedSteps = steps ? Object.values(steps).filter((step: any) => step.status === 'completed').length : 0;
                              const isAllCompleted = totalSteps > 0 && completedSteps === totalSteps;
                              
                              return (
                                <Space>
                                  {isAllCompleted && (
                                    <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '16px' }} />
                                  )}
                                  <Text strong>{item.file_name || item.title || '未知文件'}</Text>
                                  {item.file_format && (
                                    <Tag color="blue">{item.file_format.toUpperCase()}</Tag>
                                  )}
                                  {isAllCompleted && (
                                    <>
                                      <Button 
                                        size="small" 
                                        type="primary" 
                                        ghost
                                        onClick={() => handleReprocessOCR(item.id)}
                                      >
                                        重新识别
                                      </Button>
                                      <Button 
                                        size="small" 
                                        type="primary" 
                                        ghost
                                        onClick={() => handleReprocessChunks(item.id)}
                                      >
                                        重新切片
                                      </Button>
                                      <Button 
                                        size="small" 
                                        type="primary" 
                                        ghost
                                        onClick={() => handleSyncToElasticsearch(item.id)}
                                      >
                                        点击同步
                                      </Button>
                                    </>
                                  )}
                                </Space>
                              );
                            })()
                          }
                          description={
                            <Space direction="vertical" size={0}>
                              {item.description && (
                                <Text type="secondary">{item.description}</Text>
                              )}
                              <Text type="secondary">
                                文件大小: {item.file_size ? `${(item.file_size / 1024 / 1024).toFixed(2)} MB` : '未知'}
                                {item.file_format && (
                                  <> | 文件格式: {item.file_format.toUpperCase()}</>
                                )}
                                {item.processed_at && (
                                  <> | 处理时间: {dayjs(item.processed_at).format('YYYY-MM-DD HH:mm')}</>
                                )}
                              </Text>
                              <Text type="secondary">
                                <ClockCircleOutlined /> 上传于 {dayjs(item.upload_time).format('YYYY-MM-DD HH:mm')}
                              </Text>
                              {/* 文件处理进度条 - 只在处理未完成时显示 */}
                              {item.processing_steps && (() => {
                                const steps = item.processing_steps;
                                const totalSteps = Object.keys(steps).length;
                                const completedSteps = Object.values(steps).filter((step: any) => step.status === 'completed').length;
                                const processingStep = Object.entries(steps).find(([key, step]: [string, any]) => step.status === 'processing');
                                const failedStep = Object.entries(steps).find(([key, step]: [string, any]) => step.status === 'failed');
                                
                                if (totalSteps === 0) return null;
                                
                                const progress = Math.round((completedSteps / totalSteps) * 100);
                                const isProcessing = !!processingStep;
                                const hasFailed = !!failedStep;
                                const isAllCompleted = totalSteps > 0 && completedSteps === totalSteps;
                                
                                // 如果全部完成，隐藏进度条
                                if (isAllCompleted) {
                                  return null;
                                }
                                
                                let status: 'normal' | 'active' | 'exception' = 'normal';
                                let statusText = '';
                                
                                if (hasFailed) {
                                  status = 'exception';
                                  statusText = `处理失败: ${failedStep[0]}`;
                                } else if (isProcessing) {
                                  status = 'active';
                                  statusText = `正在处理: ${processingStep[0]}`;
                                } else {
                                  statusText = `已完成 ${completedSteps}/${totalSteps} 步骤`;
                                }
                                
                                return (
                                  <div style={{ marginTop: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                      <Text type="secondary" style={{ fontSize: 12 }}>处理进度</Text>
                                      <Text type="secondary" style={{ fontSize: 12 }}>{statusText}</Text>
                                    </div>
                                    <Progress 
                                      percent={progress} 
                                      size="small" 
                                      status={status}
                                      showInfo={false}
                                      strokeColor={{
                                        '0%': '#108ee9',
                                        '100%': '#87d068',
                                      }}
                                    />
                                  </div>
                                );
                              })()}
                            </Space>
                          }
                        />

                        {item.ocr_content && (
                          <div className="content">
                            <Text strong>OCR识别内容预览:</Text>
                            <p style={{ 
                              marginTop: 8, 
                              color: '#666',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical'
                            }}>
                              {item.ocr_content}
                            </p>
                          </div>
                        )}
                      </List.Item>
                    </ResultItem>
                  )}
                />
              </FileListContainer>
              
              {/* 内嵌预览面板 */}
              {selectedDocument && (
                <InlinePreviewPanel $isTransitioning={isTransitioning}>
                  <PreviewHeader>
                    {/* 预览模式切换按钮 - 使用新的样式 */}
                    <PreviewModeToggle>
                      <ToggleButton
                        $active={previewMode === 'document'}
                        onClick={() => handlePreviewModeChange('document')}
                      >
                        文档预览
                      </ToggleButton>
                      <ToggleButton
                        $active={previewMode === 'chunks'}
                        disabled={(() => {
                          const chunkStatus = contractChunkStatus[selectedDocument.id];
                          const isDisabled = !chunkStatus || 
                                           chunkStatus.status !== 'completed' ||
                                           chunkStatus.chunk_count === 0;
                          console.log(`合同 ${selectedDocument.id} 切片预览按钮状态:`, {
                            chunkStatus,
                            isDisabled,
                            hasStatus: !!chunkStatus,
                            status: chunkStatus?.status,
                            chunkCount: chunkStatus?.chunk_count
                          });
                          return isDisabled;
                        })()}
                        onClick={() => handlePreviewModeChange('chunks')}
                      >
                        切片预览
                      </ToggleButton>
                    </PreviewModeToggle>
                    <Button 
                      type="text" 
                      icon={<CloseOutlined />} 
                      onClick={() => setSelectedDocument(null)}
                      size="small"
                    />
                  </PreviewHeader>
                  
                  <PreviewContent $isTransitioning={isTransitioning}>
                    <HtmlContentSection>
                      <h5>{previewMode === 'document' ? '文档内容' : '切片内容'}</h5>
                      {previewMode === 'chunks' ? (
                        // 切片预览内容
                        <ChunkPreviewContainer>
                          {chunkLoading ? (
                            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                              <Spin size="large" />
                              <div style={{ marginTop: 16 }}>正在加载切片内容...</div>
                            </div>
                          ) : chunkData && chunkData.chunks && chunkData.chunks.length > 0 ? (
                            <>

                              
                              {/* 切片列表 */}
                              <ChunkListContainer>
                                {chunkData.chunks.map((chunk: any, index: number) => (
                                  <ChunkItem key={chunk.id || index}>
                                    <ChunkHeader>
                                      <div className="chunk-title">
                                        切片 #{(chunkPage - 1) * 10 + index + 1}
                                      </div>
                                      <div className="chunk-meta">
                                        <div className="meta-item">
                                          字符数:
                                          <span className="meta-value">
                                            {chunk.content_text ? chunk.content_text.length : 0}
                                          </span>
                                        </div>
                                        {chunk.metadata && chunk.metadata.page && (
                                          <div className="meta-item">
                                            页码:
                                            <span className="meta-value">{chunk.metadata.page}</span>
                                          </div>
                                        )}
                                      </div>
                                    </ChunkHeader>
                                    <ChunkContent>
                                      <div className="chunk-text">
                                        {chunk.content_text || '内容为空'}
                                      </div>
                                      {chunk.metadata && Object.keys(chunk.metadata).length > 1 && (
                                        <div className="chunk-metadata">
                                          <div className="metadata-title">元数据</div>
                                          <div className="metadata-content">
                                            {JSON.stringify(chunk.metadata, null, 2)}
                                          </div>
                                        </div>
                                      )}
                                    </ChunkContent>
                                  </ChunkItem>
                                ))}
                              </ChunkListContainer>
                              
                              {/* 分页 */}
                              {chunkTotal > 10 && (
                                <PaginationContainer>
                                  <Pagination
                                    current={chunkPage}
                                    total={chunkTotal}
                                    pageSize={10}
                                    showSizeChanger={false}
                                    showQuickJumper
                                    showTotal={(total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`}
                                    onChange={(page) => fetchChunkData(selectedDocument.id.toString(), page)}
                                  />
                                </PaginationContainer>
                              )}
                            </>
                          ) : (
                            <div style={{ 
                              textAlign: 'center', 
                              padding: '60px 20px', 
                              color: '#8c8c8c',
                              background: 'white',
                              border: '1px solid #e8e8e8',
                              borderRadius: '8px',
                              margin: '20px'
                            }}>
                              暂无切片数据
                            </div>
                          )}
                        </ChunkPreviewContainer>
                      ) : (
                        // 文档预览内容（原有逻辑）
                        (previewLoading || isTransitioning) ? (
                          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                            <Spin size="large" />
                            <div style={{ marginTop: 16 }}>
                              {isTransitioning ? '正在切换文档...' : '正在加载文档内容...'}
                            </div>
                          </div>
                        ) : previewError ? (
                          <div style={{ 
                            textAlign: 'center', 
                            padding: '60px 20px', 
                            color: '#ff4d4f',
                            background: '#fff2f0',
                            border: '1px solid #ffccc7',
                            borderRadius: '8px',
                            margin: '20px'
                          }}>
                            <div style={{ fontSize: '16px', marginBottom: '8px' }}>加载失败</div>
                            <div style={{ fontSize: '14px' }}>{previewError}</div>
                          </div>
                        ) : selectedDocument?.file_format && ['jpg', 'jpeg', 'png'].includes(selectedDocument.file_format.toLowerCase()) ? (
                          <div style={{ textAlign: 'center', padding: '20px' }}>
                            <img 
                              src={`/api/v1/contracts/${selectedDocument.id}/download`}
                              alt={selectedDocument.file_name || selectedDocument.title || '文档图片'}
                              style={{ 
                                maxWidth: '100%', 
                                maxHeight: '500px', 
                                borderRadius: '8px',
                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                              }}
                            />
                          </div>
                        ) : previewContent && previewContent.includes('<html') ? (
                          // HTML内容渲染
                          <HtmlContentWrapper>
                            <div 
                              dangerouslySetInnerHTML={{ __html: previewContent }}
                            />
                          </HtmlContentWrapper>
                        ) : previewContent ? (
                          // 纯文本内容渲染
                          <TextContentWrapper>
                            <pre>
                              {previewContent}
                            </pre>
                          </TextContentWrapper>
                        ) : selectedDocument ? (
                          <div style={{ 
                            textAlign: 'center', 
                            padding: '60px 20px', 
                            color: '#8c8c8c',
                            background: 'white',
                            border: '1px solid #e8e8e8',
                            borderRadius: '8px',
                            margin: '20px'
                          }}>
                            文档内容暂不可用
                          </div>
                        ) : (
                        <div style={{ 
                          textAlign: 'center', 
                          padding: '60px 20px', 
                          color: '#8c8c8c',
                          background: 'white',
                          border: '1px solid #e8e8e8',
                          borderRadius: '8px',
                          margin: '20px'
                        }}>
                          请选择文档进行预览
                        </div>
                        )
                      )}
                    </HtmlContentSection>
                    
                    {/* 文档信息部分移到底部 */}
                    <FileInfoFooter>
                      <h5>文档信息</h5>
                      <DocumentInfoGrid>
                        <DetailItem>
                          <Text type="secondary">文件名</Text>
                          <Text strong title={selectedDocument.file_name || selectedDocument.title}>
                            {(() => {
                              const fileName = selectedDocument.file_name || selectedDocument.title || '未知文件';
                              return fileName.length > 20 ? 
                                `${fileName.substring(0, 20)}...` : 
                                fileName;
                            })()}
                          </Text>
                        </DetailItem>
                        <DetailItem>
                          <Text type="secondary">文件类型</Text>
                          <Text strong>{selectedDocument.file_format?.toUpperCase() || '未知'}</Text>
                        </DetailItem>
                        <DetailItem>
                          <Text type="secondary">文件大小</Text>
                          <Text strong>
                            {selectedDocument.file_size ? 
                              `${(selectedDocument.file_size / 1024 / 1024).toFixed(2)} MB` : 
                              '未知'
                            }
                          </Text>
                        </DetailItem>
                        <DetailItem>
                          <Text type="secondary">上传时间</Text>
                          <Text strong>{dayjs(selectedDocument.upload_time).format('MM-DD HH:mm')}</Text>
                        </DetailItem>
                        <DetailItem>
                          <Text type="secondary">OCR状态</Text>
                          <Tag color={
                            selectedDocument.ocr_status === 'completed' ? 'green' :
                            selectedDocument.ocr_status === 'processing' ? 'blue' :
                            selectedDocument.ocr_status === 'failed' ? 'red' : 'orange'
                          }>
                            {selectedDocument.ocr_status === 'completed' ? '已完成' :
                             selectedDocument.ocr_status === 'processing' ? '处理中' :
                             selectedDocument.ocr_status === 'failed' ? '失败' : '等待中'}
                          </Tag>
                        </DetailItem>
                        <DetailItem>
                          <Text type="secondary">ES同步状态</Text>
                          <Tag color={
                            selectedDocument.elasticsearch_sync_status === 'completed' ? 'green' :
                            selectedDocument.elasticsearch_sync_status === 'processing' ? 'blue' :
                            selectedDocument.elasticsearch_sync_status === 'failed' ? 'red' : 'orange'
                          }>
                            {selectedDocument.elasticsearch_sync_status === 'completed' ? '已同步' :
                             selectedDocument.elasticsearch_sync_status === 'processing' ? '同步中' :
                             selectedDocument.elasticsearch_sync_status === 'failed' ? '同步失败' : '待同步'}
                          </Tag>
                        </DetailItem>
                        <DetailItem>
                          <Text type="secondary">操作</Text>
                          <Button 
                            type="primary" 
                            icon={<DownloadOutlined />}
                            onClick={() => window.open(`/api/v1/contracts/${selectedDocument.id}/download`, '_blank')}
                            size="small"
                          >
                            下载
                          </Button>
                        </DetailItem>
                      </DocumentInfoGrid>
                    </FileInfoFooter>
                  </PreviewContent>
                </InlinePreviewPanel>
              )}
            </ContentWithPreview>
          </ResultsContainer>
        ) : (
          <Empty description="暂无文件" />
        )}
        </Card>
      </MainContent>

      {/* 高级筛选抽屉 */}
      <Drawer
        title="高级筛选"
        placement="right"
        onClose={() => setFilterDrawerVisible(false)}
        open={filterDrawerVisible}
        width={360}
      >
        <Form
          layout="vertical"
          initialValues={filters}
          onFinish={handleFilterSubmit}
        >
          <Form.Item name="fileType" label="文件类型">
            <Select placeholder="选择文件类型" allowClear>
              <Select.Option value="pdf">PDF</Select.Option>
              <Select.Option value="doc">DOC</Select.Option>
              <Select.Option value="docx">DOCX</Select.Option>
              <Select.Option value="txt">TXT</Select.Option>
              <Select.Option value="jpg">JPG</Select.Option>
              <Select.Option value="png">PNG</Select.Option>
            </Select>
          </Form.Item>
          
          <Form.Item name="ocrStatus" label="OCR状态">
            <Select placeholder="选择OCR状态" allowClear>
              <Select.Option value="pending">等待中</Select.Option>
              <Select.Option value="processing">处理中</Select.Option>
              <Select.Option value="completed">已完成</Select.Option>
              <Select.Option value="failed">失败</Select.Option>
            </Select>
          </Form.Item>
          
          <Form.Item name="uploadDateRange" label="上传日期">
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                dispatch(setFilters({}))
                setDisplayContracts(allContracts)
                setFilterDrawerVisible(false)
              }}>重置</Button>
              <Button type="primary" htmlType="submit">应用筛选</Button>
            </Space>
          </Form.Item>
        </Form>
      </Drawer>
    </SearchContainer>
  )
}

// Styled Components
const SearchContainer = styled.div`
  position: relative;
  min-height: 100vh;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e0 100%);
  color: #2d3748;
  overflow: hidden;
  
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
  
  .ant-card {
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
    border-radius: 12px;
  }
  
  .ant-drawer .ant-drawer-content {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
  }
  
  .ant-drawer .ant-drawer-header {
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.3);
  }
`

const MainContent = styled.div`
  min-height: 100vh;
  background: transparent;
  padding: 24px;
  position: relative;
  z-index: 1;
`







const SearchBox = styled.div`
  margin-top: 16px;
`

const SearchInputWrapper = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  
  .ant-input-affix-wrapper {
    flex: 1;
  }
`

const ExampleQueries = styled.div`
  margin-bottom: 16px;
  
  .ant-tag {
    cursor: pointer;
    margin-bottom: 8px;
  }
`

const ResultsContainer = styled.div`
  margin-top: 8px;
`

const ResultsHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`

const ResultItem = styled.div`
  .ant-list-item {
    padding: 16px;
    border-radius: 12px;
    margin-bottom: 16px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(15px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      border-color: rgba(102, 126, 234, 0.4);
      box-shadow: 0 8px 24px rgba(102, 126, 234, 0.15);
      transform: translateY(-2px);
    }
  }
  
  .content {
    margin: 16px 0;
    
    mark {
      background-color: #fffb8f;
      padding: 0 2px;
    }
  }
  
  .matched-clauses {
    background-color: #f9f9f9;
    padding: 12px;
    border-radius: 4px;
    margin-top: 16px;
    
    .clause {
      margin-top: 8px;
    }
  }
`

const FileIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background-color: #e6f7ff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #1890ff;
`

// 内容容器，支持预览面板
const ContentWithPreview = styled.div.withConfig({
  shouldForwardProp: (prop) => !['previewVisible'].includes(prop)
})<{ previewVisible: boolean }>`
  display: flex;
  gap: 16px;
  height: calc(100vh - 300px);
  min-height: 600px;
  position: relative;
  overflow: hidden;
`;

// 文件列表容器
const FileListContainer = styled.div.withConfig({
  shouldForwardProp: (prop) => !['previewVisible'].includes(prop)
})<{ previewVisible: boolean }>`
  flex: ${props => props.previewVisible ? '1' : '1'};
  width: ${props => props.previewVisible ? '50%' : '100%'};
  overflow-y: auto;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  transform: ${props => props.previewVisible ? 'translateX(0)' : 'translateX(0)'};
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
`;

// 内嵌预览面板
const InlinePreviewPanel = styled.div<{ $isTransitioning?: boolean }>`
  flex: 1;
  width: 50%;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  animation: slideInFromRight 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  transition: opacity 0.1s ease-in-out;
  opacity: ${props => props.$isTransitioning ? 0.3 : 1};
  
  @keyframes slideInFromRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes fadeInContent {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

// 新的预览模式切换按钮容器
const PreviewModeToggle = styled.div`
  display: flex;
  background: #f5f5f5;
  border-radius: 8px;
  padding: 4px;
  gap: 2px;
`;

// 新的切换按钮样式
const ToggleButton = styled.button<{ $active?: boolean }>`
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  background: ${props => props.$active ? '#1890ff' : 'transparent'};
  color: ${props => props.$active ? 'white' : '#666'};
  
  &:hover:not(:disabled) {
    background: ${props => props.$active ? '#40a9ff' : '#e6f7ff'};
    color: ${props => props.$active ? 'white' : '#1890ff'};
  }
  
  &:disabled {
    background: #f5f5f5;
    color: #bfbfbf;
    cursor: not-allowed;
  }
  
  &:active:not(:disabled) {
    transform: translateY(1px);
  }
`;

// 文档信息底部区域
const FileInfoFooter = styled.div`
  padding: 16px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  
  h5 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: #262626;
    padding-bottom: 6px;
    border-bottom: 1px solid #e8e8e8;
  }
`;

// 文档信息网格布局
const DocumentInfoGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px 16px;
  align-items: start;
`;

// 预览面板头部
const PreviewHeader = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  opacity: 0;
  animation: fadeInDown 0.5s cubic-bezier(0.4, 0, 0.2, 1) 0.1s forwards;
  
  h4 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #262626;
  }
  
  @keyframes fadeInDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

// 修改预览内容容器为上下布局
const PreviewContent = styled.div<{ $isTransitioning?: boolean }>`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  opacity: ${props => props.$isTransitioning ? 0.3 : 1};
  animation: ${props => props.$isTransitioning ? 'none' : 'fadeInUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) 0.1s forwards'};
  transition: opacity 0.1s ease-in-out, transform 0.1s ease-in-out;
  transform: ${props => props.$isTransitioning ? 'translateY(5px)' : 'translateY(0)'};
  
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

// 修改文档信息部分为更紧凑的区域
const FileDetailsSection = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(10px);
  
  h5 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: #262626;
    padding-bottom: 6px;
    border-bottom: 1px solid #e8e8e8;
  }
`;

// 文档信息表格容器
const DocumentInfoTable = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px 16px;
  align-items: start;
`;

// 修改详情项为表格单元格布局
const DetailItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  
  .ant-typography {
    &:first-child {
      font-size: 12px;
      color: #8c8c8c;
      font-weight: 500;
      margin-bottom: 2px;
    }
    
    &:last-child {
      font-size: 13px;
      font-weight: 600;
      color: #262626;
      word-break: break-all;
    }
  }
  
  .ant-tag {
    font-size: 11px;
    padding: 2px 6px;
    height: auto;
    line-height: 1.4;
    align-self: flex-start;
    margin: 0;
  }
  
  .ant-btn {
    align-self: flex-start;
    height: 28px;
    padding: 0 12px;
    font-size: 12px;
  }
`;

// 修改HTML内容部分为主要区域
const HtmlContentSection = styled.div`
  flex: 1;
  padding: 20px;
  background: rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  
  h5 {
    margin: 0 0 16px 0;
    font-size: 14px;
    font-weight: 600;
    color: #262626;
    padding-bottom: 8px;
    border-bottom: 1px solid #e8e8e8;
    flex-shrink: 0;
  }
`;

// 重新定义HTML内容包装器
const HtmlContentWrapper = styled.div`
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(15px);
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  
  div {
    font-size: 14px;
    line-height: 1.6;
    color: #262626;
    
    h1, h2, h3, h4, h5, h6 {
      margin: 16px 0 8px 0;
      color: #1890ff;
    }
    
    p {
      margin: 8px 0;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      
      th, td {
        border: 1px solid #e8e8e8;
        padding: 8px 12px;
        text-align: left;
      }
      
      th {
        background: #f5f5f5;
        font-weight: 600;
      }
    }
  }
`;

// 重新定义文本内容包装器
const TextContentWrapper = styled.div`
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(15px);
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  
  pre {
    margin: 0;
    font-family: 'Courier New', monospace;
    font-size: 13px;
    line-height: 1.5;
    color: #262626;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
`;

// 切片预览容器
const ChunkPreviewContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

// 切片统计信息
const ChunkStatsSection = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  .stats-info {
    display: flex;
    gap: 24px;
    align-items: center;
    
    .stat-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      
      .stat-value {
        font-size: 18px;
        font-weight: 600;
        color: #1890ff;
        margin-bottom: 2px;
      }
      
      .stat-label {
        font-size: 12px;
        color: #8c8c8c;
      }
    }
  }
`;

// 切片列表容器
const ChunkListContainer = styled.div`
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(10px);
`;

// 切片项容器
const ChunkItem = styled.div`
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  margin-bottom: 16px;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(15px);
  transition: all 0.2s ease-in-out;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
  
  &:hover {
    border-color: rgba(102, 126, 234, 0.4);
    box-shadow: 0 8px 24px rgba(102, 126, 234, 0.15);
    transform: translateY(-2px);
  }
`;

// 切片头部
const ChunkHeader = styled.div`
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  .chunk-title {
    font-size: 14px;
    font-weight: 600;
    color: #262626;
  }
  
  .chunk-meta {
    display: flex;
    gap: 12px;
    align-items: center;
    
    .meta-item {
      font-size: 12px;
      color: #8c8c8c;
      
      .meta-value {
        font-weight: 600;
        color: #262626;
        margin-left: 4px;
      }
    }
  }
`;

// 切片内容
const ChunkContent = styled.div`
  padding: 16px;
  
  .chunk-text {
    font-size: 14px;
    line-height: 1.6;
    color: #262626;
    margin-bottom: 12px;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  
  .chunk-metadata {
    padding-top: 12px;
    border-top: 1px solid #f0f0f0;
    
    .metadata-title {
      font-size: 12px;
      font-weight: 600;
      color: #8c8c8c;
      margin-bottom: 8px;
    }
    
    .metadata-content {
      font-size: 12px;
      color: #595959;
      background: #f8f8f8;
      padding: 8px 12px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
    }
  }
`;

// 分页容器
const PaginationContainer = styled.div`
  padding: 16px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  display: flex;
  justify-content: center;
  
  .ant-pagination {
    .ant-pagination-item {
      border-color: #d9d9d9;
      
      &:hover {
        border-color: #1890ff;
      }
      
      &.ant-pagination-item-active {
        border-color: #1890ff;
        background-color: #1890ff;
      }
    }
  }
`;

export default Search