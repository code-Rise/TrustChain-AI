CREATE TABLE Region (
    region_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    region_name VARCHAR2(100) NOT NULL
);

CREATE TABLE Borrowers (
    borrower_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name VARCHAR2(100) NOT NULL,
    email VARCHAR2(150) UNIQUE,
    phone VARCHAR2(20),
    loan_amount NUMBER(10,2),
    loan_date DATE,
    credit_score NUMBER(3),
    risk_level VARCHAR2(20),
    region_id NUMBER,
    
    CONSTRAINT fk_region
        FOREIGN KEY (region_id)
        REFERENCES Region(region_id)
        ON DELETE SET NULL
);


CREATE VIEW borrower_stats AS
SELECT 
    r.region_id,
    r.region_name,
    COUNT(b.borrower_id) AS total_borrowers,
    SUM(b.loan_amount) AS total_loan_amount,
    AVG(b.loan_amount) AS average_loan_amount,
    COUNT(CASE WHEN b.risk_level = 'High' THEN 1 END) AS high_risk_count
FROM Region r
LEFT JOIN Borrowers b
    ON r.region_id = b.region_id
GROUP BY r.region_id, r.region_name;


