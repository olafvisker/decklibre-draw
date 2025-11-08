/* eslint-disable react-refresh/only-export-components */
import "./global.css";
import "maplibre-gl/dist/maplibre-gl.css";

import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { Map, NavigationControl, useControl } from "react-map-gl/maplibre";
import { Deck, GeoJsonLayer, type LayersList } from "deck.gl";
import { MapboxOverlay, type MapboxOverlayProps } from "@deck.gl/mapbox";

import { DrawController } from "../../src/core";
import type { EditMode, SelectMode } from "../../src/modes";
import type { Feature } from "geojson";

import {
  CircleSmallIcon,
  HandIcon,
  MapPinIcon,
  MousePointer2Icon,
  MousePointerClickIcon,
  PentagonIcon,
  RadiusIcon,
  VectorSquare,
  WaypointsIcon,
} from "lucide-react";

let draw: DrawController | null = null;

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

function Toolbar() {
  const [activeMode, setActiveMode] = useState<string>(draw?.currentMode ?? "static");
  const [dragWithoutSelect, setDragWithoutSelect] = useState(false);

  const buttons: { label: string; icon: React.ReactNode; mode: string }[] = [
    { label: "Static", icon: <HandIcon size={16} />, mode: "static" },
    { label: "Select", icon: <MousePointer2Icon size={16} />, mode: "select" },
    { label: "Direct", icon: <MousePointerClickIcon size={16} />, mode: "edit" },
    { label: "Draw Point", icon: <MapPinIcon size={16} />, mode: "point" },
    { label: "Draw Line", icon: <WaypointsIcon size={16} />, mode: "line" },
    { label: "Draw Polygon", icon: <PentagonIcon size={16} />, mode: "polygon" },
    { label: "Draw Circle", icon: <RadiusIcon size={16} />, mode: "circle" },
    { label: "Draw Rectangle", icon: <VectorSquare size={16} />, mode: "rectangle" },
  ];

  useEffect(() => {
    if (!draw) return;
    setActiveMode(draw.currentMode ?? "static");
  }, []);

  const toggleDragWithoutSelect = () => {
    setDragWithoutSelect((prev) => {
      const newValue = !prev;
      draw?.changeModeOptions<SelectMode>("select", { dragWithoutSelect: newValue });
      draw?.changeModeOptions<EditMode>("edit", { dragWithoutSelect: newValue });
      return newValue;
    });
  };

  return (
    <div className="toolbar maplibregl-ctrl maplibregl-ctrl-group">
      {buttons.map(({ label, icon, mode }) => (
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
        className={`toolbar-btn ${dragWithoutSelect ? "toolbar-btn-active" : ""}`}
        title="Drag Without Select"
        onClick={toggleDragWithoutSelect}>
        <CircleSmallIcon size={16} className={`${dragWithoutSelect ? "icon-active" : ""}`} />
      </button>
    </div>
  );
}

function Root() {
  const [features, setFeatures] = useState<Feature[]>([]);

  const handleLoad = (deck: Deck, map: maplibregl.Map) => {
    draw = new DrawController(deck, map, {
      layerIds: ["geojson-layer"],
      onUpdate: setFeatures,
    });
  };

  const layers: LayersList = [
    new GeoJsonLayer({
      id: "geojson-layer",
      data: { type: "FeatureCollection", features },
      stroked: true,
      filled: true,
      getFillColor: (f: Feature) => {
        if (f.properties?.handle || f.properties?.midpoint) return [251, 176, 59, 255];
        const opacity = f.geometry.type === "Point" ? 255 : 25;
        return f.properties?.selected ? [251, 176, 59, opacity] : [59, 178, 208, opacity];
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
      parameters: { depthWriteEnabled: false },
    }),
  ];

  return (
    <Map
      mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
      canvasContextAttributes={{ antialias: true }}>
      <DeckGLOverlay onReady={handleLoad} layers={layers} pickingRadius={5} />
      <NavigationControl position="top-left" />
      <Toolbar />
    </Map>
  );
}

createRoot(document.getElementById("root")!).render(<Root />);
