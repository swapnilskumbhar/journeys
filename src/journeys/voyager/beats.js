import { auTo } from './distance.js';
import { markAU, headings } from './plan.js';

// The stops. `at` is heliocentric range in metres, taken from plan.js so the
// axis, the beat marks and the scale law cannot drift apart.
//
// TWENTY-TWO, down from thirty-two. Ten beats were cut in the rework, and
// every one of them was a caption over the same picture: "The Moon, in
// passing", "Banded cloud tops", "Cruise to Uranus", "Cruise to Neptune",
// "Sunlight fading toward starlight", "The termination shock" (folded into
// the heliopause, which is the boundary a reader can actually name), "Interstellar
// space", "Voyager 1, today", "Deeper into the dark" and "The Oort cloud".
// Beats 22–32 of the first build all said some version of "space gets emptier"
// and all rendered as one white shape on black; that is a beat-SELECTION
// failure and no amount of restaging fixes it. Fewer, denser beats wins.
//
// The prose that survived is unchanged. Numbers are real: the 1977 Grand Tour
// launch window really does recur roughly once every 176 years (when Jupiter,
// Saturn, Uranus and Neptune line up for sequential gravity assists); Voyager 1
// crossed the heliopause in August 2012 at ~121 AU; the Pale Blue Dot
// photograph was taken 14 February 1990 at ~40.5 AU; Proxima Centauri is
// 4.0134 ly away, and at Voyager 1's current speed (~17 km/s) it would take
// about 74,000 years to cover that distance if it were headed there, which it
// is not — no spacecraft from Earth is aimed at any particular star.

const at = (i) => auTo(markAU(i));

