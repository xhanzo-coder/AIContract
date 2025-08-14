# Project Structure & Organization

## Root Directory Layout
```
contract_archive/                 # Main application directory
├── app/                         # FastAPI backend application
├── frontend/                    # React TypeScript frontend
├── data/                        # Runtime data storage
├── venv/                        # Python virtual environment
├── requirements.txt             # Python dependencies
├── .env                         # Environment configuration
├── .env.example                 # Environment template
├── run.py                       # Development server launcher
├── run.bat                      # Windows one-click startup
└── README.md                    # Project documentation
```

## Backend Structure (`app/`)
```
app/
├── __init__.py
├── main.py                      # FastAPI application entry point
├── config.py                    # Application configuration
├── models/                      # SQLAlchemy database models
├── api/                         # API route handlers
│   ├── contracts_router.py      # Contract management endpoints
│   ├── health_router.py         # Health check endpoints
│   └── qa_sessions.py           # Q&A session endpoints
├── services/                    # Business logic services
│   ├── elasticsearch_service.py # Search functionality
│   ├── ocr_service.py           # Document processing
│   └── embedding_service.py     # Vector embeddings
└── utils/                       # Utility functions
```

## Frontend Structure (`frontend/`)
```
frontend/
├── src/
│   ├── components/              # Reusable React components
│   ├── pages/                   # Page-level components
│   │   └── Home/                # Main chat interface
│   ├── services/                # API client services
│   │   └── api.ts               # Backend API integration
│   ├── store/                   # Redux state management
│   │   └── slices/              # Redux slices
│   ├── types/                   # TypeScript type definitions
│   └── main.tsx                 # Application entry point
├── public/                      # Static assets
├── package.json                 # Node.js dependencies
├── vite.config.ts               # Vite build configuration
├── tsconfig.json                # TypeScript configuration
└── index.html                   # HTML template
```

## Data Directory Structure
```
data/
├── uploads/                     # Uploaded documents
│   ├── temp/                    # Temporary processing files
│   └── processed/               # Processed documents
└── faiss_index/                 # Vector search indices
```

## Configuration Files
- **`.env`**: Environment variables (API keys, database URLs)
- **`requirements.txt`**: Python package dependencies
- **`package.json`**: Node.js dependencies and scripts
- **`vite.config.ts`**: Frontend build and dev server config
- **`tsconfig.json`**: TypeScript compiler options

## Key Architectural Patterns

### Backend Patterns
- **Layered Architecture**: API → Services → Models → Database
- **Dependency Injection**: Configuration and services injected via FastAPI
- **Async/Await**: Asynchronous request handling throughout
- **Pydantic Models**: Request/response validation and serialization

### Frontend Patterns
- **Component-Based**: Modular React components with TypeScript
- **Redux Pattern**: Centralized state management with slices
- **Service Layer**: API calls abstracted into service modules
- **Styled Components**: CSS-in-JS for component styling

### File Naming Conventions
- **Backend**: `snake_case` for Python files and functions
- **Frontend**: `camelCase` for TypeScript, `PascalCase` for components
- **API Endpoints**: RESTful naming (`/api/v1/contracts/`)
- **Database**: `snake_case` for table and column names

### Import Organization
- **Python**: Standard library → Third-party → Local imports
- **TypeScript**: External libraries → Internal modules → Relative imports
- **Path Aliases**: Use `@/` for src directory in frontend

## Development Workflow
1. **Backend First**: Develop API endpoints with FastAPI
2. **Database Migrations**: Use Alembic for schema changes
3. **Frontend Integration**: Connect React components to API
4. **Testing**: Manual testing via Swagger UI and frontend
5. **Deployment**: One-click startup via `run.bat`