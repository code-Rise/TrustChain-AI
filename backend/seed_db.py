from sqlalchemy.orm import Session
from db.database import SessionLocal, engine
from models import models
from utils import geocoder
from datetime import date

# Create tables
models.Base.metadata.create_all(bind=engine)

def seed_database():
    db = SessionLocal()
    try:
        # Check if data already exists
        existing_count = db.query(models.Region).count()
        if existing_count > 0:
            print("Database already seeded. Skipping...")
            return

        # Create regions with coordinates from geocoder
        regions_list = ["USA", "United Kingdom", "Singapore", "Rwanda", "Nigeria", "France", "Germany", "Japan", "Brazil", "India"]
        
        regions = []
        for name in regions_list:
            lat, lng = geocoder.get_coordinates(name)
            region = models.Region(
                region_name=name,
                latitude=lat,
                longitude=lng
            )
            regions.append(region)
            db.add(region)
        
        db.commit()

        # Refresh to get IDs
        for region in regions:
            db.refresh(region)

        # Create sample borrowers with real metrics
        borrowers = [
            models.Borrower(
                first_name="John", last_name="Doe",
                email="john.doe@trustchain.local", phone="+12125550199",
                loan_amount=15000, loan_date=date(2024, 2, 1),
                decision="Approved", region_id=regions[0].region_id,
                city="New York", credit_score=780, risk_level="Low", 
                probability_of_default=0.02
            ),
            models.Borrower(
                first_name="Jane", last_name="Smith",
                email="jane.smith@trustchain.local", phone="+442079460958",
                loan_amount=8000, loan_date=date(2024, 1, 15),
                decision="Approved", region_id=regions[1].region_id,
                city="London", credit_score=720, risk_level="Low",
                probability_of_default=0.05
            ),
            models.Borrower(
                first_name="Akira", last_name="Tanaka",
                email="akira.tanaka@trustchain.local", phone="+6561234567",
                loan_amount=12000, loan_date=date(2024, 3, 10),
                decision="Pending", region_id=regions[2].region_id,
                city="Singapore", credit_score=685, risk_level="Medium",
                probability_of_default=0.15
            ),
            models.Borrower(
                first_name="Mutoni", last_name="Kamanzi",
                email="mutoni.k@trustchain.local", phone="+250788001122",
                loan_amount=2500, loan_date=date(2024, 1, 5),
                decision="Approved", region_id=regions[3].region_id,
                city="Kigali", credit_score=755, risk_level="Low",
                probability_of_default=0.04
            ),
            models.Borrower(
                first_name="Chidi", last_name="Okonkwo",
                email="chidi.o@trustchain.local", phone="+2348012345678",
                loan_amount=4500, loan_date=date(2023, 12, 20),
                decision="Denied", region_id=regions[4].region_id,
                city="Lagos", credit_score=302, risk_level="High",
                probability_of_default=0.98
            ),
        ]
        db.add_all(borrowers)
        db.commit()

        print(f"✓ Global database seeded successfully!")
        print(f"  - {len(regions)} regions created with coordinates")
        print(f"  - {len(borrowers)} borrowers created with dynamic scores")

    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
