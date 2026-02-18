# Credit Risk Scoring API

A simple FastAPI service that predicts **Probability of Default (PD)**, converts it into a **credit score (300–850 scale)**, and assigns a **risk level**.

## 1. Install Pipenv (if not installed)

```bash
pip install pipenv
```


## 2. Create Virtual Environment

From inside the project root (`credit_scoring_backend/`):

```bash
pipenv install fastapi uvicorn pandas scikit-learn joblib numpy
```

This will:
- Create a virtual environment
- Generate `Pipfile`
- Generate `Pipfile.lock`

## 3. Activate Virtual Environment

```bash
pipenv shell
```

You should now see the virtual environment active in your terminal.

## 2. Train the Model

Ensure the dataset exists at:

```
data/UCI_Credit_Card.csv
```

Run the training script:

```bash
python  train.py
```

This will:
- Train a Logistic Regression pipeline
- Evaluate performance (ROC-AUC, confusion matrix, classification report)
- Save the trained model to:

```
models/credit_model.pkl
```

## 3. Run the API

```bash
uvicorn main:app --reload
```

API base URL:

```
http://127.0.0.1:8000
```

Interactive documentation:

```
http://127.0.0.1:8000/docs
```

## 4. Endpoint

### POST `/credit-score`

### Example Request

```json
{
  "LIMIT_BAL": 200000,
  "AGE": 35,
  "avg_pay_delay": 0.2,
  "credit_utilization": 0.45,
  "payment_ratio": 0.6
}
```

### Example Response

```json
{
  "PD": 0.18,
  "Credit_Score": 751,
  "Risk_Level": "Low"
}
```


## Credit Score Logic

```
score = 850 - (PD * 550)
```

Risk Levels:
- High: score < 650
- Medium: 650–749
- Low: 750+


## Project Structure

```
.
├── app.py
├── train_credit_model.py
├── data/
│   └── UCI_Credit_Card.csv
└── models/
    └── credit_model.pkl
```

## Workflow

1. Train the model  
2. Start the API  
3. Send POST request to `/credit-score`  
4. Receive PD, Credit Score, and Risk Level  
