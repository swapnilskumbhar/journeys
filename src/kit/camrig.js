// A shared camera-aiming helper for journeys.
//
// Every journey owns its own `camera(u, cam)` callback (see engine/player.js —
// the engine hands the camera object straight to the journey and imposes no
// convention on it). `earth-to-moon` invented CAM / LOOK_Y / PAN / AZIMUTH
// tables and a `cam.lookAt(0, LOOK_Y(u), 0)` call, which works as long as every
// subject the camera ever aims at lies ON the world Y axis. Earth→Mars breaks
// that assumption on purpose — the Sun and an evening-star Earth in the
// Martian sky are subjects that are NOT in the direction of travel — so this
// factors the aiming math out where any journey can reuse it, with a genuine
// 3-D look-target instead of a single scalar height.
//
// `aimCamera(cam, {...})` is a pure function of its arguments (rule 8: no
// clock, no accumulated state), general rather than bent to one journey
// (rule 7), and its default (`lookAt: [0, 0, 0]`, `azimuthDeg: 0`, `pan: 0`)
// reproduces exactly what a bare `cam.position.set(...); cam.lookAt(0,0,0)`
// would do — so a journey that only ever needed LOOK_Y can pass
// `lookAt: [0, LOOK_Y(u), 0]` and render identically to before.
// `rollDeg` rotates about the VIEW axis, which is how a journey decides where
// its travel axis lands on screen without moving a single object.
//
// A journey whose subject is travel has an origin and a destination, and they
// sit on opposite ends of one line. Which way that line runs in the frame is
// the most consequential composition decision the journey makes, and it is
// usually made by accident. `earth-to-moon` placed Earth at -y and the Moon at
// +y — a VERTICAL travel axis — so the trajectory was a stripe up the middle,
// the ship never crossed anything, and no frame could hold both worlds. Rule 5
// asks for the opposite: vertical scroll in, horizontal journey out, left to
// right, the same direction the ribbon runs.
//
// Rolling the camera fixes that for the cost of one number. The alternative —
// re-authoring every layer's offset onto a different world axis — also breaks
// the ascent, where "down" is not arbitrary: the ground really is at -y and
// gravity really does point that way. So the world keeps its axis and the
// CAMERA turns, which additionally makes the hand-off from "standing on a
// planet" to "travelling between two" an authored move rather than a cut.
export function aimCamera(cam, { pos, azimuthDeg = 0, lookAt = [0, 0, 0], pan = 0, rollDeg = 0 } = {}) {
  const [x, y, z] = pos;
  const a = (azimuthDeg * Math.PI) / 180;
  cam.position.set(x * Math.cos(a) + z * Math.sin(a), y, z * Math.cos(a) - x * Math.sin(a));
  const [lx, ly, lz] = lookAt;
  cam.lookAt(lx, ly, lz);
  // Roll BEFORE pan, so that pan stays screen-horizontal whatever the roll is.
  // Pan exists to push a subject clear of the copy panel, and the panel does
  // not roll with the camera.
  if (rollDeg) cam.rotateZ((rollDeg * Math.PI) / 180);
  if (pan) cam.translateX(-pan);
}
