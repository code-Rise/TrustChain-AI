import React, { useMemo } from 'react';
import { Borrower } from '../types';

interface CountryMapProps {
  countryName: string;
  geoJson: any;
  borrowers: Borrower[];
}

export const CountryMap: React.FC<CountryMapProps> = ({ countryName, geoJson, borrowers }) => {
  const { pathData, projection, cities } = useMemo(() => {
    if (!geoJson) return { pathData: '', projection: null, cities: [] };

    // Find feature with robust name matching
    const feature = geoJson.features.find((f: any) => {
       const name = f.properties.name || f.properties.NAME || f.properties.ADMIN;
       if (!name) return false;
       const n = name.toLowerCase();
       const s = countryName.toLowerCase();
       return n === s ||
              (s === 'usa' && n.includes('united states')) ||
              (s === 'uk' && n.includes('united kingdom')) ||
              (s === 'uae' && n.includes('arab emirates'));
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
        if (geometry.type === 'Polygon') {
            geometry.coordinates.forEach((ring: any[]) => processCoords(ring));
        } else if (geometry.type === 'MultiPolygon') {
            geometry.coordinates.forEach((poly: any[]) => poly.forEach((ring: any[]) => processCoords(ring)));
        }
    }

    // 2. IMPORTANT: Process Borrowers for bounds to ensure they are always visible
    // This fixes issues where the map shape might be small/missing but we still want to see data
    borrowers.forEach(b => {
        expandBounds(b.location.lng, b.location.lat);
    });
    
    // Default bounds if nothing found (shouldn't happen if borrowers exist)
    if (minLng > maxLng) {
         minLng = -10; maxLng = 10; minLat = -10; maxLat = 10;
    }

    // Add padding (approx 15% of width to leave room for labels)
    const lngSpan = maxLng - minLng;
    const latSpan = maxLat - minLat;
    const paddingX = Math.max(lngSpan * 0.15, 0.1); // Minimum padding
    const paddingY = Math.max(latSpan * 0.15, 0.1);

    minLng -= paddingX; maxLng += paddingX;
    minLat -= paddingY; maxLat += paddingY;

    // ViewBox dimensions
    const width = 400; // Increased resolution of SVG space
    const height = 400 * ((maxLat - minLat) / (maxLng - minLng)) || 300; 
    
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
          <div className="flex flex-col items-center justify-center h-64 text-slate-500 text-xs border border-slate-800 rounded bg-slate-900/50">
              <span className="animate-pulse">Loading map data...</span>
          </div>
      )
  }

  return (
    <div className="relative w-full flex-1 min-h-[300px] bg-slate-950/50 backdrop-blur-md border border-slate-800 rounded-xl overflow-hidden p-0 shadow-2xl flex flex-col group">
       {/* Header Overlay */}
       <div className="absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-start pointer-events-none">
          <div className="bg-slate-950/80 backdrop-blur border border-slate-800 px-3 py-1 rounded text-xs text-slate-400">
             {borrowers.length} Active Targets
          </div>
       </div>
       
       <div className="flex-1 w-full h-full relative flex items-center justify-center bg-slate-900/20">
           <svg 
             viewBox={`0 0 ${projection.width} ${projection.height}`} 
             className="w-full h-full max-h-[400px] transition-transform duration-700 ease-out group-hover:scale-[1.02]" 
             preserveAspectRatio="xMidYMid meet"
           >
               {/* Background Grid Pattern */}
               <defs>
                   <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                       <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(16, 185, 129, 0.05)" strokeWidth="0.5"/>
                   </pattern>
                   <radialGradient id="glow-bg" cx="50%" cy="50%" r="50%">
                       <stop offset="0%" stopColor="#10b981" stopOpacity="0.1" />
                       <stop offset="100%" stopColor="#020617" stopOpacity="0" />
                   </radialGradient>
               </defs>
               
               {/* Center Glow */}
               <rect width={projection.width} height={projection.height} fill="url(#glow-bg)" />
               <rect width={projection.width} height={projection.height} fill="url(#grid-pattern)" />
               
               {/* Country Shape */}
               {pathData && (
                 <path 
                    d={pathData} 
                    fill="#1e293b" 
                    fillOpacity="0.5"
                    stroke="#34d399" 
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke" 
                    className="drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                 />
               )}

               {/* City Labels & Markers */}
               {cities.map((city, i) => (
                   <g key={`city-${i}`}>
                       <text 
                          x={projection.toX(city.lng)} 
                          y={projection.toY(city.lat) - 12} 
                          textAnchor="middle" 
                          fill="#94a3b8" 
                          fontSize={projection.width / 35} 
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
                   
                   return (
                       <g key={b.id}>
                           {/* Pulse Effect for High Risk */}
                           {b.riskLevel === 'High' && (
                               <circle 
                                  cx={x} cy={y} r={projection.width / 40} 
                                  fill="none" stroke={color} strokeWidth="0.5" opacity="0.5"
                               >
                                   <animate attributeName="r" from={projection.width / 60} to={projection.width / 25} dur="1.5s" repeatCount="indefinite" />
                                   <animate attributeName="opacity" from="0.8" to="0" dur="1.5s" repeatCount="indefinite" />
                               </circle>
                           )}
                           
                           {/* Main Dot */}
                           <circle 
                              cx={x} 
                              cy={y} 
                              r={projection.width / 60} 
                              fill={color}
                              stroke="#020617"
                              strokeWidth="0.5"
                              className="drop-shadow-[0_0_8px_rgba(0,0,0,1)]"
                           />
                       </g>
                   )
               })}
           </svg>
       </div>
       
       <div className="mt-0 pt-3 border-t border-slate-800/50 flex justify-between items-center text-[10px] text-slate-500 bg-slate-950/30 px-4 py-2">
           <div className="flex gap-4">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> LOW</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span> MED</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> HIGH</span>
           </div>
           <span className="text-emerald-500 font-mono">LIVE_FEED_v2.0</span>
       </div>
    </div>
  );
}
