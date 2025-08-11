import React, { useState, useEffect } from 'react'
import { Layout, Menu, Button, Avatar, Dropdown, Badge, theme } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import {
  HomeOutlined,
  SearchOutlined,
  UploadOutlined,
  BarChartOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined
} from '@ant-design/icons'
import styled from 'styled-components'
import { RootState } from '../../store'
import ElasticsearchStatus from '../ElasticsearchStatus'

const { Header, Content } = Layout

interface AppLayoutProps {
  children: React.ReactNode
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { token } = theme.useToken()
  
  const notifications = useSelector((state: RootState) => state.ui.notifications)
  
  const [selectedKeys, setSelectedKeys] = useState<string[]>(['home'])

  useEffect(() => {
    const path = location.pathname
    if (path === '/') setSelectedKeys(['home'])
    else if (path.includes('/search')) setSelectedKeys(['search'])
    else if (path.includes('/upload')) setSelectedKeys(['upload'])
    else if (path.includes('/statistics')) setSelectedKeys(['statistics'])
    else if (path.includes('/settings')) setSelectedKeys(['settings'])
  }, [location.pathname])

  const menuItems = [
    {
      key: 'home',
      label: '首页',
      onClick: () => navigate('/')
    },
    {
      key: 'upload',
      label: '文档上传',
      onClick: () => navigate('/upload')
    },
    {
      key: 'search',
      label: '文件管理',
      onClick: () => navigate('/search')
    },
    {
      key: 'statistics',
      label: '使用统计',
      onClick: () => navigate('/statistics')
    },
    {
      key: 'settings',
      label: '系统设置',
      onClick: () => navigate('/settings')
    }
  ]

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人资料'
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '账户设置'
    },
    {
      type: 'divider'
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录'
    }
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ 
        padding: '15px 20px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 999,
        width: '100%',
        background: '#2d3748',
        borderBottom: 'none',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
      }}>
        {/* Logo */}
        <LogoContainer onClick={() => navigate('/')}>
          📋 合约档案智能检索
        </LogoContainer>
        
        {/* 导航菜单 */}
        <NavMenu>
          <Menu
            mode="horizontal"
            selectedKeys={selectedKeys}
            items={menuItems}
            style={{ 
              border: 'none',
              background: 'transparent',
              fontSize: '14px'
            }}
          />
        </NavMenu>
        
        {/* Elasticsearch状态 */}
        <ElasticsearchStatus />
        
        {/* 用户信息 */}
        <UserInfo>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" arrow>
            <UserSection>
              <UserOutlined style={{ marginRight: '8px' }} />
              <span>用户</span>
            </UserSection>
          </Dropdown>
        </UserInfo>
      </Header>
      
      <Content style={{ 
        padding: 0,
        overflow: 'initial',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e0 100%)'
      }}>
        {children}
      </Content>
    </Layout>
  )
}

const LogoContainer = styled.div`
  font-size: 1.2rem;
  font-weight: 700;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  
  &:hover {
    color: rgba(255, 255, 255, 0.8);
  }
`

const NavMenu = styled.div`
  flex: 1;
  display: flex;
  justify-content: center;
  
  .ant-menu-horizontal {
    line-height: 64px;
    background: transparent;
    border-bottom: none;
  }
  
  .ant-menu-item {
    color: white !important;
    font-weight: 500;
    padding: 8px 16px;
    border-radius: 6px;
    margin: 0 2px;
    transition: all 0.3s ease;
    border-bottom: none !important;
    
    &:hover {
      background: rgba(255, 255, 255, 0.1) !important;
      color: white !important;
    }
    
    &.ant-menu-item-selected {
      background: rgba(255, 255, 255, 0.2) !important;
      color: white !important;
    }
    
    &::after {
      display: none !important;
    }
  }
`

const UserInfo = styled.div`
  display: flex;
  align-items: center;
`

const UserSection = styled.div`
  display: flex;
  align-items: center;
  color: white;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.9rem;
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }
`

export default AppLayout