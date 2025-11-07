/* eslint-disable react-refresh/only-export-components */
import { createRoot } from "react-dom/client";
import { Map, NavigationControl, useControl } from "react-map-gl/maplibre";
import { Deck, GeoJsonLayer, type LayersList } from "deck.gl";
import { MapboxOverlay, type MapboxOverlayProps } from "@deck.gl/mapbox";
import "maplibre-gl/dist/maplibre-gl.css";
import { useRef, useState } from "react";
import type { Feature } from "geojson";

import { DrawController } from "../../src/core";
import {
  DirectSelectMode,
  DrawCircleMode,
  DrawLineStringMode,
  DrawPointMode,
  DrawPolygonMode,
  DrawRectangleMode,
  SimpleSelectMode,
  StaticMode,
} from "../../src/modes";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const INITIAL_VIEW_STATE = {
  latitude: 37.893394,
  longitude: -122.123801,
  zoom: 10,
  bearing: 0,
  pitch: 0,
};

function Toolbar({ controller }: { controller: DrawController | null }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.9)",
        padding: 8,
        borderRadius: 4,
        border: "1px solid lightgray",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}>
      <button onClick={() => controller?.changeMode(StaticMode)}>Static</button>
      <button onClick={() => controller?.changeMode(SimpleSelectMode, { dragWithoutSelect: true })}>Select</button>
      <button onClick={() => controller?.changeMode(DirectSelectMode)}>Direct</button>
      <button onClick={() => controller?.changeMode(DrawPointMode)}>Draw Point</button>
      <button onClick={() => controller?.changeMode(DrawLineStringMode)}>Draw Line</button>
      <button onClick={() => controller?.changeMode(DrawPolygonMode)}>Draw Polygon</button>
      <button onClick={() => controller?.changeMode(DrawCircleMode)}>Draw Circle</button>
      <button onClick={() => controller?.changeMode(DrawRectangleMode)}>Draw Rectangle</button>
    </div>
  );
}

interface DeckGLOverlayProps extends MapboxOverlayProps {
  onReady?: (deck: Deck, map: maplibregl.Map) => void;
}

function DeckGLOverlay({ onReady, ...props }: DeckGLOverlayProps) {
  const overlay = useControl(() => {
    //@ts-expect-error access to private vars
    const handleLoad = () => onReady?.(overlay._deck, overlay._map);
    return new MapboxOverlay({ interleaved: true, onLoad: handleLoad });
  });
  overlay.setProps(props);
  return null;
}

function Root() {
  const controllerRef = useRef<DrawController>(null);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [ready, setReady] = useState(false);

  const handleLoad = (deck: Deck, map: maplibregl.Map) => {
    controllerRef.current = new DrawController(deck, map, {
      initialMode: StaticMode,
      layerIds: ["geojson-layer"],
      onUpdate: setFeatures,
    });

    setReady(true);
  };

  const layers: LayersList = [
    new GeoJsonLayer({
      id: "geojson-layer",
      data: { type: "FeatureCollection", features },
      stroked: true,
      filled: true,
      getFillColor: (f: Feature) => {
        if (f.properties?.handle) {
          return [251, 176, 59, 255]; // solid orange
        }
        if (f.properties?.midpoint) {
          return [251, 176, 59, 255]; // solid orange
        }
        let opacity = 25;
        if (f.geometry.type === "Point") opacity = 255;
        return f.properties?.selected ? [251, 176, 59, opacity] : [59, 178, 208, opacity]; // default semi-transparent
      },
      getLineColor: (f: Feature) => {
        if (f.geometry.type === "Point" || f.properties?.handle) return [255, 255, 255, 255];
        return f.properties?.selected ? [251, 176, 59, 255] : [59, 178, 208, 255];
      },
      getLineWidth: (f) => (f.properties?.midpoint ? 0 : 2),
      getPointRadius: (f) => (f.properties?.midpoint ? 3 : 4),
      pointRadiusUnits: "pixels",
      lineWidthUnits: "pixels",
      pointBillboard: true,
      pickable: true,
      parameters: {
        depthWriteEnabled: false,
      },
    }),
  ];

  return (
    <Map
      initialViewState={INITIAL_VIEW_STATE}
      mapStyle={MAP_STYLE}
      canvasContextAttributes={{ antialias: true }}
      // projection={{ type: "globe" }}
    >
      <DeckGLOverlay
        onReady={handleLoad}
        layers={layers}
        pickingRadius={5}
        // views={new _GlobeView()}
      />
      <NavigationControl position="top-left" />
      {ready && (
        <div style={{ position: "absolute", zIndex: 10, right: 0 }}>
          <Toolbar controller={controllerRef.current} />
        </div>
      )}
      {/* <div style={{ position: "absolute", zIndex: 10, bottom: 0 }}>{JSON.stringify(features)}</div> */}
    </Map>
  );
}

createRoot(document.getElementById("root")!).render(<Root />);
