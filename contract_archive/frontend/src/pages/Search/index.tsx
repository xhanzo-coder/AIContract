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
  message
} from 'antd'
import { useSelector, useDispatch } from 'react-redux'
import {
  SearchOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  FilterOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
  DownloadOutlined,
  EyeOutlined,
  HighlightOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  CloseOutlined
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
  
  const [searchType, setSearchType] = useState<'natural' | 'keyword' | 'list'>('list')
  const [filterDrawerVisible, setFilterDrawerVisible] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<any>(null)

  const [allContracts, setAllContracts] = useState<Contract[]>([])
  const [contractsLoading, setContractsLoading] = useState(false)
  const [displayContracts, setDisplayContracts] = useState<Contract[]>([])

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
      
      setAllContracts(contracts)
      setDisplayContracts(contracts)
    } catch (error) {
      console.error('获取合同列表失败:', error)
      message.error('获取合同列表失败')
    } finally {
      setContractsLoading(false)
    }
  }

  // 组件加载时获取所有合同
  useEffect(() => {
    fetchAllContracts()
  }, [])
  
  const handleSearch = () => {
    if (!query.trim()) return
    
    if (searchType === 'natural') {
      dispatch(searchContracts({ query, filters }))
    } else {
      dispatch(keywordSearch({ keyword: query, filters }))
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

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
    
    if (searchType === 'list') {
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
    } else if (query) {
      if (searchType === 'natural') {
        dispatch(searchContracts({ query, filters: newFilters }))
      } else {
        dispatch(keywordSearch({ keyword: query, filters: newFilters }))
      }
    }
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
    
    if (searchType === 'list') {
      // 对合同列表进行排序
      const sortedContracts = [...displayContracts].sort((a, b) => {
        const dateA = new Date(a.upload_date).getTime()
        const dateB = new Date(b.upload_date).getTime()
        return newOrder === 'desc' ? dateB - dateA : dateA - dateB
      })
      setDisplayContracts(sortedContracts)
    } else if (query) {
      if (searchType === 'natural') {
        dispatch(searchContracts({ query, filters, sortOrder: newOrder }))
      } else {
        dispatch(keywordSearch({ keyword: query, filters, sortOrder: newOrder }))
      }
    }
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
          <Title level={3}>智能合约搜索</Title>
          <Paragraph>
            支持自然语言搜索和关键词搜索，快速找到您需要的合约信息
          </Paragraph>
          
          <SearchBox>
            <Tabs 
              activeKey={searchType} 
              onChange={(key) => setSearchType(key as 'natural' | 'keyword' | 'list')}
              style={{ marginBottom: 16 }}
              tabBarExtraContent={
                searchType === 'list' && (
                  <Button 
                    icon={<ReloadOutlined />} 
                    onClick={fetchAllContracts}
                    loading={contractsLoading}
                    size="small"
                  >
                    刷新
                  </Button>
                )
              }
              items={[
                {
                  key: 'list',
                  label: (
                    <span>
                      <FileTextOutlined />
                      合同列表
                    </span>
                  )
                },
                {
                  key: 'natural',
                  label: (
                    <span>
                      <HighlightOutlined />
                      自然语言搜索
                    </span>
                  )
                },
                {
                  key: 'keyword',
                  label: (
                    <span>
                      <SearchOutlined />
                      关键词搜索
                    </span>
                  )
                }
              ]}
            />
            
            {searchType !== 'list' && (
              <SearchInputWrapper>
                <Input
                  placeholder={
                    searchType === 'natural'
                      ? '请输入自然语言问题，例如："找出所有与租赁相关的合同"'
                      : '请输入关键词，例如："租赁 违约金"'
                  }
                  value={query}
                  onChange={(e) => dispatch(setQuery(e.target.value))}
                  onKeyPress={handleKeyPress}
                  size="large"
                  suffix={
                    <Tooltip title={
                      searchType === 'natural'
                        ? '自然语言搜索：您可以用日常语言描述需求，系统会理解您的意图'
                        : '关键词搜索：使用空格分隔多个关键词，支持精确匹配'
                    }>
                      <InfoCircleOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
                    </Tooltip>
                  }
                />
                <Button 
                  type="primary" 
                  icon={<SearchOutlined />} 
                  onClick={handleSearch}
                  loading={loading}
                  size="large"
                >
                  搜索
                </Button>
                <Tooltip title="高级筛选">
                  <Badge dot={Object.keys(filters).some(key => !!filters[key])}>
                    <Button 
                      icon={<FilterOutlined />} 
                      onClick={() => setFilterDrawerVisible(true)}
                      size="large"
                    />
                  </Badge>
                </Tooltip>
              </SearchInputWrapper>
            )}
            
            {searchType === 'natural' && (
              <ExampleQueries>
                <Text type="secondary">示例问题：</Text>
                <Space wrap>
                  <Tag color="blue" style={{ cursor: 'pointer' }} onClick={() => {
                    dispatch(setQuery('找出所有与租赁相关的合同'))
                    dispatch(searchContracts({ query: '找出所有与租赁相关的合同', filters }))
                  }}>
                    找出所有与租赁相关的合同
                  </Tag>
                  <Tag color="blue" style={{ cursor: 'pointer' }} onClick={() => {
                    dispatch(setQuery('2023年签订的采购合同有哪些'))
                    dispatch(searchContracts({ query: '2023年签订的采购合同有哪些', filters }))
                  }}>
                    2023年签订的采购合同有哪些
                  </Tag>
                  <Tag color="blue" style={{ cursor: 'pointer' }} onClick={() => {
                    dispatch(setQuery('合同中关于违约金的条款'))
                    dispatch(searchContracts({ query: '合同中关于违约金的条款', filters }))
                  }}>
                    合同中关于违约金的条款
                  </Tag>
                </Space>
              </ExampleQueries>
            )}
          </SearchBox>
          
          <Divider />
        
        {/* 搜索结果或合同列表 */}
        {(searchType === 'list' ? contractsLoading : loading) ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              {searchType === 'list' ? '正在加载合同列表...' : '正在搜索中，请稍候...'}
            </div>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<span style={{ color: '#ff4d4f' }}>{error}</span>}
            />
          </div>
        ) : (searchType === 'list' ? displayContracts.length > 0 : results.length > 0) ? (
          <ResultsContainer>
            <ResultsHeader>
              <div>
                {searchType === 'list' ? (
                  <>共有 <Text strong>{displayContracts.length}</Text> 个合同</>
                ) : (
                  <>找到 <Text strong>{results.length}</Text> 条结果</>
                )}
                {Object.keys(filters).some(key => !!filters[key]) && (
                  <Button 
                    type="link" 
                    size="small" 
                    onClick={() => {
                      dispatch(setFilters({}))
                      if (searchType === 'list') {
                        setDisplayContracts(allContracts)
                      } else if (query) {
                        if (searchType === 'natural') {
                          dispatch(searchContracts({ query, filters: {} }))
                        } else {
                          dispatch(keywordSearch({ keyword: query, filters: {} }))
                        }
                      }
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
                {searchType === 'list' ? 
                  (sortOrder === 'desc' ? '按上传时间降序' : '按上传时间升序') :
                  (sortOrder === 'desc' ? '按相关度降序' : '按相关度升序')
                }
              </Button>
            </ResultsHeader>
            
            <ContentWithPreview previewVisible={!!selectedDocument}>
              <FileListContainer previewVisible={!!selectedDocument}>
                <List
                  itemLayout="vertical"
                  dataSource={searchType === 'list' ? displayContracts : results}
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
                          </Button>
                        ]}
                      >
                        <List.Item.Meta
                          avatar={<FileIcon><FileTextOutlined /></FileIcon>}
                          title={
                            <Space>
                              <Text strong>{item.file_name || item.title || '未知文件'}</Text>
                              {item.file_format && (
                                <Tag color="blue">{item.file_format.toUpperCase()}</Tag>
                              )}
                              {item.ocr_status && (
                                <Tag color={
                                  item.ocr_status === 'completed' ? 'green' :
                                  item.ocr_status === 'processing' ? 'blue' :
                                  item.ocr_status === 'failed' ? 'red' : 'orange'
                                }>
                                  OCR: {item.ocr_status === 'completed' ? '已完成' :
                                        item.ocr_status === 'processing' ? '处理中' :
                                        item.ocr_status === 'failed' ? '失败' : '等待中'}
                                </Tag>
                              )}
                            </Space>
                          }
                          description={
                            <Space direction="vertical" size={0}>
                              {item.description && (
                                <Text type="secondary">{item.description}</Text>
                              )}
                              <Text type="secondary">
                                文件大小: {item.file_size ? `${(item.file_size / 1024 / 1024).toFixed(2)} MB` : '未知'}
                                {item.processed_at && (
                                  <> | 处理时间: {dayjs(item.processed_at).format('YYYY-MM-DD HH:mm')}</>
                                )}
                              </Text>
                              <Text type="secondary">
                                <ClockCircleOutlined /> 上传于 {dayjs(item.upload_time).format('YYYY-MM-DD HH:mm')}
                              </Text>
                            </Space>
                          }
                        />
                        {searchType !== 'list' && (
                          <>
                            <div className="content">
                              {renderHighlightedContent(item.content || '', item.highlights || [])}
                            </div>
                            {item.matchedClauses && item.matchedClauses.length > 0 && (
                              <div className="matched-clauses">
                                <Text strong>匹配条款:</Text>
                                {item.matchedClauses.map((clause: any, index: number) => (
                                  <div key={index} className="clause">
                                    <Tag color="purple">{clause.title}</Tag>
                                    <p>{clause.content}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                        {searchType === 'list' && item.ocr_content && (
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
                    <h4>文档预览</h4>
                    <Button 
                      type="text" 
                      icon={<CloseOutlined />} 
                      onClick={() => setSelectedDocument(null)}
                      size="small"
                    />
                  </PreviewHeader>
                  
                  <PreviewContent $isTransitioning={isTransitioning}>
                    <FileDetailsSection>
                      <h5>文档信息</h5>
                      <DocumentInfoTable>
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
                      </DocumentInfoTable>
                    </FileDetailsSection>

                    <HtmlContentSection>
                      <h5>文档内容</h5>
                      {previewLoading || isTransitioning ? (
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
                      )}
                    </HtmlContentSection>
                  </PreviewContent>
                </InlinePreviewPanel>
              )}
            </ContentWithPreview>
          </ResultsContainer>
        ) : query ? (
          <Empty description="未找到匹配的结果，请尝试其他搜索词或调整筛选条件" />
        ) : searchHistory.length > 0 ? (
          <div>
            <Title level={5} style={{ marginTop: 24 }}>最近搜索历史</Title>
            <List
              size="small"
              bordered
              dataSource={searchHistory.slice(0, 10)}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button 
                      type="link" 
                      onClick={() => {
                        dispatch(setQuery(item.query))
                        setSearchType(item.type)
                        if (item.type === 'natural') {
                          dispatch(searchContracts({ query: item.query, filters }))
                        } else {
                          dispatch(keywordSearch({ keyword: item.query, filters }))
                        }
                      }}
                    >
                      重新搜索
                    </Button>
                  ]}
                >
                  <Space>
                    <ClockCircleOutlined style={{ color: '#999' }} />
                    <Text>{item.query}</Text>
                    <Tag color={item.type === 'natural' ? 'blue' : 'green'}>
                      {item.type === 'natural' ? '自然语言' : '关键词'}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {dayjs(item.timestamp).format('YYYY-MM-DD HH:mm')}
                    </Text>
                  </Space>
                </List.Item>
              )}
            />
          </div>
        ) : null}
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
          {searchType === 'list' ? (
            // 合同列表模式的筛选选项
            <>
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
            </>
          ) : (
            // 搜索模式的筛选选项
            <>
              <Form.Item name="contractType" label="合同类型">
                <Select
                  mode="multiple"
                  placeholder="选择合同类型"
                  allowClear
                  options={[
                    { label: '租赁合同', value: '租赁合同' },
                    { label: '采购合同', value: '采购合同' },
                    { label: '劳务合同', value: '劳务合同' },
                    { label: '销售合同', value: '销售合同' },
                    { label: '技术服务合同', value: '技术服务合同' }
                  ]}
                />
              </Form.Item>
              
              <Form.Item name="dateRange" label="签订日期范围">
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
              
              <Form.Item name="party" label="合同方">
                <Input placeholder="输入合同方名称" />
              </Form.Item>
              
              <Form.Item name="status" label="合同状态">
                <Radio.Group>
                  <Radio.Button value="all">全部</Radio.Button>
                  <Radio.Button value="active">生效中</Radio.Button>
                  <Radio.Button value="expired">已过期</Radio.Button>
                  <Radio.Button value="terminated">已终止</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </>
          )}
          
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                dispatch(setFilters({}))
                if (searchType === 'list') {
                  setDisplayContracts(allContracts)
                }
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
  
  .ant-card {
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  }
`

const MainContent = styled.div`
  min-height: 100vh;
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
  margin-top: 16px;
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
    border-radius: 8px;
    margin-bottom: 16px;
    border: 1px solid #f0f0f0;
    transition: all 0.3s;
    
    &:hover {
      border-color: #1890ff;
      box-shadow: 0 4px 12px rgba(24, 144, 255, 0.15);
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
`;

// 内嵌预览面板
const InlinePreviewPanel = styled.div<{ $isTransitioning?: boolean }>`
  flex: 1;
  width: 50%;
  background: white;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  animation: slideInFromRight 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
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

// 预览面板头部
const PreviewHeader = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fafafa;
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
  border-bottom: 1px solid #f0f0f0;
  background: #fafafa;
  
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
  overflow-y: auto;
  background: white;
  
  h5 {
    margin: 0 0 16px 0;
    font-size: 14px;
    font-weight: 600;
    color: #262626;
    padding-bottom: 8px;
    border-bottom: 1px solid #e8e8e8;
  }
`;

// 重新定义HTML内容包装器
const HtmlContentWrapper = styled.div`
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 16px;
  background: #fafafa;
  max-height: 500px;
  overflow-y: auto;
  
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
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 16px;
  background: #fafafa;
  max-height: 500px;
  overflow-y: auto;
  
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

export default Search