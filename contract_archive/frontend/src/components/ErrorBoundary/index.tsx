import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Result, Button } from 'antd'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleGoHome = () => {
    window.location.href = '/'
  }

  public render() {
    if (this.state.hasError) {
      return (
        <Result
          status="500"
          title="页面出现错误"
          subTitle="抱歉，页面发生了意外错误。请尝试刷新页面或返回首页。"
          extra={[
            <Button type="primary" onClick={this.handleReload} key="reload">
              刷新页面
            </Button>,
            <Button onClick={this.handleGoHome} key="home">
              返回首页
            </Button>
          ]}
        />
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary