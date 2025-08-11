import React, { useState, useEffect } from 'react'
import { Button, Tooltip, Space, message } from 'antd'
import { 
  CheckCircleOutlined, 
  ExclamationCircleOutlined, 
  LoadingOutlined,
  ReloadOutlined 
} from '@ant-design/icons'
import styled from 'styled-components'
import { elasticsearchAPI } from '../../services/api'

interface ElasticsearchStatusProps {
  className?: string
}

interface ElasticsearchStatus {
  connected: boolean
  index_exists: boolean
  document_count: number
  last_sync?: string
}

const ElasticsearchStatus: React.FC<ElasticsearchStatusProps> = ({ className }) => {
  const [status, setStatus] = useState<ElasticsearchStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(false)

  // 检查Elasticsearch状态
  const checkStatus = async () => {
    try {
      setLoading(true)
      const statusResponse = await elasticsearchAPI.checkStatus()
      
      if (statusResponse.success && statusResponse.data) {
        const connected = statusResponse.data.status === 'available'
        
        if (connected) {
          // 如果连接正常，检查索引状态
          try {
            const initResponse = await elasticsearchAPI.initializeIndex()
            const indexExists = initResponse.success && initResponse.data && 
              (initResponse.data.contracts_index_created || initResponse.data.contents_index_created)
            
            // 获取实际的文档数量
            let documentCount = 0
            try {
              const syncStatusResponse = await fetch('/api/v1/contracts/elasticsearch/sync-status')
              if (syncStatusResponse.ok) {
                const syncData = await syncStatusResponse.json()
                if (syncData.success && syncData.data) {
                  // 新的接口返回格式：统计已同步完成的合同数量
                  const contracts = syncData.data.contracts || []
                  documentCount = contracts.filter((contract: any) => contract.sync_complete).length
                }
              }
            } catch (syncError) {
              console.warn('获取同步状态失败:', syncError)
            }
            
            setStatus({
              connected: true,
              index_exists: indexExists,
              document_count: documentCount
            })
          } catch (initError) {
            // 如果初始化API调用失败，假设索引不存在
            setStatus({
              connected: true,
              index_exists: false,
              document_count: 0
            })
          }
        } else {
          setStatus({
            connected: false,
            index_exists: false,
            document_count: 0
          })
        }
      } else {
        setStatus({
          connected: false,
          index_exists: false,
          document_count: 0
        })
      }
    } catch (error) {
      console.error('检查Elasticsearch状态失败:', error)
      setStatus({
        connected: false,
        index_exists: false,
        document_count: 0
      })
    } finally {
      setLoading(false)
    }
  }

  // 手动初始化Elasticsearch
  const handleInitialize = async () => {
    try {
      setInitializing(true)
      const response = await elasticsearchAPI.initializeIndex()
      if (response.success) {
        // 根据初始化API返回的数据判断索引是否真正创建
        if (response.data && (response.data.contracts_index_created || response.data.contents_index_created)) {
          message.success(response.message || 'Elasticsearch索引初始化成功')
          setStatus(prev => prev ? {
            ...prev,
            index_exists: true
          } : null)
        } else {
          // 虽然API调用成功，但索引没有创建
          message.warning('Elasticsearch连接正常，但索引未创建。可能需要检查后端配置。')
          setStatus(prev => prev ? {
            ...prev,
            index_exists: false
          } : null)
        }
        await checkStatus() // 重新检查连接状态
      } else {
        message.error(response.message || 'Elasticsearch初始化失败')
      }
    } catch (error) {
      console.error('Elasticsearch初始化失败:', error)
      message.error('Elasticsearch初始化失败')
    } finally {
      setInitializing(false)
    }
  }

  // 组件挂载时检查状态
  useEffect(() => {
    checkStatus()
    // 每30秒自动检查一次状态
    const interval = setInterval(checkStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  // 获取状态指示器
  const getStatusIndicator = () => {
    if (loading) {
      return (
        <StatusIndicator>
          <LoadingOutlined style={{ color: '#1890ff' }} />
          <StatusText>检查中...</StatusText>
        </StatusIndicator>
      )
    }

    if (!status) {
      return (
        <StatusIndicator>
          <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
          <StatusText>未知状态</StatusText>
        </StatusIndicator>
      )
    }

    if (!status.connected) {
      return (
        <Tooltip title="Elasticsearch服务未连接">
          <StatusIndicator>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            <StatusText>ES未连接</StatusText>
          </StatusIndicator>
        </Tooltip>
      )
    }

    if (!status.index_exists) {
      return (
        <Tooltip title="Elasticsearch索引未创建">
          <StatusIndicator>
            <ExclamationCircleOutlined style={{ color: '#faad14' }} />
            <StatusText>索引未创建</StatusText>
          </StatusIndicator>
        </Tooltip>
      )
    }

    return (
      <Tooltip title={`Elasticsearch正常运行，已索引${status.document_count}个文档`}>
        <StatusIndicator>
          <CheckCircleOutlined style={{ color: '#52c41a' }} />
          <StatusText>ES正常 ({status.document_count})</StatusText>
        </StatusIndicator>
      </Tooltip>
    )
  }

  return (
    <Container className={className}>
      <Space size="small">
        {getStatusIndicator()}
        <Button
          type="text"
          size="small"
          icon={<ReloadOutlined />}
          loading={initializing}
          onClick={handleInitialize}
          style={{ color: 'white' }}
          title="重新初始化Elasticsearch"
        >
          初始化
        </Button>
      </Space>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  align-items: center;
`

const StatusIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
`

const StatusText = styled.span`
  color: white;
  font-size: 12px;
  font-weight: 500;
`

export default ElasticsearchStatus