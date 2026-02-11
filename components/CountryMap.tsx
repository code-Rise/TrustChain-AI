import React, { useMemo } from 'react';
import { Borrower } from '../types';

interface CountryMapProps {
  countryName: string;
  geoJson: any;
  borrowers: Borrower[];
}

export const CountryMap: React.FC<CountryMapProps> = ({ countryName, geoJson, borrowers }) => {
  const { pathData, projection } = useMemo(() => {
    if (!geoJson) return { pathData: '', projection: null };

    // Find feature with basic name normalization
    const feature = geoJson.features.find((f: any) => {
       const name = f.properties.name || f.properties.NAME;
       const n = name.toLowerCase();
       const s = countryName.toLowerCase();
       return n === s ||
              (s === 'usa' && n === 'united states of america') ||
              (s === 'uk' && n === 'united kingdom') ||
              (s === 'uae' && n.includes('arab emirates'));
    });

    if (!feature) return { pathData: '', projection: null };

    // Calculate Bounds
    let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
    
    const processCoords = (coords: any[]) => {
       coords.forEach(pt => {
          const [lng, lat] = pt;
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
       });
    };

    const geometry = feature.geometry;
    if (geometry.type === 'Polygon') {
        geometry.coordinates.forEach((ring: any[]) => processCoords(ring));
    } else if (geometry.type === 'MultiPolygon') {
        geometry.coordinates.forEach((poly: any[]) => poly.forEach((ring: any[]) => processCoords(ring)));
    }

    // Add padding (approx 10% of width)
    const lngSpan = maxLng - minLng;
    const latSpan = maxLat - minLat;
    const paddingX = lngSpan * 0.1;
    const paddingY = latSpan * 0.1;

    minLng -= paddingX; maxLng += paddingX;
    minLat -= paddingY; maxLat += paddingY;

    // ViewBox dimensions (arbitrary units)
    const width = 200;
    const height = 200 * ((maxLat - minLat) / (maxLng - minLng)); // Preserve aspect ratio
    
    // Simple projection
    const toX = (lng: number) => ((lng - minLng) / (maxLng - minLng)) * width;
    const toY = (lat: number) => height - ((lat - minLat) / (maxLat - minLat)) * height; // Flip Y

    // Generate Path
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

    let d = '';
    if (geometry.type === 'Polygon') {
         d = geometry.coordinates.map(drawRing).join(' ');
    } else if (geometry.type === 'MultiPolygon') {
         d = geometry.coordinates.map((poly: any[]) => poly.map(drawRing).join(' ')).join(' ');
    }

    return { 
        pathData: d, 
        projection: { toX, toY, width, height }
    };
  }, [geoJson, countryName]);

  if (!pathData || !projection) {
      return (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500 text-xs border border-slate-800 rounded bg-slate-900/50">
              <span>Map data unavailable for</span>
              <span className="text-emerald-500 font-bold mt-1">{countryName}</span>
          </div>
      )
  }

  return (
    <div className="relative w-full flex-1 min-h-[250px] bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl overflow-hidden p-4 shadow-xl flex flex-col">
       <div className="absolute top-0 right-0 p-4 z-10">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-emerald-400 bg-slate-950/80 px-2 py-1 rounded border border-emerald-500/30">
            <span>Active Users: {borrowers.length}</span>
          </div>
       </div>
       
       <div className="flex-1 w-full h-full relative flex items-center justify-center">
           <svg 
             viewBox={`0 0 ${projection.width} ${projection.height}`} 
             className="w-full h-full max-h-[300px] drop-shadow-[0_0_15px_rgba(16,185,129,0.2)]" 
             preserveAspectRatio="xMidYMid meet"
           >
               {/* Background Grid */}
               <defs>
                   <pattern id={`grid-${countryName}`} width="10" height="10" patternUnits="userSpaceOnUse">
                       <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5"/>
                   </pattern>
               </defs>
               <rect width={projection.width} height={projection.height} fill={`url(#grid-${countryName})`} />
               
               {/* Country Shape */}
               <path 
                  d={pathData} 
                  fill="rgba(16, 185, 129, 0.05)" 
                  stroke="#34d399" 
                  strokeWidth="0.5" 
                  vectorEffect="non-scaling-stroke" 
               />

               {/* Borrowers */}
               {borrowers.map(b => (
                   <circle 
                      key={b.id}
                      cx={projection.toX(b.location.lng)}
                      cy={projection.toY(b.location.lat)}
                      r={projection.width / 80} // Relative size
                      fill={b.riskLevel === 'High' ? '#ef4444' : b.riskLevel === 'Medium' ? '#fbbf24' : '#34d399'}
                      className="animate-pulse"
                      stroke="#0f172a"
                      strokeWidth="0.5"
                   />
               ))}
           </svg>
       </div>
       
       <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-500">
           <span>COORDS: {projection.width.toFixed(0)}x{projection.height.toFixed(0)}</span>
           <span className="animate-pulse text-emerald-500">LIVE FEED</span>
       </div>
    </div>
  );
}
