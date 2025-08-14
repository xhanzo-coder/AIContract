# Technology Stack & Build System

## Backend Stack
- **Framework**: FastAPI 0.104.1 with Uvicorn ASGI server
- **Database**: PostgreSQL with SQLAlchemy ORM and Alembic migrations
- **AI/ML**: 
  - PaddlePaddle + PaddleOCR (CPU-only) for document text extraction
  - Faiss-CPU for vector similarity search
  - SiliconFlow BGE-M3 API for text embeddings
  - Doubao (豆包) API for conversational AI
- **Search**: Elasticsearch 8.11.0 with elasticsearch-dsl
- **Document Processing**: PyPDF2, python-docx, PyMuPDF, Pillow
- **HTTP**: httpx, requests for API clients
- **Security**: python-jose, passlib with bcrypt

## Frontend Stack
- **Framework**: React 18.2.0 with TypeScript
- **Build Tool**: Vite 5.0.8 with hot reload
- **UI Library**: Ant Design 5.12.8 with styled-components
- **State Management**: Redux Toolkit with React-Redux
- **Routing**: React Router DOM 6.8.1
- **Markdown**: react-markdown with remark-gfm
- **Charts**: ECharts with echarts-for-react
- **HTTP Client**: Axios

## Development Environment
- **Python**: 3.8+ with virtual environment (venv)
- **Node.js**: For frontend development
- **Database**: PostgreSQL 15.x recommended
- **Search Engine**: Elasticsearch 8.11.3

## Common Commands

### Backend Development
```bash
# Setup virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Start development server
python run.py
# OR
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Database migrations
alembic upgrade head
```

### Frontend Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

### One-Click Deployment
```bash
# Windows - starts both backend and frontend
run.bat

# Creates venv, installs dependencies, starts services
# Backend: http://localhost:8000
# Frontend: http://localhost:3000 (dev) or via Streamlit on 8501
```

## Configuration
- **Environment**: `.env` file (copy from `.env.example`)
- **API Keys**: SiliconFlow and Doubao APIs required
- **Database**: PostgreSQL connection string in DATABASE_URL
- **File Storage**: Local filesystem with configurable upload directory
- **CORS**: Configured for localhost development

## API Documentation
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/api/v1/health