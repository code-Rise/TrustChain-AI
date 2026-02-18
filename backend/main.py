# app.py
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from typing import List, Dict, Any
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

app = FastAPI(title="Credit Risk Scoring API")

#retrieving all Borrowers   , response_model=List[Dist[str, Any]])
@app.get("/api/borrowers", response_model=List[Dict[str, Any]])
def get_all_borrowers(
    skip: int = Query(0, ge=0, description="Number of records to skip (for pagination)"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return")
):                                                                                    
	total_borrowers  = len(borrowers_df)
	
	# aha ni appying pagination using dataframe slicing
	paginated_data = borrowers_df.iloc[skip:skip + limit]

	borrowers_list = paginated_data.to_dict(orient='records')
	
	return borrowers_list


#getting a borrower  ,  response_model=Dict[str, Any]
@app.get("/api/borrowers/{borrower_id}", response_model=Dict[str, Any])
def get_borrower_info(borrower_id: int):
	borrower_record = borrowers_df[borrowers_df['ID'] ==  borrower_id]
	if borrower_record.empty:
		raise HTTPException(status_code=404,
			detail=f"Borrower with ID {borrower_id} not found"
		)
	borrower_data = borrower_record.iloc[0].to_dict()
	return borrower_data


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


