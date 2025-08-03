import React, { useState } from 'react'
import { 
  Upload, 
  Button, 
  Card, 
  Form, 
  Input, 
  Select, 
  DatePicker, 
  message, 
  Progress, 
  List, 
  Typography, 
  Space, 
  Tag,
  Alert,
  Divider,
  Row,
  Col,
  Modal
} from 'antd'
import { 
  UploadOutlined, 
  InboxOutlined, 
  FileTextOutlined, 
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  InfoCircleOutlined,
  EyeOutlined,
  SyncOutlined
} from '@ant-design/icons'
import { useDispatch, useSelector } from 'react-redux'
import styled from 'styled-components'
import { RootState } from '../../store'
import { contractAPI } from '../../services/api'
import { UploadResponse, OcrStatusResponse } from '../../types'
import dayjs from 'dayjs'

const { Title, Paragraph, Text } = Typography
const { Dragger } = Upload
const { TextArea } = Input

interface UploadFile {
  uid: string
  name: string
  status: 'uploading' | 'done' | 'error' | 'processing'
  percent?: number
  response?: UploadResponse
  error?: any
  file?: File
  contractId?: number
  ocrStatus?: 'pending' | 'processing' | 'completed' | 'failed'
}

const UploadPage: React.FC = () => {
  const [form] = Form.useForm()
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({})
  const [loading, setLoading] = useState(false)
  const [ocrStatusModal, setOcrStatusModal] = useState<{
    visible: boolean
    contractId?: number
    status?: OcrStatusResponse
  }>({ visible: false })

  const supportedFormats = [
    { ext: 'PDF', desc: 'PDF文档，支持扫描件和电子文档' },
    { ext: 'DOC/DOCX', desc: 'Microsoft Word文档' },
    { ext: 'TXT', desc: '纯文本文件' },
    { ext: 'JPG/PNG', desc: '图片格式，系统将自动进行OCR识别' }
  ]

  // 简化合同类型，只需要标题和描述
  const contractTypes = [
    '租赁合同',
    '采购合同',
    '劳务合同',
    '销售合同',
    '技术服务合同',
    '保密协议',
    '合作协议',
    '其他'
  ]

  const handleUpload = async (values: any) => {
    if (fileList.length === 0) {
      message.error('请选择要上传的文件')
      return
    }

    setLoading(true)
    
    try {
      for (const fileItem of fileList) {
        if (fileItem.status === 'done') continue
        
        // 更新文件状态为上传中
        setFileList(prev => prev.map(f => 
          f.uid === fileItem.uid 
            ? { ...f, status: 'uploading', percent: 0 }
            : f
        ))
        
        // 构建标题和描述
        const title = values.title || fileItem.name.split('.')[0]
        const description = values.description || `${values.contractType || '合同'} - ${title}`
        
        try {
          // 调用Alex Chen的上传接口
          const result = await contractAPI.uploadContract(
            fileItem.file!,
            title,
            description,
            (progress) => {
              setUploadProgress(prev => ({ ...prev, [fileItem.uid]: progress }))
              setFileList(prev => prev.map(f => 
                f.uid === fileItem.uid 
                  ? { ...f, percent: progress }
                  : f
              ))
            }
          )
          
          // 上传成功
          setFileList(prev => prev.map(f => 
            f.uid === fileItem.uid 
              ? { 
                  ...f, 
                  status: 'processing', 
                  percent: 100, 
                  response: result,
                  contractId: result.contract_id,
                  ocrStatus: result.ocr_status
                }
              : f
          ))
          
          message.success(`${fileItem.name} 上传成功，正在进行OCR处理...`)
          
          // 开始监控OCR状态
          monitorOcrStatus(result.contract_id, fileItem.uid)
          
        } catch (error: any) {
          console.error('Upload error:', error)
          setFileList(prev => prev.map(f => 
            f.uid === fileItem.uid 
              ? { ...f, status: 'error', error: error.response?.data || error.message }
              : f
          ))
          message.error(`${fileItem.name} 上传失败: ${error.response?.data?.message || error.message}`)
        }
      }
      
    } catch (error: any) {
      console.error('Upload process error:', error)
      message.error('上传过程中发生错误')
    } finally {
      setLoading(false)
    }
  }

  // 监控OCR处理状态
  const monitorOcrStatus = async (contractId: number, fileUid: string) => {
    const checkStatus = async () => {
      try {
        const status = await contractAPI.getOcrStatus(contractId)
        
        setFileList(prev => prev.map(f => 
          f.uid === fileUid 
            ? { ...f, ocrStatus: status.ocr_status }
            : f
        ))
        
        if (status.ocr_status === 'completed') {
          setFileList(prev => prev.map(f => 
            f.uid === fileUid 
              ? { ...f, status: 'done' }
              : f
          ))
          message.success('OCR处理完成')
        } else if (status.ocr_status === 'failed') {
          setFileList(prev => prev.map(f => 
            f.uid === fileUid 
              ? { ...f, status: 'error', error: { message: status.ocr_error || 'OCR处理失败' } }
              : f
          ))
          message.error('OCR处理失败')
        } else if (status.ocr_status === 'processing') {
          // 继续监控
          setTimeout(checkStatus, 3000)
        }
      } catch (error) {
        console.error('OCR status check error:', error)
      }
    }
    
    // 延迟2秒后开始检查
    setTimeout(checkStatus, 2000)
  }

  const handleFileChange = (info: any) => {
    let newFileList = [...info.fileList]
    
    // 限制文件数量
    newFileList = newFileList.slice(-10)
    
    // 更新文件状态，保存原始文件对象
    newFileList = newFileList.map(file => {
      return {
        ...file,
        file: file.originFileObj || file.file,
        status: file.status || 'ready'
      }
    })
    
    setFileList(newFileList)
  }

  const beforeUpload = (file: File) => {
    const isValidType = file.type === 'application/pdf' || 
                       file.type.includes('word') || 
                       file.type === 'text/plain' ||
                       file.type.startsWith('image/')
    
    if (!isValidType) {
      message.error('只支持 PDF、Word、TXT 和图片格式的文件')
      return false
    }
    
    const isLt50M = file.size / 1024 / 1024 < 50
    if (!isLt50M) {
      message.error('文件大小不能超过 50MB')
      return false
    }
    
    return false // 阻止自动上传，手动控制
  }

  // 查看OCR状态详情
  const viewOcrStatus = async (contractId: number) => {
    try {
      const status = await contractAPI.getOcrStatus(contractId)
      setOcrStatusModal({
        visible: true,
        contractId,
        status
      })
    } catch (error) {
      message.error('获取OCR状态失败')
    }
  }

  // 手动触发OCR处理
  const triggerOcrProcess = async (contractId: number, fileUid: string) => {
    try {
      await contractAPI.processOcr(contractId)
      message.success('已触发OCR处理，请稍候...')
      
      // 更新文件状态
      setFileList(prev => prev.map(f => 
        f.uid === fileUid 
          ? { ...f, status: 'processing', ocrStatus: 'processing' }
          : f
      ))
      
      // 开始监控状态
      monitorOcrStatus(contractId, fileUid)
    } catch (error: any) {
      message.error(`触发OCR处理失败: ${error.response?.data?.message || error.message}`)
    }
  }

  const removeFile = (file: UploadFile) => {
    setFileList(prev => prev.filter(f => f.uid !== file.uid))
    setUploadProgress(prev => {
      const newProgress = { ...prev }
      delete newProgress[file.uid]
      return newProgress
    })
  }

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'pdf':
        return <FileTextOutlined style={{ color: '#ff4d4f' }} />
      case 'doc':
      case 'docx':
        return <FileTextOutlined style={{ color: '#1890ff' }} />
      case 'txt':
        return <FileTextOutlined style={{ color: '#52c41a' }} />
      case 'jpg':
      case 'jpeg':
      case 'png':
        return <FileTextOutlined style={{ color: '#722ed1' }} />
      default:
        return <FileTextOutlined />
    }
  }

  const getStatusIcon = (status: string, ocrStatus?: string) => {
    if (status === 'uploading') {
      return <LoadingOutlined style={{ color: '#1890ff' }} />;
    } else if (status === 'processing') {
      return <SyncOutlined spin style={{ color: '#1890ff' }} />;
    } else if (status === 'done') {
      if (ocrStatus === 'completed') {
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      } else if (ocrStatus === 'processing') {
        return <SyncOutlined spin style={{ color: '#1890ff' }} />;
      } else if (ocrStatus === 'failed') {
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      } else {
        return <LoadingOutlined style={{ color: '#faad14' }} />;
      }
    } else if (status === 'error') {
      return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
    }
    return null;
  };

  const getStatusText = (status: string, ocrStatus?: string) => {
    if (status === 'uploading') {
      return '正在上传...';
    } else if (status === 'processing') {
      return '正在处理OCR...';
    } else if (status === 'done') {
      if (ocrStatus === 'completed') {
        return '上传成功，OCR处理完成';
      } else if (ocrStatus === 'processing') {
        return '上传成功，OCR处理中...';
      } else if (ocrStatus === 'failed') {
        return '上传成功，OCR处理失败';
      } else {
        return '上传成功，等待OCR处理';
      }
    } else if (status === 'error') {
      return '处理失败';
    }
    return '';
  };

  return (
    <UploadContainer>
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card title="上传合约文档" variant="borderless">
            <Alert
              message="上传说明"
              description="系统支持多种文件格式，会自动进行OCR识别和内容提取。请确保文件清晰可读，以获得最佳的识别效果。"
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />
            
            <Form
              form={form}
              layout="vertical"
              onFinish={handleUpload}
            >
              <Form.Item
                name="title"
                label="文档标题"
                rules={[{ required: false, message: '请输入文档标题' }]}
              >
                <Input 
                  placeholder="请输入文档标题（可选，默认使用文件名）" 
                  size="large" 
                />
              </Form.Item>
              
              <Form.Item
                name="contractType"
                label="合同类型"
              >
                <Select placeholder="请选择合同类型（可选）" size="large" allowClear>
                  {contractTypes.map(type => (
                    <Select.Option key={type} value={type}>{type}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
              
              <Form.Item
                name="description"
                label="文档描述"
              >
                <TextArea 
                  rows={3} 
                  placeholder="请输入文档的简要描述（可选，系统会自动生成）"
                />
              </Form.Item>
              
              <Form.Item label="选择文件">
                <Dragger
                  multiple
                  beforeUpload={beforeUpload}
                  onChange={handleFileChange}
                  fileList={fileList}
                  onRemove={removeFile}
                  style={{ padding: '20px' }}
                >
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
                  </p>
                  <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                  <p className="ant-upload-hint">
                    支持单个或批量上传，最多同时上传10个文件
                  </p>
                </Dragger>
              </Form.Item>
              
              {fileList.length > 0 && (
                <FileListContainer>
                  <Title level={5}>文件列表</Title>
                  <List
                    itemLayout="horizontal"
                    dataSource={fileList}
                    renderItem={(file) => (
                      <List.Item
                        actions={[
                          ...(file.contractId && file.status !== 'uploading' ? [
                            <Button 
                              type="link" 
                              icon={<EyeOutlined />}
                              onClick={() => viewOcrStatus(file.contractId!)}
                            >
                              查看状态
                            </Button>
                          ] : []),
                          ...(file.contractId && file.ocrStatus === 'failed' ? [
                            <Button 
                              type="link" 
                              icon={<SyncOutlined />}
                              onClick={() => triggerOcrProcess(file.contractId!, file.uid)}
                            >
                              重新处理
                            </Button>
                          ] : []),
                          <Button 
                            type="link" 
                            danger 
                            onClick={() => removeFile(file)}
                            disabled={file.status === 'uploading' || file.status === 'processing'}
                          >
                            移除
                          </Button>
                        ]}
                      >
                        <List.Item.Meta
                          avatar={getFileIcon(file.name)}
                          title={
                            <Space>
                              <span>{file.name}</span>
                              {getStatusIcon(file.status, file.ocrStatus)}
                              {file.ocrStatus && (
                                <Tag color={
                                  file.ocrStatus === 'completed' ? 'green' :
                                  file.ocrStatus === 'processing' ? 'blue' :
                                  file.ocrStatus === 'failed' ? 'red' : 'orange'
                                }>
                                  {file.ocrStatus === 'completed' ? '已完成' :
                                   file.ocrStatus === 'processing' ? '处理中' :
                                   file.ocrStatus === 'failed' ? '失败' : '等待中'}
                                </Tag>
                              )}
                            </Space>
                          }
                          description={
                            <div>
                              <div style={{ marginBottom: 4 }}>
                                <Text>{getStatusText(file.status, file.ocrStatus)}</Text>
                              </div>
                              {(file.status === 'uploading' || file.status === 'processing') && uploadProgress[file.uid] !== undefined && (
                                <Progress 
                                  percent={uploadProgress[file.uid]} 
                                  size="small" 
                                  style={{ marginBottom: 4 }}
                                />
                              )}
                              {file.status === 'error' && (
                                <Text type="danger">
                                  {file.error?.message || '处理失败'}
                                </Text>
                              )}
                              {file.response && (
                                <Text type="secondary">
                                  合同ID: {file.response.contract_id}
                                </Text>
                              )}
                            </div>
                          }
                        />
                      </List.Item>
                    )}
                  />
                </FileListContainer>
              )}
              
              <Form.Item style={{ marginTop: 24 }}>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  icon={<UploadOutlined />}
                  loading={loading}
                  disabled={fileList.length === 0}
                  size="large"
                  block
                >
                  开始上传
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>
        
        <Col xs={24} lg={8}>
          <Card title="支持的文件格式" variant="borderless" style={{ marginBottom: 24 }}>
            <List
              size="small"
              dataSource={supportedFormats}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<InfoCircleOutlined style={{ color: '#1890ff' }} />}
                    title={<Text strong>{item.ext}</Text>}
                    description={item.desc}
                  />
                </List.Item>
              )}
            />
          </Card>
          
          <Card title="上传注意事项" variant="borderless">
            <Space direction="vertical" size="middle">
              <div>
                <Text strong>文件要求：</Text>
                <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                  <li>单个文件大小不超过 50MB</li>
                  <li>同时最多上传 10 个文件</li>
                  <li>图片文件请确保清晰度足够</li>
                </ul>
              </div>
              
              <div>
                <Text strong>处理流程：</Text>
                <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                  <li>文件上传到服务器</li>
                  <li>自动进行OCR文字识别</li>
                  <li>提取合同关键信息</li>
                  <li>建立搜索索引</li>
                </ul>
              </div>
              
              <div>
                <Text strong>隐私保护：</Text>
                <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                  <li>所有文件加密存储</li>
                  <li>严格的访问权限控制</li>
                  <li>完整的操作日志记录</li>
                </ul>
              </div>
            </Space>
          </Card>
          </Col>
        </Row>

        {/* OCR状态查看模态框 */}
        <Modal
          title="OCR处理状态"
          open={ocrStatusModal.visible}
          onCancel={() => setOcrStatusModal({ visible: false })}
          footer={[
            <Button key="close" onClick={() => setOcrStatusModal({ visible: false })}>
              关闭
            </Button>,
            ...(ocrStatusModal.status?.ocr_status === 'failed' ? [
              <Button 
                key="retry" 
                type="primary" 
                loading={loading}
                onClick={() => {
                  if (ocrStatusModal.contractId) {
                    triggerOcrProcess(ocrStatusModal.contractId, '');
                    setOcrStatusModal({ visible: false });
                  }
                }}
              >
                重新处理
              </Button>
            ] : [])
          ]}
          width={600}
        >
          {ocrStatusModal.status && (
            <div>
              <Row gutter={[16, 16]}>
                <Col span={8}><strong>合同ID:</strong></Col>
                <Col span={16}>{ocrStatusModal.contractId}</Col>
                
                <Col span={8}><strong>OCR状态:</strong></Col>
                <Col span={16}>
                  <Tag color={
                    ocrStatusModal.status.ocr_status === 'completed' ? 'green' :
                    ocrStatusModal.status.ocr_status === 'processing' ? 'blue' :
                    ocrStatusModal.status.ocr_status === 'failed' ? 'red' : 'orange'
                  }>
                    {ocrStatusModal.status.ocr_status === 'completed' ? '已完成' :
                     ocrStatusModal.status.ocr_status === 'processing' ? '处理中' :
                     ocrStatusModal.status.ocr_status === 'failed' ? '失败' : '等待中'}
                  </Tag>
                </Col>
                
                {ocrStatusModal.status.processed_at && (
                  <>
                    <Col span={8}><strong>处理时间:</strong></Col>
                    <Col span={16}>{new Date(ocrStatusModal.status.processed_at).toLocaleString()}</Col>
                  </>
                )}
                
                {ocrStatusModal.status.ocr_error && (
                  <>
                    <Col span={8}><strong>错误信息:</strong></Col>
                    <Col span={16}>
                      <Alert 
                        message={ocrStatusModal.status.ocr_error} 
                        type="error" 
                        showIcon 
                        style={{ marginTop: 8 }}
                      />
                    </Col>
                  </>
                )}
                
                {ocrStatusModal.status.ocr_content && (
                  <>
                    <Col span={24}>
                      <Divider>OCR识别内容</Divider>
                      <div style={{ 
                        maxHeight: '300px', 
                        overflow: 'auto', 
                        padding: '12px', 
                        backgroundColor: '#f5f5f5', 
                        borderRadius: '6px',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {ocrStatusModal.status.ocr_content}
                      </div>
                    </Col>
                  </>
                )}
              </Row>
            </div>
          )}
        </Modal>
      </UploadContainer>
    )
}

const UploadContainer = styled.div`
  .ant-upload-drag {
    border: 2px dashed #d9d9d9;
    border-radius: 8px;
    background: #fafafa;
    transition: all 0.3s;
    
    &:hover {
      border-color: #1890ff;
      background: #f0f8ff;
    }
  }
  
  .ant-upload-drag.ant-upload-drag-hover {
    border-color: #1890ff;
    background: #f0f8ff;
  }
`

const FileListContainer = styled.div`
  margin-top: 16px;
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
  
  .ant-list-item {
    padding: 12px 0;
    border-bottom: 1px solid #f0f0f0;
    
    &:last-child {
      border-bottom: none;
    }
  }
`

export default UploadPage