# app.py
from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
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
from utils import geocoder
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
    city: Optional[str] = None
    country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    credit_score: Optional[int] = None
    risk_level: Optional[str] = None
    probability_of_default: Optional[float] = None

class UserRegistration(BaseModel):
    fullNameOrBusiness: str
    entityType: str
    country: str
    city: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None

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
    credit_score: Optional[int] = None
    risk_level: Optional[str] = None
    probability_of_default: Optional[float] = None
    region_name: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

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

# Load environment variables
load_dotenv()

# Configure CORS
origins = [
    os.getenv("FRONTEND_URL", "http://localhost:3000"),
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    'https://trust-chain-ai-frontend.vercel.app'
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/borrowers", response_model=BorrowerResponse, status_code=201)
def create_borrower(borrower: BorrowerCreate, db: Session = Depends(get_db)):
    # Generate unique email if not provided
    email = borrower.email
    if not email:
        email = f"{borrower.first_name.lower()}.{borrower.last_name.lower()}@trustchain.local"
    
    # Handle Region (Search by country name)
    region_id = borrower.region_id
    if borrower.country:
        region = db.query(models.Region).filter(models.Region.region_name == borrower.country).first()
        if not region:
            lat, lng = geocoder.get_coordinates(borrower.country)
            region = models.Region(
                region_name=borrower.country,
                latitude=borrower.latitude if borrower.latitude else lat,
                longitude=borrower.longitude if borrower.longitude else lng
            )
            db.add(region)
            db.commit()
            db.refresh(region)
        region_id = region.region_id

    # Create borrower
    db_borrower = models.Borrower(
        first_name=borrower.first_name,
        last_name=borrower.last_name,
        email=email,
        phone=borrower.phone,
        loan_amount=borrower.loan_amount,
        loan_date=borrower.loan_date if borrower.loan_date else date.today(),
        decision=borrower.decision,
        region_id=region_id,
        city=borrower.city,
        credit_score=borrower.credit_score,
        risk_level=borrower.risk_level,
        probability_of_default=borrower.probability_of_default
    )
    db.add(db_borrower)
    db.commit()
    db.refresh(db_borrower)
    return db_borrower

@app.post("/api/register-user", status_code=201)
def register_user(user: UserRegistration, db: Session = Depends(get_db)):
    # Split name into first and last name
    name_parts = user.fullNameOrBusiness.strip().split(maxsplit=1)
    first_name = name_parts[0] if len(name_parts) > 0 else user.fullNameOrBusiness
    last_name = name_parts[1] if len(name_parts) > 1 else ""
    
    # Find or create region
    region = db.query(models.Region).filter(models.Region.region_name == user.country).first()
    if not region:
        # Get coordinates from geocoder if not provided
        lat, lng = geocoder.get_coordinates(user.country)
        
        region = models.Region(
            region_name=user.country,
            latitude=user.latitude if user.latitude else lat,
            longitude=user.longitude if user.longitude else lng
        )
        db.add(region)
        db.commit()
        db.refresh(region)
    elif user.latitude and user.longitude:
        # Update coordinates if provided and different
        region.latitude = user.latitude
        region.longitude = user.longitude
        db.commit()
    
    # Create borrower
    db_borrower = models.Borrower(
        first_name=first_name,
        last_name=last_name,
        decision="Pending",
        region_id=region.region_id,
        city=user.city
    )
    db.add(db_borrower)
    db.commit()
    db.refresh(db_borrower)
    
    return {
        "borrower_id": db_borrower.borrower_id,
        "message": "User registered successfully",
        "entity_type": user.entityType,
        "location": f"{user.city}, {user.country}"
    }

@app.get("/api/borrowers", response_model=List[BorrowerResponse])
def get_all_borrowers(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records"),
    db: Session = Depends(get_db)
):
    borrowers = db.query(models.Borrower).offset(skip).limit(limit).all()
    results = []
    for b in borrowers:
        resp = BorrowerResponse.from_orm(b)
        if b.region:
            resp.region_name = b.region.region_name
            resp.latitude = b.region.latitude
            resp.longitude = b.region.longitude
        results.append(resp)
    return results

@app.get("/api/borrowers/{borrower_id}", response_model=BorrowerResponse)
def get_borrower_by_id(borrower_id: int, db: Session = Depends(get_db)):
    db_borrower = db.query(models.Borrower).filter(models.Borrower.borrower_id == borrower_id).first()
    if db_borrower is None:
        raise HTTPException(status_code=404, detail=f"Borrower with ID {borrower_id} not found")
    
    resp = BorrowerResponse.from_orm(db_borrower)
    if db_borrower.region:
        resp.region_name = db_borrower.region.region_name
        resp.latitude = db_borrower.region.latitude
        resp.longitude = db_borrower.region.longitude
    return resp

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
