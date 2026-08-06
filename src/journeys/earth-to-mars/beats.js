import { MARS_D, walked } from './distance.js';

// The stops. `at` is metres travelled along the flight path — pad to Martian
// surface, ~5.60e11 m of it, walked() past that.
//
// Numbers are real: a Mars transfer stack carries its own cruise stage (heavier
// than an Apollo stack), Mars receives 43% of Earth's solar flux, a Hohmann
// transfer's aphelion crosses Mars' own 2.279e11 m orbital radius, entry
// interface at Mars is conventionally 125 km altitude, and Mars' two moons are
// deliberately not mentioned here — this journey is about the Sun and the two
// planets, not a third body.

export const beats = [
  {
    at: 1,
    heading: 'The pad',
    body: 'A Mars transfer stack stands on the pad — taller and heavier than an Apollo stack, because it carries its own cruise stage: the hardware that will still be firing four decades of distance from now. Almost all of its mass, again, is propellant.',
    hint: 'Scroll to travel outward. The axis is distance along the flight path, not time.',
  },
  {
    at: 4,
    heading: 'Ignition',
    body: 'The engines light and build thrust over several seconds while computers confirm every one is healthy, held down the whole time. Water floods the flame trench to keep the sound from shaking the vehicle apart. Then the hold-down arms let go.',
  },
  {
    at: 130,
    heading: 'The tower clears',
    body: 'The stack rises past its own tower, rolls onto its heading, and begins to tip over. The goal from here is sideways speed, not altitude — every second spent going straight up is a second spent fighting gravity for nothing.',
  },
  {
    at: 1.4e4,
    heading: 'Max Q',
    body: 'Speed and remaining air multiply to their worst combination here, around fourteen kilometres up. The engines throttle back through the load, then push forward again once the air has thinned enough to stop fighting back.',
  },
  {
    at: 6.5e4,
    heading: 'Staging',
    body: 'The spent first stage falls away, tumbling, as the second stage lights above it. For a few seconds two objects are visible where a moment ago there was one — the exact mechanism earth-to-moon\'s Saturn V used, run again on different hardware.',
  },
  {
    at: 9.5e4,
    heading: 'The sky goes black',
    body: 'Above about a hundred kilometres there is no meaningful air left to scatter blue light, so the band above the horizon turns to stars while the horizon itself stays lit and visibly curved. The vehicle is now in the vacuum it will occupy for the rest of the journey.',
  },
  {
    at: 2.0e5,
    heading: 'Parking orbit',
    body: 'The stage cuts off in a low parking orbit, coasting rather than burning, while the crew and the ground confirm the trajectory before committing to it. Earth fills most of the lower frame — a full planet is a very large thing seen from two hundred kilometres up.',
  },
  {
    at: 2.05e5,
    heading: 'One quiet orbit',
    body: 'The stack circles once before the burn that actually leaves. The terminator sweeps beneath it; on the night side, city lights mark out coastlines the day side had hidden in the glare.',
  },
  {
    at: 2.2e5,
    heading: 'Trans-Mars injection',
    body: 'The stage relights and burns until the trajectory no longer returns to Earth. This single burn sets essentially the whole of the next four decades of distance — there is no steering to speak of between here and Mars beyond a few small corrections.',
  },
  {
    at: 1.0e7,
    heading: 'Earth shrinking behind',
    body: 'Ten thousand kilometres out, Earth is still the dominant object in the sky, but it is now unmistakably a receding disc rather than a horizon. The Moon rides beside it as a small, separate point — the destination of the other journey, now just a companion to this one\'s point of departure.',
  },
  {
    at: 1.0e9,
    heading: 'Nothing close to anything',
    body: 'A million kilometres out, and the honest picture of interplanetary space is exactly this: a small craft, a faint line marking where it has been and where it is going, and stars. Nothing is close to anything out here — that is not a rendering limitation, it is the actual density of the solar system.',
  },
  {
    at: 3.0e10,
    heading: 'A dimmer sun',
    body: 'Mars receives forty-three per cent of the sunlight Earth does, and the difference is already visible: the Sun is a measurably smaller, cooler-white disc than the one the stack lifted off under. Nothing about this is a special effect — it is the inverse-square law, watched happening rather than read as a statistic.',
  },
  {
    at: 1.5e11,
    heading: "Crossing Earth's orbit",
    body: "The trajectory line crosses a faint ring marking Earth's own path around the Sun — not a place, just the circle Earth traces every year, now behind and inside the ship's own arc. Earth and the Sun have both shrunk to points by this distance.",
  },
  {
    at: 2.2e11,
    heading: 'The cruise stage unfolds',
    body: "Solar panels swing out to their full span, catching a sun already visibly dimmer than the one they were built to hold under at Earth. It is the only structural change the vehicle makes for the whole cruise, and the only thing that gives this stretch of the journey a shape rather than a wait.",
  },
  {
    at: 3.6e11,
    heading: 'A course correction',
    body: "A brief, precise burn nudges the trajectory — a thin blue flame against a backdrop that does not visibly change at all, because a correction burn is measured in metres per second against a journey measured in hundreds of billions of metres.",
  },
  {
    at: 5.0e11,
    heading: "Crossing Mars' orbit",
    body: "A second faint ring, Mars' own 2.279e11-metre orbital path, and this time there is a bright point sitting almost on the crossing: the trajectory was aimed to arrive exactly when Mars does. Rendezvous, not coincidence.",
  },
  {
    at: MARS_D - 5.97e8,
    heading: 'A point of light',
    body: "Mars is now the brightest thing ahead of the ship, an ochre-tinted point with no disc yet resolvable — the same threshold the Moon crossed for the outbound half of the other journey, reached here after a much longer, much emptier approach.",
  },
  {
    at: MARS_D - 5.46e7,
    heading: 'A disc',
    body: "A small, hard-edged ochre disc, still smaller in this frame than the Moon ever appeared from lunar orbit — Mars is a smaller body, seen across a longer final approach. It is close enough now that its shape, not just its colour, is the subject.",
  },
  {
    at: MARS_D - 1.016e7,
    heading: 'Ochre, and a white cap',
    body: "Mars fills a third of the frame: rust-red dust across most of the disc, a bright polar cap at one pole, and a hard terminator with no atmosphere to soften it. The colour is iron oxide — the planet is, quite literally, rusted.",
  },
  {
    at: MARS_D - 5.79e6,
    heading: 'Olympus Mons, Valles Marineris',
    body: "Two features resolve on the approach: a shield volcano on the limb three times the height of Everest, and a canyon system scored across the disc that would stretch most of the way across the continental United States. Neither needs narration once it is actually visible.",
  },
  {
    at: MARS_D - 1.25e5,
    heading: 'Entry interface',
    body: "One hundred and twenty-five kilometres of altitude — the conventional line where atmosphere starts to matter — and a thin plasma sheath forms around the capsule, orange-white, streaming behind it. The ship is still moving several kilometres a second.",
  },
  {
    at: MARS_D - 6.0e4,
    heading: 'Peak heating',
    body: "The sheath reaches its brightest and widest here, briefly the only visible thing in the frame. Mars' atmosphere is thin — about one per cent of Earth's pressure at the surface — but at this speed even a thin atmosphere is enough to matter.",
  },
  {
    at: MARS_D - 1.1e4,
    heading: 'Parachute',
    body: "A single large canopy opens. The thin air means Martian parachutes do less work than Earth's — the ground below is still rushing up faster than an equivalent Earth landing would allow at this altitude, which is why powered descent still has real work left to do.",
  },
  {
    at: MARS_D - 2.0e3,
    heading: 'Heat shield away',
    body: "The heat shield falls away below, its job finished, revealing the lander's underside and legs for the first time. What follows next has to be flown, not fallen — there is no more atmosphere left to lean on.",
  },
  {
    at: MARS_D - 1.4e3,
    heading: 'Powered descent',
    body: "Retro engines light. A dust plume starts to billow off the ground below, kicked up by exhaust in an atmosphere too thin to keep it airborne for more than a few seconds — regolith thrown by an engine, not a glow.",
  },
  {
    at: MARS_D,
    heading: 'Touchdown',
    body: "Engines cut. In the thin air the dust drops almost as fast as it rose — four legs, planted on rust-coloured ground, and then stillness. This is the surface the whole path was aimed at from the moment the hold-down arms let go.",
  },
  {
    at: walked(9),
    heading: 'The first frame',
    body: "Rust-coloured sky near the sun, a butterscotch band low at the horizon where dust scatters what light there is, and rocks in the foreground — ordinary basalt, chemically unremarkable, extraordinary only for where they are.",
  },
  {
    at: walked(55),
    heading: 'An evening star',
    body: "At dusk, low over the horizon and close to where the sun went down, one point of light does not dim with the rest of the sky: Earth, from Mars, is an evening star — the whole of the outbound journey, seen from the other end of it, reduced to a single point.",
  },
];
