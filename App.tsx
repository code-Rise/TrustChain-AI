import React, { useState, Suspense, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { Globe } from './components/Globe';
import { CountryMap } from './components/CountryMap';
import { CreditMixChart, BorrowerRadar, TrendChart } from './components/Charts';
import { MOCK_BORROWERS } from './utils/data';
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
  AlertTriangle
} from 'lucide-react';
import { Modal } from './components/Modal';
import { Toast, ToastType } from './components/Toast';

const App: React.FC = () => {
  const [selectedBorrower, setSelectedBorrower] = useState<Borrower | null>(null);
  const [borrowers] = useState<Borrower[]>(MOCK_BORROWERS);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [selectedCountryName, setSelectedCountryName] = useState<string | null>(null);
  const [geoJson, setGeoJson] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
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

  useEffect(() => {
    setMounted(true);

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

  // Stats for the header
  const totalUsers = borrowers.length;
  const avgScore = Math.floor(borrowers.reduce((acc, b) => acc + b.creditScore, 0) / totalUsers);
  const highRiskCount = borrowers.filter(b => b.riskLevel === 'High').length;

  return (
    <div className="relative w-full h-screen bg-slate-950 overflow-hidden text-white selection:bg-emerald-500/30">

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
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="font-tech text-2xl font-bold tracking-wider text-white">SENTINEL<span className="text-emerald-400">RISK</span></h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em]">Global Credit Monitoring System</p>
          </div>
        </div>

        {/* Desktop Stats Ticker */}
        <div className="hidden md:flex items-center gap-8 pointer-events-auto bg-slate-900/40 backdrop-blur-md px-6 py-2 rounded-full border border-slate-700/50">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase">Total Active</span>
              <span className="font-mono font-bold text-sm">{totalUsers.toLocaleString()}</span>
            </div>
          </div>
          <div className="w-px h-6 bg-slate-700/50"></div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase">Avg Score</span>
              <span className="font-mono font-bold text-sm text-cyan-400">{avgScore}</span>
            </div>
          </div>
          <div className="w-px h-6 bg-slate-700/50"></div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase">High Risk</span>
              <span className="font-mono font-bold text-sm text-red-400">{highRiskCount}</span>
            </div>
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
      {selectedCountryName && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30">
          <button
            onClick={() => setSelectedCountryName(null)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900/80 hover:bg-slate-800 backdrop-blur border border-slate-700 rounded-full text-slate-200 text-xs font-bold uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)] hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]"
          >
            <ArrowLeft className="w-3 h-3" /> Return to Orbit
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
          <div className="flex-1 min-h-[250px] bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-5 shadow-xl shadow-black/50 pointer-events-auto flex flex-col z-10">
            <h3 className="font-tech text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-emerald-500" /> Regional Risk Mix
            </h3>
            <div className="flex-1 w-full -ml-2">
              <CreditMixChart data={borrowers} />
            </div>
            <div className="mt-4 pt-4 border-t border-slate-800">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Algorithm v2.4 Active</span>
                <span className="text-emerald-500 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live
                </span>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Right Panel - Borrower Detail (Shows when selected) */}
      <aside className={`absolute top-24 right-6 w-80 md:w-96 flex flex-col gap-4 z-20 transition-all duration-500 ${selectedBorrower ? 'translate-x-0 opacity-100' : 'translate-x-[120%] opacity-0'}`}>
        {selectedBorrower && (
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
              <button className="py-2 px-3 rounded text-xs font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700">
                Full Report
              </button>
              <button className="py-2 px-3 rounded text-xs font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 transition-all">
                Approve Limit
              </button>
            </div>
          </div>
        )}
      </aside>

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
            © 2026 SENTINEL RISK SYSTEMS<br />
            POWERED BY CodeRise
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;