import React from 'react';
import { Card, Row, Col, Statistic, List, Avatar, Input, Button, Space, Tag } from 'antd';
import { 
  FileTextOutlined, 
  SearchOutlined, 
  RiseOutlined, 
  DownloadOutlined,
  UserOutlined,
  ClockCircleOutlined,
  UploadOutlined,
  BarChartOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined
} from '@ant-design/icons';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../../store';
import styled from 'styled-components';

const { Search } = Input;

const Home: React.FC = () => {
  const { searchHistory } = useSelector((state: RootState) => state.search);
  const navigate = useNavigate();

  const recentActivities = [
    {
      id: 1,
      type: 'upload',
      title: '新增文档：租赁合同-办公楼A座.pdf',
      time: '2小时前',
      icon: '📄'
    },
    {
      id: 2,
      type: 'search',
      title: '搜索问题：违约责任条款有哪些？',
      time: '4小时前',
      icon: '🔍'
    },
    {
      id: 3,
      type: 'qa',
      title: '智能问答：合同期限相关问题',
      time: '1天前',
      icon: '💬'
    }
  ];

  const handleSearch = (value: string) => {
    if (value.trim()) {
      navigate(`/search?q=${encodeURIComponent(value)}`);
    }
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'upload':
        navigate('/upload');
        break;
      case 'search':
        navigate('/search');
        break;
      case 'statistics':
        navigate('/statistics');
        break;
    }
  };

  return (
    <HomeContainer>
      {/* 搜索英雄区域 */}
      <SearchHero>
        <h1>智能文档检索问答</h1>
        <p>快速搜索文档内容，获得智能问答</p>
        
        <SearchContainer>
          <Search
            placeholder="🔍 输入关键词或问题，如：租赁期限是多久？"
            allowClear
            enterButton={<Button type="primary" className="search-btn">搜索</Button>}
            size="large"
            onSearch={handleSearch}
            className="search-input-large"
          />
        </SearchContainer>
        
        <SearchSuggestions>
          <Tag className="suggestion-tag">违约条款</Tag>
          <Tag className="suggestion-tag">付款方式</Tag>
          <Tag className="suggestion-tag">合同期限</Tag>
          <Tag className="suggestion-tag">责任条款</Tag>
        </SearchSuggestions>
      </SearchHero>

      {/* 快捷操作 */}
      <QuickActions>
        <ActionCard hoverable onClick={() => handleQuickAction('upload')}>
          <div className="action-icon">📤</div>
          <h3>上传文档</h3>
          <p>上传合约文档进行智能解析</p>
          <Button type="primary" className="action-btn">立即上传</Button>
        </ActionCard>
        
        <ActionCard hoverable onClick={() => handleQuickAction('search')}>
          <div className="action-icon">🔍</div>
          <h3>高级搜索</h3>
          <p>使用筛选条件精确搜索</p>
          <Button type="primary" className="action-btn">开始搜索</Button>
        </ActionCard>
        
        <ActionCard hoverable onClick={() => handleQuickAction('statistics')}>
          <div className="action-icon">📊</div>
          <h3>使用统计</h3>
          <p>查看文档和搜索统计</p>
          <Button type="primary" className="action-btn">查看统计</Button>
        </ActionCard>
      </QuickActions>

      {/* 概览统计 */}
      <OverviewStats>
        <StatCard>
          <div className="stat-number">1,234</div>
          <div className="stat-label">总文档数</div>
          <div className="stat-trend positive">
            <ArrowUpOutlined /> +12%
          </div>
        </StatCard>
        
        <StatCard>
          <div className="stat-number">856</div>
          <div className="stat-label">本月搜索</div>
          <div className="stat-trend positive">
            <ArrowUpOutlined /> +8%
          </div>
        </StatCard>
        
        <StatCard>
          <div className="stat-number">98.5%</div>
          <div className="stat-label">搜索准确率</div>
          <div className="stat-trend positive">
            <ArrowUpOutlined /> +2%
          </div>
        </StatCard>
        
        <StatCard>
          <div className="stat-number">2.3s</div>
          <div className="stat-label">平均响应时间</div>
          <div className="stat-trend negative">
            <ArrowDownOutlined /> -15%
          </div>
        </StatCard>
      </OverviewStats>

      <Row gutter={[24, 24]}>
        {/* 最近活动 */}
        <Col xs={24} lg={14}>
          <RecentActivityCard title="最近活动">
            <ActivityList>
              {recentActivities.map((item) => (
                <ActivityItem key={item.id}>
                  <div className="activity-icon">{item.icon}</div>
                  <div className="activity-content">
                    <div className="activity-title">{item.title}</div>
                    <div className="activity-time">{item.time}</div>
                  </div>
                </ActivityItem>
              ))}
            </ActivityList>
          </RecentActivityCard>
        </Col>

        {/* 文档上传趋势 */}
        <Col xs={24} lg={10}>
          <TrendAnalysisCard title="文档上传趋势">
            <ChartContainer>
              <div className="chart-placeholder">
                📈 文档上传统计
                <ChartData>
                  <div className="chart-bar" style={{ height: '60%' }}>1月</div>
                  <div className="chart-bar" style={{ height: '75%' }}>2月</div>
                  <div className="chart-bar" style={{ height: '90%' }}>3月</div>
                  <div className="chart-bar" style={{ height: '85%' }}>4月</div>
                  <div className="chart-bar" style={{ height: '95%' }}>5月</div>
                </ChartData>
              </div>
            </ChartContainer>
          </TrendAnalysisCard>
        </Col>
      </Row>
    </HomeContainer>
  );
};

