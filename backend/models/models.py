from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, text
from sqlalchemy.orm import relationship
from db.database import Base

class Region(Base):
    __tablename__ = "Region"

    region_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    region_name = Column(String(100), nullable=False)

    borrowers = relationship("Borrower", back_populates="region")

class Borrower(Base):
    __tablename__ = "Borrowers"

    borrower_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(150), unique=False, index=True, nullable=True)
    phone = Column(String(20))
    loan_amount = Column(Float)
    loan_date = Column(Date)
    decision = Column(String(20), default="Pending") # Pending, Approved, Denied
    region_id = Column(Integer, ForeignKey("Region.region_id", ondelete="SET NULL"))

    region = relationship("Region", back_populates="borrowers")
    transactions = relationship("HistoricalTransaction", back_populates="borrower", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="borrower", cascade="all, delete-orphan")

class HistoricalTransaction(Base):
    __tablename__ = "Historical_Transactions"

    transaction_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    borrower_id = Column(Integer, ForeignKey("Borrowers.borrower_id", ondelete="CASCADE"))
    transaction_date = Column(Date, server_default=text('CURRENT_TIMESTAMP'))
    transaction_amount = Column(Float)
    transaction_type = Column(String(50))

    borrower = relationship("Borrower", back_populates="transactions")

class Document(Base):
    __tablename__ = "Documents"

    document_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    borrower_id = Column(Integer, ForeignKey("Borrowers.borrower_id", ondelete="CASCADE"))
    document_name = Column(String(150))
    document_type = Column(String(50))
    upload_date = Column(Date, server_default=text('CURRENT_TIMESTAMP'))

    borrower = relationship("Borrower", back_populates="documents")

# Note: Views in SQLite/SQLAlchemy can be mapped to models by setting __table__
# but they are usually read-only. For now, we will use raw SQL or dynamic queries 
# for stats unless a specific view model is needed.
