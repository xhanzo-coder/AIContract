import React, { useEffect, useState } from 'react'
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Table, 
  Select, 
  DatePicker, 
  Space, 
  Typography,
  Tag,
  Progress,
  List,
  Avatar,
  Tooltip
} from 'antd'
import { 
  FileTextOutlined, 
  SearchOutlined, 
  UploadOutlined, 
  DownloadOutlined,
  RiseOutlined,
  FallOutlined,
  UserOutlined,
  ClockCircleOutlined
} from '@ant-design/icons'
import { useSelector, useDispatch } from 'react-redux'
import styled from 'styled-components'
import { RootState } from '../../store'
import { fetchStatistics } from '../../store/slices/contractSlice'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

// 模拟图表组件（实际项目中可以使用 recharts 或 antv/g2）
const SimpleChart: React.FC<{ data: any[], type: 'line' | 'bar' }> = ({ data, type }) => {
  return (
    <div style={{ height: 200, display: 'flex', alignItems: 'end', justifyContent: 'space-around', padding: '20px 0' }}>
      {data.map((item, index) => (
        <div key={index} style={{ textAlign: 'center', flex: 1 }}>
          <div 
            style={{ 
              height: `${(item.value / Math.max(...data.map(d => d.value))) * 150}px`,
              backgroundColor: '#1890ff',
              margin: '0 2px',
              borderRadius: type === 'bar' ? '4px 4px 0 0' : '50%',
              width: type === 'line' ? '4px' : 'auto'
            }}
          />
          <div style={{ fontSize: '12px', marginTop: '8px' }}>{item.label}</div>
          <div style={{ fontSize: '10px', color: '#999' }}>{item.value}</div>
        </div>
      ))}
    </div>
  )
}

