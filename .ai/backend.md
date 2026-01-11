# Backend Standards (Python)

> Standards for integrators developing Python backends with SIDE

## Python Norms

**Version and Style:**
- Python 3.13+ required
- PEP8 and pragmatic static typing (PEP484)
- snake_case for variables and functions
- Autonomous and testable modules

**Self-Documenting Code:**
- No `#` comments
- No docstrings
- Explicit names (functions, variables, parameters)
- Short and readable code

**Error Handling:**
- No try/except unless upon explicit request
- Try/except only for critical cases (external calls, I/O)
- Explicit business exceptions

**Organization:**
- No business logic in `__init__.py`
- File > 100 lines without justification? Split it
- Prefer pure functions to classes
- Create class only if state or external integration justifies it

## Recommended Architecture

**Stateless:**
- Backend stateless regarding business data
- No server persistence (data in frontend IndexedDB)
- Temporary sessions in memory if necessary

**Separation of Concerns:**
```
backend/
├── api/          # HTTP interface (FastAPI)
│   ├── routes/   # Endpoints
│   ├── security/ # Auth
│   └── config.py # Configuration
└── domain/       # Business logic and services
    ├── models/   # Pydantic models
    └── services/ # Business services
```

## Recommended Stack

**Framework:**
- FastAPI + Uvicorn (async server)
- Pydantic (validation and schemas)
- httpx (async HTTP calls)

**Build System:**
- uv + Hatch workspaces
- Minimal pyproject.toml

**Configuration:**
- Environment variables via config.py
- Pydantic Settings for validation

## Principles

**Dependency Injection:**
```python
from functools import lru_cache
from fastapi import Depends

@lru_cache(maxsize=None)
def get_service() -> MyService:
    return MyService()

@app.get("/data")
def endpoint(service: MyService = Depends(get_service)):
    return service.get_data()
```

**No Try/Except:**
```python
def process_data(data: dict) -> Result:
    return transform(data)
```

**Pure Functions:**
```python
def calculate_score(items: list[Item]) -> float:
    return sum(item.value for item in items) / len(items)
```

## Testing

Manual testing only (cURL, HTTP clients). No coded tests by AI without explicit request.

## Simplicity Checklist

1. Pure function sufficient? Don't create class
2. Direct library call possible? Don't wrap unnecessarily
3. File > 100 lines? Split by responsibility
4. Superfluous state/class? Remove
5. Complex abstraction? Verify if necessary
