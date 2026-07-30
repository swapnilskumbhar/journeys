import { MOON_D, CROSSOVER, overMoon, walked } from './distance.js';

// The stops. `at` is metres from Earth's surface along the flight path, written
// through `overMoon()` and `walked()` where that is the honest way to say it,
// so the source reads in the units the flight was actually flown in.
//
// Numbers follow the Apollo 11 flight record and NASA's mission reports: a
// 2,970-tonne stack, 7.6 million pounds of thrust, max dynamic pressure at
// about 13.7 km, S-IC cutoff near 67 km, a 185.5 × 190.6 km parking orbit,
// translunar injection to 10.83 km/s, and a descent that began at 15 km with
// pitchover near 2.3 km. Where a number is a range in the sources, the copy
// says so rather than picking a false precision.

export const beats = [
  {
    at: 1,
    heading: 'The pad',
    body: 'Two thousand nine hundred and seventy tonnes are standing on a concrete pad, and about ninety per cent of that mass is propellant. The stack is 110 metres tall — most of it a thin aluminium skin holding kerosene, liquid oxygen and liquid hydrogen apart from each other. Three people are strapped in at the top.',
    hint: 'Scroll to travel outward. The axis is distance, not time.',
  },
  {
    at: 4,
    heading: 'Ignition',
    body: 'Five F-1 engines light and build to 7.6 million pounds of thrust over about seven seconds, held down the whole time while the computers confirm all five are healthy. Water floods the flame trench at 200 tonnes a minute — not to cool the rocket, but to keep the sound from shaking the vehicle apart. Then the hold-down arms let go.',
  },
  {
    at: 110,
    heading: 'The tower clears',
    body: 'It takes about twelve seconds to rise past its own launch tower, slower than a lift. Once clear, the vehicle rolls onto the heading it will fly and begins to tip over — because the goal is not height, it is sideways speed, and every second spent going straight up is a second spent fighting gravity for nothing.',
  },
  {
    at: 2.0e3,
    heading: 'Through the cloud deck',
    body: 'Two kilometres up, and the coastline below has already flattened into a map. The vehicle is accelerating hard now: it burns roughly thirteen tonnes of propellant every second, so it gets lighter as fast as it gets faster. The cloud tops fall away underneath in a few seconds.',
  },
  {
    at: 1.37e4,
    heading: 'Max Q',
    body: 'At around fourteen kilometres, speed and remaining air multiply to their worst combination — maximum dynamic pressure, about 35 kilopascals of wind against the nose. This is the moment the structure is most likely to fail, so the engines are throttled back through it. Past here the atmosphere thins faster than the vehicle accelerates, and the loads only ever fall.',
  },
  {
    at: 3.5e4,
    heading: 'The sky goes out',
    body: 'By thirty-five kilometres, ninety-nine per cent of the atmosphere is below. There is not enough air left overhead to scatter blue, so the sky above the horizon turns black in daylight while the horizon itself stays bright — and for the first time the edge of it is visibly curved.',
  },
  {
    at: 6.7e4,
    heading: 'Staging',
    body: 'The first stage runs dry at about sixty-seven kilometres, having burned two thousand tonnes in two and a half minutes. Explosive charges cut the interstage, small retro-rockets push the empty stage backwards, and it falls away to break up in the upper atmosphere. The second stage lights while both are still moving at nearly 2.4 kilometres per second.',
  },
  {
    at: 9.5e4,
    heading: 'The escape tower goes',
    body: 'The launch escape system — a solid rocket on a lattice tower that could have pulled the crew capsule clear in the first two minutes — is no longer any use, so it is jettisoned and takes the protective cover with it. The crew get their windows back. A hundred kilometres up, by international convention, is where space begins.',
  },
  {
    at: 1.40e5,
    heading: 'The second stage',
    body: 'Five J-2 engines burning liquid hydrogen, pushing almost flat now rather than up. Altitude has stopped being the point: the vehicle is trading the last of its climb for horizontal speed, and the whole limb of the Earth has opened out below into a shallow blue curve with a thin bright rind of atmosphere on it.',
  },
  {
    at: 1.855e5,
    heading: 'Cut-off',
    // "Falling around the world" was folded in here. It sat at 1.88e5 m — three
    // kilometres higher than this beat, on the same orbit, in the same light —
    // and measured adjacent 0.5 against it: the same picture with a different
    // caption. Orbital mechanics is the right thing to explain at cut-off, not
    // a separate stop with nothing new to look at.
    body: 'Eleven and a half minutes after the hold-down arms released, the engines stop. The vehicle is 185 kilometres up and travelling at 7.8 kilometres per second. Nothing is pushing any more, and everything loose in the cabin begins to drift. This is not the absence of gravity — at this altitude gravity is still about 94 per cent of its value on the ground. It is falling and missing: moving sideways fast enough that the surface curves away underneath at exactly the rate the ship drops, so the fall never ends.',
  },
  {
    at: 1.905e5,
    heading: 'Sixteen sunrises',
    body: 'One trip around takes about eighty-eight minutes, which is sixteen sunrises and sixteen sunsets a day. Each one lasts a few seconds and runs through the whole atmosphere edge-on: a thin band of orange under a thinner band of blue, and then black. The crew stay here for about two and a half hours, checking the ship before committing.',
  },
  {
    at: 1.95e5,
    heading: 'Translunar injection',
    body: 'The third stage relights over the Pacific and burns for nearly six minutes, taking the ship from 7.8 to 10.83 kilometres per second. That is not escape velocity — it is deliberately just short of it. The trajectory is an enormous ellipse whose far end happens to be where the Moon will be in three days.',
  },
  {
    at: 6.0e6,
    heading: 'Turnaround',
    body: 'Six thousand kilometres out, the crew separate their capsule from the spent stage, turn it end for end, and dock nose-first with the lunar module still folded inside. Then they pull it out and leave the stage behind. It is the only piloted manoeuvre in the flight that would be impossible to do from the ground.',
  },
  {
    at: 2.5e7,
    heading: 'The whole Earth',
    body: 'At twenty-five thousand kilometres the planet finally fits inside a window. This is roughly where the whole-Earth photographs were taken — the first pictures in which the thing everyone lives on has an edge. The Moon, from here, is still a small bright disc about half a degree across, exactly as it looks from the ground.',
  },
  // THREE BEATS CUT TO ONE, and the measurement is the argument. "Nothing to
  // push against" (8.0e7), "Small enough to cover" (2.6e8) and "Where the Moon
  // takes over" (CROSSOVER) scored 0.029, 0.026 and 0.024 occupancy with
  // adjacent distances of 0.6, 0.2 and 0.4 — three captions over one picture of
  // a very small disc. No scale law could rescue them: at those distances Earth
  // really is 6.7°, then 2.1°, and the honest picture of a marble is a marble.
  //
  // A stretch of the axis where the world genuinely does not change wants FEWER
  // beats, not more captions. The facts worth keeping — the silent coast, the
  // thumb, the point where the arithmetic changes sign — all belong to the same
  // idea and now share one beat, placed where the trajectory and both bodies
  // are still legible together.
  {
    at: 8.0e7,
    heading: 'Nothing to push against',
    body: 'The engines have been silent for a day. The ship is coasting and slowing the whole time, climbing away against a gravity that never quite lets go. Cover Earth with your thumb at arm\'s length now and it is gone, along with everyone. About nine-tenths of the way out, the Moon\'s pull finally exceeds Earth\'s — the ship is at its slowest there, under a kilometre per second, and from that point it stops climbing and starts falling. Nothing marks it. It is simply where the arithmetic changes sign.',
  },
  {
    at: 3.70e8,
    heading: 'The Moon becomes a place',
    body: 'Inside ten thousand kilometres the Moon stops being a disc and becomes terrain. Craters resolve inside craters, the maria show as smooth grey floods, and the terminator is a hard line — with no atmosphere there is no twilight, no blue rim, nothing between full sunlight and black shadow.',
  },
  {
    at: overMoon(3.14e5),
    heading: 'Behind the Moon',
    body: 'The braking burn has to happen on the far side, out of radio contact with Earth, because that is where the trajectory passes closest. For about half an hour nobody on the ground knows whether it worked. The far side is not dark — it gets exactly as much sun — but it has almost no maria, and it is far more heavily cratered.',
  },
  {
    at: overMoon(1.11e5),
    heading: 'Earthrise',
    body: 'Coming back around the limb, Earth climbs out of the lunar horizon. It does this every two hours here, but only because the ship is moving — from the surface below, the Earth never rises at all. It is about two degrees across: four times the width of a full Moon seen from a garden, and the only colour anywhere in the frame.',
  },
  {
    at: overMoon(1.00e5),
    heading: 'The terminator',
    body: 'The landing site is chosen for low sun. With the sun a few degrees above the horizon, every rock throws a shadow long enough to see from a hundred kilometres up, which is the only way to tell a boulder from a stain on flat grey ground. At noon the same terrain is featureless.',
  },
  {
    at: overMoon(1.5e4),
    heading: 'Powered descent',
    body: 'Fifteen kilometres up, the lander turns its engine into the direction of travel and begins to kill 1.7 kilometres per second of orbital speed. It flies on its back for the first eight minutes, engine forward, windows to the stars — braking is the entire job and there is nothing worth looking at ahead.',
  },
  {
    at: overMoon(2.3e3),
    heading: 'Pitchover',
    body: 'At about two and a half kilometres the lander swings upright and the crew see where they are going for the first time. The computer has been flying a curve calculated three days ago; from here a human decides whether the ground it has picked is actually landable, and there is fuel for roughly two minutes of arguing about it.',
  },
  {
    at: overMoon(1.5e2),
    heading: 'Sixty seconds',
    body: 'Below about thirty metres the exhaust starts moving the surface. With no air to hold it up, the dust does not billow — it leaves in flat radial sheets at high speed and does not come back, so the ground disappears under something like a fast grey river while the horizon stays perfectly sharp above it.',
  },
  {
    at: MOON_D,
    heading: 'Contact',
    body: 'Probes hanging below three of the four footpads touch first and light a lamp in the cabin. The engine is shut down and the lander drops the last metre or so. The instant the engine stops, the dust stops — every particle of it continues on a clean ballistic arc and lands, because there is no air to keep anything suspended.',
  },
  {
    at: walked(9),
    heading: 'One boot',
    body: 'The regolith is a powder of shattered glass and rock, ground for four billion years by micrometeorites, and it has never been rained on or blown about. It takes an impression like fresh cement and holds every ridge of the overshoe. Nothing here erases it — no wind, no water, no weather of any kind.',
  },
  {
    at: walked(55),
    heading: 'The Earth does not rise here',
    body: 'The Moon keeps one face turned to us, so from this spot the Earth hangs in the same patch of sky forever: it does not rise, it does not set, it only turns through its phases. Everything anyone has ever done is inside that two-degree disc, 376,292 kilometres back the way you came.',
    hint: 'Drag the ribbon to fall back toward Earth.',
  },
];
