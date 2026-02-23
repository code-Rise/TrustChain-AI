import React, { useState, Suspense, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { Globe } from './components/Globe';
import { CountryMap } from './components/CountryMap';
import { CreditMixChart, BorrowerRadar, TrendChart } from './components/Charts';
import { MOCK_BORROWERS } from './utils/data';
import api from './utils/api';
import { Borrower } from './types';
import {
  ShieldCheck,
  Globe2,
  Activity,
  Users,
  MapPin,
  ArrowLeft,
  FileText,
  CheckCircle,
  AlertTriangle,
  X,
  Menu,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Upload
} from 'lucide-react';
import { Modal } from './components/Modal';
import { Toast, ToastType } from './components/Toast';

const App: React.FC = () => {
  const [selectedBorrower, setSelectedBorrower] = useState<Borrower | null>(null);
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [selectedCountryName, setSelectedCountryName] = useState<string | null>(null);
  const [geoJson, setGeoJson] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  // New Feature State
  const [showReportModal, setShowReportModal] = useState(false);
  const [toasts, setToasts] = useState<{ id: string, message: string, type: ToastType }[]>([]);

  const addToast = (message: string, type: ToastType) => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, message, type }]);
  };
  // Add User Wizard State
const [showAddUserWizard, setShowAddUserWizard] = useState(false);
const [addUserStep, setAddUserStep] = useState<1 | 2 | 3 | 4>(1);

const [addUserData, setAddUserData] = useState({
  fullNameOrBusiness: '',
  entityType: '' as '' | 'Individual' | 'SME' | 'Corporation',
  country: '',
  city: '',

  monthlyIncomeOrRevenue: '',
  mobileMoneyUsage: '',
  repaymentHistory: '',
  requestedCreditLimit: '',
  age: '25'
});

const [creditScoreResult, setCreditScoreResult] = useState<{
  PD: number;
  Credit_Score: number;
  Risk_Level: string;
} | null>(null);

const [isCalculating, setIsCalculating] = useState(false);

const [addUserFiles, setAddUserFiles] = useState({
  repaymentProof: null as File | null,
  momoStatements: null as File | null,
  otherDocs: null as File | null
});

const [addUserConfirmTruth, setAddUserConfirmTruth] = useState(false);

const resetAddUserWizard = () => {
  setShowAddUserWizard(false);
  setAddUserStep(1);
  setAddUserData({
    fullNameOrBusiness: '',
    entityType: '',
    country: '',
    city: '',
    monthlyIncomeOrRevenue: '',
    mobileMoneyUsage: '',
    repaymentHistory: '',
    requestedCreditLimit: '',
    age: '25'
  });
  setAddUserFiles({ repaymentProof: null, momoStatements: null, otherDocs: null });
  setAddUserConfirmTruth(false);
  setCreditScoreResult(null);
};

// Validation
const isStep1Valid =
  addUserData.fullNameOrBusiness.trim().length > 0 &&
  addUserData.entityType !== '' &&
  addUserData.country.trim().length > 0 &&
  addUserData.city.trim().length > 0;

const isStep2Valid = (() => {
  const rh = Number(addUserData.repaymentHistory);
  return (
    addUserData.monthlyIncomeOrRevenue.trim().length > 0 &&
    addUserData.mobileMoneyUsage.trim().length > 0 &&
    addUserData.repaymentHistory.trim().length > 0 &&
    !Number.isNaN(rh) &&
    rh >= 0 &&
    rh <= 100 &&
    addUserData.requestedCreditLimit.trim().length > 0
  );
})();

const isStep3Valid = !!addUserFiles.repaymentProof && !!addUserFiles.momoStatements;

