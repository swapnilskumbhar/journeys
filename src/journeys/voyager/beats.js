import { auTo } from './distance.js';

// The stops. `at` is heliocentric range in metres. Numbers are real: the
// 1977 Grand Tour launch window really does recur roughly once every 176
// years (when Jupiter, Saturn, Uranus and Neptune line up for sequential
// gravity assists); Voyager 1 crossed the termination shock in Dec 2004 at
// ~94 AU and the heliopause in Aug 2012 at ~121 AU; the Pale Blue Dot
// photograph was taken 14 Feb 1990 at ~40.5 AU; Voyager 1 is quoted here at
// ~166 AU, its approximate distance today; Proxima Centauri is 4.0134 ly
// away, and at Voyager 1's current speed (~17 km/s) it would take about
// 74,000 years to cover that distance if it were headed there, which it is
// not — no spacecraft from Earth is aimed at any particular star.

export const beats = [
  {
    at: auTo(1.00),
    heading: 'The Grand Tour alignment',
    body: 'Once roughly every 176 years, Jupiter, Saturn, Uranus and Neptune line up so a single spacecraft can use each planet\'s gravity to bend and accelerate toward the next. The alignment was there in the late 1970s; two Voyager probes were built to use it.',
    hint: 'Scroll to travel outward. The axis is distance from the Sun, not time.',
  },
  {
    at: auTo(1.02),
    heading: 'Leaving Earth',
    body: 'A Titan-Centaur booster does the work an Apollo stack could not: enough velocity to leave the solar system\'s inner reaches for good, no return trajectory built in. Voyager 2 launched first, on a slower path; Voyager 1 overtook it two weeks later on a faster one.',
  },
  {
    at: auTo(1.03),
    heading: 'The Moon, in passing',
    body: 'The Moon crosses the frame in the first hours, already a footnote — closer to Earth than the spacecraft will ever be to anything again except the four worlds still ahead of it.',
  },
  {
    at: auTo(1.5),
    heading: 'Into deep cruise',
    body: 'Past Mars\' orbital distance, the instruments power up and the long coast to Jupiter begins: a year and a half of nearly featureless space, exactly the stretch this journey has to earn rather than skip past.',
  },
  {
    at: auTo(2.7),
    heading: 'The asteroid belt',
    body: 'Between Mars and Jupiter lies a belt of rock, mostly empty despite its reputation — the total mass of everything in it is less than the Moon\'s, spread across a region wide enough that a spacecraft can cross it without a realistic chance of hitting anything.',
  },
  {
    at: auTo(4.5),
    heading: 'Approaching the giant',
    body: 'Jupiter grows from a bright point to a banded disc over months, not days — more than three hundred times Earth\'s mass, its gravity now the dominant force acting on the spacecraft\'s path.',
  },
  {
    at: auTo(5.20),
    heading: 'Jupiter: the Great Red Spot',
    body: 'A storm wider than Earth has been raging in Jupiter\'s southern hemisphere for at least as long as telescopes have been pointed at it. Voyager 1 photographed it turning, a fluid vortex with no solid ground beneath it anywhere.',
  },
  {
    at: auTo(5.203),
    heading: 'Banded cloud tops',
    body: 'Jupiter has no surface to speak of — what looks solid is the top of an atmosphere thousands of kilometres deep, organised into bands by winds that blow in opposite directions at adjacent latitudes, colder ammonia ice above warmer gas below.',
  },
  {
    at: auTo(5.205),
    heading: "Io's volcanoes",
    body: "Io, squeezed and flexed by Jupiter's tides, turned out to be the most volcanically active body in the solar system — plumes hundreds of kilometres high, photographed erupting in real time, a discovery nobody on the mission had predicted.",
  },
  {
    at: auTo(5.207),
    heading: "Europa's cracked ice",
    body: "Europa's surface is ice, fractured into long straight lines with almost no impact craters — evidence of a young surface, resurfaced from below, and the first hint that an ocean might be sitting under that ice.",
  },
  {
    at: auTo(5.25),
    heading: 'The gravity assist',
    body: "The spacecraft does not fire an engine to reach Saturn faster; it steals a sliver of Jupiter's own orbital momentum, bending its path and adding several kilometres a second of speed for free. Jupiter loses an amount of momentum too small to ever measure. This one manoeuvre is what makes the rest of the mission possible.",
  },
  {
    at: auTo(7.5),
    heading: 'Cruise to Saturn',
    body: "Another two years of coasting, faster now than the outbound leg to Jupiter — the assist's whole purpose. The Sun is visibly smaller here than it was at Earth, and will keep shrinking for the rest of this journey.",
  },
  {
    at: auTo(9.58),
    heading: 'Saturn: the rings edge-on',
    body: "From certain angles Saturn's rings, seventy metres thick and hundreds of thousands of kilometres wide, all but disappear — a plane so thin it can vanish from view even though it is the most recognisable feature in the solar system from any other angle.",
  },
  {
    at: auTo(9.586),
    heading: 'The rings, lit',
    body: 'Tilted into sunlight, the rings resolve into thousands of separate ringlets — not a solid sheet but countless individual particles of ice, from dust grains to house-sized chunks, all independently orbiting.',
  },
  {
    at: auTo(9.60),
    heading: "Titan's haze",
    body: "Titan is wrapped in an orange nitrogen atmosphere thicker than Earth's, opaque enough that Voyager's cameras could not see through it to any surface at all — an entire moon that kept its ground a secret for another quarter century.",
  },
  {
    at: auTo(9.70),
    heading: 'Voyager 1 and 2 diverge',
    body: "Voyager 1's trajectory through the Saturn system was bent north, out of the plane of the planets, to study Titan up close — a choice that traded away any further planetary encounters. Voyager 2 flew a different line through the same system, preserving a path on to Uranus and Neptune. From here the two spacecraft are on genuinely different journeys.",
  },
  {
    at: auTo(14),
    heading: 'Cruise to Uranus',
    body: "Voyager 2's alone now on this leg — four and a half years of coasting, farther from the Sun than any spacecraft had gone at the time and about to go farther still.",
  },
  {
    at: auTo(19.20),
    heading: 'Uranus: tipped on its side',
    body: "Uranus rotates on an axis tilted almost ninety degrees from every other planet's — it orbits the Sun rolling rather than spinning upright, the likely scar of an ancient collision. Its atmosphere is a nearly featureless pale cyan, methane absorbing the red end of sunlight and leaving the rest.",
  },
  {
    at: auTo(25),
    heading: 'Cruise to Neptune',
    body: "Another three years outbound. Sunlight here is roughly a thousandth of its strength at Earth — full daylight on Neptune is dimmer than Earth's dusk.",
  },
  {
    at: auTo(30.10),
    heading: 'Neptune: the deepest blue',
    body: "Neptune is the most deeply coloured of the giant planets, and the windiest place yet found anywhere in the solar system — supersonic winds, over two thousand kilometres an hour, driven by a heat source inside the planet that outshines the feeble sunlight reaching it from here.",
  },
  {
    at: auTo(30.1024),
    heading: "Triton's nitrogen geysers",
    body: "Neptune's largest moon orbits backwards, evidence it was captured rather than formed in place, and its thin nitrogen atmosphere vents in geysers photographed rising kilometres above a surface colder than anywhere else Voyager visited.",
  },
  {
    at: auTo(39.50),
    heading: "Pluto's distance, and the Kuiper belt",
    body: "This is Pluto's own average distance from the Sun — Voyager 2 was never aimed at it, its trajectory already committed to Triton by the time the choice was made. Beyond here lies the Kuiper belt, a second, far larger belt of icy debris that Pluto is merely the largest known member of.",
  },
  {
    at: auTo(40.50),
    heading: 'The Pale Blue Dot',
    body: "On 14 February 1990, at the request of Carl Sagan, Voyager 1 turned its camera back toward the inner solar system and photographed Earth from here: a single pixel, less than a tenth of a pixel wide, caught in a scattered ray of sunlight. Everyone who has ever lived, lived on that point.",
  },
  {
    at: auTo(60),
    heading: 'Sunlight fading toward starlight',
    body: "The Sun is now unmistakably one star among many rather than a source of daylight — bright still, but no longer bright enough to cast a meaningful shadow. The transition from sunlight to starlight has no sharp edge; it is simply the inverse-square law, run far enough.",
  },
  {
    at: auTo(94),
    heading: 'The termination shock',
    body: "Voyager 1 crossed this boundary in December 2004: the point where the solar wind, streaming outward at supersonic speed since it left the Sun, abruptly slows as it starts to push back against the thin gas between the stars.",
  },
  {
    at: auTo(121),
    heading: 'The heliopause',
    body: "Voyager 1 crossed here in August 2012 — plasma density jumped roughly forty-fold in a matter of days. This is the actual boundary of the Sun's influence: inside it, particles that came from the Sun; outside it, particles that came from everywhere else in the galaxy.",
  },
  {
    at: auTo(130),
    heading: 'Interstellar space',
    body: "Voyager 1 is now the first human-made object confirmed to be travelling through the material between stars, rather than through the Sun's own extended atmosphere. It is still bound to the Sun by gravity — this is a change in what surrounds it, not an escape from orbit.",
  },
  {
    at: auTo(166),
    heading: 'Voyager 1, today',
    body: "Roughly a hundred and sixty-six times Earth's distance from the Sun, and still transmitting — a signal that takes over twenty-two hours to reach Earth at the speed of light, carried by a radio dish three point seven metres across and a transmitter weaker than a refrigerator light bulb.",
  },
  {
    at: auTo(166.1),
    heading: 'The Golden Record',
    body: "Bolted to each spacecraft is a gold-plated copper record: sounds and images of Earth, greetings in fifty-five languages, and a stylus and instructions for playing it, aimed at whoever might find it long after everyone who built it is gone.",
  },
  {
    at: auTo(1000),
    heading: 'Deeper into the dark',
    body: "A thousand astronomical units out, and the Sun has faded to a star among stars in earnest — still the brightest thing in this sky by a wide margin, but nothing here would tell an observer where they had come from without already being told.",
  },
  {
    at: auTo(20000),
    heading: 'The Oort cloud',
    body: "Somewhere in this vast range lies the Oort cloud — a shell of icy bodies loosely bound to the Sun, the presumed source of long-period comets, never directly observed and inferred only from the comets that occasionally fall in from it. Voyager 1 will not reach even its inner edge for another three hundred years.",
  },
  {
    at: auTo(268000),
    heading: 'The Sun as just another star',
    body: "This is Proxima Centauri's distance — 4.0134 light-years, the nearest star to the Sun. At Voyager 1's current speed of about seventeen kilometres a second, covering that distance would take roughly seventy-four thousand years, and Voyager 1 is not headed there. From out here the Sun is simply one point of light in a field of others, exactly as every other star looks from everywhere else.",
  },
];
