import React, { useMemo, useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, ThreeEvent, useThree } from '@react-three/fiber';
import { Text, Html, Center, Float, Grid } from '@react-three/drei';
import { Borrower } from '../types';

interface CountrySceneProps {
  countryName: string;
  geoJson: any;
  borrowers: Borrower[];
  onSelectBorrower: (b: Borrower | null) => void;
}

// Subcomponent for Outline Lines to handle both outer boundary and holes (lakes)
const CountryOutline: React.FC<{ shape: THREE.Shape, x: number, y: number }> = ({ shape, x, y }) => {
  const lines = useMemo(() => {
      const result: THREE.Line[] = [];
      const material = new THREE.LineBasicMaterial({ 
          color: "#22d3ee", 
          transparent: true, 
          opacity: 0.6,
          linewidth: 1 
      });
      
      // Outer contour
      const outerGeo = new THREE.BufferGeometry().setFromPoints(shape.getPoints());
      result.push(new THREE.Line(outerGeo, material));

      // Inner holes (e.g. lakes)
      shape.holes.forEach((h: any) => {
          const holeGeo = new THREE.BufferGeometry().setFromPoints(h.getPoints());
          result.push(new THREE.Line(holeGeo, material));
      });
      return result;
  }, [shape]);

  return (
    <group position={[x, y, 0.26]}>
        {lines.map((line, i) => <primitive key={i} object={line} />)}
    </group>
  );
}

