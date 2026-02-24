/**
 * Body part labels for the SVG body map (FrontBody.svg / BackBody.svg).
 * Ids and display names come from the path id/title attributes in those SVGs.
 */
export function getBodyPartLabel(id: string): string {
  return id.replace(/_/g, " ");
}
