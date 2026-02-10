import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, useLoader, ThreeEvent } from '@react-three/fiber';
import { Sphere, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Borrower } from '../types';

interface GlobeProps {
  borrowers: Borrower[];
  onSelectBorrower: (b: Borrower | null) => void;
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
  // Normalize vector just in case
  const n = v.clone().normalize();
  const lat = 90 - (Math.acos(n.y) * 180) / Math.PI;
  // theta = atan2(z, -x) because x = -sin(theta) and z = sin(theta) roughly in our forward transform
  // Our forward: x = -R sin(phi) cos(theta), z = R sin(phi) sin(theta)
  // z / -x = tan(theta)
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

export const Globe: React.FC<GlobeProps> = ({ borrowers, onSelectBorrower }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [geoJson, setGeoJson] = useState<any>(null);
  const [selectedCountryName, setSelectedCountryName] = useState<string | null>(null);

  // Load Earth Texture (Blue Marble / Satellite View)
  const earthMap = useLoader(THREE.TextureLoader, 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg');

  // Fetch GeoJSON for country borders
  useEffect(() => {
    fetch('https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_admin_0_countries.geojson')
      .then(res => res.json())
      .then(data => setGeoJson(data))
      .catch(err => console.error("Failed to load country data", err));
  }, []);

  useFrame((state, delta) => {
    if (groupRef.current && !selectedCountryName) {
       // Only rotate if no country is selected to allow easier inspection
       groupRef.current.rotation.y += delta * 0.05;
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

  // Process GeoJSON into 3D Lines
  const countryBorders = useMemo(() => {
    if (!geoJson) return [];
    
    const borders: { name: string, points: THREE.Vector3[][] }[] = [];

    geoJson.features.forEach((feature: any) => {
        const name = feature.properties.name || feature.properties.NAME;
        const geometry = feature.geometry;

        const processPolygon = (coords: any[]) => {
            return coords.map((pt: any) => 
                latLngToVector3(pt[1], pt[0], GLOBE_RADIUS + 0.01) // Slightly above surface
            );
        };

        if (geometry.type === 'Polygon') {
             borders.push({
                 name,
                 points: geometry.coordinates.map(processPolygon)
             });
        } else if (geometry.type === 'MultiPolygon') {
             geometry.coordinates.forEach((polygon: any) => {
                 borders.push({
                     name,
                     points: polygon.map(processPolygon)
                 });
             });
        }
    });
    return borders;
  }, [geoJson]);

  const handleGlobeClick = (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      // Calculate Lat/Lng from intersection point
      const point = e.point; // This is in world space. If the group is rotated, we need local space.
      
      // Convert world point to local point relative to the rotating globe
      const localPoint = groupRef.current!.worldToLocal(point.clone());
      const { lat, lng } = vector3ToLatLng(localPoint, GLOBE_RADIUS);

      // Find country
      let foundCountry = null;
      if (geoJson) {
          for (const feature of geoJson.features) {
              const geometry = feature.geometry;
              const name = feature.properties.name || feature.properties.NAME;
              
              if (geometry.type === 'Polygon') {
                   // GeoJSON coords are [lng, lat]
                   if (isPointInPolygon([lng, lat], geometry.coordinates[0])) {
                       foundCountry = name;
                       break;
                   }
              } else if (geometry.type === 'MultiPolygon') {
                   for (const polygon of geometry.coordinates) {
                       if (isPointInPolygon([lng, lat], polygon[0])) {
                           foundCountry = name;
                           break;
                       }
                   }
                   if (foundCountry) break;
              }
          }
      }

      if (foundCountry) {
          setSelectedCountryName(foundCountry === selectedCountryName ? null : foundCountry);
          console.log("Selected Country:", foundCountry);
      } else {
          setSelectedCountryName(null);
      }
  };

  return (
    <group ref={groupRef}>
      {/* Main Sphere (Earth Map) */}
      <Sphere 
        args={[GLOBE_RADIUS, 64, 64]} 
        onClick={handleGlobeClick}
        onPointerOver={() => document.body.style.cursor = 'crosshair'}
        onPointerOut={() => document.body.style.cursor = 'auto'}
      >
        <meshStandardMaterial
          map={earthMap}
          color="#ffffff" 
          roughness={0.6}
          metalness={0.2}
          emissive="#020617"
          emissiveIntensity={0.2}
        />
      </Sphere>

      {/* Country Borders */}
      {countryBorders.map((country, i) => {
         const isSelected = country.name === selectedCountryName;
         return (
             <group key={`${country.name}-${i}`}>
                 {country.points.map((linePoints, j) => (
                    <Line
                        key={j}
                        points={linePoints}
                        color={isSelected ? "#22d3ee" : "#3b82f6"} // Cyan if selected, Blue otherwise
                        lineWidth={isSelected ? 2 : 1}
                        transparent
                        opacity={isSelected ? 0.8 : 0.15} // More visible if selected
                    />
                 ))}
             </group>
         )
      })}
      
      {/* Selected Country Label (Optional) */}
      {selectedCountryName && (
           <Html position={[0, GLOBE_RADIUS + 0.5, 0]} center>
               <div className="pointer-events-none bg-black/80 text-cyan-400 border border-cyan-500/50 px-3 py-1 rounded text-sm font-tech font-bold tracking-widest uppercase shadow-[0_0_15px_rgba(6,182,212,0.5)]">
                   {selectedCountryName}
               </div>
           </Html>
      )}

      {/* Atmosphere Glow */}
       <Sphere args={[GLOBE_RADIUS + 0.2, 32, 32]}>
        <meshBasicMaterial
          color="#06b6d4" // cyan-500
          transparent
          opacity={0.1}
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
                <sphereGeometry args={[0.06, 16, 16]} />
                <meshStandardMaterial
                    color={point.color}
                    emissive={point.color}
                    emissiveIntensity={hoveredId === point.id ? 3 : 1.5}
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
                <Html distanceFactor={10}>
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