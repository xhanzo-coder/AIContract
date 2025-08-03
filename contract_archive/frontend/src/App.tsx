import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { Layout } from 'antd'
import AppLayout from './components/Layout/AppLayout'
import ErrorBoundary from './components/ErrorBoundary'
import Home from './pages/Home'
import Search from './pages/Search'
import Upload from './pages/Upload'
import Statistics from './pages/Statistics'
import Settings from './pages/Settings'

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <Layout style={{ minHeight: '100vh' }}>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/statistics" element={<Statistics />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </AppLayout>
      </Layout>
    </ErrorBoundary>
  )
}

export default App