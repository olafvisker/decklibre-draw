import type { DrawState, DrawFeature } from "./draw-state";

/**
 * Get the group ID from a feature's properties
 */
export function getGroupId(feature: DrawFeature): string | number | undefined {
  return feature.properties?.groupId;
}

/**
 * Check if a feature is part of a group
 */
export function isGrouped(feature: DrawFeature): boolean {
  return feature.properties?.groupId !== undefined;
}

/**
 * Check if a feature is the primary feature in a group
 */
export function isPrimaryFeature(feature: DrawFeature): boolean {
  return feature.properties?.groupPrimary === true;
}

/**
 * Get all features in the same group as the given feature
 */
export function getGroupFeatures(state: DrawState, feature: DrawFeature): DrawFeature[] {
  const groupId = getGroupId(feature);
  if (!groupId) return [feature];

  return state.features.filter(f => getGroupId(f) === groupId);
}

/**
 * Get all feature IDs in the same group as the given feature
 */
export function getGroupIds(state: DrawState, featureId: string | number): (string | number)[] {
  const feature = state.getFeature(featureId);
  if (!feature) return [featureId];

  const groupId = getGroupId(feature);
  if (!groupId) return [featureId];

  return state.features
    .filter(f => getGroupId(f) === groupId)
    .map(f => f.id!)
    .filter(id => id !== undefined);
}

/**
 * Get the primary feature from a group (the one with handles)
 */
export function getPrimaryFeature(state: DrawState, featureId: string | number): DrawFeature | undefined {
  const groupIds = getGroupIds(state, featureId);

  // Find the feature with handles (the primary feature)
  for (const id of groupIds) {
    const feature = state.getFeature(id);
    if (feature?.properties?.handles) return feature;
  }

  // Fallback to first feature
  const firstId = groupIds[0];
  return firstId !== undefined ? state.getFeature(firstId) : undefined;
}

/**
 * Select all features in a group
 */
export function selectGroup(state: DrawState, featureId: string | number): void {
  const groupIds = getGroupIds(state, featureId);

  if (groupIds.length === 1) {
    state.setSelected(featureId);
  } else {
    // Currently DrawState only supports single selection
    // For now, select just the primary feature but this could be extended
    const primary = getPrimaryFeature(state, featureId);
    if (primary?.id !== undefined) {
      state.setSelected(primary.id);
    }
  }
}
