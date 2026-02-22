from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, text
from sqlalchemy.orm import relationship
from .db.database import Base

class Region(Base):
    __tablename__ = "Region"

    region_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    region_name = Column(String(100), nullable=False)

    borrowers = relationship("Borrower", back_populates="region")

class Borrower(Base):
    __tablename__ = "Borrowers"

    borrower_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True)
    phone = Column(String(20))
    loan_amount = Column(Float)
    loan_date = Column(Date)
    credit_score = Column(Integer)
    risk_level = Column(String(20))
    region_id = Column(Integer, ForeignKey("Region.region_id", ondelete="SET NULL"))

    region = relationship("Region", back_populates="borrowers")

# Note: Views in SQLite/SQLAlchemy can be mapped to models by setting __table__
# but they are usually read-only. For now, we will use raw SQL or dynamic queries 
# for stats unless a specific view model is needed.