export const beats = [
  {
    at: at(0),
    heading: headings[0],
    body: 'Once roughly every 176 years, Jupiter, Saturn, Uranus and Neptune line up so a single spacecraft can use each planet\'s gravity to bend and accelerate toward the next. The alignment was there in the late 1970s; two Voyager probes were built to use it.',
    hint: 'Scroll to travel outward. The axis is distance from the Sun, not time.',
  },
  {
    at: at(1),
    heading: headings[1],
    body: 'The Titan-Centaur has already done the work an Apollo stack could not: enough velocity to leave the solar system for good, with no return trajectory built in. Fourteen thousand kilometres up the burn is long over, the spent stages fall away, and the spacecraft unfolds — booms swinging out, the magnetometer reaching thirteen metres clear of everything else. Voyager 2 launched first on a slower path; Voyager 1 overtook it two weeks later.',
  },
  {
    at: at(2),
    heading: headings[2],
    body: 'Past Mars\' orbital distance, the instruments power up and the long coast to Jupiter begins: a year and a half of nearly featureless space, exactly the stretch this journey has to earn rather than skip past.',
  },
  {
    at: at(3),
    heading: headings[3],
    body: 'Between Mars and Jupiter lies a belt of rock, mostly empty despite its reputation — the total mass of everything in it is less than the Moon\'s, spread across a region wide enough that a spacecraft can cross it without a realistic chance of hitting anything.',
  },
  {
    at: at(4),
    heading: headings[4],
    body: 'Jupiter grows from a bright point to a banded disc over months, not days — more than three hundred times Earth\'s mass, its gravity now the dominant force acting on the spacecraft\'s path.',
  },
  {
    at: at(5),
    heading: headings[5],
    body: 'A storm wider than Earth has been raging in Jupiter\'s southern hemisphere for at least as long as telescopes have been pointed at it. Voyager 1 photographed it turning, a fluid vortex with no solid ground beneath it anywhere.',
  },
  {
    at: at(6),
    heading: headings[6],
    body: "Io, squeezed and flexed by Jupiter's tides, turned out to be the most volcanically active body in the solar system — plumes hundreds of kilometres high, photographed erupting in real time, a discovery nobody on the mission had predicted.",
  },
  {
    at: at(7),
    heading: headings[7],
    body: "Europa's surface is ice, fractured into long straight lines with almost no impact craters — evidence of a young surface, resurfaced from below, and the first hint that an ocean might be sitting under that ice.",
  },
  {
    at: at(8),
    heading: headings[8],
    body: "The spacecraft does not fire an engine to reach Saturn faster; it steals a sliver of Jupiter's own orbital momentum, bending its path and adding several kilometres a second of speed for free. Jupiter loses an amount of momentum too small to ever measure. This one manoeuvre is what makes the rest of the mission possible.",
  },
  {
    at: at(9),
    heading: headings[9],
    body: "Another two years of coasting, faster now than the outbound leg to Jupiter — the assist's whole purpose. The Sun is visibly smaller here than it was at Earth, and will keep shrinking for the rest of this journey.",
  },
  {
    at: at(10),
    heading: headings[10],
    body: "From certain angles Saturn's rings, seventy metres thick and hundreds of thousands of kilometres wide, all but disappear — a plane so thin it can vanish from view even though it is the most recognisable feature in the solar system from any other angle.",
  },
  {
    at: at(11),
    heading: headings[11],
    body: 'Tilted into sunlight, the rings resolve into thousands of separate ringlets — not a solid sheet but countless individual particles of ice, from dust grains to house-sized chunks, all independently orbiting.',
  },
  {
    at: at(12),
    heading: headings[12],
    body: "Titan is wrapped in an orange nitrogen atmosphere thicker than Earth's, opaque enough that Voyager's cameras could not see through it to any surface at all — an entire moon that kept its ground a secret for another quarter century.",
  },
  {
    at: at(13),
    heading: headings[13],
    body: "Voyager 1's trajectory through the Saturn system was bent north, out of the plane of the planets, to study Titan up close — a choice that traded away any further planetary encounters. Voyager 2 flew a different line through the same system, preserving a path on to Uranus and Neptune. From here the two spacecraft are on genuinely different journeys.",
  },
  {
    at: at(14),
    heading: headings[14],
    body: "Uranus rotates on an axis tilted almost ninety degrees from every other planet's — it orbits the Sun rolling rather than spinning upright, the likely scar of an ancient collision. Its atmosphere is a nearly featureless pale cyan, methane absorbing the red end of sunlight and leaving the rest.",
  },
  {
    at: at(15),
    heading: headings[15],
    body: "Neptune is the most deeply coloured of the giant planets, and the windiest place yet found anywhere in the solar system — supersonic winds, over two thousand kilometres an hour, driven by a heat source inside the planet that outshines the feeble sunlight reaching it from here.",
  },
  {
    at: at(16),
    heading: headings[16],
    body: "Neptune's largest moon orbits backwards, evidence it was captured rather than formed in place, and its thin nitrogen atmosphere vents in geysers photographed rising kilometres above a surface colder than anywhere else Voyager visited.",
  },
  {
    at: at(17),
    heading: headings[17],
    body: "This is Pluto's own average distance from the Sun — Voyager 2 was never aimed at it, its trajectory already committed to Triton by the time the choice was made. Beyond here lies the Kuiper belt, a second, far larger belt of icy debris that Pluto is merely the largest known member of.",
  },
  {
    at: at(18),
    heading: headings[18],
    body: "On 14 February 1990, at the request of Carl Sagan, Voyager 1 turned its camera back toward the inner solar system and photographed Earth from here: a single pixel, less than a tenth of a pixel wide, caught in a scattered ray of sunlight. Everyone who has ever lived, lived on that point.",
  },
  {
    at: at(19),
    heading: headings[19],
    body: "Voyager 1 crossed here in August 2012 — plasma density jumped roughly forty-fold in a matter of days. This is the actual boundary of the Sun's influence: inside it, particles that came from the Sun; outside it, particles that came from everywhere else in the galaxy. Eight years earlier the solar wind had already slowed to below the speed of sound at the termination shock, some thirty AU further in.",
  },
  {
    at: at(20),
    heading: headings[20],
    body: "Bolted to each spacecraft is a gold-plated copper record: sounds and images of Earth, greetings in fifty-five languages, and a stylus and instructions for playing it, aimed at whoever might find it long after everyone who built it is gone.",
  },
  {
    at: at(21),
    heading: headings[21],
    body: "This is Proxima Centauri's distance — 4.0134 light-years, the nearest star to the Sun. At Voyager 1's current speed of about seventeen kilometres a second, covering that distance would take roughly seventy-four thousand years, and Voyager 1 is not headed there. From out here the Sun is simply one point of light in a field of others, exactly as every other star looks from everywhere else.",
  },
];
