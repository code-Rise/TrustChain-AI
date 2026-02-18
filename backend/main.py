# app.py
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
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
    email: Optional[str] = None
    phone: Optional[str] = None
    loan_amount: Optional[float] = None
    loan_date: Optional[date] = None
    credit_score: Optional[int] = None
    risk_level: Optional[str] = None
    region_id: Optional[int] = None

class BorrowerResponse(BaseModel):
    borrower_id: int
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    loan_amount: Optional[float] = None
    loan_date: Optional[date] = None
    credit_score: Optional[int] = None
    risk_level: Optional[str] = None
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

@app.get("/api/stats/global")
def get_global_stats():
    if not borrowers_db:
        return {"total_users": 0, "average_credit_score": 0, "high_risk_count": 0}
    
    borrowers = list(borrowers_db.values())
    total_users = len(borrowers)
    
    credit_scores = [b.get('credit_score') for b in borrowers if b.get('credit_score')]
    avg_credit_score = round(sum(credit_scores) / len(credit_scores), 2) if credit_scores else 0
    
    high_risk_count = sum(1 for b in borrowers if b.get('risk_level') == 'High')
    
    return {
        "total_users": total_users,
        "average_credit_score": avg_credit_score,
        "high_risk_count": high_risk_count
    }

@app.get("/api/stats/regions")
def get_high_risk_regions():
    if not borrowers_db:
        return []
    
    region_stats = {}
    for borrower in borrowers_db.values():
        region_id = borrower.get('region_id')
        if region_id:
            if region_id not in region_stats:
                region_stats[region_id] = {'total': 0, 'high_risk': 0}
            region_stats[region_id]['total'] += 1
            if borrower.get('risk_level') == 'High':
                region_stats[region_id]['high_risk'] += 1
    
    high_risk_regions = [
        {
            "region_id": region_id,
            "total_borrowers": stats['total'],
            "high_risk_count": stats['high_risk'],
            "high_risk_percentage": round((stats['high_risk'] / stats['total']) * 100, 2)
        }
        for region_id, stats in region_stats.items()
        if stats['high_risk'] > 0
    ]
    
    return sorted(high_risk_regions, key=lambda x: x['high_risk_percentage'], reverse=True)


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


