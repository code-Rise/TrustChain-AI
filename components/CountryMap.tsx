import React, { useMemo, useState } from 'react';
import { Borrower } from '../types';
import { MapPin } from 'lucide-react';

interface CountryMapProps {
  countryName: string;
  geoJson: any;
  borrowers: Borrower[];
  onSelectBorrower?: (b: Borrower) => void;
  className?: string;
}

export const CountryMap: React.FC<CountryMapProps> = ({ countryName, geoJson, borrowers, onSelectBorrower, className }) => {
  const [hoveredBorrower, setHoveredBorrower] = useState<Borrower | null>(null);

  const { pathData, projection, cities } = useMemo(() => {
    if (!geoJson) return { pathData: '', projection: null, cities: [] };

    // Find feature with robust name matching
    const feature = geoJson.features.find((f: any) => {
       const p = f.properties;
       const candidates = [
           p.name, p.NAME, p.ADMIN, p.NAME_LONG, p.brk_name, p.formal_en, p.sovereignt, p.gu_a3, p.su_a3
       ].filter(v => typeof v === 'string');

       const target = countryName.toLowerCase();
       
       return candidates.some(candidate => {
           const c = candidate.toLowerCase();
           return c === target || 
                  (target === 'usa' && (c === 'united states' || c.includes('united states'))) ||
                  (target === 'uk' && (c === 'united kingdom' || c === 'great britain')) ||
                  (target === 'uae' && c.includes('arab emirates')) ||
                  c.includes(target);
       });
    });

    // Initialize bounds with inverted values
    let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
    
    // Helper to expand bounds
    const expandBounds = (lng: number, lat: number) => {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
    };

    // 1. Process Geometry for bounds (if feature exists)
    let geometry = null;
    if (feature) {
        geometry = feature.geometry;
        const processCoords = (coords: any[]) => {
           coords.forEach(pt => expandBounds(pt[0], pt[1]));
        };
        const traverse = (coords: any, type: string) => {
             if (type === 'Polygon') {
                 coords.forEach((ring: any[]) => processCoords(ring));
             } else if (type === 'MultiPolygon') {
                 coords.forEach((poly: any[]) => poly.forEach((ring: any[]) => processCoords(ring)));
             }
        }
        traverse(geometry.coordinates, geometry.type);
    }

    // 2. IMPORTANT: Process Borrowers for bounds to ensure they are always visible
    borrowers.forEach(b => {
        expandBounds(b.location.lng, b.location.lat);
    });
    
    // Default bounds if nothing found
    if (minLng > maxLng) {
         minLng = -10; maxLng = 10; minLat = -10; maxLat = 10;
    }

    // Add padding (approx 10% of width)
    const lngSpan = maxLng - minLng;
    const latSpan = maxLat - minLat;
    const paddingX = Math.max(lngSpan * 0.1, 0.1); 
    const paddingY = Math.max(latSpan * 0.1, 0.1);

    minLng -= paddingX; maxLng += paddingX;
    minLat -= paddingY; maxLat += paddingY;

    // ViewBox dimensions (Fixed coordinate space, SVG scales via CSS)
    const width = 800; 
    const height = 800 * ((maxLat - minLat) / (maxLng - minLng)) || 600; 
    
    // Projection functions
    const toX = (lng: number) => ((lng - minLng) / (maxLng - minLng)) * width;
    const toY = (lat: number) => height - ((lat - minLat) / (maxLat - minLat)) * height;

    // Generate Path Data
    let d = '';
    if (geometry) {
        const drawRing = (ring: any[]) => {
            if (ring.length === 0) return '';
            const start = ring[0];
            let path = `M ${toX(start[0]).toFixed(1)} ${toY(start[1]).toFixed(1)}`;
            for (let i = 1; i < ring.length; i++) {
                const pt = ring[i];
                path += ` L ${toX(pt[0]).toFixed(1)} ${toY(pt[1]).toFixed(1)}`;
            }
            path += ' Z';
            return path;
        };

        if (geometry.type === 'Polygon') {
             d = geometry.coordinates.map(drawRing).join(' ');
        } else if (geometry.type === 'MultiPolygon') {
             d = geometry.coordinates.map((poly: any[]) => poly.map(drawRing).join(' ')).join(' ');
        }
    }

    // Identify unique cities for labels
    const uniqueCities = Array.from(new Set(borrowers.map(b => b.location.city))).map(cityName => {
         const b = borrowers.find(b => b.location.city === cityName);
         return { name: cityName, lng: b!.location.lng, lat: b!.location.lat };
    });

    return { 
        pathData: d, 
        projection: { toX, toY, width, height },
        cities: uniqueCities
    };
  }, [geoJson, countryName, borrowers]);

  if (!projection) {
      return (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs border border-slate-800 rounded bg-slate-900/50">
              <span className="animate-pulse">Loading map data...</span>
          </div>
      )
  }

  return (
    <div className={`relative bg-slate-950/20 backdrop-blur-sm overflow-hidden flex flex-col group rounded-xl ${className || 'w-full h-full'}`}>
       
       {/* Map Container */}
       <div className="flex-1 w-full h-full relative flex items-center justify-center">
           <svg 
             viewBox={`0 0 ${projection.width} ${projection.height}`} 
             className="w-full h-full" 
             preserveAspectRatio="xMidYMid meet"
           >
               <defs>
                   <pattern id="grid-pattern-map" width="40" height="40" patternUnits="userSpaceOnUse">
                       <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(16, 185, 129, 0.05)" strokeWidth="0.5"/>
                   </pattern>
                   <radialGradient id="glow-bg-map" cx="50%" cy="50%" r="60%">
                       <stop offset="0%" stopColor="#10b981" stopOpacity="0.05" />
                       <stop offset="100%" stopColor="#020617" stopOpacity="0" />
                   </radialGradient>
                   <filter id="glow-filter" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="2" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                   </filter>
               </defs>
               
               <rect width={projection.width} height={projection.height} fill="url(#glow-bg-map)" />
               <rect width={projection.width} height={projection.height} fill="url(#grid-pattern-map)" />
               
               {/* Country Shape */}
               {pathData && (
                 <path 
                    d={pathData} 
                    fill="#1e293b" 
                    fillOpacity="0.4"
                    stroke="#34d399" 
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke" 
                    className="drop-shadow-lg transition-all duration-500"
                 />
               )}

               {/* City Labels */}
               {cities.map((city, i) => (
                   <g key={`city-${i}`} className="pointer-events-none">
                       <text 
                          x={projection.toX(city.lng)} 
                          y={projection.toY(city.lat) - 15} 
                          textAnchor="middle" 
                          fill="#64748b" 
                          fontSize={Math.max(10, projection.width / 45)} 
                          fontFamily="Rajdhani"
                          fontWeight="600"
                          className="uppercase tracking-widest select-none drop-shadow-md"
                       >
                          {city.name}
                       </text>
                   </g>
               ))}

               {/* Borrowers / Risk Points */}
               {borrowers.map(b => {
                   const x = projection.toX(b.location.lng);
                   const y = projection.toY(b.location.lat);
                   const color = b.riskLevel === 'High' ? '#ef4444' : b.riskLevel === 'Medium' ? '#fbbf24' : '#34d399';
                   const isHovered = hoveredBorrower?.id === b.id;
                   
                   return (
                       <g 
                         key={b.id} 
                         className="cursor-pointer transition-opacity"
                         onClick={(e) => {
                             e.stopPropagation();
                             onSelectBorrower?.(b);
                         }}
                         onMouseEnter={() => setHoveredBorrower(b)}
                         onMouseLeave={() => setHoveredBorrower(null)}
                       >
                           {/* Pulse Effect for all nodes on big map */}
                           <circle 
                              cx={x} cy={y} r={projection.width / 40} 
                              fill="none" stroke={color} strokeWidth="1" opacity="0.3"
                           >
                               <animate attributeName="r" from={projection.width / 50} to={projection.width / 25} dur="2s" repeatCount="indefinite" />
                               <animate attributeName="opacity" from="0.6" to="0" dur="2s" repeatCount="indefinite" />
                           </circle>

                           {/* Interactive Circle */}
                           <circle 
                              cx={x} cy={y} 
                              r={isHovered ? projection.width / 50 : projection.width / 60} 
                              fill={color}
                              stroke="#020617" strokeWidth="1"
                              className="transition-all duration-300"
                              filter="url(#glow-filter)"
                           />

                           {/* Connecting Line to Label if hovered */}
                           {isHovered && (
                               <line 
                                x1={x} y1={y} 
                                x2={x + 20} y2={y - 20} 
                                stroke={color} 
                                strokeWidth="1" 
                               />
                           )}
                       </g>
                   )
               })}
           </svg>

           {/* HTML Overlay for Tooltips (Positioned absolutely over the SVG container) */}
           {hoveredBorrower && (
               <div 
                  className="absolute z-50 pointer-events-none"
                  style={{
                      left: `${(projection.toX(hoveredBorrower.location.lng) / projection.width) * 100}%`,
                      top: `${(projection.toY(hoveredBorrower.location.lat) / projection.height) * 100}%`
                  }}
               >
                   <div className="transform -translate-y-full translate-x-4 mb-2 bg-slate-900/95 backdrop-blur-md border border-slate-700 p-3 rounded-lg shadow-xl text-left min-w-[150px]">
                       <div className="text-xs font-bold text-white mb-0.5">{hoveredBorrower.name}</div>
                       <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase tracking-wider mb-2">
                           <MapPin className="w-3 h-3" /> {hoveredBorrower.location.city}
                       </div>
                       <div className="flex items-center justify-between border-t border-slate-800 pt-2">
                           <span className="text-[10px] text-slate-500">Risk Score</span>
                           <span className={`font-mono font-bold text-sm ${
                               hoveredBorrower.riskLevel === 'Low' ? 'text-emerald-400' : 
                               hoveredBorrower.riskLevel === 'Medium' ? 'text-amber-400' : 'text-red-400'
                           }`}>
                               {hoveredBorrower.creditScore}
                           </span>
                       </div>
                   </div>
               </div>
           )}
       </div>
    </div>
  );
}