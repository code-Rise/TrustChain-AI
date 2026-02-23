# app.py
from fastapi import FastAPI, HTTPException, Query, Depends
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import date
import pandas as pd
import joblib
import os
from sqlalchemy.orm import Session
from sqlalchemy import func

from db.database import SessionLocal, engine
from models import models
import uvicorn
 

# Create database tables
models.Base.metadata.create_all(bind=engine)

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# load trained model (pkl) file 
model_path = 'models/credit_model.pkl'
if not os.path.exists(model_path):
    raise FileNotFoundError(f"Model not found at {model_path}. Run train_credit_model.py first.")

model = joblib.load(model_path)

# loading borrower data from csv file kbs
data_path = 'data/UCI_Credit_Card.csv'
if not os.path.exists(data_path):
	raise FileNotFoundError(
		f"Data file not found at {data_path}"
	)

# loading the complete borrower dataset into memory for fast access
borrowers_df = pd.read_csv(data_path)

class Borrower(BaseModel):
    LIMIT_BAL: float
    AGE: float
    avg_pay_delay: float
    credit_utilization: float
    payment_ratio: float

class BorrowerCreate(BaseModel):
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    loan_amount: Optional[float] = None
    loan_date: Optional[date] = None
    decision: Optional[str] = "Pending"
    region_id: Optional[int] = None

class BorrowerResponse(BaseModel):
    borrower_id: int
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    loan_amount: Optional[float] = None
    loan_date: Optional[date] = None
    decision: Optional[str] = None
    region_id: Optional[int] = None

    class Config:
        from_attributes = True

class TransactionResponse(BaseModel):
    transaction_id: int
    borrower_id: int
    transaction_date: date
    transaction_amount: float
    transaction_type: str

    class Config:
        from_attributes = True

class DocumentResponse(BaseModel):
    document_id: int
    borrower_id: int
    document_name: str
    document_type: str
    upload_date: date

    class Config:
        from_attributes = True

app = FastAPI(title="Credit Risk Scoring API")

@app.post("/api/borrowers", response_model=BorrowerResponse, status_code=201)
def create_borrower(borrower: BorrowerCreate, db: Session = Depends(get_db)):
    db_borrower = models.Borrower(**borrower.dict())
    db.add(db_borrower)
    db.commit()
    db.refresh(db_borrower)
    return db_borrower

@app.get("/api/borrowers", response_model=List[BorrowerResponse])
def get_all_borrowers(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records"),
    db: Session = Depends(get_db)
):
    borrowers = db.query(models.Borrower).offset(skip).limit(limit).all()
    return borrowers

@app.get("/api/borrowers/{borrower_id}", response_model=BorrowerResponse)
def get_borrower_by_id(borrower_id: int, db: Session = Depends(get_db)):
    db_borrower = db.query(models.Borrower).filter(models.Borrower.borrower_id == borrower_id).first()
    if db_borrower is None:
        raise HTTPException(status_code=404, detail=f"Borrower with ID {borrower_id} not found")
    return db_borrower

@app.get("/api/stats/global")
def get_global_stats(db: Session = Depends(get_db)):
    total_users = db.query(func.count(models.Borrower.borrower_id)).scalar()
    if total_users == 0:
        return {"total_users": 0, "average_loan_amount": 0, "approved_count": 0}
    
    avg_loan = db.query(func.avg(models.Borrower.loan_amount)).scalar()
    approved_count = db.query(func.count(models.Borrower.borrower_id))\
        .filter(models.Borrower.decision == 'Approved').scalar()
    
    return {
        "total_users": total_users,
        "average_loan_amount": round(float(avg_loan), 2) if avg_loan else 0,
        "approved_count": approved_count
    }

@app.get("/api/stats/regions")
def get_region_stats(db: Session = Depends(get_db)):
    results = db.query(
        models.Borrower.region_id,
        func.count(models.Borrower.borrower_id).label('total_borrowers'),
        func.avg(models.Borrower.loan_amount).label('avg_loan')
    ).group_by(models.Borrower.region_id).all()

    if not results:
        return []
    
    region_stats = []
    for region_id, total, avg_loan in results:
        if region_id is None: continue
        region_stats.append({
            "region_id": region_id,
            "total_borrowers": total,
            "average_loan_amount": round(float(avg_loan), 2) if avg_loan else 0
        })
    
    return region_stats

@app.get("/api/borrowers/{borrower_id}/transactions", response_model=List[TransactionResponse])
def get_borrower_transactions(borrower_id: int, db: Session = Depends(get_db)):
    transactions = db.query(models.HistoricalTransaction).filter(models.HistoricalTransaction.borrower_id == borrower_id).all()
    return transactions

@app.get("/api/borrowers/{borrower_id}/documents", response_model=List[DocumentResponse])
def get_borrower_documents(borrower_id: int, db: Session = Depends(get_db)):
    documents = db.query(models.Document).filter(models.Document.borrower_id == borrower_id).all()
    return documents


@app.post("/credit-score")
def credit_score_endpoint(data: Borrower):
    df_input = pd.DataFrame([data.dict()])

    pd_prob = model.predict_proba(df_input)[:, 1][0]

    # Convert PD to credit score (simple scale)
    score = int(850 - pd_prob * 550)

    # Risk level
    if score < 650:
        risk = "High"
    elif score < 750:
        risk = "Medium"
    else:
        risk = "Low"

    return {
        "PD": round(float(pd_prob), 2),
        "Credit_Score": score,
        "Risk_Level": risk
    }

@app.get("/")
def read_root():
    return {"message": "Credit Risk Scoring API is running. Use /credit-score endpoint to POST data."}

if __name__ == "__main__":
    # Render and other cloud platforms provide a PORT environment variable.
    # We must bind to "0.0.0.0" (all interfaces) rather than "127.0.0.1" (localhost)
    # so that Render's load balancer can reach the application.
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting server on 0.0.0.0:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
