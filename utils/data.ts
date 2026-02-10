import { Borrower } from '../types';

const CITIES = [
  { city: 'New York', country: 'USA', lat: 40.7128, lng: -74.0060 },
  { city: 'London', country: 'UK', lat: 51.5074, lng: -0.1278 },
  { city: 'Singapore', country: 'Singapore', lat: 1.3521, lng: 103.8198 },
  { city: 'Tokyo', country: 'Japan', lat: 35.6762, lng: 139.6503 },
  { city: 'Sao Paulo', country: 'Brazil', lat: -23.5505, lng: -46.6333 },
  { city: 'Lagos', country: 'Nigeria', lat: 6.5244, lng: 3.3792 },
  { city: 'Mumbai', country: 'India', lat: 19.0760, lng: 72.8777 },
  { city: 'Sydney', country: 'Australia', lat: -33.8688, lng: 151.2093 },
  { city: 'Berlin', country: 'Germany', lat: 52.5200, lng: 13.4050 },
  { city: 'Nairobi', country: 'Kenya', lat: -1.2921, lng: 36.8219 },
  { city: 'Dubai', country: 'UAE', lat: 25.2048, lng: 55.2708 },
  { city: 'San Francisco', country: 'USA', lat: 37.7749, lng: -122.4194 },
  { city: 'Shanghai', country: 'China', lat: 31.2304, lng: 121.4737 },
  { city: 'Mexico City', country: 'Mexico', lat: 19.4326, lng: -99.1332 },
  { city: 'Cape Town', country: 'South Africa', lat: -33.9249, lng: 18.4241 },
  { city: 'Kigali', country: 'Rwanda', lat: -1.9441, lng: 30.0619 },
  { city: 'Huye', country: 'Rwanda', lat: -2.6000, lng: 29.7333 },
];

export const generateBorrowers = (count: number): Borrower[] => {
  return Array.from({ length: count }).map((_, i) => {
    const cityData = CITIES[i % CITIES.length];
    // Add some random jitter to coords so they don't stack perfectly.
    // Reduced jitter to 0.5 degrees to keep points closer to the city/country, 
    // especially important for smaller countries like Rwanda.
    const lat = cityData.lat + (Math.random() - 0.5) * 0.5;
    const lng = cityData.lng + (Math.random() - 0.5) * 0.5;
    
    const creditScore = Math.floor(Math.random() * (850 - 300) + 300);
    let riskLevel: 'Low' | 'Medium' | 'High' = 'Medium';
    if (creditScore > 700) riskLevel = 'Low';
    if (creditScore < 550) riskLevel = 'High';

    return {
      id: `BRW-${1000 + i}`,
      name: `User ${1000 + i}`,
      location: {
        ...cityData,
        lat,
        lng,
      },
      creditScore,
      riskLevel,
      spendingTrend: Array.from({ length: 6 }).map(() => Math.floor(Math.random() * 5000) + 1000),
      repaymentHistory: Math.floor(Math.random() * 20) + 80, // 80-100%
      mobileMoneyUsage: Math.floor(Math.random() * 1000),
    };
  });
};

export const MOCK_BORROWERS = generateBorrowers(40); // Increased count to ensure Rwanda cities are generated
