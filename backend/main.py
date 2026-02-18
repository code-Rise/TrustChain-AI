# app.py
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, EmailStr
from typing import List, Dict, Any, Optional
from datetime import date
import pandas as pd
import joblib
import os

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
    full_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    loan_amount: Optional[float] = None
    loan_date: Optional[date] = None
    region_id: Optional[int] = None

class BorrowerResponse(BaseModel):
    borrower_id: int
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    loan_amount: Optional[float] = None
    loan_date: Optional[date] = None
    region_id: Optional[int] = None

app = FastAPI(title="Credit Risk Scoring API")

# In-memory borrower storage (simulating database)
borrowers_db: Dict[int, Dict[str, Any]] = {}
next_borrower_id = 1

@app.post("/api/borrowers", response_model=BorrowerResponse, status_code=201)
def create_borrower(borrower: BorrowerCreate):
    global next_borrower_id
    borrower_data = borrower.dict()
    borrower_data['borrower_id'] = next_borrower_id
    borrowers_db[next_borrower_id] = borrower_data
    next_borrower_id += 1
    return borrower_data

@app.get("/api/borrowers", response_model=List[BorrowerResponse])
def get_all_borrowers(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records")
):
    borrowers_list = list(borrowers_db.values())
    return borrowers_list[skip:skip + limit]

@app.get("/api/borrowers/{borrower_id}", response_model=BorrowerResponse)
def get_borrower_by_id(borrower_id: int):
    if borrower_id not in borrowers_db:
        raise HTTPException(status_code=404, detail=f"Borrower with ID {borrower_id} not found")
    return borrowers_db[borrower_id]


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


