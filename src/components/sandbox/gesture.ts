/** Shared tool motion. Updated every frame by the cursors, read by the tools. */
export const gesture = {
  /** 0 = raised, 1 = buried in the sand. */
  press: 0,
  acting: false,
  pendingDump: false,
  /** 0 = upright, 1 = tipped to pour. Dump fires near the end of the tip. */
  pour: 0,
  didCastle: false,
  didKick: false,
};
