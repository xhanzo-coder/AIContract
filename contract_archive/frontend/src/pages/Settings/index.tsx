import React, { useState } from 'react'
import { 
  Card, 
  Form, 
  Input, 
  Switch, 
  Button, 
  Select, 
  Divider, 
  Typography, 
  Space, 
  message,
  Row,
  Col,
  Alert,
  Modal,
  Table,
  Tag,
  Popconfirm
} from 'antd'
import { 
  SettingOutlined, 
  UserOutlined, 
  BellOutlined, 
  SecurityScanOutlined,
  DatabaseOutlined,
  ExportOutlined,
  ImportOutlined,
  DeleteOutlined,
  PlusOutlined,
  EditOutlined
} from '@ant-design/icons'
import styled from 'styled-components'

const { Title, Paragraph, Text } = Typography
const { TextArea } = Input

interface User {
  id: string
  username: string
  email: string
  role: string
  status: 'active' | 'inactive'
  lastLogin: string
}

const Settings: React.FC = () => {
  const [form] = Form.useForm()
  const [userForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [userModalVisible, setUserModalVisible] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  // 模拟用户数据
  const [users, setUsers] = useState<User[]>([
    {
      id: '1',
      username: 'admin',
      email: 'admin@example.com',
      role: 'administrator',
      status: 'active',
      lastLogin: '2024-01-15 10:30:00'
    },
    {
      id: '2',
      username: 'user1',
      email: 'user1@example.com',
      role: 'user',
      status: 'active',
      lastLogin: '2024-01-14 16:45:00'
    },
    {
      id: '3',
      username: 'user2',
      email: 'user2@example.com',
      role: 'user',
      status: 'inactive',
      lastLogin: '2024-01-10 09:15:00'
    }
  ])

  const handleSystemSettingsSave = async (values: any) => {
    setLoading(true)
    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000))
      message.success('系统设置保存成功')
    } catch (error) {
      message.error('保存失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleUserSave = async (values: any) => {
    try {
      if (editingUser) {
        // 编辑用户
        setUsers(prev => prev.map(user => 
          user.id === editingUser.id 
            ? { ...user, ...values }
            : user
        ))
        message.success('用户信息更新成功')
      } else {
        // 新增用户
        const newUser: User = {
          id: Date.now().toString(),
          ...values,
          status: 'active',
          lastLogin: '-'
        }
        setUsers(prev => [...prev, newUser])
        message.success('用户创建成功')
      }
      setUserModalVisible(false)
      setEditingUser(null)
      userForm.resetFields()
    } catch (error) {
      message.error('操作失败，请重试')
    }
  }

  const handleUserDelete = (userId: string) => {
    setUsers(prev => prev.filter(user => user.id !== userId))
    message.success('用户删除成功')
  }

  const handleUserEdit = (user: User) => {
    setEditingUser(user)
    userForm.setFieldsValue(user)
    setUserModalVisible(true)
  }

  const handleUserAdd = () => {
    setEditingUser(null)
    userForm.resetFields()
    setUserModalVisible(true)
  }

  const handleExportData = () => {
    message.info('数据导出功能开发中...')
  }

  const handleImportData = () => {
    message.info('数据导入功能开发中...')
  }

  const handleClearCache = () => {
    message.success('缓存清理成功')
  }

  const userColumns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email'
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Tag color={role === 'administrator' ? 'red' : 'blue'}>
          {role === 'administrator' ? '管理员' : '普通用户'}
        </Tag>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>
          {status === 'active' ? '活跃' : '禁用'}
        </Tag>
      )
    },
    {
      title: '最后登录',
      dataIndex: 'lastLogin',
      key: 'lastLogin'
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record: User) => (
        <Space>
          <Button 
            type="link" 
            icon={<EditOutlined />}
            onClick={() => handleUserEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个用户吗？"
            onConfirm={() => handleUserDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button 
              type="link" 
              danger 
              icon={<DeleteOutlined />}
              disabled={record.role === 'administrator'}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <SettingsContainer>
      <Title level={3}>系统设置</Title>
      
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          {/* 基本设置 */}
          <Card title={<><SettingOutlined /> 基本设置</>} bordered={false}>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSystemSettingsSave}
              initialValues={{
                systemName: '合约档案智能检索系统',
                maxFileSize: 50,
                maxFilesPerUpload: 10,
                enableOCR: true,
                enableNotifications: true,
                autoBackup: true,
                backupFrequency: 'daily',
                searchResultsPerPage: 20,
                sessionTimeout: 30
              }}
            >
              <Form.Item
                name="systemName"
                label="系统名称"
                rules={[{ required: true, message: '请输入系统名称' }]}
              >
                <Input placeholder="请输入系统名称" />
              </Form.Item>
              
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="maxFileSize"
                    label="最大文件大小 (MB)"
                    rules={[{ required: true, message: '请输入最大文件大小' }]}
                  >
                    <Input type="number" min={1} max={100} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="maxFilesPerUpload"
                    label="单次最大上传文件数"
                    rules={[{ required: true, message: '请输入最大文件数' }]}
                  >
                    <Input type="number" min={1} max={50} />
                  </Form.Item>
                </Col>
              </Row>
              
              <Form.Item name="enableOCR" label="启用OCR文字识别" valuePropName="checked">
                <Switch />
              </Form.Item>
              
              <Form.Item name="enableNotifications" label="启用系统通知" valuePropName="checked">
                <Switch />
              </Form.Item>
              
              <Form.Item name="autoBackup" label="自动备份" valuePropName="checked">
                <Switch />
              </Form.Item>
              
              <Form.Item name="backupFrequency" label="备份频率">
                <Select>
                  <Select.Option value="daily">每日</Select.Option>
                  <Select.Option value="weekly">每周</Select.Option>
                  <Select.Option value="monthly">每月</Select.Option>
                </Select>
              </Form.Item>
              
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="searchResultsPerPage" label="搜索结果每页显示数">
                    <Select>
                      <Select.Option value={10}>10条</Select.Option>
                      <Select.Option value={20}>20条</Select.Option>
                      <Select.Option value={50}>50条</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="sessionTimeout" label="会话超时 (分钟)">
                    <Input type="number" min={5} max={120} />
                  </Form.Item>
                </Col>
              </Row>
              
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} block>
                  保存设置
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>
        
        <Col xs={24} lg={12}>
          {/* 安全设置 */}
          <Card title={<><SecurityScanOutlined /> 安全设置</>} bordered={false} style={{ marginBottom: 24 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <Text strong>密码策略</Text>
                <Paragraph type="secondary">
                  密码长度至少8位，包含大小写字母、数字和特殊字符
                </Paragraph>
              </div>
              
              <div>
                <Text strong>登录安全</Text>
                <Paragraph type="secondary">
                  连续登录失败5次将锁定账户30分钟
                </Paragraph>
              </div>
              
              <div>
                <Text strong>数据加密</Text>
                <Paragraph type="secondary">
                  所有上传文件采用AES-256加密存储
                </Paragraph>
              </div>
              
              <Button type="primary" ghost block>
                修改安全策略
              </Button>
            </Space>
          </Card>
          
          {/* 数据管理 */}
          <Card title={<><DatabaseOutlined /> 数据管理</>} bordered={false}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Alert
                message="数据备份"
                description="系统会自动备份重要数据，您也可以手动创建备份"
                type="info"
                showIcon
              />
              
              <Row gutter={8}>
                <Col span={12}>
                  <Button 
                    icon={<ExportOutlined />} 
                    onClick={handleExportData}
                    block
                  >
                    导出数据
                  </Button>
                </Col>
                <Col span={12}>
                  <Button 
                    icon={<ImportOutlined />} 
                    onClick={handleImportData}
                    block
                  >
                    导入数据
                  </Button>
                </Col>
              </Row>
              
              <Divider />
              
              <Alert
                message="缓存管理"
                description="清理系统缓存可以释放存储空间，提升系统性能"
                type="warning"
                showIcon
              />
              
              <Button 
                danger 
                onClick={handleClearCache}
                block
              >
                清理缓存
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
      
      {/* 用户管理 */}
      <Card 
        title={<><UserOutlined /> 用户管理</>} 
        bordered={false} 
        style={{ marginTop: 24 }}
        extra={
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={handleUserAdd}
          >
            添加用户
          </Button>
        }
      >
        <Table
          dataSource={users}
          columns={userColumns}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 个用户`
          }}
        />
      </Card>
      
      {/* 用户编辑模态框 */}
      <Modal
        title={editingUser ? '编辑用户' : '添加用户'}
        open={userModalVisible}
        onCancel={() => {
          setUserModalVisible(false)
          setEditingUser(null)
          userForm.resetFields()
        }}
        footer={null}
        width={500}
      >
        <Form
          form={userForm}
          layout="vertical"
          onFinish={handleUserSave}
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>
          
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>
          
          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select placeholder="请选择角色">
              <Select.Option value="user">普通用户</Select.Option>
              <Select.Option value="administrator">管理员</Select.Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select placeholder="请选择状态">
              <Select.Option value="active">活跃</Select.Option>
              <Select.Option value="inactive">禁用</Select.Option>
            </Select>
          </Form.Item>
          
          {!editingUser && (
            <Form.Item
              name="password"
              label="密码"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 8, message: '密码长度至少8位' }
              ]}
            >
              <Input.Password placeholder="请输入密码" />
            </Form.Item>
          )}
          
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setUserModalVisible(false)
                setEditingUser(null)
                userForm.resetFields()
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                {editingUser ? '更新' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </SettingsContainer>
  )
}

const SettingsContainer = styled.div`
  .ant-card-head-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .ant-table-tbody > tr > td {
    padding: 12px 16px;
  }
`

export default Settings