export const CountryScene: React.FC<CountrySceneProps> = ({ countryName, geoJson, borrowers, onSelectBorrower }) => {
  const meshRef = useRef<THREE.Group>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { camera, controls } = useThree();

  // Parse GeoJSON and create 3D Shapes
  const { shapes, centerOffset, projectionScale, minBounds, error } = useMemo(() => {
    if (!geoJson) return { shapes: [], centerOffset: { x: 0, y: 0 }, projectionScale: 1, minBounds: { x: 0, y: 0 }, error: "Loading Map Data..." };

    // Robust Name Matching
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

    if (!feature) {
        return { shapes: [], centerOffset: { x: 0, y: 0 }, projectionScale: 1, minBounds: { x: 0, y: 0 }, error: `Map Data Not Found for ${countryName}` };
    }

    // Calculate Bounds
    let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
    const updateBounds = (lng: number, lat: number) => {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
    };

    const traverseCoords = (coords: any, type: string) => {
         if (type === 'Polygon') {
             coords.forEach((ring: any[]) => ring.forEach(pt => updateBounds(pt[0], pt[1])));
         } else if (type === 'MultiPolygon') {
             coords.forEach((poly: any[]) => poly.forEach((ring: any[]) => ring.forEach(pt => updateBounds(pt[0], pt[1]))));
         }
    };
    traverseCoords(feature.geometry.coordinates, feature.geometry.type);

    // Determine scale to fit in view (approx width of 14 units)
    const lngSpan = maxLng - minLng;
    const latSpan = maxLat - minLat;
    const safeLngSpan = lngSpan > 0 ? lngSpan : 1;
    const safeLatSpan = latSpan > 0 ? latSpan : 1;
    const scale = 14 / Math.max(safeLngSpan, safeLatSpan);

    const createShapeFromRing = (ring: any[]) => {
        const shape = new THREE.Shape();
        if (ring.length < 3) return shape;
        const startX = (ring[0][0] - minLng) * scale;
        const startY = (ring[0][1] - minLat) * scale;
        shape.moveTo(startX, startY);
        for (let i = 1; i < ring.length; i++) {
             const x = (ring[i][0] - minLng) * scale;
             const y = (ring[i][1] - minLat) * scale;
             shape.lineTo(x, y);
        }
        return shape;
    }

    const generatedShapes: THREE.Shape[] = [];

    const processPolygonCoords = (coords: any[]) => {
         if (coords.length === 0) return;
         // Outer ring is usually the first element in GeoJSON Polygon coordinates
         const outerShape = createShapeFromRing(coords[0]);
         
         // Inner rings (Holes)
         for (let i = 1; i < coords.length; i++) {
             const holeShape = createShapeFromRing(coords[i]);
             outerShape.holes.push(holeShape);
         }
         generatedShapes.push(outerShape);
    };

    if (feature.geometry.type === 'Polygon') {
        processPolygonCoords(feature.geometry.coordinates);
    } else if (feature.geometry.type === 'MultiPolygon') {
        feature.geometry.coordinates.forEach(processPolygonCoords);
    }

    // Center offset
    const centerX = (safeLngSpan * scale) / 2;
    const centerY = (safeLatSpan * scale) / 2;

    return { 
        shapes: generatedShapes, 
        centerOffset: { x: centerX, y: centerY }, 
        projectionScale: scale,
        minBounds: { x: minLng, y: minLat },
        error: null
    };
  }, [geoJson, countryName]);

  // Reset camera when country changes
  useEffect(() => {
      if (controls) {
          const orbit = controls as any;
          orbit.target.set(0, 0, 0);
          orbit.update();
      }
      camera.position.set(0, -5, 12);
      camera.lookAt(0, 0, 0);
  }, [countryName, camera, controls, shapes.length]);

  const points = useMemo(() => {
      return borrowers.map(b => {
          const x = ((b.location.lng - minBounds.x) * projectionScale) - centerOffset.x;
          const y = ((b.location.lat - minBounds.y) * projectionScale) - centerOffset.y;
          let color = '#34d399';
          if (b.riskLevel === 'Medium') color = '#fbbf24';
          if (b.riskLevel === 'High') color = '#ef4444';
          return { ...b, position: new THREE.Vector3(x, y, 0.4), color };
      });
  }, [borrowers, minBounds, projectionScale, centerOffset]);

  if (error || shapes.length === 0) {
      return (
          <Center>
              <Text color="white" fontSize={0.5} position={[0,0,0]}>
                  {error || "Analyzing Terrain..."}
              </Text>
          </Center>
      )
  }

  return (
    <Center>
        <group ref={meshRef} rotation={[-0.1, 0, 0]}> 
            <Grid 
                position={[0, 0, -0.5]} 
                args={[40, 40]} 
                cellColor="#1e293b" 
                sectionColor="#334155" 
                fadeDistance={30} 
                fadeStrength={1}
                infiniteGrid
            />
            
            <Float speed={1.5} rotationIntensity={0.05} floatIntensity={0.1}>
                <group>
                    {shapes.map((shape, i) => (
                        <mesh key={i} position={[-centerOffset.x, -centerOffset.y, 0]} receiveShadow castShadow>
                            {/* Extruded Geometry with Bevels */}
                            <extrudeGeometry args={[shape, { depth: 0.25, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02 }]} />
                            <meshStandardMaterial 
                                color="#0f172a" 
                                roughness={0.3} 
                                metalness={0.6}
                                emissive="#06b6d4" 
                                emissiveIntensity={0.2}
                            />
                        </mesh>
                    ))}
                    
                    {/* Render Outlines (Boundary + Holes) */}
                    {shapes.map((shape, i) => (
                        <CountryOutline 
                          key={`line-${i}`} 
                          shape={shape} 
                          x={-centerOffset.x} 
                          y={-centerOffset.y} 
                        />
                    ))}
                </group>

                {/* Data Points */}
                {points.map((point) => (
                    <group key={point.id} position={point.position}>
                        <mesh position={[0, 0, point.mobileMoneyUsage / 3000 / 2]}>
                            <cylinderGeometry args={[0.015, 0.015, point.mobileMoneyUsage / 3000, 4]} />
                            <meshBasicMaterial color={point.color} transparent opacity={0.6} />
                        </mesh>
                        <mesh 
                            position={[0, 0, point.mobileMoneyUsage / 3000]}
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
                            <sphereGeometry args={[0.12, 16, 16]} />
                            <meshStandardMaterial 
                                color={point.color} 
                                emissive={point.color}
                                emissiveIntensity={hoveredId === point.id ? 3 : 1.5}
                                toneMapped={false}
                            />
                        </mesh>
                        {hoveredId === point.id && (
                             <Html distanceFactor={10} zIndexRange={[100, 0]}>
                                <div className="bg-slate-900/95 backdrop-blur-xl border border-emerald-500/50 p-3 rounded-lg text-xs text-white whitespace-nowrap pointer-events-none transform -translate-y-14 -translate-x-1/2 shadow-xl shadow-black/80 z-50">
                                    <div className="font-bold text-emerald-400 font-tech uppercase tracking-wider text-sm">{point.name}</div>
                                    <div className="text-slate-300 font-mono text-[10px] mt-0.5">{point.location.city}</div>
                                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-800">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-slate-500 uppercase">Score</span>
                                            <span className="font-bold text-emerald-400">{point.creditScore}</span>
                                        </div>
                                    </div>
                                </div>
                            </Html>
                        )}
                    </group>
                ))}
            </Float>

             <Text
                position={[0, 5, 0]}
                fontSize={0.8}
                color="#e2e8f0"
                font="https://fonts.gstatic.com/s/rajdhani/v15/L1RYZPSJnHxp-pHTHdbz4K4.woff"
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.02}
                outlineColor="#0f172a"
            >
                {countryName.toUpperCase()}
            </Text>
        </group>
    </Center>
  );
};
