// ---------------------------------------------------------------------------
// Hyderabad Metro — Blue Line live tracker
// Real-world constants. All lengths in metres.
// ---------------------------------------------------------------------------

export const LINE = {
  name: 'Blue Line',
  code: '03',
  corridor: 'Corridor II',
  from: 'Nagole',
  to: 'Raidurg',
  operator: 'HMRL',
  network: 'Hyderabad Metro Rail',
};

export const MAP = {
  // Local projection origin (roughly the middle of the Blue Line).
  origin: { lng: 78.47, lat: 17.42 },
  initialZoom: 20.15,
  minZoom: 13,
  maxZoom: 21.5,
  pitch: 50,
  maxPitch: 76,
  // Chase camera looks this far up the line from the train, offset to the side
  // so the set is seen in three-quarter view rather than dead astern.
  lookAhead: 16,
  cameraOffset: 3.5,
  // The chase view is swung a little off the track heading so the flank of the
  // train is visible; dragging adds to this base angle.
  chaseBearing: -20,
};

export const VIADUCT = {
  deckTop: 10.4,        // concrete deck surface above ground
  deckThickness: 1.15,
  deckWidth: 10.6,
  parapetHeight: 1.05,
  parapetWidth: 0.42,
  trackOffset: 2.15,    // each track centre from guideway centre
  railTop: 10.58,       // rail head above ground
  gauge: 1.435,
};

export const TRAIN = {
  carLength: 21.4,
  carSpacing: 21.8,
  shellLength: 20.4,
  width: 2.9,
  railToRoof: 3.8,
  bodyBottom: 1.0,
  bodyTop: 3.72,
  bogieHalfSpacing: 7.9,
  wheelRadius: 0.43,
  gauge: 1.435,
  doorsPerSide: 4,
  doorCentres: [-6.6, -2.2, 2.2, 6.6],
  windowCentres: [-4.4, 0, 4.4],
  windowWidth: 2.35,
  endWindowCentres: [-8.75, 8.75],
  endWindowWidth: 1.32,
  blueBandBottom: 3.1,
  blueBandTop: 3.56,
};

export const SIM = {
  cruise: 68 / 3.6,
  maxAccel: 0.98,
  maxBrake: 0.92,
  doorDwell: 22,      // seconds stopped with doors open
  terminusDwell: 55,
  doorTime: 1.6,
  stationMargin: 3,   // stop this far before the station marker
  startOffset: 6,     // metres past Nagole at boot
};

export const COLORS = {
  steel: 0xc7cbcd,
  steelDark: 0x9aa0a2,
  paintBlue: 0x0b5fae,
  paintBlueDeep: 0x08457f,
  paintRed: 0xd12f31,
  paintGreen: 0x11934a,
  glass: 0x101d20,
  rubber: 0x0a0c0d,
  roof: 0x6a6f71,
  roofDark: 0x3f4547,
  bogie: 0x141719,
  wheel: 0x2a2d2e,
  interior: 0x1b2a2d,
};
