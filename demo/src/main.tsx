/* eslint-disable react-refresh/only-export-components */
import "./global.css";
import "maplibre-gl/dist/maplibre-gl.css";

import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import { Map, NavigationControl, useControl } from "react-map-gl/maplibre";
import { Deck, GeoJsonLayer, type LayersList } from "deck.gl";
import { MapboxOverlay, type MapboxOverlayProps } from "@deck.gl/mapbox";

import { DrawController } from "../../src/core";
import type { EditMode, SelectMode } from "../../src/modes";
import type { Feature } from "geojson";

import {
  HandIcon,
  MapPinIcon,
  MousePointer2Icon,
  PentagonIcon,
  RadiusIcon,
  Trash2Icon,
  VectorSquare,
  WaypointsIcon,
  ZapIcon,
} from "lucide-react";

interface DeckGLOverlayProps extends MapboxOverlayProps {
  onReady?: (deck: Deck, map: maplibregl.Map) => void;
}
function DeckGLOverlay({ onReady, ...props }: DeckGLOverlayProps) {
  const overlay = useControl(() => {
    //@ts-expect-error access private vars
    const handleLoad = () => onReady?.(overlay._deck, overlay._map);
    return new MapboxOverlay({ interleaved: true, onLoad: handleLoad });
  });

  overlay.setProps(props);
  return null;
}

const modes: { label: string; icon: React.ReactNode; mode: string }[] = [
  { label: "Static", icon: <HandIcon size={16} />, mode: "static" },
  { label: "Select", icon: <MousePointer2Icon size={16} />, mode: "select" },
  // { label: "Direct", icon: <MousePointerClickIcon size={16} />, mode: "edit" },
  { label: "Draw Point", icon: <MapPinIcon size={16} />, mode: "point" },
  { label: "Draw Line", icon: <WaypointsIcon size={16} />, mode: "line" },
  { label: "Draw Polygon", icon: <PentagonIcon size={16} />, mode: "polygon" },
  { label: "Draw Circle", icon: <RadiusIcon size={16} />, mode: "circle" },
  { label: "Draw Rectangle", icon: <VectorSquare size={16} />, mode: "rectangle" },
];

function Toolbar({ draw }: { draw: DrawController | null }) {
  const [activeMode, setActiveMode] = useState(draw?.currentMode ?? "static");
  const [dragWithoutSelect, setDragWithoutSelect] = useState(false);

  useEffect(() => {
    if (!draw) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const index = parseInt(e.key, 10);
      if (!isNaN(index) && index >= 1 && index <= modes.length) {
        draw.changeMode(modes[index - 1].mode);
      }
    };

    const handleModeChange = ({ name }: { name: string }) => setActiveMode(name);

    draw.on("mode:change", handleModeChange);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      draw.off("mode:change", handleModeChange);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [draw]);

  const toggleDragWithoutSelect = () => {
    setDragWithoutSelect((prev) => {
      const newValue = !prev;
      draw?.changeModeOptions<SelectMode>("select", { dragWithoutSelect: newValue });
      draw?.changeModeOptions<EditMode>("edit", { dragWithoutSelect: newValue });
      return newValue;
    });
  };

  const deleteSelected = () => {
    const selectedIds = draw?.state.selectedIds;
    if (selectedIds && selectedIds.length > 0) {
      draw?.state.removeFeatures(selectedIds);
    }
  };

  return (
    <div className="toolbar maplibregl-ctrl maplibregl-ctrl-group">
      {modes.map(({ label, icon, mode }) => (
        <button
          key={label}
          className={`toolbar-btn ${mode === activeMode ? "toolbar-btn-active" : ""}`}
          title={label}
          onClick={() => {
            draw?.changeMode(mode);
            setActiveMode(mode);
          }}>
          {icon}
        </button>
      ))}
      <button
        className="toolbar-btn"
        title="Delete Selected"
        disabled={!draw?.state.selectedIds.length}
        onClick={deleteSelected}>
        <Trash2Icon size={16} />
      </button>
      <button
        className={`toolbar-btn ${dragWithoutSelect ? "toolbar-btn-active" : ""}`}
        title="Drag Without Select"
        onClick={toggleDragWithoutSelect}>
        <ZapIcon size={16} className={dragWithoutSelect ? "icon-active" : ""} />
      </button>
    </div>
  );
}

// Main application
function Root() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const drawRef = useRef<DrawController | null>(null);

  const handleLoad = (deck: Deck, map: maplibregl.Map) => {
    const draw = new DrawController(deck, map, { layerIds: ["geojson-layer"] });
    draw.on("feature:change", (e) => setFeatures(e.features));
    drawRef.current = draw;
  };

  const layers: LayersList = [
    new GeoJsonLayer({
      id: "geojson-layer",
      data: { type: "FeatureCollection", features },
      stroked: true,
      filled: true,
      pickable: true,
      pointBillboard: true,
      pointRadiusUnits: "pixels",
      lineWidthUnits: "pixels",
      parameters: { depthWriteEnabled: false },

      getFillColor: (f: Feature) => {
        const { handle, midpoint, selected, preview } = f.properties || {};
        const isPoint = f.geometry.type === "Point";
        if (handle || midpoint) return [251, 176, 59, 255];

        const opacity = isPoint ? 255 : 25;
        const active = selected || preview;
        return active ? [251, 176, 59, opacity] : [59, 178, 208, opacity];
      },

      getLineColor: (f: Feature) => {
        const { handle, selected, preview } = f.properties || {};
        if (f.geometry.type === "Point" || handle) return [255, 255, 255, 255];
        const active = selected || preview;
        return active ? [251, 176, 59, 255] : [59, 178, 208, 255];
      },

      getLineWidth: (f: Feature) => (f.properties?.midpoint ? 0 : 2),
      getPointRadius: (f: Feature) => (f.properties?.midpoint ? 3 : 4),
    }),
  ];

  return (
    <Map
      mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
      canvasContextAttributes={{ antialias: true }}>
      <DeckGLOverlay onReady={handleLoad} layers={layers} pickingRadius={5} />
      <NavigationControl position="top-left" />
      <Toolbar draw={drawRef.current} />
    </Map>
  );
}

createRoot(document.getElementById("root")!).render(<Root />);
