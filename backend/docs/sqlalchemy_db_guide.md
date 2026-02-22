# SQLAlchemy & SQLite Database Integration

This document explains the implementation of SQLAlchemy ORM for the persistent database layer using SQLite.

## Overview

SQLAlchemy is a powerful Python SQL toolkit and Object-Relational Mapper (ORM). It allows us to interact with the database using Python classes instead of writing raw SQL, providing:
- **Abstraction**: Write Python code that works across different database engines.
- **Persistence**: Data is saved to a file (`sql_app.db`) and persists across application restarts.
- **Relationships**: Easier management of foreign keys and related data (e.g., Region and Borrower).

---

## Technical Stack

- **ORM**: SQLAlchemy
- **Database Engine**: SQLite (file-based)
- **FastAPI Integration**: Dependency Injection for session management

---

## Project Structure

```text
backend/
├── db/
│   └── database.py        # Database connection and session setup
├── models/
│   └── models.py          # SQLAlchemy table models
├── docs/
│   └── sqlalchemy_db_guide.md  # This documentation
└── sql_app.db             # The actual SQLite database file
```

---

## Implementation Details

### 1. Database Configuration (`db/database.py`)
This file sets up the engine and declares the `Base` class that all models inherit from.

```python
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Storage location: backend/sql_app.db
SQLALCHEMY_DATABASE_URL = "sqlite:///./sql_app.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
```

### 2. Models Definition (`models/models.py`)
Maps Python classes to database tables.

```python
class Borrower(Base):
    __tablename__ = "Borrowers"

    borrower_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    full_name = Column(String(100), nullable=False)
    # ... other fields ...
    region_id = Column(Integer, ForeignKey("Region.region_id"))
    region = relationship("Region", back_populates="borrowers")
```

### 3. API Integration (`main.py`)
Uses dependency injection to provide a database session to each request.

```python
# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/api/borrowers")
def create_borrower(borrower: BorrowerCreate, db: Session = Depends(get_db)):
    db_borrower = models.Borrower(**borrower.dict())
    db.add(db_borrower)
    db.commit()
    return db_borrower
```

---

## Data Storage Location

- **File**: `backend/sql_app.db`
- **Format**: SQLite (standard SQL file)
- **Viewing**: You can use tools like [SQLite Browser](https://sqlitebrowser.org/) or the VS Code SQLite extension to explore the data.

---

## How to Run

1. **Ensure Dependencies**:
   ```bash
   pip install sqlalchemy uvicorn
   ```
2. **Start the Application**:
   Use the following command to run the backend:
   ```bash
   python -m uvicorn main:app --reload
   ```
   *Note: Using `python -m uvicorn` is more reliable on Windows to avoid "command not found" errors.*

3. **Verify**:
   The `sql_app.db` file will appear in the `backend/` directory as soon as the app starts.
