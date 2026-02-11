import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, useLoader, ThreeEvent, useThree } from '@react-three/fiber';
import { Sphere, Html } from '@react-three/drei';
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

// Native Line component to avoid shader errors with Line2/LineMaterial
// Using primitive to avoid TypeScript confusion with SVG <line>
const CountryLine: React.FC<{ points: THREE.Vector3[], isSelected: boolean }> = ({ points, isSelected }) => {
    const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);
    const [pulse, setPulse] = useState(0);
    const line = useMemo(() => new THREE.Line(), []);
    
    useFrame((state, delta) => {
        if (isSelected) {
            setPulse(prev => prev + delta * 5);
        }
    });

    const opacity = isSelected ? 0.8 + Math.sin(pulse) * 0.2 : 0.2;
    // Note: lineBasicMaterial 'linewidth' only works on some environments (not Chrome/Windows). 
    // We rely on color brightness/opacity for distinction.
    const color = isSelected ? "#4ade80" : "#475569"; 

    return (
        <primitive object={line} geometry={geometry}>
            <lineBasicMaterial 
                color={color}
                transparent
                opacity={opacity}
                linewidth={1} 
            />
        </primitive>
    );
};

export const Globe: React.FC<GlobeProps> = ({ borrowers, onSelectBorrower, selectedCountry, onSelectCountry, data: geoJson }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  
  // Country Hover State
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<THREE.Vector3 | null>(null);

  const [selectedCountryCenter, setSelectedCountryCenter] = useState<THREE.Vector3 | null>(null);
  const [zoomOffset, setZoomOffset] = useState<number>(1.0); // Dynamic zoom level (distance from surface)
  const [isAnimating, setIsAnimating] = useState(false);
  
  const { camera, controls } = useThree(); // Access camera and controls (OrbitControls needs makeDefault in App)
  
  // Load Earth Texture (Blue Marble / Satellite View)
  const earthMap = useLoader(THREE.TextureLoader, 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg');

  // Process GeoJSON into 3D Lines
  const countryBorders = useMemo(() => {
    if (!geoJson) return [];
    
    const borders: { name: string, points: THREE.Vector3[][], rawPoints: THREE.Vector3[] }[] = [];

    geoJson.features.forEach((feature: any) => {
        // Try multiple properties for the name
        const name = feature.properties.name || feature.properties.NAME || feature.properties.ADMIN || feature.properties.NAME_LONG;
        const geometry = feature.geometry;

        const processPolygon = (coords: any[]) => {
            return coords.map((pt: any) => 
                latLngToVector3(pt[1], pt[0], GLOBE_RADIUS + 0.01) // Slightly above surface
            );
        };

        if (geometry.type === 'Polygon') {
             const polyPoints = geometry.coordinates.map(processPolygon);
             borders.push({
                 name: name || 'Unknown',
                 points: polyPoints,
                 rawPoints: polyPoints.flat()
             });
        } else if (geometry.type === 'MultiPolygon') {
             const multiPoints = geometry.coordinates.map((polygon: any) => polygon.map(processPolygon));
             borders.push({
                 name: name || 'Unknown',
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
        let center: THREE.Vector3 | null = null;
        let newZoom = 1.0;
        const s = selectedCountry.toLowerCase();

        // 1. Try to find center from Country Borders (GeoJSON)
        if (countryBorders.length > 0) {
            const countryData = countryBorders.find(c => {
                const n = c.name.toLowerCase();
                return n === s ||
                       (s === 'usa' && (n === 'united states' || n.includes('united states'))) ||
                       (s === 'uk' && (n === 'united kingdom' || n === 'great britain')) ||
                       (s === 'uae' && n.includes('arab emirates'));
            });
            
            if (countryData && countryData.rawPoints.length > 0) {
                 const c = new THREE.Vector3();
                 countryData.rawPoints.forEach(p => c.add(p));
                 c.divideScalar(countryData.rawPoints.length);
                 
                 // Project to surface for accurate distance calculation
                 const surfaceCenter = c.clone().normalize().multiplyScalar(GLOBE_RADIUS);
                 center = surfaceCenter;

                 // Calculate bounding radius (max distance from center to any point in the country)
                 let maxDist = 0;
                 countryData.rawPoints.forEach(p => {
                    const d = p.distanceTo(surfaceCenter);
                    if (d > maxDist) maxDist = d;
                 });
                 
                 // Heuristic: scale zoom based on country size.
                 // We want to be at least 0.1 units away (2.6 total)
                 newZoom = Math.max(0.1, maxDist * 1.5);
            }
        }

        // 2. Fallback: Calculate center from Borrowers in that country if map data missing
        if (!center) {
            const countryBorrowers = borrowers.filter(b => b.location.country.toLowerCase() === s);
            if (countryBorrowers.length > 0) {
                 const c = new THREE.Vector3();
                 countryBorrowers.forEach(b => {
                     const pos = latLngToVector3(b.location.lat, b.location.lng, GLOBE_RADIUS);
                     c.add(pos);
                 });
                 c.divideScalar(countryBorrowers.length);
                 
                 const surfaceCenter = c.clone().normalize().multiplyScalar(GLOBE_RADIUS);
                 center = surfaceCenter;

                 // Bounds based on borrowers
                 let maxDist = 0;
                 countryBorrowers.forEach(b => {
                     const pos = latLngToVector3(b.location.lat, b.location.lng, GLOBE_RADIUS);
                     const d = pos.distanceTo(surfaceCenter);
                     if (d > maxDist) maxDist = d;
                 });
                 
                 newZoom = Math.max(0.1, maxDist * 2.0);
            }
        }

        if (center) {
             setSelectedCountryCenter(center);
             setZoomOffset(newZoom);
             setIsAnimating(true);
        }
    } else {
        setSelectedCountryCenter(null);
        setIsAnimating(true);
    }
  }, [selectedCountry, countryBorders, borrowers]);

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
      // CRITICAL: Always look at (0,0,0) to ensure rotation orbits the globe center.
      // If we move target to surface, rotation causes clipping/penetration.
      const targetLookAt = new THREE.Vector3(0, 0, 0);
      const stopDistanceThreshold = 0.02;

      if (selectedCountry && selectedCountryCenter) {
          // Calculate camera position along the vector from center to country
          const direction = selectedCountryCenter.clone().normalize();
          
          // Distance from center = Radius + calculated zoom
          // Minimum distance enforced in App.tsx is 2.6
          const zoomDistance = Math.max(2.6, GLOBE_RADIUS + zoomOffset); 
          targetPos = direction.clone().multiplyScalar(zoomDistance); 
      } else {
          // Reset to global view
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
          const name = feature.properties.name || feature.properties.NAME || feature.properties.ADMIN;
          
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
          if (foundCountry === selectedCountry) {
            onSelectCountry(null); // Deselect
          } else {
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
      {/* Main Sphere (Earth Map) - Brightened for better visibility */}
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
          color="#cbd5e1" // Light Slate - Brightened from #475569
          roughness={0.6}
          metalness={0.1}
          emissive="#1e293b" // Slate-800 - Adds subtle blue-grey glow, lighter than before
          emissiveIntensity={0.3}
        />
      </Sphere>

      {/* Country Borders */}
      {countryBorders.map((country, i) => {
         // Match logic
         const n = country.name.toLowerCase();
         const s = selectedCountry ? selectedCountry.toLowerCase() : '';
         const isSelected = n === s || 
              (s === 'usa' && n.includes('united states')) ||
              (s === 'uk' && (n === 'united kingdom' || n === 'great britain')) ||
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

      {/* Atmosphere Glow - Brighter */}
       <Sphere args={[GLOBE_RADIUS + 0.2, 32, 32]}>
        <meshBasicMaterial
          color="#38bdf8" // Sky blue-400
          transparent
          opacity={0.08}
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
            <line>
                <bufferGeometry attach="geometry" {...new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0, 0.2 + (point.mobileMoneyUsage / 2000), 0)])} />
                <lineBasicMaterial attach="material" color={point.color} transparent opacity={0.6} />
            </line>

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
