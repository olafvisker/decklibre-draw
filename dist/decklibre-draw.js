import { v4 as h } from "uuid";
import { distance as _, point as c, circle as f, toMercator as u, toWgs84 as m } from "@turf/turf";
const p = (n) => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: n[0] },
  properties: {}
});
p.shapeName = "point";
const y = (n) => ({
  type: "Feature",
  geometry: { type: "LineString", coordinates: n },
  properties: {}
}), I = (n) => ({
  type: "Feature",
  geometry: { type: "Polygon", coordinates: [[...n, n[0]]] },
  properties: {}
}), F = (n) => {
  const e = n[0], t = n[1], s = _(c(e), c(t), { units: "meters" });
  return f(e, s, { steps: 64, units: "meters" });
}, S = (n) => {
  const [e, t] = n, [s, r] = e, [i, o] = t;
  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [[
      [s, r],
      [i, r],
      [i, o],
      [s, o],
      [s, r]
    ]] },
    properties: {}
  };
}, C = {
  point: p,
  line: y,
  polygon: I,
  circle: F,
  rect: S
};
class M {
  constructor(e) {
    if (this._featureMap = /* @__PURE__ */ new Map(), this._selectedIds = /* @__PURE__ */ new Set(), this._handles = /* @__PURE__ */ new Map(), this._shapeGenerator = {}, this._shapeGenerator = { ...C, ...e?.shapeGenerators }, this._onUpdate = e?.onUpdate, e?.features)
      for (const t of e.features)
        t.id !== void 0 && this._featureMap.set(t.id, t);
  }
  // --- Feature Management ---
  get features() {
    return Array.from(this._featureMap.values());
  }
  getFeature(e) {
    if (e)
      return this._featureMap.get(e);
  }
  addFeature(e) {
    this.addFeatures([e]);
  }
  addFeatures(e) {
    for (const t of e)
      t.id !== void 0 && this._featureMap.set(t.id, t);
    this._emitUpdate();
  }
  removeFeature(e) {
    return this.removeFeatures([e]);
  }
  removeFeatures(e) {
    e.length && (e.forEach((t) => {
      t !== void 0 && this._featureMap.delete(t), this.clearHandles(t);
    }), this._emitUpdate());
  }
  updateFeature(e, t) {
    if (!e) return;
    const s = this._featureMap.get(e);
    s && (Object.assign(s, t), t.properties && (s.properties = { ...s.properties, ...t.properties }), this._emitUpdate());
  }
  // --- Handle Management ---
  createHandle(e, t, s) {
    const r = {
      id: h(),
      type: "Feature",
      geometry: { type: "Point", coordinates: t },
      properties: { handle: !0, _handleIndex: s ?? void 0 }
    }, i = this._handles.get(e) ?? [];
    return this._handles.set(e, [...i, r]), this.addFeature(r), r;
  }
  clearHandles(e) {
    if (!e) return;
    const t = this._handles.get(e);
    t && (this.removeFeatures(t.map((s) => s.id)), this._handles.delete(e));
  }
  getHandles(e) {
    return e ? this._handles.get(e) ?? [] : [];
  }
  // --- Feature Generation ---
  generateFeature(e, t, s) {
    const r = this._shapeGenerator[e];
    if (!r) {
      console.warn(`Generator "${e}" not found.`);
      return;
    }
    const i = r(t);
    if (i)
      return i.id = s?.id || i.id || h(), i.properties = { ...i.properties, generator: e, handles: t, ...s?.props }, i;
  }
  // --- Selection Management ---
  get selectedIds() {
    return Array.from(this._selectedIds);
  }
  isSelected(e) {
    return this._selectedIds.has(e);
  }
  setSelected(e) {
    this._selectedIds.clear(), e !== void 0 && this._selectedIds.add(e), this._syncSelectionState();
  }
  clearSelection() {
    this._selectedIds.clear(), this._syncSelectionState();
  }
  _syncSelectionState() {
    let e = !1;
    this._selectedIds.forEach((t) => {
      const s = this._featureMap.get(t);
      s && s.properties?.selected !== !0 && (s.properties = { ...s.properties, selected: !0 }, e = !0);
    });
    for (const t of this._featureMap.values())
      t.id && !this._selectedIds.has(t.id) && t.properties?.selected && (t.properties = { ...t.properties, selected: !1 }, e = !0);
    e && this._emitUpdate();
  }
  // --- Internal ---
  _emitUpdate() {
    this._onUpdate?.(this.features, this.selectedIds);
  }
}
class H {
  constructor(e, t, s) {
    this._layerIds = [], this._panning = !1, this._modeInstances = /* @__PURE__ */ new Map(), this._warmUp = () => {
      const r = [
        {
          id: h(),
          type: "Feature",
          geometry: { type: "Point", coordinates: [0, 0] },
          properties: {}
        },
        {
          id: h(),
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [
              [0, 0],
              [1, 1]
            ]
          },
          properties: {}
        },
        {
          id: h(),
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [0, 0],
                [0, 1],
                [1, 1],
                [0, 0]
              ]
            ]
          },
          properties: {}
        }
      ];
      this._store.addFeatures(r), requestAnimationFrame(() => {
        this._store.removeFeatures(r.map((i) => i.id));
      });
    }, this._onMouseDown = (r) => this._mode?.onMouseDown?.(this._buildInfo(r), this), this._onMouseMove = (r) => this._mode?.onMouseMove?.(this._buildInfo(r), this), this._onMouseUp = (r) => this._mode?.onMouseUp?.(this._buildInfo(r), this), this._onClick = (r) => this._mode?.onClick?.(this._buildInfo(r), this), this._onDoubleClick = (r) => this._mode?.onDoubleClick?.(this._buildInfo(r), this), this._onPanStart = () => {
      this._panning = !0;
    }, this._onPanning = () => {
    }, this._onPanEnd = () => {
      this._panning = !1;
    }, this._deck = e, this._map = t, this._store = new M({
      features: s?.features,
      shapeGenerators: s?.shapeGenerators,
      onUpdate: s?.onUpdate
    }), this._layerIds = s?.layerIds ?? [], s?.initialMode && this.changeMode(s.initialMode), this._bindEvents();
  }
  /** Getters */
  get features() {
    return this._store.features;
  }
  get store() {
    return this._store;
  }
  /** Cleanup */
  destroy() {
    this._unbindEvents();
  }
  /** Mode handling */
  changeMode(e, t) {
    let s;
    if (typeof e == "function")
      !t && this._modeInstances.has(e) ? s = this._modeInstances.get(e) : (s = new e(t), this._modeInstances.set(e, s));
    else {
      if (t !== void 0)
        throw new Error("Cannot pass options when passing an instance.");
      s = e;
    }
    this._mode?.onExit?.(this), this._reset(), this._mode = s, this._mode.onEnter?.(this);
  }
  /** Cursor handling */
  setCursor(e) {
    this._deck.setProps({
      getCursor: (t) => typeof e == "string" ? e : this._panning ? e.pan ?? e.default ?? "default" : t.isHovering ? e.hover ?? e.default ?? "default" : e.default ?? "default"
    });
  }
  /** Deck/map helpers */
  setDraggability(e) {
    e ? (this._map.dragRotate.enable(), this._map.dragPan.enable()) : (this._map.dragRotate.disable(), this._map.dragPan.disable());
  }
  setDoubleClickZoom(e) {
    e ? this._map.doubleClickZoom.enable() : this._map.doubleClickZoom.disable();
  }
  _reset() {
    this.setDraggability(!0), this.setDoubleClickZoom(!0), this.setCursor("default");
  }
  /** Event binding */
  _bindEvents() {
    this._map.on("load", this._warmUp), this._map.on("dragstart", this._onPanStart), this._map.on("drag", this._onPanning), this._map.on("dragend", this._onPanEnd), this._map.on("mousedown", this._onMouseDown), this._map.on("mousemove", this._onMouseMove), this._map.on("mouseup", this._onMouseUp), this._map.on("click", this._onClick), this._map.on("dblclick", this._onDoubleClick);
  }
  _unbindEvents() {
    this._map.off("load", this._warmUp), this._map.off("dragstart", this._onPanStart), this._map.off("drag", this._onPanning), this._map.off("dragend", this._onPanEnd), this._map.off("mousedown", this._onMouseDown), this._map.off("mousemove", this._onMouseMove), this._map.off("mouseup", this._onMouseUp), this._map.off("click", this._onClick), this._map.off("dblclick", this._onDoubleClick);
  }
  _buildInfo(e) {
    const { x: t, y: s } = e.point, { lng: r, lat: i } = e.lngLat, o = this._deck.pickObject({ x: t, y: s, layerIds: this._layerIds, radius: this._deck.props.pickingRadius });
    return {
      x: t,
      y: s,
      lng: r,
      lat: i,
      feature: o?.object
    };
  }
}
class b {
  constructor({ selectedId: e, dragWithoutSelect: t } = {}) {
    this._dragging = !1, this._dragWithoutSelect = !1, t && (this._dragWithoutSelect = t), this._startSelectedId = e;
  }
  onEnter(e) {
    e.setCursor({ default: "default", hover: "pointer" }), this._startSelectedId && e.store.setSelected(this._startSelectedId);
  }
  onExit(e) {
    this._dragging = !1, this._dragStartCoord = void 0, this._dragFeatureId = void 0, e.setDraggability(!0);
  }
  onClick(e, t) {
    const s = e.feature;
    if (!s?.id) {
      t.store.clearSelection();
      return;
    }
    t.store.isSelected(s.id) && t.changeMode(v), t.store.setSelected(s.id);
  }
  onMouseDown(e, t) {
    const s = e.feature?.id;
    s && (this._dragWithoutSelect || t.store.isSelected(s)) && (this._dragging = !0, this._dragFeatureId = s, this._dragStartCoord = [e.lng, e.lat], t.setDraggability(!1));
  }
  onMouseMove(e, t) {
    if (!this._dragging || !this._dragFeatureId || !this._dragStartCoord) return;
    const [s, r] = [e.lng - this._dragStartCoord[0], e.lat - this._dragStartCoord[1]], i = t.store.getFeature(this._dragFeatureId);
    i && t.store.updateFeature(this._dragFeatureId, this.translateFeature(i, s, r)), this._dragStartCoord = [e.lng, e.lat];
  }
  onMouseUp(e, t) {
    this._dragging = !1, this._dragStartCoord = void 0, this._dragFeatureId = void 0, t.setDraggability(!0);
  }
  translateFeature(e, t, s) {
    if (!e.geometry) return e;
    const r = ([a, l, ...g]) => [a + t, l + s, ...g], i = e.geometry;
    let o;
    switch (i.type) {
      case "Point":
        o = { ...i, coordinates: r(i.coordinates) };
        break;
      case "LineString":
        o = { ...i, coordinates: i.coordinates.map(r) };
        break;
      case "Polygon":
        o = { ...i, coordinates: i.coordinates.map((a) => a.map(r)) };
        break;
      default:
        return e;
    }
    const d = (e.properties?.handles).map(([a, l]) => [a + t, l + s]);
    return {
      ...e,
      geometry: o,
      properties: { ...e.properties, handles: d }
    };
  }
}
class v {
  constructor({ selectedId: e, dragWithoutSelect: t } = {}) {
    this._dragging = !1, this._dragType = null, this._dragWithoutSelect = !1, this._startSelectedId = e, t && (this._dragWithoutSelect = t);
  }
  onEnter(e) {
    e.setCursor({ default: "default", hover: "pointer" }), this._startSelectedId && e.store.setSelected(this._startSelectedId), this.createHandles(e);
  }
  onExit(e) {
    this.deselectAll(e), this.resetDragState();
  }
  onClick(e, t) {
    const s = e.feature;
    if (!s || !s.id) return this.deselectAll(t);
    const { handle: r, midpoint: i, insertIndex: o } = s.properties || {};
    if (!r) {
      if (i) {
        if (!this.getSelectedFeature(t)) return;
        this.insertVertex(t, o, [e.lng, e.lat]), this.createHandles(t);
        return;
      }
      t.store.isSelected(s.id) || (t.changeMode(b), t.store.setSelected(s.id));
    }
  }
  onMouseDown(e, t) {
    const s = e.feature;
    if (!s || !s.id) return t.setDoubleClickZoom(!0);
    const { handle: r, midpoint: i, _handleIndex: o, insertIndex: d } = s.properties || {};
    if ((this._dragWithoutSelect || t.store.isSelected(s.id)) && !r && !i) {
      this._dragging = !0, this._dragFeatureId = s.id, this._dragType = "feature", this._dragStartCoord = [e.lng, e.lat], t.setDraggability(!1), t.setDoubleClickZoom(!1);
      return;
    }
    if (i) {
      if (!this.getSelectedFeature(t)) return;
      this.insertVertex(t, d, [e.lng, e.lat]), this.startDrag("handle", e, d + 1, t), this.createHandles(t);
      return;
    }
    if (r) return this.startDrag("handle", e, o, t);
    t.store.isSelected(s.id) && this.startDrag("feature", e, void 0, t);
  }
  onMouseMove(e, t) {
    if (this._dragging && this._dragFeatureId && this._dragStartCoord && this._dragType === "feature") {
      const o = t.store.getFeature(this._dragFeatureId);
      if (!o) return;
      const [d, a] = [e.lng - this._dragStartCoord[0], e.lat - this._dragStartCoord[1]], l = this.translateFeature(o, d, a, t);
      t.store.updateFeature(o.id, l), this._dragStartCoord = [e.lng, e.lat], this.createHandles(t);
      return;
    }
    const s = this.getSelectedFeature(t);
    if (!this._dragging || !s || !this._dragStartCoord) return;
    const [r, i] = [e.lng - this._dragStartCoord[0], e.lat - this._dragStartCoord[1]];
    if (this._dragStartCoord = [e.lng, e.lat], this._dragType === "handle" && typeof this._dragHandleIndex == "number") {
      const o = this.moveVertex(s, this._dragHandleIndex, r, i, t);
      t.store.updateFeature(s.id, o), this.createHandles(t);
    }
  }
  onMouseUp(e, t) {
    this.resetDragState(), this._dragFeatureId = void 0, t.setDraggability(!0), (!e.feature || !e.feature.properties?.handle && !e.feature.properties?.midpoint) && t.setDoubleClickZoom(!0);
  }
  // === Drag Helpers ===
  resetDragState() {
    this._dragging = !1, this._dragType = null, this._dragStartCoord = void 0, this._dragHandleIndex = void 0;
  }
  startDrag(e, t, s, r) {
    this._dragging = !0, this._dragType = e, this._dragStartCoord = [t.lng, t.lat], this._dragHandleIndex = s, r.setDraggability(!1), r.setDoubleClickZoom(!1);
  }
  // === Geometry Editing ===
  translateFeature(e, t, s, r) {
    const o = (e.properties?.handles || []).map(([d, a]) => [d + t, a + s]);
    return this.regenerateFeature(r, e, o);
  }
  moveVertex(e, t, s, r, i) {
    const d = (e.properties?.handles || []).map((a, l) => l === t ? [a[0] + s, a[1] + r] : a);
    return this.regenerateFeature(i, e, d);
  }
  insertVertex(e, t, s) {
    const r = this.getSelectedFeature(e);
    if (!r) return;
    const o = [...r.properties?.handles || []];
    o.splice(t + 1, 0, s);
    const d = this.regenerateFeature(e, r, o);
    e.store.updateFeature(r.id, d);
  }
  // === Handle Management ===
  createHandles(e) {
    const t = this.getSelectedFeature(e);
    if (!t) return;
    e.store.clearHandles(t.id);
    const s = t.properties?.handles || [];
    s.map((r, i) => e.store.createHandle(t.id, r, i)), t.properties?.insertable !== !1 && this.makeMidpoints(s, t.geometry.type === "Polygon", e);
  }
  makeMidpoints(e, t, s) {
    for (let r = 0; r < e.length - 1; r++)
      this.makeMidpoint(e[r], e[r + 1], r, s);
    t && e.length > 2 && this.makeMidpoint(e[e.length - 1], e[0], e.length - 1, s);
  }
  makeMidpoint(e, t, s, r) {
    const i = u(c(e)).geometry.coordinates, o = u(c(t)).geometry.coordinates, d = m(c([(i[0] + o[0]) / 2, (i[1] + o[1]) / 2])).geometry.coordinates, a = r.store.createHandle(this.getSelectedFeature(r).id, d);
    return a.properties = { ...a.properties, midpoint: !0, insertIndex: s }, a;
  }
  // === Selection ===
  deselectAll(e) {
    const t = this.getSelectedFeature(e);
    t && e.store.clearHandles(t.id), e.store.clearSelection();
  }
  getSelectedFeature(e) {
    const t = e.store.selectedIds[0];
    if (t)
      return e.store.getFeature(t);
  }
  // === Core helper ===
  regenerateFeature(e, t, s) {
    const r = t.properties?.generator, i = { ...t.properties, handles: s };
    return r ? e.store.generateFeature(r, s, { id: t.id, props: i }) || t : {
      ...t,
      geometry: {
        ...t.geometry,
        coordinates: t.geometry.type === "Point" ? s[0] : s
      },
      properties: i
    };
  }
}
class P {
  onEnter(e) {
    e.setDoubleClickZoom(!1), e.setCursor("crosshair");
  }
  onExit(e) {
    this.circleId && e.store.removeFeature(this.circleId), this.reset(e);
  }
  onClick(e, t) {
    if (!this.center) {
      this.center = [e.lng, e.lat];
      const s = t.store.generateFeature("circle", [this.center, this.center], {
        props: this.withDefaultProps({ selected: !0 })
      });
      if (!s) return;
      this.circleId = s.id, t.store.addFeature(s), this.circleId && t.store.createHandle(this.circleId, this.center);
      return;
    }
    if (this.center && this.circleId) {
      const s = [e.lng, e.lat];
      this.updateCircle(t, this.center, s, { selected: !1 }), t.store.clearHandles(this.circleId), t.store.createHandle(this.circleId, this.center), t.store.createHandle(this.circleId, s), this.reset(t);
    }
  }
  onMouseMove(e, t) {
    if (!this.center || !this.circleId) return;
    const s = [e.lng, e.lat];
    this.updateCircle(t, this.center, s, { selected: !0 });
  }
  updateCircle(e, t, s, r) {
    if (!this.circleId) return;
    const i = e.store.generateFeature("circle", [t, s], {
      id: this.circleId,
      props: this.withDefaultProps(r)
    });
    i && e.store.updateFeature(this.circleId, i);
  }
  reset(e) {
    e.store.clearHandles(this.circleId), this.center = void 0, this.circleId = void 0;
  }
  withDefaultProps(e) {
    return { insertable: !1, ...e };
  }
}
class x {
  constructor() {
    this.coordinates = [];
  }
  onEnter(e) {
    e.setCursor("crosshair"), e.setDoubleClickZoom(!1);
  }
  onExit(e) {
    this.lineId && e.store.removeFeature(this.lineId), this.reset(e);
  }
  onClick(e, t) {
    const s = [e.lng, e.lat];
    if (e.feature?.properties?.handle) {
      this.finishLine(t);
      return;
    }
    if (this.coordinates.push(s), this.lineId)
      this.updateLine(t, this.coordinates, { selected: !0 }), this.updateHandles(t);
    else {
      const r = t.store.generateFeature("line", this.coordinates, {
        props: { selected: !0 }
      });
      if (!r) return;
      this.lineId = r.id, t.store.addFeature(r), this.lineId && t.store.createHandle(this.lineId, s);
    }
  }
  onDoubleClick(e, t) {
    this.finishLine(t);
  }
  onMouseMove(e, t) {
    if (!this.lineId || this.coordinates.length === 0) return;
    const s = [...this.coordinates, [e.lng, e.lat]];
    this.updateLine(t, s, { selected: !0 });
  }
  updateLine(e, t, s) {
    if (!this.lineId) return;
    const r = e.store.generateFeature("line", t, {
      id: this.lineId,
      props: s
    });
    r && e.store.updateFeature(this.lineId, r);
  }
  updateHandles(e) {
    if (!this.lineId || this.coordinates.length === 0) return;
    e.store.clearHandles(this.lineId);
    const t = this.coordinates[this.coordinates.length - 1];
    e.store.createHandle(this.lineId, t);
  }
  finishLine(e) {
    !this.lineId || this.coordinates.length < 2 || (this.updateLine(e, this.coordinates, { selected: !1 }), e.store.clearHandles(this.lineId), this.reset(e));
  }
  reset(e) {
    this.lineId && e.store.clearHandles(this.lineId), this.coordinates = [], this.lineId = void 0;
  }
}
class E {
  onEnter(e) {
    e.setCursor("crosshair");
  }
  onClick(e, t) {
    const s = t.store.generateFeature("point", [[e.lng, e.lat]]);
    s && t.store.addFeature(s);
  }
}
class U {
  constructor() {
    this.coordinates = [];
  }
  onEnter(e) {
    e.setDoubleClickZoom(!1), e.setCursor("crosshair");
  }
  onExit(e) {
    this.polygonId && e.store.removeFeature(this.polygonId), this.reset(e);
  }
  onClick(e, t) {
    const { feature: s } = e;
    if (s?.properties?.handle) {
      this.finishPolygon(t);
      return;
    }
    const r = [e.lng, e.lat];
    if (this.coordinates.push(r), this.polygonId)
      this.updatePolygon(t, this.coordinates, { selected: !0 }), this.updateHandles(t);
    else {
      const i = t.store.generateFeature("polygon", this.coordinates, {
        props: { selected: !0 }
      });
      if (!i) return;
      this.polygonId = i.id, t.store.addFeature(i), this.polygonId && t.store.createHandle(this.polygonId, r);
    }
  }
  onDoubleClick(e, t) {
    this.finishPolygon(t);
  }
  onMouseMove(e, t) {
    if (!this.polygonId || this.coordinates.length === 0) return;
    const s = [...this.coordinates, [e.lng, e.lat]];
    this.updatePolygon(t, s, { selected: !0 });
  }
  updatePolygon(e, t, s) {
    if (!this.polygonId) return;
    const r = e.store.generateFeature("polygon", t, {
      id: this.polygonId,
      props: s
    });
    r && e.store.updateFeature(this.polygonId, r);
  }
  updateHandles(e) {
    !this.polygonId || this.coordinates.length === 0 || (e.store.clearHandles(this.polygonId), e.store.createHandle(this.polygonId, this.coordinates[0]), this.coordinates.length > 1 && e.store.createHandle(this.polygonId, this.coordinates[this.coordinates.length - 1]));
  }
  finishPolygon(e) {
    !this.polygonId || this.coordinates.length < 3 || (this.updatePolygon(e, this.coordinates, { selected: !1 }), e.store.clearHandles(this.polygonId), this.reset(e));
  }
  reset(e) {
    this.polygonId && e.store.clearHandles(this.polygonId), this.coordinates = [], this.polygonId = void 0;
  }
}
class G {
  onEnter(e) {
    e.setDoubleClickZoom(!1), e.setCursor("crosshair");
  }
  onExit(e) {
    this.rectId && e.store.removeFeature(this.rectId), this.reset(e);
  }
  onClick(e, t) {
    if (!this.start) {
      this.start = [e.lng, e.lat];
      const s = t.store.generateFeature("rect", [this.start, this.start], {
        props: this.withDefaultProps({ selected: !0 })
      });
      if (!s) return;
      this.rectId = s.id, t.store.addFeature(s), this.rectId && t.store.createHandle(this.rectId, this.start);
      return;
    }
    if (this.start && this.rectId) {
      const s = [e.lng, e.lat];
      this.updateRect(t, this.start, s, { selected: !1 }), this.reset(t);
    }
  }
  onMouseMove(e, t) {
    if (!this.start || !this.rectId) return;
    const s = [e.lng, e.lat];
    this.updateRect(t, this.start, s, { selected: !0 });
  }
  updateRect(e, t, s, r) {
    if (!this.rectId) return;
    const i = e.store.generateFeature("rect", [t, s], {
      id: this.rectId,
      props: this.withDefaultProps(r)
    });
    i && e.store.updateFeature(this.rectId, i);
  }
  reset(e) {
    e.store.clearHandles(this.rectId), this.start = void 0, this.rectId = void 0;
  }
  withDefaultProps(e) {
    return { insertable: !1, ...e };
  }
}
class L {
  onEnter(e) {
    e.setCursor({ default: "grab", pan: "grabbing" });
  }
}
export {
  F as CircleShapeGenerator,
  C as DefaultShapeGenerators,
  v as DirectSelectMode,
  P as DrawCircleMode,
  H as DrawController,
  x as DrawLineStringMode,
  E as DrawPointMode,
  U as DrawPolygonMode,
  G as DrawRectangleMode,
  M as DrawStore,
  y as LineStringShapeGenerator,
  p as PointShapeGenerator,
  I as PolygonShapeGenerator,
  S as RectangleShapeGenerator,
  b as SimpleSelectMode,
  L as StaticMode
};
