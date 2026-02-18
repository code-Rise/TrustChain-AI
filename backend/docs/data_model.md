# Data Model Documentation

## Overview

This document describes the data models used in the Credit Risk Scoring API, including the UCI Credit Card dataset structure, feature engineering process, and credit scoring methodology.

---

## UCI Credit Card Dataset

### Dataset Information

- **Source**: UCI Machine Learning Repository
- **Records**: 30,000 credit card clients
- **Origin**: Taiwan, 2005
- **Purpose**: Predict probability of default payment

### Raw Dataset Fields

#### Demographic Information

| Field | Type | Description | Values |
|-------|------|-------------|--------|
| `ID` | integer | Unique client identifier | 1 to 30000 |
| `LIMIT_BAL` | integer | Credit limit (NT dollar) | 10000 to 1000000 |
| `SEX` | integer | Gender | 1 = male, 2 = female |
| `EDUCATION` | integer | Education level | 1 = graduate school<br>2 = university<br>3 = high school<br>4 = others |
| `MARRIAGE` | integer | Marital status | 1 = married<br>2 = single<br>3 = others |
| `AGE` | integer | Age in years | 21 to 79 |

#### Repayment Status (6 months)

| Field | Description | Values |
|-------|-------------|--------|
| `PAY_0` | Repayment status in September | -2 = no consumption<br>-1 = pay duly<br>0 = revolving credit<br>1 = payment delay 1 month<br>2 = payment delay 2 months<br>...<br>8 = payment delay 8 months<br>9 = payment delay 9+ months |
| `PAY_2` | Repayment status in August | Same as above |
| `PAY_3` | Repayment status in July | Same as above |
| `PAY_4` | Repayment status in June | Same as above |
| `PAY_5` | Repayment status in May | Same as above |
| `PAY_6` | Repayment status in April | Same as above |

#### Bill Amounts (6 months)

| Field | Description | Unit |
|-------|-------------|------|
| `BILL_AMT1` | Bill statement amount in September | NT dollar |
| `BILL_AMT2` | Bill statement amount in August | NT dollar |
| `BILL_AMT3` | Bill statement amount in July | NT dollar |
| `BILL_AMT4` | Bill statement amount in June | NT dollar |
| `BILL_AMT5` | Bill statement amount in May | NT dollar |
| `BILL_AMT6` | Bill statement amount in April | NT dollar |

#### Payment Amounts (6 months)

| Field | Description | Unit |
|-------|-------------|------|
| `PAY_AMT1` | Previous payment in September | NT dollar |
| `PAY_AMT2` | Previous payment in August | NT dollar |
| `PAY_AMT3` | Previous payment in July | NT dollar |
| `PAY_AMT4` | Previous payment in June | NT dollar |
| `PAY_AMT5` | Previous payment in May | NT dollar |
| `PAY_AMT6` | Previous payment in April | NT dollar |

#### Target Variable

| Field | Description | Values |
|-------|-------------|--------|
| `default.payment.next.month` | Default payment next month | 1 = yes (default)<br>0 = no (no default) |

---

## Feature Engineering

The machine learning model uses engineered features derived from the raw dataset to improve prediction accuracy.

### Engineered Features

#### 1. Average Payment Delay (`avg_pay_delay`)

**Formula:**
```python
avg_pay_delay = mean(PAY_0, PAY_2, PAY_3, PAY_4, PAY_5, PAY_6)
# Note: -1 values (pay duly) are replaced with 0
```

**Purpose:** Captures the overall payment behavior pattern across 6 months.

**Interpretation:**
- `0.0`: Always pays on time
- `1.0`: Average 1 month delay
- `2.0+`: Chronic payment delays

---

#### 2. Credit Utilization (`credit_utilization`)

**Formula:**
```python
avg_bill = mean(BILL_AMT1, BILL_AMT2, BILL_AMT3, BILL_AMT4, BILL_AMT5, BILL_AMT6)
credit_utilization = avg_bill / LIMIT_BAL
```

**Purpose:** Measures how much of the available credit is being used.

**Interpretation:**
- `0.0 - 0.3`: Low utilization (good)
- `0.3 - 0.7`: Moderate utilization
- `0.7 - 1.0`: High utilization (risky)
- `> 1.0`: Over-limit (very risky)

---

#### 3. Payment Ratio (`payment_ratio`)

**Formula:**
```python
avg_payment = mean(PAY_AMT1, PAY_AMT2, PAY_AMT3, PAY_AMT4, PAY_AMT5, PAY_AMT6)
payment_ratio = avg_payment / avg_bill
```

