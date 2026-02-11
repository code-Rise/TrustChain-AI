import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, useLoader, ThreeEvent, useThree } from '@react-three/fiber';
import { Sphere, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Borrower } from '../types';

interface GlobeProps {
  borrowers: Borrower[];
  onSelectBorrower: (b: Borrower | null) => void;
  selectedCountry: string | null;
  onSelectCountry: (country: string | null) => void;
  data: any; // geoJson
}

const GLOBE_RADIUS = 2.5;

// Helper to convert Lat/Lng to Vector3
const latLngToVector3 = (lat: number, lng: number, radius: number): THREE.Vector3 => {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
};

// Helper to convert Vector3 on sphere to Lat/Lng
const vector3ToLatLng = (v: THREE.Vector3, radius: number) => {
  const n = v.clone().normalize();
  const lat = 90 - (Math.acos(n.y) * 180) / Math.PI;
  const lng = ((Math.atan2(n.z, -n.x) * 180) / Math.PI);
  return { lat, lng };
};

// Point in Polygon algorithm (Ray Casting)
const isPointInPolygon = (point: [number, number], vs: [number, number][]) => {
    const x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const xi = vs[i][0], yi = vs[i][1];
        const xj = vs[j][0], yj = vs[j][1];
        const intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
};

export const Globe: React.FC<GlobeProps> = ({ borrowers, onSelectBorrower, selectedCountry, onSelectCountry, data: geoJson }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  
  // Country Hover State
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<THREE.Vector3 | null>(null);

  const [selectedCountryCenter, setSelectedCountryCenter] = useState<THREE.Vector3 | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const { camera, controls } = useThree(); // Access camera and controls (OrbitControls needs makeDefault in App)
  
  // Load Earth Texture (Blue Marble / Satellite View)
  const earthMap = useLoader(THREE.TextureLoader, 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg');

  // Process GeoJSON into 3D Lines
  const countryBorders = useMemo(() => {
    if (!geoJson) return [];
    
    const borders: { name: string, points: THREE.Vector3[][], rawPoints: THREE.Vector3[] }[] = [];

    geoJson.features.forEach((feature: any) => {
        const name = feature.properties.name || feature.properties.NAME;
        const geometry = feature.geometry;

        const processPolygon = (coords: any[]) => {
            return coords.map((pt: any) => 
                latLngToVector3(pt[1], pt[0], GLOBE_RADIUS + 0.01) // Slightly above surface
            );
        };

        if (geometry.type === 'Polygon') {
             const polyPoints = geometry.coordinates.map(processPolygon);
             borders.push({
                 name,
                 points: polyPoints,
                 rawPoints: polyPoints.flat()
             });
        } else if (geometry.type === 'MultiPolygon') {
             const multiPoints = geometry.coordinates.map((polygon: any) => polygon.map(processPolygon));
             borders.push({
                 name,
                 points: multiPoints.flat(),
                 rawPoints: multiPoints.flat().flat()
             });
        }
    });
    return borders;
  }, [geoJson]);

  // React to selectedCountry prop changes to set center and trigger animation
  useEffect(() => {
    if (selectedCountry) {
        if (countryBorders.length > 0) {
            // Find country case-insensitive and handle common abbreviations
            const countryData = countryBorders.find(c => {
                const n = c.name.toLowerCase();
                const s = selectedCountry.toLowerCase();
                return n === s ||
                       (s === 'usa' && n === 'united states of america') ||
                       (s === 'uk' && n === 'united kingdom') ||
                       (s === 'uae' && n.includes('arab emirates'));
            });
            
            if (countryData && countryData.rawPoints.length > 0) {
                 const center = new THREE.Vector3();
                 countryData.rawPoints.forEach(p => center.add(p));
                 center.divideScalar(countryData.rawPoints.length);
                 setSelectedCountryCenter(center);
                 setIsAnimating(true);
            }
        }
    } else {
        setSelectedCountryCenter(null);
        // Trigger animation to reset view on deselect
        setIsAnimating(true);
    }
  }, [selectedCountry, countryBorders]);

  // Animation Loop
  useFrame((state, delta) => {
    // Idle Rotation
    if (groupRef.current && !selectedCountry) {
       groupRef.current.rotation.y += delta * 0.05;
    }

    // Zoom & Focus Logic
    if (isAnimating && controls) {
      const orbitControls = controls as any;
      let targetPos: THREE.Vector3;
      let targetLookAt: THREE.Vector3;
      const stopDistanceThreshold = 0.05;

      if (selectedCountry && selectedCountryCenter) {
          // 1. Calculate ideal camera position: Directly above the center point
          const direction = selectedCountryCenter.clone().normalize();
          
          // Zoom closer: Radius (2.5) + Height (0.8) = 3.3. Standard view is usually 6-10.
          const zoomDistance = GLOBE_RADIUS + 0.8; 
          targetPos = direction.clone().multiplyScalar(zoomDistance); 
          targetLookAt = selectedCountryCenter;
      } else {
          // Reset to global view
          targetLookAt = new THREE.Vector3(0, 0, 0);
          // If camera is too close, pull it back to a default distance
          if (camera.position.length() < 6) {
             targetPos = camera.position.clone().normalize().multiplyScalar(6);
          } else {
             targetPos = camera.position.clone();
          }
      }

      // Smoothly interpolate
      camera.position.lerp(targetPos, 0.08);
      orbitControls.target.lerp(targetLookAt, 0.08);
      orbitControls.update();

      // Check if we reached the target
      if (camera.position.distanceTo(targetPos) < stopDistanceThreshold && 
          orbitControls.target.distanceTo(targetLookAt) < stopDistanceThreshold) {
          setIsAnimating(false);
      }
    }
  });

  const points = useMemo(() => {
    return borrowers.map((b) => {
      const pos = latLngToVector3(b.location.lat, b.location.lng, GLOBE_RADIUS);
      let color = '#34d399'; // emerald-400
      if (b.riskLevel === 'Medium') color = '#fbbf24'; // amber-400
      if (b.riskLevel === 'High') color = '#ef4444'; // red-500
      return { ...b, position: pos, color };
    });
  }, [borrowers]);

  // Reusable function to find country at a 3D world point
  const getCountryAtPoint = (point: THREE.Vector3) => {
      if (!geoJson || !groupRef.current) return null;
      
      // Convert world point to local point (taking into account rotation)
      const localPoint = groupRef.current.worldToLocal(point.clone());
      const { lat, lng } = vector3ToLatLng(localPoint, GLOBE_RADIUS);

      for (const feature of geoJson.features) {
          const geometry = feature.geometry;
          const name = feature.properties.name || feature.properties.NAME;
          
          if (geometry.type === 'Polygon') {
               if (isPointInPolygon([lng, lat], geometry.coordinates[0])) {
                   return name;
               }
          } else if (geometry.type === 'MultiPolygon') {
               for (const polygon of geometry.coordinates) {
                   if (isPointInPolygon([lng, lat], polygon[0])) {
                       return name;
                   }
               }
          }
      }
      return null;
  };

  const handleGlobeClick = (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      const foundCountry = getCountryAtPoint(e.point);

      if (foundCountry) {
          // Map inconsistent naming if necessary, though getCountryAtPoint returns GeoJSON name
          // We rely on App to handle selectedCountry string matching
          if (foundCountry === selectedCountry) {
            onSelectCountry(null); // Deselect
          } else {
            // Try to map back to our simpler names if needed, or just pass the full name
            // For now passing full name from GeoJSON is fine, App will need to handle it.
            // But wait, our `borrowers` have simple names like "USA".
            // If we click "United States", selectedCountry becomes "United States".
            // Then logic in App needs to match.
            // Let's implement a reverse lookup? Or just let user click.
            // For consistency, let's just pass what we found.
            onSelectCountry(foundCountry); 
          }
      } else {
          onSelectCountry(null); // Deselect if clicked on ocean
      }
  };

  const handleGlobePointerMove = (e: ThreeEvent<PointerEvent>) => {
     e.stopPropagation();
     const foundCountry = getCountryAtPoint(e.point);
     
     if (foundCountry) {
         setHoveredCountry(foundCountry);
         // Store local point for <Html> positioning inside group
         const localPoint = groupRef.current!.worldToLocal(e.point.clone());
         setHoveredPoint(localPoint);
         document.body.style.cursor = 'pointer';
     } else {
         setHoveredCountry(null);
         setHoveredPoint(null);
         document.body.style.cursor = 'auto'; // or 'grab'
     }
  };

  return (
    <group ref={groupRef}>
      {/* Main Sphere (Earth Map) - Darkened for futuristic look */}
      <Sphere 
        args={[GLOBE_RADIUS, 64, 64]} 
        onClick={handleGlobeClick}
        onPointerMove={handleGlobePointerMove}
        onPointerOut={() => {
            document.body.style.cursor = 'auto';
            setHoveredCountry(null);
        }}
      >
        <meshStandardMaterial
          map={earthMap}
          color="#475569" // Dark Slate
          roughness={0.8}
          metalness={0.1}
          emissive="#020617" // Very dark blue
          emissiveIntensity={0.5}
        />
      </Sphere>

      {/* Country Borders */}
      {countryBorders.map((country, i) => {
         // Match logic
         const n = country.name.toLowerCase();
         const s = selectedCountry ? selectedCountry.toLowerCase() : '';
         const isSelected = n === s || 
              (s === 'usa' && n === 'united states of america') ||
              (s === 'uk' && n === 'united kingdom') ||
              (s === 'uae' && n.includes('arab emirates'));

         return (
             <group key={`${country.name}-${i}`}>
                 {country.points.map((linePoints, j) => {
                    return (
                        <CountryLine 
                            key={j} 
                            points={linePoints} 
                            isSelected={isSelected} 
                        />
                    );
                 })}
             </group>
         )
      })}
      
      {/* Selected Country Label */}
      {selectedCountry && selectedCountryCenter && (
           <Html position={selectedCountryCenter.clone().multiplyScalar(1.05)} center zIndexRange={[100, 0]}>
               <div className="pointer-events-none bg-black/90 text-emerald-400 border border-emerald-500/50 px-4 py-2 rounded text-base font-tech font-bold tracking-widest uppercase shadow-[0_0_20px_rgba(16,185,129,0.5)] animate-bounce whitespace-nowrap">
                   {selectedCountry}
               </div>
           </Html>
      )}

      {/* Hovered Country Tooltip (Only show if different from selected or no selected) */}
      {hoveredCountry && hoveredPoint && hoveredCountry !== selectedCountry && (
          <Html position={hoveredPoint.clone().multiplyScalar(1.05)} center pointerEvents="none" zIndexRange={[100, 0]}>
              <div className="bg-slate-900/80 backdrop-blur-sm text-slate-200 border border-slate-600/50 px-3 py-1 rounded text-xs font-tech font-bold tracking-wider uppercase shadow-lg whitespace-nowrap transform -translate-y-6">
                  {hoveredCountry}
              </div>
          </Html>
      )}

      {/* Atmosphere Glow */}
       <Sphere args={[GLOBE_RADIUS + 0.2, 32, 32]}>
        <meshBasicMaterial
          color="#1e293b"
          transparent
          opacity={0.05}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </Sphere>

      {/* Data Points */}
      {points.map((point) => (
        <group key={point.id} position={point.position}>
            {/* The interactive dot */}
            <mesh
                onClick={(e) => {
                    e.stopPropagation();
                    onSelectBorrower(point);
                }}
                onPointerOver={(e) => {
                    e.stopPropagation();
                    document.body.style.cursor = 'pointer';
                    setHoveredId(point.id);
                }}
                onPointerOut={(e) => {
                     e.stopPropagation();
                     document.body.style.cursor = 'auto';
                     setHoveredId(null);
                }}
            >
                {/* Increase size if in map mode (selectedCountry is present) for better visibility */}
                <sphereGeometry args={[selectedCountry ? 0.04 : 0.06, 16, 16]} />
                <meshStandardMaterial
                    color={point.color}
                    emissive={point.color}
                    emissiveIntensity={hoveredId === point.id ? 4 : 2}
                    toneMapped={false}
                />
            </mesh>
            
            {/* Height Line (visualizing value/volume) */}
            <Line
                points={[[0,0,0], [0, 0.2 + (point.mobileMoneyUsage / 2000), 0]]} 
                color={point.color}
                lineWidth={1}
                transparent
                opacity={0.6}
            />

            {/* Hover Tooltip in 3D space */}
            {hoveredId === point.id && (
                <Html distanceFactor={10} zIndexRange={[200, 0]}>
                    <div className="bg-slate-900/90 backdrop-blur-md border border-emerald-500/50 p-2 rounded text-xs text-white whitespace-nowrap pointer-events-none transform -translate-y-8 shadow-lg shadow-black/50 z-50">
                        <div className="font-bold text-emerald-400 font-tech uppercase tracking-wider">{point.name}</div>
                        <div className="text-slate-300">{point.location.city}, {point.location.country}</div>
                        <div className="text-[10px] text-slate-400 mt-1">Score: {point.creditScore}</div>
                    </div>
                </Html>
            )}
        </group>
      ))}
    </group>
  );
};

// Extracted Line component to handle its own animation state
const CountryLine = ({ points, isSelected }: { points: THREE.Vector3[], isSelected: boolean }) => {
    const [pulse, setPulse] = useState(0);
    
    useFrame((state, delta) => {
        if (isSelected) {
            setPulse(prev => prev + delta * 5);
        }
    });

    const opacity = isSelected ? 0.8 + Math.sin(pulse) * 0.2 : 0.1;
    const width = isSelected ? 4 : 1;
    const color = isSelected ? "#4ade80" : "#64748b"; // emerald-400 vs slate-500

    return (
        <Line
            points={points}
            color={color}
            lineWidth={width}
            transparent
            opacity={opacity}
        />
    );
};
