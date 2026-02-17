import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import roc_auc_score, confusion_matrix, classification_report
import joblib
import os

# Load data set
df = pd.read_csv("data/UCI_Credit_Card.csv")  # adjust path if needed

# Clean data
# Drop ID column
df = df.drop('ID', axis=1)

# Replace infinities with 0
df.replace([np.inf, -np.inf], 0, inplace=True)

# Fill missing values with 0
df.fillna(0, inplace=True)

# Feature engineering
# Average repayment delay (-1 treated as 0)
pay_cols = ['PAY_0', 'PAY_2', 'PAY_3', 'PAY_4', 'PAY_5', 'PAY_6']
df['avg_pay_delay'] = df[pay_cols].replace(-1, 0).mean(axis=1)

# Credit utilization
bill_cols = ['BILL_AMT1', 'BILL_AMT2', 'BILL_AMT3', 'BILL_AMT4', 'BILL_AMT5', 'BILL_AMT6']
df['avg_bill'] = df[bill_cols].mean(axis=1)
df['credit_utilization'] = df['avg_bill'] / df['LIMIT_BAL']

# Payment ratio
pay_amt_cols = ['PAY_AMT1', 'PAY_AMT2', 'PAY_AMT3', 'PAY_AMT4', 'PAY_AMT5', 'PAY_AMT6']
df['avg_payment'] = df[pay_amt_cols].mean(axis=1)
df['payment_ratio'] = df['avg_payment'] / df['avg_bill']

# Remove outliers (scaler values)
for col in ['LIMIT_BAL', 'avg_bill', 'avg_payment']:
    df[col] = np.clip(df[col], None, 1e6)

# Prepare features
features = ['LIMIT_BAL', 'AGE', 'avg_pay_delay', 'credit_utilization', 'payment_ratio']
X = df[features]
y = df['default.payment.next.month']

# Split and train
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# Build pipeline
pipeline = Pipeline([
    ('scaler', StandardScaler()),
    ('model', LogisticRegression(solver='liblinear'))
])

# Train
pipeline.fit(X_train, y_train)

# Evaluate model
y_pred_prob = pipeline.predict_proba(X_test)[:, 1]
roc = roc_auc_score(y_test, y_pred_prob)
print("ROC-AUC:", roc)

threshold = 0.3
y_pred_label = (y_pred_prob >= threshold).astype(int)
print("Confusion Matrix:\n", confusion_matrix(y_test, y_pred_label))
print("Classification Report:\n", classification_report(y_test, y_pred_label))

# Save model
os.makedirs("models", exist_ok=True)
joblib.dump(pipeline, 'models/credit_model.pkl')
print("Model saved to models/credit_model.pkl")