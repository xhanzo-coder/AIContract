import React from 'react'
import { Spin } from 'antd'
import styled from 'styled-components'

interface LoadingProps {
  size?: 'small' | 'default' | 'large'
  tip?: string
  spinning?: boolean
  children?: React.ReactNode
}

const Loading: React.FC<LoadingProps> = ({ 
  size = 'default', 
  tip = '加载中...', 
  spinning = true,
  children 
}) => {
  if (children) {
    return (
      <Spin size={size} tip={tip} spinning={spinning}>
        {children}
      </Spin>
    )
  }

  return (
    <LoadingContainer>
      <Spin size={size} tip={tip} />
    </LoadingContainer>
  )
}

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
  width: 100%;
`

export default Loading