const canSubmit = isStep1Valid && isStep2Valid && isStep3Valid && addUserConfirmTruth;


  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleApproveLimit = () => {
    if (!selectedBorrower) return;

    // Optimistic update
    const updated = { ...selectedBorrower, approved: true };
    setSelectedBorrower(updated);

    // In a real app, we'd update the main list too or refetch
    // For now, let's just show the success message
    addToast(`Credit limit approved for ${selectedBorrower.name}`, 'success');
  };
  const [searchTerm, setSearchTerm] = useState('');

  // Derived list of unique countries from the data for search suggestions
  const availableCountries = useMemo(() => {
    const countries = new Set(borrowers.map(b => b.location.country));
    return Array.from(countries).sort();
  }, [borrowers]);

  const searchResults = useMemo(() => {
    if (!searchTerm) return [];
    return availableCountries.filter(c =>
      c.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, availableCountries]);

  // Derived list of borrowers for the selected country (for the sidebar list)
  const countryBorrowers = useMemo(() => {
    if (!selectedCountryName) return [];
    return borrowers.filter(b => b.location.country === selectedCountryName);
  }, [selectedCountryName, borrowers]);

  // REGIONAL STATS (Left Panel when no country selected)
  const countryStats = useMemo(() => {
    const stats = new Map<string, { count: number, highRisk: number, avgScore: number, totalScore: number }>();

    borrowers.forEach(b => {
      if (!stats.has(b.location.country)) {
        stats.set(b.location.country, { count: 0, highRisk: 0, avgScore: 0, totalScore: 0 });
      }
      const s = stats.get(b.location.country)!;
      s.count++;
      s.totalScore += b.creditScore;
      if (b.riskLevel === 'High') s.highRisk++;
    });

    return Array.from(stats.entries()).map(([country, data]) => ({
      country,
      count: data.count,
      highRisk: data.highRisk,
      avgScore: Math.floor(data.totalScore / data.count)
    })).sort((a, b) => b.highRisk - a.highRisk); // Sort by risk
  }, [borrowers]);

  // GLOBAL STATS (Right Panel when no borrower selected)
  const globalStats = useMemo(() => {
    const highestLimit = [...borrowers].sort((a, b) => (b.maxLimit || 0) - (a.maxLimit || 0))[0];
    const highestRisk = [...borrowers].sort((a, b) => a.creditScore - b.creditScore)[0]; // Lowest score

    const topRisky = borrowers
      .filter(b => b.riskLevel === 'High')
      .sort((a, b) => a.creditScore - b.creditScore)
      .slice(0, 5);

    return { highestLimit, highestRisk, topRisky };
  }, [borrowers]);

  // REGIONAL STATS (Right Panel when country selected but no borrower)
  const regionalStats = useMemo(() => {
    if (!selectedCountryName) return null;

    const regionBorrowers = borrowers.filter(b => b.location.country === selectedCountryName);
    if (regionBorrowers.length === 0) return null;

    const highestLimit = [...regionBorrowers].sort((a, b) => (b.maxLimit || 0) - (a.maxLimit || 0))[0];
    const highestRisk = [...regionBorrowers].sort((a, b) => a.creditScore - b.creditScore)[0]; // Lowest score

    // Top risky in region, or just top 5 if no high risk
    let topRisky = regionBorrowers
      .filter(b => b.riskLevel === 'High')
      .sort((a, b) => a.creditScore - b.creditScore)
      .slice(0, 5);

    if (topRisky.length === 0) {
      topRisky = [...regionBorrowers].sort((a, b) => a.creditScore - b.creditScore).slice(0, 5);
    }

    return { highestLimit, highestRisk, topRisky };
  }, [selectedCountryName, borrowers]);

  useEffect(() => {
    setMounted(true);

    const fetchBorrowers = async () => {
      try {
        const response = await api.get('/api/borrowers');
        if (response.data.length > 0) {
          // Map backend BorrowerResponse to frontend Borrower type
          setBorrowers(response.data.map((b: any) => ({
            id: `BRW-${b.borrower_id}`,
            name: `${b.first_name} ${b.last_name}`,
            location: {
              lat: b.region_id === 1 ? -1.9441 : b.region_id === 2 ? -2.6000 : b.region_id === 3 ? -1.67409 : -1.9441 + (Math.random() - 0.5) * 0.5,
              lng: b.region_id === 1 ? 30.0619 : b.region_id === 2 ? 29.7333 : b.region_id === 3 ? 29.2562 : 30.0619 + (Math.random() - 0.5) * 0.5,
              city: b.region_id === 1 ? "Kigali" : b.region_id === 2 ? "Huye" : b.region_id === 3 ? "Rubavu" : "Kigali",
              country: "Rwanda"
            },
            creditScore: b.decision === 'Approved' ? 750 : 500,
            riskLevel: b.decision === 'Approved' ? 'Low' : b.decision === 'Denied' ? 'High' : 'Medium',
            spendingTrend: [65, 59, 80, 81, 56, 55, 40],
            repaymentHistory: 95,
            mobileMoneyUsage: 2500,
            approved: b.decision === 'Approved',
            maxLimit: b.loan_amount || 5000
          })));
        } else {
          setBorrowers(MOCK_BORROWERS);
        }
      } catch (error) {
        console.error("Failed to fetch borrowers:", error);
        setBorrowers(MOCK_BORROWERS);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBorrowers();

    const geoJsonUrls = [
      'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson',
      'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_admin_0_countries.geojson',
      'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson'
    ];

    const loadGeoJson = async (index = 0) => {
      if (index >= geoJsonUrls.length) {
        console.warn("All GeoJSON sources failed to load. Map borders will not be visible.");
        return;
      }
      try {
        const res = await fetch(geoJsonUrls[index]);
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        setGeoJson(data);
      } catch (err) {
        console.warn(`Failed to load GeoJSON from source ${index + 1}, trying next...`);
        loadGeoJson(index + 1);
      }
    };

    loadGeoJson();
  }, []);

  if (!mounted) return null;

  return (
    <div className="relative w-full h-screen bg-slate-950 overflow-hidden text-white selection:bg-emerald-500/30">
      {isLoading && (
        <div className="absolute inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
          <p className="font-tech text-emerald-400 animate-pulse tracking-widest text-sm">INITIALIZING TRUSTCHAIN AI...</p>
        </div>
      )}

      {/* 3D Scene Background */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 6], fov: 45, near: 0.01 }}>
          <Suspense fallback={null}>
            {/* Lighting */}
            <ambientLight intensity={0.4} />
            <hemisphereLight args={['#ffffff', '#000000', 0.8]} />
            <directionalLight position={[10, 10, 5]} intensity={1.5} color="#4ade80" />
            <directionalLight position={[-10, -5, -5]} intensity={1} color="#3b82f6" />
            <pointLight position={[0, 5, 0]} intensity={0.5} color="#ffffff" />

            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

            {/* Render Globe only if no country is selected */}
            {!selectedCountryName && (
              <Globe
                borrowers={borrowers}
                onSelectBorrower={setSelectedBorrower}
                selectedCountry={null}
                onSelectCountry={setSelectedCountryName}
                data={geoJson}
              />
            )}

            <OrbitControls
              makeDefault
              enablePan={false}
              enableZoom={!selectedCountryName}
              minDistance={3}
              maxDistance={15}
              autoRotate={!selectedCountryName}
              autoRotateSpeed={0.5}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* -------------------- UI OVERLAYS -------------------- */}

      {/* Header */}
      <header className="absolute top-0 left-0 w-full z-20 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-slate-900/90 to-transparent pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg backdrop-blur-sm">
            <Globe2 className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="font-tech text-2xl font-bold tracking-wider text-white">TRUSTCHAIN<span className="text-emerald-400"> AI</span></h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em]">Decentralized Credit Intelligence</p>
          </div>
        </div>



        {/* Mobile Menu Toggle */}
        <button
          className="md:hidden pointer-events-auto p-2 text-slate-300 hover:text-white"
          onClick={() => setShowMobileMenu(!showMobileMenu)}
        >
          {showMobileMenu ? <X /> : <Menu />}
        </button>
      </header>

      {/* Back Button (Only when Country Selected) */}
      {/* Country Name Display */}
      {selectedCountryName && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="relative animate-in slide-in-from-top-4 duration-700 fade-in flex flex-col items-center">
            <h1 className="text-4xl md:text-6xl font-bold font-tech text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 tracking-[0.2em] uppercase drop-shadow-[0_0_25px_rgba(16,185,129,0.3)] text-center">
              {selectedCountryName}
            </h1>
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-24 h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50"></div>
          </div>
        </div>
      )}

      {/* Return to Orbit Button */}
      {selectedCountryName && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20">
          <button
            onClick={() => setSelectedCountryName(null)}
            className="flex items-center gap-2 px-6 py-2 bg-slate-950/50 hover:bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-full text-emerald-400 text-xs font-bold uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)] hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] group"
          >
            <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> Return to Orbit
          </button>
        </div>
      )}

      {/* CENTER OVERLAY: Big 2D Map (Replaces 3D Scene) */}
      {selectedCountryName && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-8 md:p-20 pointer-events-none">
          <div className="w-full h-full max-w-6xl max-h-[85vh] relative pointer-events-auto animate-in fade-in zoom-in duration-500">
            <CountryMap
              countryName={selectedCountryName}
              geoJson={geoJson}
              borrowers={countryBorrowers}
              onSelectBorrower={setSelectedBorrower}
              className="w-full h-full shadow-2xl shadow-black/80 rounded-3xl border border-slate-800/60 bg-slate-950/80 backdrop-blur-md"
            />
            {/* Decorative Tech Corners */}
            <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 border-emerald-500/50 rounded-tl-2xl -translate-x-1 -translate-y-1"></div>
            <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-emerald-500/50 rounded-tr-2xl translate-x-1 -translate-y-1"></div>
            <div className="absolute bottom-0 left-0 w-16 h-16 border-b-2 border-l-2 border-emerald-500/50 rounded-bl-2xl -translate-x-1 translate-y-1"></div>
            <div className="absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 border-emerald-500/50 rounded-br-2xl translate-x-1 translate-y-1"></div>
          </div>
        </div>
      )}

      {/* Left Panel - Navigation & List */}
      <aside className={`absolute top-24 left-6 w-80 max-h-[85vh] flex flex-col gap-4 z-20 transition-transform duration-500 ${showMobileMenu ? 'translate-x-0' : '-translate-x-[120%] md:translate-x-0'}`}>

        {/* Search Panel */}
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-4 shadow-xl shadow-black/50 pointer-events-auto">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search Region..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-700 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-emerald-500/50 text-slate-200"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-slate-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {searchTerm && (
            <div className="mt-2 bg-slate-950/90 border border-slate-700 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
              {searchResults.length > 0 ? (
                searchResults.map(country => (
                  <button
                    key={country}
                    className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-emerald-500/20 hover:text-emerald-400 flex items-center gap-2 transition-colors"
                    onClick={() => {
                      setSelectedCountryName(country);
                      setSearchTerm('');
                    }}
                  >
                    <MapPin className="w-3 h-3" />
                    {country}
                  </button>
                ))
              ) : (
                <div className="px-4 py-2 text-xs text-slate-500">No regions found</div>
              )}
            </div>
          )}
        </div>

        {/* Dynamic Panel: List or Global Charts */}
        {selectedCountryName ? (
          <div className="pointer-events-auto flex flex-col max-h-[65vh] bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-0 shadow-xl shadow-black/50 overflow-hidden">

            {/* List Header */}
            <div className="p-3 border-b border-slate-700 bg-slate-950/50">
              <div className="flex justify-between items-center">
                <span className="text-white font-tech text-lg">{countryBorrowers.length} Entities</span>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Live
                </span>
              </div>
            </div>

            {/* Sites List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-slate-900/50 custom-scrollbar">
              {countryBorrowers.sort((a, b) => a.creditScore - b.creditScore).map(borrower => (
                <div
                  key={borrower.id}
                  onClick={() => setSelectedBorrower(borrower)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all hover:bg-slate-800 ${selectedBorrower?.id === borrower.id
                    ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                    : 'bg-slate-950/30 border-slate-800 hover:border-slate-600'
                    }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <div className="text-sm font-bold text-slate-200">{borrower.name}</div>
                    <div className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${borrower.riskLevel === 'Low' ? 'text-emerald-400 bg-emerald-500/10' :
                      borrower.riskLevel === 'Medium' ? 'text-amber-400 bg-amber-500/10' : 'text-red-400 bg-red-500/10'
                      }`}>
                      {borrower.creditScore}
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-500">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {borrower.location.city}</span>
                    <span>{borrower.id}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-5 shadow-xl shadow-black/50 pointer-events-auto flex flex-col z-10 overflow-hidden max-h-[60vh]">
            <div className="flex-1 overflow-y-auto custom-scrollbar mb-4">
              <h4 className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 sticky top-0 bg-slate-900/90 z-10 py-1 backdrop-blur-sm">High Risk Regions</h4>
              <div className="space-y-2">
                {countryStats.map(stat => (
                  <div key={stat.country} className="flex items-center justify-between p-2 rounded bg-slate-950/30 border border-slate-800/50 hover:bg-slate-800/50 cursor-pointer transition-colors" onClick={() => setSelectedCountryName(stat.country)}>
                    <div className="flex items-center gap-2">
                      {stat.highRisk > 0 && <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>}
                      <span className="text-xs text-slate-300 font-bold">{stat.country}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${stat.avgScore < 600 ? 'text-red-400 bg-red-500/10' : 'text-emerald-400 bg-emerald-500/10'}`}>
                        {stat.avgScore}
                      </span>
                      <span className="text-[10px] text-slate-500 w-8 text-right">{stat.count} Ent.</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-auto pt-4 border-t border-slate-800">
              <h3 className="font-tech text-xs font-bold text-slate-400 mb-2 flex items-center gap-2 uppercase tracking-wider">
                <Globe2 className="w-3 h-3 text-emerald-500" /> Regional Risk Mix
              </h3>
              <div className="w-full h-[150px] shrink-0">
                <CreditMixChart data={borrowers} />
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Right Panel - Borrower Detail OR Global/Regional Report */}
      {/* Add User Modal */}
      {showAddUserWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-2xl p-6 shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            {/* Top stepper */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                {[
                  { n: 1, label: 'Identity', done: addUserStep > 1 || isStep1Valid },
                  { n: 2, label: 'Financial', done: addUserStep > 2 || isStep2Valid },
                  { n: 3, label: 'Docs', done: isStep3Valid }
                ].map((s, idx, arr) => (
                  <div key={s.n} className="flex items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border transition-all ${
                        s.done ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                      title={s.label}
                    >
                      {s.n}
                    </div>
                    {idx < arr.length - 1 && (
                      <div className={`w-8 h-[2px] mx-1 transition-all ${arr[idx].done ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={resetAddUserWizard}
                className="text-slate-400 hover:text-white transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step content */}
            {addUserStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Full Name / Business Name</label>
                  <input
                    value={addUserData.fullNameOrBusiness}
                    onChange={(e) => setAddUserData(prev => ({ ...prev, fullNameOrBusiness: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g. Iris Kayigamba / Trustchain Ltd"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300">Entity Type</label>
                  <select
                    value={addUserData.entityType}
                    onChange={(e) => setAddUserData(prev => ({ ...prev, entityType: e.target.value as any }))}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select…</option>
                    <option value="Individual">Individual</option>
                    <option value="SME">SME</option>
                    <option value="Corporation">Corporation</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Country</label>
                    <input
                      value={addUserData.country}
                      onChange={(e) => setAddUserData(prev => ({ ...prev, country: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="e.g. Rwanda"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300">City</label>
                    <input
                      value={addUserData.city}
                      onChange={(e) => setAddUserData(prev => ({ ...prev, city: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="e.g. Kigali"
                    />
                  </div>
                </div>
              </div>
            )}

            {addUserStep === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Monthly Income / Business Revenue</label>
                  <input
                    value={addUserData.monthlyIncomeOrRevenue}
                    onChange={(e) => setAddUserData(prev => ({ ...prev, monthlyIncomeOrRevenue: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g. 1,200"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300">Mobile Money Usage / Month</label>
                  <input
                    value={addUserData.mobileMoneyUsage}
                    onChange={(e) => setAddUserData(prev => ({ ...prev, mobileMoneyUsage: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g. 400"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300">Repayment History (%)</label>
                  <input
                    value={addUserData.repaymentHistory}
                    onChange={(e) => setAddUserData(prev => ({ ...prev, repaymentHistory: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="0 - 100"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Must be between 0 and 100.</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300">Requested Credit Limit</label>
                  <input
                    value={addUserData.requestedCreditLimit}
                    onChange={(e) => setAddUserData(prev => ({ ...prev, requestedCreditLimit: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g. 5,000"
                  />
                </div>
              </div>
            )}

            {addUserStep === 3 && (
              <div className="space-y-4">
                <div className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-emerald-500" /> Upload Documents
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Repayment history proof (required)</label>
                    <input
                      type="file"
                      onChange={(e) => setAddUserFiles(prev => ({ ...prev, repaymentProof: e.target.files?.[0] || null }))}
                      className="mt-1 w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-500/10 file:text-emerald-400 hover:file:bg-emerald-500/20"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300">MoMo statements (required)</label>
                    <input
                      type="file"
                      onChange={(e) => setAddUserFiles(prev => ({ ...prev, momoStatements: e.target.files?.[0] || null }))}
                      className="mt-1 w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-500/10 file:text-emerald-400 hover:file:bg-emerald-500/20"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300">Other supporting documents (optional)</label>
                    <input
                      type="file"
                      onChange={(e) => setAddUserFiles(prev => ({ ...prev, otherDocs: e.target.files?.[0] || null }))}
                      className="mt-1 w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-500/10 file:text-emerald-400 hover:file:bg-emerald-500/20"
                    />
                  </div>

                  <div className="pt-3 border-t border-slate-700">
                    <label className="flex items-start gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={addUserConfirmTruth}
                        onChange={(e) => setAddUserConfirmTruth(e.target.checked)}
                        className="mt-1 accent-emerald-500"
                      />
                      <span>I confirm that all the information provided is true and complete.</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() => setAddUserStep(prev => (prev === 1 ? 1 : (prev - 1) as any))}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-white disabled:opacity-40 disabled:hover:text-slate-400 transition-colors"
                disabled={addUserStep === 1}
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>

              {addUserStep < 3 ? (
                <button
                  onClick={() => {
                    if (addUserStep === 1 && !isStep1Valid) return;
                    if (addUserStep === 2 && !isStep2Valid) return;
                    setAddUserStep(prev => (prev + 1) as any);
                  }}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-all"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (!canSubmit) return;
                    addToast(`New entity "${addUserData.fullNameOrBusiness}" submitted for review`, 'success');
                    resetAddUserWizard();
                  }}
                  disabled={!canSubmit}
                  className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                    canSubmit
                      ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg'
                      : 'bg-emerald-600/30 text-white/40 cursor-not-allowed'
                  }`}
                >
                  Submit
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <aside className={`absolute top-6 right-6 w-80 md:w-96 flex flex-col gap-4 z-20 transition-all duration-500 translate-x-0 opacity-100`}>
        {!selectedBorrower ? (
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-5 shadow-xl shadow-black/50 pointer-events-auto animate-in slide-in-from-right-4 fade-in duration-500">

            {(() => {
              if (selectedCountryName && !regionalStats) {
                return (
                  <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center p-6">
                    <div className="p-3 bg-slate-800/50 rounded-full mb-3">
                      <Users className="w-6 h-6 text-slate-600" />
                    </div>
                    <h3 className="font-tech text-lg font-bold text-slate-400 mb-1">{selectedCountryName}</h3>
                    <p className="text-xs text-slate-500 max-w-[200px] leading-relaxed">
                      No active credit entities currently monitored in this region.
                    </p>
                  </div>
                );
              }

              const stats = (selectedCountryName && regionalStats) ? regionalStats : globalStats;
              if (!stats) return null;

              return (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-tech text-lg font-bold text-slate-200 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-500" />
                      {selectedCountryName ? `${selectedCountryName} Risk Report` : 'Global Risk Report'}
                    </h3>

                    {!selectedCountryName && (
                      <button
                        onClick={() => setShowAddUserWizard(true)}
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all shadow-md hover:shadow-lg"
                        title="Add user"
                      >
                        <Plus className="w-4 h-4 text-emerald-400" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                          <div className="p-3 bg-slate-950/50 rounded-lg border border-slate-800">
                            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Highest Exposure</div>
                            <div className="font-mono text-emerald-400 font-bold text-lg">
                              ${stats.highestLimit?.maxLimit?.toLocaleString() || '0'}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">{stats.highestLimit?.name || 'N/A'}</div>
                          </div>
                          <div className="p-3 bg-slate-950/50 rounded-lg border border-slate-800">
                            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Highest Risk</div>
                            <div className="font-mono text-red-400 font-bold text-lg">
                              {stats.highestRisk?.creditScore || '-'}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">{stats.highestRisk?.name || 'N/A'}</div>
                          </div>
                        </div>

                <h4 className="text-[10px] uppercase tracking-widest text-slate-500 mb-3 border-b border-slate-800 pb-2">
                  {selectedCountryName ? 'Top Regional Entities' : 'Top Critical Entities'}
                </h4>
                <div className="space-y-2">
                  {stats.topRisky.map(b => (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBorrower(b)}
                      className="flex justify-between items-center p-2 rounded hover:bg-slate-800 cursor-pointer group"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">{b.name}</span>
                        <span className="text-[10px] text-slate-500">{b.location.city} • {b.id}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-mono font-bold text-red-400">{b.creditScore}</div>
                        <div className="text-[10px] text-slate-600">SCORE</div>
                      </div>
                    </div>
                  ))}
                  {stats.topRisky.length === 0 && (
                    <div className="text-xs text-slate-500 p-2 text-center italic">No high risk entities found in this region.</div>
                  )}
                </div>
              </>
            );
            })()}
          </div>
        ) : (
          <div className="bg-slate-900/90 backdrop-blur-xl border border-emerald-500/30 rounded-xl overflow-hidden shadow-2xl shadow-emerald-900/20 pointer-events-auto">

            {/* Header with Close */}
            <div className="p-5 border-b border-slate-800 flex justify-between items-start bg-gradient-to-r from-emerald-900/20 to-transparent">
              <div>
                <h2 className="font-tech text-2xl font-bold text-white">{selectedBorrower.name}</h2>
                <p className="text-xs font-mono text-emerald-400 mt-1">{selectedBorrower.id}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                  <span>{selectedBorrower.location.city}, {selectedBorrower.location.country}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedBorrower(null)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Score & Radar */}
            <div className="p-5 grid grid-cols-2 gap-4 items-center">
              <div className="flex flex-col items-center justify-center p-4 bg-slate-950/50 rounded-lg border border-slate-800">
                <span className="text-xs text-slate-500 uppercase tracking-widest mb-1">Risk Score</span>
                <span className={`font-tech text-4xl font-bold ${selectedBorrower.riskLevel === 'Low' ? 'text-emerald-400' :
                  selectedBorrower.riskLevel === 'Medium' ? 'text-amber-400' : 'text-red-500'
                  }`}>
                  {selectedBorrower.creditScore}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full mt-2 border ${selectedBorrower.riskLevel === 'Low' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' :
                  selectedBorrower.riskLevel === 'Medium' ? 'border-amber-500/30 text-amber-400 bg-amber-500/10' : 'border-red-500/30 text-red-400 bg-red-500/10'
                  }`}>
                  {selectedBorrower.riskLevel.toUpperCase()}
                </span>
              </div>
              <div className="h-32 w-full">
                <BorrowerRadar borrower={selectedBorrower} />
              </div>
            </div>

            {/* Spending Trend */}
            <div className="px-5 pb-5">
              <h4 className="text-xs uppercase tracking-widest text-slate-500 mb-3">6-Month Spending Trend</h4>
              <div className="h-24 w-full bg-slate-950/30 rounded-lg border border-slate-800/50 p-2">
                <TrendChart data={selectedBorrower.spendingTrend} />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-slate-950/50 border-t border-slate-800 grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowReportModal(true)}
                className="py-2 px-3 rounded text-xs font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 flex items-center justify-center gap-2"
              >
                <FileText className="w-3 h-3" /> Full Report
              </button>
              <button
                onClick={handleApproveLimit}
                disabled={selectedBorrower.approved}
                className={`py-2 px-3 rounded text-xs font-bold uppercase tracking-wider text-white shadow-lg transition-all flex items-center justify-center gap-2 ${selectedBorrower.approved
                  ? 'bg-emerald-500/50 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'
                  }`}
              >
                {selectedBorrower.approved ? (
                  <>
                    <CheckCircle className="w-3 h-3" /> Approved
                  </>
                ) : (
                  'Approve Limit'
                )}
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* MODAL: Full Report */}
      <Modal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        title="Comprehensive Risk Report"
      >
        {selectedBorrower && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className={`p-3 rounded-full ${selectedBorrower.riskLevel === 'Low' ? 'bg-emerald-500/20 text-emerald-400' :
                selectedBorrower.riskLevel === 'Medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-500'
                }`}>
                <ShieldCheck className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">Risk Analysis Complete</h4>
                <p className="text-sm text-slate-400">Generated on {new Date().toLocaleDateString()}</p>
              </div>
              <div className="ml-auto text-right">
                <div className="text-2xl font-mono font-bold text-white">{selectedBorrower.creditScore}</div>
                <div className="text-xs uppercase tracking-wider text-slate-500">Credit Score</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-950/30 rounded-lg border border-slate-800">
                <h5 className="text-xs uppercase tracking-widest text-slate-500 mb-3">Financial Behavior</h5>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li className="flex justify-between">
                    <span>Repayment History</span>
                    <span className="font-mono text-emerald-400">{selectedBorrower.repaymentHistory}%</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Mobile Money Usage</span>
                    <span className="font-mono text-slate-200">${selectedBorrower.mobileMoneyUsage}/mo</span>
                  </li>
                  <li className="flex justify-between border-t border-slate-800 pt-2 mt-2">
                    <span>Recommended Limit</span>
                    <span className="font-mono text-emerald-400 font-bold">${selectedBorrower.maxLimit?.toLocaleString()}</span>
                  </li>
                </ul>
              </div>

              <div className="p-4 bg-slate-950/30 rounded-lg border border-slate-800">
                <h5 className="text-xs uppercase tracking-widest text-slate-500 mb-3">Risk Factors</h5>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li className="flex items-start gap-2">
                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                    <span>Consistent repayment pattern over last 6 months.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                    <span>No default history in cross-border transactions.</span>
                  </li>
                  {selectedBorrower.riskLevel === 'High' && (
                    <li className="flex items-start gap-2 text-red-300">
                      <div className="mt-1 w-1.5 h-1.5 rounded-full bg-red-500"></div>
                      <span>High volatility in recent transaction volume.</span>
                    </li>
                  )}
                </ul>
              </div>
            </div>

            <div className="p-4 bg-slate-950/30 rounded-lg border border-slate-800">
              <h5 className="text-xs uppercase tracking-widest text-slate-500 mb-3">Recommendation</h5>
              <p className="text-sm text-slate-300 leading-relaxed">
                Based on the aggregated data from multiple regional bureaus and mobile money statements,
                the algorithm suggests <strong className="text-white">APPROVAL</strong> for a credit limit up to
                <span className="text-emerald-400"> ${selectedBorrower.maxLimit?.toLocaleString()}</span>.
                The entity shows strong repayment discipline despite regional economic fluctuations.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
              <button
                onClick={() => setShowReportModal(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  handleApproveLimit();
                  setShowReportModal(false);
                }}
                disabled={selectedBorrower.approved}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {selectedBorrower.approved ? 'Limit Approved' : 'Approve & Close'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Toast Notifications container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none *:pointer-events-auto">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            {...toast}
            onClose={removeToast}
          />
        ))}
      </div>
        {/* Bottom Center Compact Stats Bar */}
<div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-30 pointer-events-auto hidden md:block">
  <div className="flex items-center gap-6 bg-slate-900/50 backdrop-blur-md px-5 py-2 rounded-full border border-slate-700/50 shadow-[0_0_20px_rgba(0,0,0,0.45)]">

    {/* TA */}
    <div className="relative group flex items-center gap-2">
      <Users className="w-4 h-4 text-slate-400" />
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] text-slate-400 font-bold tracking-widest">TA</span>
        <span className="font-mono font-bold text-sm text-white">
          {totalUsers.toLocaleString()}
        </span>
      </div>

      {/* Tooltip */}
      <div className="absolute -top-9 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="text-[10px] px-2 py-1 rounded bg-slate-950/90 border border-slate-700 text-slate-200 whitespace-nowrap">
          Total Active
        </div>
      </div>
    </div>

    <div className="w-px h-6 bg-slate-700/50" />

    {/* AS */}
    <div className="relative group flex items-center gap-2">
      <Activity className="w-4 h-4 text-cyan-400" />
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] text-cyan-300 font-bold tracking-widest">AS</span>
        <span className="font-mono font-bold text-sm text-cyan-400">
          {avgScore}
        </span>
      </div>

      {/* Tooltip */}
      <div className="absolute -top-9 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="text-[10px] px-2 py-1 rounded bg-slate-950/90 border border-slate-700 text-slate-200 whitespace-nowrap">
          Average Score
        </div>
      </div>
    </div>

    <div className="w-px h-6 bg-slate-700/50" />

    {/* HR */}
    <div className="relative group flex items-center gap-2">
      <AlertTriangle className="w-4 h-4 text-red-400" />
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] text-red-300 font-bold tracking-widest">HR</span>
        <span className="font-mono font-bold text-sm text-red-400">
          {highRiskCount}
        </span>
      </div>

      {/* Tooltip */}
      <div className="absolute -top-9 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="text-[10px] px-2 py-1 rounded bg-slate-950/90 border border-slate-700 text-slate-200 whitespace-nowrap">
          High Risk
        </div>
      </div>
    </div>

  </div>
</div>

      {/* Footer / System Status */}
      <footer className="absolute bottom-6 left-6 right-6 z-10 flex justify-between items-end pointer-events-none">
        <div className="hidden md:block">
          <div className="flex gap-1 mb-1">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="w-1 h-3 bg-emerald-500/30 rounded-sm"></div>
            ))}
            <div className="w-1 h-3 bg-emerald-500 animate-pulse rounded-sm"></div>
          </div>
          <p className="text-[10px] text-slate-500 font-mono">SYSTEM_STATUS: OPTIMAL</p>
        </div>

        <div className="text-right pointer-events-auto">
          <p className="text-[10px] text-slate-600">
            © 2026 TRUSTCHAIN AI<br />
            POWERED BY CodeRise
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;