// Styled Components
const HomeContainer = styled.div`
  background: #f7fafc;
  min-height: calc(100vh - 64px);
  padding: 40px 24px;
`;

const SearchHero = styled.div`
  text-align: center;
  padding: 60px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  color: white;
  margin-bottom: 40px;
  box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);

  h1 {
    font-size: 2.5rem;
    margin-bottom: 15px;
    font-weight: 700;
  }

  p {
    font-size: 1.2rem;
    margin-bottom: 30px;
    opacity: 0.9;
  }
`;

const SearchContainer = styled.div`
  max-width: 600px;
  margin: 0 auto 20px;
  
  .search-input-large {
    .ant-input-group-addon {
      .search-btn {
        background: #48bb78;
        border-color: #48bb78;
        border-radius: 25px;
        padding: 15px 30px;
        font-weight: 600;
        
        &:hover {
          background: #38a169;
          border-color: #38a169;
          transform: translateY(-2px);
        }
      }
    }
    
    .ant-input {
      border-radius: 25px;
      padding: 15px 20px;
      font-size: 1.1rem;
    }
  }
`;

const SearchSuggestions = styled.div`
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;

  .suggestion-tag {
    padding: 8px 16px;
    background: rgba(255,255,255,0.2);
    border-radius: 20px;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.3s ease;
    border: none;
    color: white;

    &:hover {
      background: rgba(255,255,255,0.3);
    }
  }
`;

const QuickActions = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 40px;
`;

const ActionCard = styled(Card)`
  text-align: center;
  border-radius: 12px !important;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08) !important;
  border: 1px solid #e2e8f0 !important;
  transition: all 0.3s ease !important;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 30px rgba(0,0,0,0.15) !important;
  }

  .action-icon {
    font-size: 3rem;
    margin-bottom: 20px;
  }

  h3 {
    font-size: 1.3rem;
    margin-bottom: 10px;
    color: #2d3748;
  }

  p {
    color: #718096;
    margin-bottom: 20px;
  }

  .action-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    border-radius: 8px;
    font-weight: 600;
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
    }
  }
`;

const OverviewStats = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 40px;
`;

const StatCard = styled(Card)`
  text-align: center;
  border-radius: 12px !important;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08) !important;
  border: 1px solid #e2e8f0 !important;

  .stat-number {
    font-size: 2.5rem;
    font-weight: 700;
    color: #667eea;
    margin-bottom: 8px;
  }

  .stat-label {
    color: #718096;
    font-size: 0.9rem;
    margin-bottom: 8px;
  }

  .stat-trend {
    font-size: 0.8rem;
    font-weight: 600;
    
    &.positive {
      color: #48bb78;
    }
    
    &.negative {
      color: #f56565;
    }
  }
`;

const RecentActivityCard = styled(Card)`
  border-radius: 12px !important;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08) !important;
  border: 1px solid #e2e8f0 !important;
`;

const ActivityList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

const ActivityItem = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px;
  background: #f7fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;

  .activity-icon {
    font-size: 1.5rem;
    width: 40px;
    text-align: center;
  }

  .activity-content {
    flex: 1;
  }

  .activity-title {
    font-weight: 600;
    color: #2d3748;
    margin-bottom: 4px;
  }

  .activity-time {
    font-size: 0.8rem;
    color: #718096;
  }
`;

const TrendAnalysisCard = styled(Card)`
  border-radius: 12px !important;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08) !important;
  border: 1px solid #e2e8f0 !important;
`;

const ChartContainer = styled.div`
  height: 200px;
  background: #f7fafc;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e2e8f0;

  .chart-placeholder {
    text-align: center;
    color: #718096;
  }
`;

const ChartData = styled.div`
  display: flex;
  gap: 20px;
  align-items: end;
  margin-top: 20px;

  .chart-bar {
    width: 40px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 4px 4px 0 0;
    display: flex;
    align-items: end;
    justify-content: center;
    color: white;
    font-size: 0.8rem;
    padding: 5px;
  }
`;

export default Home