const Statistics: React.FC = () => {
  const dispatch = useDispatch()
  const { statistics, loading } = useSelector((state: RootState) => state.contract)
  
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month')
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)

  useEffect(() => {
    dispatch(fetchStatistics())
  }, [dispatch])

  // 模拟数据
  const mockData = {
    overview: {
      totalDocuments: 1248,
      totalSearches: 5632,
      totalUploads: 89,
      totalDownloads: 234,
      growthRate: {
        documents: 12.5,
        searches: 8.3,
        uploads: -2.1,
        downloads: 15.7
      }
    },
    uploadTrend: [
      { label: '1月', value: 45 },
      { label: '2月', value: 52 },
      { label: '3月', value: 38 },
      { label: '4月', value: 61 },
      { label: '5月', value: 49 },
      { label: '6月', value: 73 }
    ],
    searchTrend: [
      { label: '周一', value: 120 },
      { label: '周二', value: 98 },
      { label: '周三', value: 145 },
      { label: '周四', value: 132 },
      { label: '周五', value: 156 },
      { label: '周六', value: 89 },
      { label: '周日', value: 67 }
    ],
    contractTypes: [
      { type: '租赁合同', count: 342, percentage: 27.4 },
      { type: '采购合同', count: 298, percentage: 23.9 },
      { type: '劳务合同', count: 234, percentage: 18.7 },
      { type: '销售合同', count: 189, percentage: 15.1 },
      { type: '技术服务合同', count: 123, percentage: 9.9 },
      { type: '其他', count: 62, percentage: 5.0 }
    ],
    topSearches: [
      { query: '租赁合同违约条款', count: 89, trend: 'up' },
      { query: '采购合同付款方式', count: 76, trend: 'up' },
      { query: '劳务合同工资标准', count: 65, trend: 'down' },
      { query: '销售合同交付时间', count: 54, trend: 'up' },
      { query: '技术服务合同保密条款', count: 43, trend: 'stable' }
    ],
    recentActivities: [
      { user: '张三', action: '上传了租赁合同', time: '2分钟前', type: 'upload' },
      { user: '李四', action: '搜索了"违约金条款"', time: '5分钟前', type: 'search' },
      { user: '王五', action: '下载了采购合同', time: '8分钟前', type: 'download' },
      { user: '赵六', action: '上传了劳务合同', time: '12分钟前', type: 'upload' },
      { user: '钱七', action: '搜索了"付款条件"', time: '15分钟前', type: 'search' }
    ]
  }

  const contractTypeColumns = [
    {
      title: '合同类型',
      dataIndex: 'type',
      key: 'type',
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: '数量',
      dataIndex: 'count',
      key: 'count',
      render: (count: number) => <Text>{count}</Text>
    },
    {
      title: '占比',
      dataIndex: 'percentage',
      key: 'percentage',
      render: (percentage: number) => (
        <Space>
          <Progress 
            percent={percentage} 
            size="small" 
            style={{ width: 100 }}
            showInfo={false}
          />
          <Text>{percentage}%</Text>
        </Space>
      )
    }
  ]

  const searchColumns = [
    {
      title: '搜索内容',
      dataIndex: 'query',
      key: 'query',
      render: (text: string) => <Text>{text}</Text>
    },
    {
      title: '搜索次数',
      dataIndex: 'count',
      key: 'count',
      render: (count: number) => <Text strong>{count}</Text>
    },
    {
      title: '趋势',
      dataIndex: 'trend',
      key: 'trend',
      render: (trend: string) => {
        const icons = {
          up: <RiseOutlined style={{ color: '#52c41a' }} />,
          down: <FallOutlined style={{ color: '#ff4d4f' }} />,
          stable: <Text style={{ color: '#999' }}>-</Text>
        }
        return icons[trend as keyof typeof icons]
      }
    }
  ]

  const getActivityIcon = (type: string) => {
    const icons = {
      upload: <UploadOutlined style={{ color: '#52c41a' }} />,
      search: <SearchOutlined style={{ color: '#1890ff' }} />,
      download: <DownloadOutlined style={{ color: '#722ed1' }} />
    }
    return icons[type as keyof typeof icons] || <FileTextOutlined />
  }

  const getGrowthIcon = (rate: number) => {
    return rate > 0 
      ? <RiseOutlined style={{ color: '#52c41a' }} />
      : <FallOutlined style={{ color: '#ff4d4f' }} />
  }

  const getGrowthColor = (rate: number) => {
    return rate > 0 ? '#52c41a' : '#ff4d4f'
  }

  return (
    <StatisticsContainer>
      <Title level={3}>使用统计</Title>
      
      {/* 时间筛选 */}
      <Card variant="borderless" style={{ marginBottom: 24 }}>
        <Space>
          <Text>时间范围：</Text>
          <Select
            value={timeRange}
            onChange={setTimeRange}
            style={{ width: 120 }}
          >
            <Select.Option value="week">最近一周</Select.Option>
            <Select.Option value="month">最近一月</Select.Option>
            <Select.Option value="quarter">最近一季</Select.Option>
            <Select.Option value="year">最近一年</Select.Option>
          </Select>
          <RangePicker
            value={dateRange}
            onChange={setDateRange}
            placeholder={['开始日期', '结束日期']}
          />
        </Space>
      </Card>

      {/* 概览统计 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="总文档数"
              value={mockData.overview.totalDocuments}
              prefix={<FileTextOutlined />}
              suffix={
                <Tooltip title={`较上期${mockData.overview.growthRate.documents > 0 ? '增长' : '下降'} ${Math.abs(mockData.overview.growthRate.documents)}%`}>
                  <Space>
                    {getGrowthIcon(mockData.overview.growthRate.documents)}
                    <Text style={{ color: getGrowthColor(mockData.overview.growthRate.documents), fontSize: '12px' }}>
                      {Math.abs(mockData.overview.growthRate.documents)}%
                    </Text>
                  </Space>
                </Tooltip>
              }
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="总搜索次数"
              value={mockData.overview.totalSearches}
              prefix={<SearchOutlined />}
              suffix={
                <Tooltip title={`较上期${mockData.overview.growthRate.searches > 0 ? '增长' : '下降'} ${Math.abs(mockData.overview.growthRate.searches)}%`}>
                  <Space>
                    {getGrowthIcon(mockData.overview.growthRate.searches)}
                    <Text style={{ color: getGrowthColor(mockData.overview.growthRate.searches), fontSize: '12px' }}>
                      {Math.abs(mockData.overview.growthRate.searches)}%
                    </Text>
                  </Space>
                </Tooltip>
              }
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="总上传次数"
              value={mockData.overview.totalUploads}
              prefix={<UploadOutlined />}
              suffix={
                <Tooltip title={`较上期${mockData.overview.growthRate.uploads > 0 ? '增长' : '下降'} ${Math.abs(mockData.overview.growthRate.uploads)}%`}>
                  <Space>
                    {getGrowthIcon(mockData.overview.growthRate.uploads)}
                    <Text style={{ color: getGrowthColor(mockData.overview.growthRate.uploads), fontSize: '12px' }}>
                      {Math.abs(mockData.overview.growthRate.uploads)}%
                    </Text>
                  </Space>
                </Tooltip>
              }
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="总下载次数"
              value={mockData.overview.totalDownloads}
              prefix={<DownloadOutlined />}
              suffix={
                <Tooltip title={`较上期${mockData.overview.growthRate.downloads > 0 ? '增长' : '下降'} ${Math.abs(mockData.overview.growthRate.downloads)}%`}>
                  <Space>
                    {getGrowthIcon(mockData.overview.growthRate.downloads)}
                    <Text style={{ color: getGrowthColor(mockData.overview.growthRate.downloads), fontSize: '12px' }}>
                      {Math.abs(mockData.overview.growthRate.downloads)}%
                    </Text>
                  </Space>
                </Tooltip>
              }
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* 左侧图表区域 */}
        <Col xs={24} lg={16}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card title="文档上传趋势" variant="borderless">
                <SimpleChart data={mockData.uploadTrend} type="bar" />
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card title="搜索活跃度" variant="borderless">
                <SimpleChart data={mockData.searchTrend} type="line" />
              </Card>
            </Col>
            <Col xs={24}>
              <Card title="合同类型分布" variant="borderless">
                <Table
                  dataSource={mockData.contractTypes}
                  columns={contractTypeColumns}
                  pagination={false}
                  size="small"
                  rowKey="type"
                />
              </Card>
            </Col>
            <Col xs={24}>
              <Card title="热门搜索" variant="borderless">
                <Table
                  dataSource={mockData.topSearches}
                  columns={searchColumns}
                  pagination={false}
                  size="small"
                  rowKey="query"
                />
              </Card>
            </Col>
          </Row>
        </Col>

        {/* 右侧活动面板 */}
        <Col xs={24} lg={8}>
          <Card title="实时活动" variant="borderless">
            <List
              itemLayout="horizontal"
              dataSource={mockData.recentActivities}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar icon={getActivityIcon(item.type)} />}
                    title={
                      <Space>
                        <UserOutlined style={{ fontSize: '12px' }} />
                        <Text strong style={{ fontSize: '14px' }}>{item.user}</Text>
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={0}>
                        <Text style={{ fontSize: '13px' }}>{item.action}</Text>
                        <Space>
                          <ClockCircleOutlined style={{ fontSize: '11px', color: '#999' }} />
                          <Text style={{ fontSize: '11px', color: '#999' }}>{item.time}</Text>
                        </Space>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </StatisticsContainer>
  )
}

const StatisticsContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e0 100%);
  padding: 24px;
  
  .ant-card {
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(102, 126, 234, 0.2);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border-radius: 12px;
  }
  
  .ant-statistic-content {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .ant-table-tbody > tr > td {
    padding: 8px 16px;
  }
  
  .ant-list-item {
    padding: 12px 0;
    border-bottom: 1px solid #f5f5f5;
    
    &:last-child {
      border-bottom: none;
    }
  }
  
  .ant-card-head-title {
    font-weight: 600;
  }
`

export default Statistics