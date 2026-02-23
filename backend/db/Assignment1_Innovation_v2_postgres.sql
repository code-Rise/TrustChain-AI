CREATE TABLE Region (
    region_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    region_name VARCHAR(100) NOT NULL
);

CREATE TABLE Borrowers (
    borrower_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE,
    phone VARCHAR(20),
    loan_amount NUMERIC(10,2),
    loan_date DATE,
    decision VARCHAR(20),
    CONSTRAINT chk_decision 
    CHECK (decision IN ('Pending', 'Approved', 'Denied')),
    region_id INTEGER,
    
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
    AVG(b.loan_amount) AS average_loan_amount
FROM Region r
LEFT JOIN Borrowers b
    ON r.region_id = b.region_id
GROUP BY r.region_id, r.region_name;

CREATE TABLE Historical_Transactions (
    transaction_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    borrower_id INTEGER,
    transaction_date DATE DEFAULT CURRENT_DATE,
    transaction_amount NUMERIC(10,2),
    transaction_type VARCHAR(50),

    CONSTRAINT fk_transaction_borrower
        FOREIGN KEY (borrower_id)
        REFERENCES Borrowers(borrower_id)
        ON DELETE CASCADE
);

CREATE TABLE Documents (
    document_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    borrower_id INTEGER,
    document_name VARCHAR(150),
    document_type VARCHAR(50),
    upload_date DATE DEFAULT CURRENT_DATE,

    CONSTRAINT fk_document_borrower
        FOREIGN KEY (borrower_id)
        REFERENCES Borrowers(borrower_id)
        ON DELETE CASCADE
);

CREATE VIEW Report_Summary AS
SELECT 
    b.borrower_id,
    b.first_name,
    b.last_name,
    b.decision,
    
    CASE 
        WHEN b.decision = 'Approved' THEN 'Loan approved successfully'
        WHEN b.decision = 'Denied' THEN 'Loan application denied'
        WHEN b.decision = 'Pending' THEN 'Loan under review'
    END AS decision_description,

    r.region_name,
    COUNT(ht.transaction_id) AS total_transactions,
    COUNT(d.document_id) AS total_documents

FROM Borrowers b
LEFT JOIN Region r 
    ON b.region_id = r.region_id
LEFT JOIN Historical_Transactions ht
    ON b.borrower_id = ht.borrower_id
LEFT JOIN Documents d
    ON b.borrower_id = d.borrower_id

GROUP BY 
    b.borrower_id,
    b.first_name,
    b.last_name,
    b.decision,
    r.region_name;