**Purpose:** Indicates the proportion of bills being paid.

**Interpretation:**
- `0.0`: Not making payments
- `0.0 - 0.5`: Partial payments
- `0.5 - 1.0`: Substantial payments
- `> 1.0`: Paying more than billed (overpayment)

---

### Model Input Features

The trained model expects these 5 features:

```python
{
    "LIMIT_BAL": float,        # Credit limit
    "AGE": float,              # Age
    "avg_pay_delay": float,    # Average payment delay
    "credit_utilization": float,  # Credit utilization ratio
    "payment_ratio": float     # Payment to bill ratio
}
```

---

## Credit Scoring Methodology

### Machine Learning Model

- **Algorithm**: Logistic Regression with StandardScaler
- **Training**: 80/20 train-test split with stratification
- **Output**: Probability of Default (PD)

### Credit Score Calculation

**Formula:**
```python
Credit_Score = 850 - (PD × 550)
```

**Score Range:** 300 to 850

**Interpretation:**
- **850**: Perfect score (0% probability of default)
- **300**: Worst score (100% probability of default)

### Risk Level Classification

| Risk Level | Credit Score Range | Probability of Default |
|------------|-------------------|------------------------|
| **Low** | 750 - 850 | 0% - 18% |
| **Medium** | 650 - 749 | 18% - 36% |
| **High** | 300 - 649 | 36% - 100% |

---

## Data Preprocessing

The following preprocessing steps are applied during model training:

### 1. Data Cleaning

```python
# Remove ID column (not a feature)
df = df.drop('ID', axis=1)

# Replace infinite values with 0
df.replace([np.inf, -np.inf], 0, inplace=True)

# Fill missing values with 0
df.fillna(0, inplace=True)
```

### 2. Outlier Handling

```python
# Clip extreme values to prevent model instability
for col in ['LIMIT_BAL', 'avg_bill', 'avg_payment']:
    df[col] = np.clip(df[col], None, 1e6)  # Cap at 1 million
```

### 3. Feature Scaling

```python
# StandardScaler applied to all features
# Transforms features to have mean=0 and std=1
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)
```

---

## API Response Models

### Borrower Response

Complete borrower record returned by `/api/borrowers/{id}`:

```json
{
    "ID": 1,
    "LIMIT_BAL": 20000,
    "SEX": 2,
    "EDUCATION": 2,
    "MARRIAGE": 1,
    "AGE": 24,
    "PAY_0": 2,
    "PAY_2": 2,
    "PAY_3": -1,
    "PAY_4": -1,
    "PAY_5": -2,
    "PAY_6": -2,
    "BILL_AMT1": 3913,
    "BILL_AMT2": 3102,
    "BILL_AMT3": 689,
    "BILL_AMT4": 0,
    "BILL_AMT5": 0,
    "BILL_AMT6": 0,
    "PAY_AMT1": 0,
    "PAY_AMT2": 689,
    "PAY_AMT3": 0,
    "PAY_AMT4": 0,
    "PAY_AMT5": 0,
    "PAY_AMT6": 0,
    "default.payment.next.month": 1
}
```

### Credit Score Response

Result from `/credit-score` endpoint:

```json
{
    "PD": 0.23,
    "Credit_Score": 723,
    "Risk_Level": "Medium"
}
```

---

## Model Performance Metrics

The model is evaluated using:

- **ROC-AUC Score**: Measures the model's ability to distinguish between defaulters and non-defaulters
- **Confusion Matrix**: Shows true positives, false positives, true negatives, and false negatives
- **Classification Report**: Provides precision, recall, and F1-score

These metrics are displayed when running `train.py`.

---

## Data Quality Considerations

### Missing Values
- Handled by filling with 0 during preprocessing
- Minimal impact due to complete dataset

### Imbalanced Classes
- The dataset has more non-defaulters than defaulters
- Stratified sampling used during train-test split to maintain class distribution

### Feature Correlation
- Engineered features are designed to capture different aspects of credit behavior
- Reduces multicollinearity compared to using raw payment/bill amounts

---

## References

- UCI Machine Learning Repository: [Default of Credit Card Clients Dataset](https://archive.ics.uci.edu/ml/datasets/default+of+credit+card+clients)
- Original Paper: Yeh, I. C., & Lien, C. H. (2009). The comparisons of data mining techniques for the predictive accuracy of probability of default of credit card clients. *Expert Systems with Applications*, 36(2), 2473-2480.
