from sqlalchemy.orm import Session
from db.database import SessionLocal, engine
from models import models
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

        # Create regions
        regions = [
            models.Region(region_name="Rwanda"),
            models.Region(region_name="Kenya"),
            models.Region(region_name="Uganda"),
        ]
        db.add_all(regions)
        db.commit()

        # Refresh to get IDs
        for region in regions:
            db.refresh(region)

        # Create sample borrowers
        borrowers = [
            models.Borrower(
                first_name="Jean", last_name="Uwimana",
                email="jean.uwimana@example.com", phone="+250788123456",
                loan_amount=5000, loan_date=date(2024, 1, 15),
                decision="Approved", region_id=regions[0].region_id
            ),
            models.Borrower(
                first_name="Grace", last_name="Mutesi",
                email="grace.mutesi@example.com", phone="+250788234567",
                loan_amount=3000, loan_date=date(2024, 2, 10),
                decision="Pending", region_id=regions[0].region_id
            ),
            models.Borrower(
                first_name="Patrick", last_name="Nkunda",
                email="patrick.nkunda@example.com", phone="+250788345678",
                loan_amount=7500, loan_date=date(2024, 1, 20),
                decision="Denied", region_id=regions[0].region_id
            ),
        ]
        db.add_all(borrowers)
        db.commit()

        print(f"✓ Database seeded successfully!")
        print(f"  - {len(regions)} regions created")
        print(f"  - {len(borrowers)} borrowers created")

    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
