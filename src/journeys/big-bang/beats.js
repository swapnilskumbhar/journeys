import { ago, after, YR } from './time.js';

// The milestones. `at` is seconds since the Big Bang — written through `ago()`
// and `after()` so the source reads in the units the science is quoted in and
// stays checkable against a reference.
//
// Dates follow mainstream consensus: Planck 2018 cosmology (13.797 Gyr), the
// ICS 2023 geological timescale, and — for the first galaxies — JWST's
// JADES-GS-z14-0, which in 2024 pushed confirmed galaxy formation back to
// roughly 290 million years after the Big Bang.

export const beats = [
  {
    at: 5.39e-44,
    heading: 'The Planck epoch',
    body: 'The universe is younger than the shortest interval physics can describe. Gravity has not yet separated from the other forces, and no theory we have works here — general relativity and quantum mechanics both apply, and they contradict each other. This is not a gap in the data. It is the edge of the map.',
    hint: 'Scroll to travel forward in time.',
  },
  {
    at: 1e-36,
    heading: 'Inflation begins',
    body: 'For a sliver of a sliver of a second, space itself expands faster than light — not through space, but as space. A region smaller than a proton is stretched to something larger than a grapefruit.',
  },
  {
    at: 1e-32,
    heading: 'The seeds of everything',
    body: 'Inflation ends, leaving a universe almost perfectly smooth — but not quite. Quantum fluctuations, stretched to cosmic size, are frozen in as faint ripples in density. Every galaxy that will ever exist is already sketched here, in noise.',
  },
  {
    at: 1e-12,
    heading: 'The forces separate',
    body: 'The Higgs field settles into place and the electroweak force splits in two. Particles that had been massless acquire mass. The four forces we know — gravity, electromagnetism, and the strong and weak nuclear forces — now all exist as distinct things.',
  },
  {
    at: 1e-6,
    heading: 'Quarks are captured',
    body: 'Until now, quarks and gluons have moved freely in a plasma hotter than anything since. As the universe cools past about two trillion degrees, the strong force wins: quarks are bound into threes, and the first protons and neutrons appear.',
  },
  {
    at: 1e-4,
    heading: 'One in a billion survives',
    body: 'Matter and antimatter annihilate on contact, and there was very nearly the same amount of each. For every billion antiparticles there were about a billion and one particles. As the last of them find each other and vanish into light, that rounding error is all that remains — and it is every star, every planet, you.',
  },
  {
    at: 1,
    heading: 'Neutrinos fly free',
    body: 'One second in. The universe thins enough that neutrinos stop interacting with anything and simply leave. They are still travelling now, about 340 of them in every cubic centimetre of the room you are in, cooled to under two degrees above absolute zero.',
  },
  {
    at: 180,
    heading: 'The first elements',
    body: 'Between roughly ten seconds and twenty minutes, protons and neutrons fuse into the lightest nuclei: helium, a trace of deuterium and lithium. Then the universe becomes too cold and too sparse to fuse anything more. The recipe locks in at about three-quarters hydrogen, one-quarter helium — and it still holds today.',
  },
  {
    at: 1e8,
    heading: 'Featureless glare',
    body: 'For the next few hundred thousand years the universe is an opaque plasma at around a million degrees — uniformly, blindingly bright in every direction. Light cannot travel any distance before being scattered by a free electron. There is nothing to see, because there is nowhere for an image to come from.',
  },
  {
    at: after(50e3),
    heading: 'Matter takes the lead',
    body: 'For fifty thousand years radiation has dominated, its pressure smoothing out any structure that tried to form. Now matter finally outweighs it. Gravity is free to start pulling, and the faint ripples left by inflation begin to deepen.',
  },
  {
    at: after(380e3),
    heading: 'The universe turns transparent',
    body: 'At about 3,000 degrees, electrons slow enough to be captured by nuclei, and the fog of free charges clears. Light that had been endlessly scattered can finally travel in a straight line. That light is still arriving: the cosmic microwave background, stretched by expansion to microwaves at 2.725 degrees above absolute zero.',
    hint: 'The oldest light there is — everything before this is invisible, forever.',
  },
  {
    at: after(3e6),
    heading: 'The dark ages',
    body: 'The afterglow fades to infrared, then to nothing the eye could catch. There are no stars yet, no galaxies — only cooling hydrogen and helium, drifting, drawn slowly toward the densest patches. This darkness lasts a hundred million years.',
  },
  {
    at: after(180e6),
    heading: 'First light',
    body: 'The first stars ignite in the densest knots of gas. With no heavier elements to help them cool and fragment, they grow enormous — hundreds of times the mass of the Sun — burn ferociously blue, and die within a few million years. Their explosions scatter the first carbon, oxygen and iron ever to exist.',
  },
  {
    at: after(290e6),
    heading: 'The first galaxies',
    body: 'Stars gather into the first true galaxies. In 2024 the James Webb telescope confirmed one, JADES-GS-z14-0, shining less than 300 million years after the Big Bang — far brighter and more developed than anyone expected this early, and a genuine open problem.',
  },
  {
    at: after(1e9),
    heading: 'The fog burns off',
    body: 'Radiation from the first stars and galaxies strips electrons back off the hydrogen filling the universe. Reionization completes about a billion years in, and intergalactic space becomes clear to ultraviolet light — the state it remains in today.',
  },
  {
    at: after(3.3e9),
    heading: 'Cosmic noon',
    body: 'Star formation peaks. The universe is building stars roughly ten times faster than it does now, galaxies are colliding constantly, and supermassive black holes are feeding at their brightest as quasars. Everything after this is, slowly, a quieting down.',
  },
  {
    at: after(5e9),
    heading: 'The cosmic web',
    body: 'On the largest scales, matter is not scattered evenly. Galaxies hang in sheets and filaments strung between dense clusters, with vast near-empty voids between them — the ripples from inflation, grown for billions of years under gravity into the largest structure that exists.',
  },
  {
    at: ago(5e9),
    heading: 'Expansion speeds up',
    body: 'For eight billion years gravity has been slowing the expansion down. Then, as matter thins out, something else takes over: dark energy, which makes up about 68% of the universe and pushes it apart faster and faster. We do not know what it is.',
  },
  {
    at: ago(4.8e9),
    heading: 'Our galaxy',
    body: 'We arrive in a barred spiral about 100,000 light years across, holding a few hundred billion stars around a black hole four million times the mass of the Sun. There are hundreds of billions of other galaxies. Nothing about our position in it is special — which took a long time to accept, and is one of the more important things anyone has worked out.',
  },
  {
    at: ago(4.568e9),
    heading: 'A star is born',
    body: 'A fragment of a cold molecular cloud collapses. Most of it becomes the Sun; the leftover 0.14% flattens into a spinning disc of gas and dust. That disc is every planet, moon, asteroid and comet in the solar system, including the ground under your feet.',
  },
  {
    at: ago(4.51e9),
    heading: 'The Moon',
    body: 'A Mars-sized body strikes the young Earth a glancing blow. The impactor is destroyed, Earth is left molten and spinning fast, and the debris thrown into orbit coalesces within a century or so into the Moon — which formed far closer than it is now, and has been drifting away ever since.',
  },
  {
    at: ago(4.4e9),
    heading: 'Oceans',
    body: 'Earth cools enough for water to stay liquid. Tiny zircon crystals from Western Australia, 4.4 billion years old, carry a chemical signature that only forms in the presence of water — evidence that oceans existed within about 150 million years of the planet itself.',
  },
  {
    at: ago(3.7e9),
    heading: 'Life',
    body: 'Somewhere in that water, chemistry starts copying itself. The oldest widely accepted traces — layered microbial mats called stromatolites — are around 3.5 billion years old, and disputed claims reach back past 3.8. Every living thing shares one ancestor from around this time.',
  },
  {
    at: ago(2.4e9),
    heading: 'The oxygen catastrophe',
    body: 'Cyanobacteria have been splitting water for energy and venting oxygen as waste. Once the oceans can absorb no more, it floods the atmosphere — and poisons almost everything alive, in what may be the largest extinction in Earth\'s history. It also makes everything that follows possible.',
  },
  {
    at: ago(1.8e9),
    heading: 'Cells within cells',
    body: 'One microbe engulfs another and, instead of digesting it, keeps it. The captive becomes the mitochondrion. This single merger gives cells the energy budget for complexity — and every plant, animal and fungus descends from it.',
  },
  {
    at: ago(600e6),
    heading: 'Bodies',
    body: 'After three billion years of almost entirely single cells, the Ediacaran seas fill with the first large, soft-bodied multicellular organisms — fronds and discs and ribbons, unlike anything alive today.',
  },
  {
    at: ago(538.8e6),
    heading: 'The Cambrian explosion',
    body: 'In perhaps twenty million years — a blink, at this scale — almost every major animal body plan alive today appears in the fossil record. Eyes, shells, limbs, guts, predators. The arms race that has been running ever since starts here.',
  },
  {
    at: ago(470e6),
    heading: 'Life leaves the water',
    body: 'Plants colonise bare rock, and over the next hundred million years build the first soils and forests. Atmospheric oxygen climbs steeply. Arthropods follow them ashore, and by 380 million years ago the first vertebrates drag themselves onto land.',
  },
  {
    at: ago(251.9e6),
    heading: 'The Great Dying',
    body: 'Vast volcanic eruptions in Siberia burn through coal deposits and dump carbon into the atmosphere. The oceans acidify and lose their oxygen. Around 81% of marine species vanish — the closest life has come to ending entirely, and it takes ten million years to recover.',
  },
  {
    at: ago(66e6),
    heading: 'Ten kilometres of rock',
    body: 'An asteroid strikes what is now the Yucatán Peninsula at around 20 kilometres per second. Impact debris ignites fires worldwide and dust blocks the sun for years. The non-avian dinosaurs end here, and the small surviving mammals inherit an empty world.',
  },
  {
    at: ago(7e6),
    heading: 'A branch splits',
    body: 'In Africa, the lineage leading to us separates from the one leading to chimpanzees. There is no first human — just a long series of populations, walking upright a little more often, over millions of years.',
  },
  {
    at: ago(1.9e6),
    heading: 'Fire and travel',
    body: 'Homo erectus appears: tall, long-legged, and the first hominin to leave Africa. Its stone tools stay recognisably the same for over a million years, and somewhere in that span our ancestors learn to control fire — which cooks food, extends the day, and starts feeding a very expensive brain.',
  },
  {
    at: ago(300e3),
    heading: 'Us',
    body: 'The oldest fossils of Homo sapiens, from Jebel Irhoud in Morocco, are about 300,000 years old. For most of the time our species has existed, there were several other kinds of human alive at the same time — Neanderthals, Denisovans, and others. Some of their DNA is in most people reading this.',
  },
  {
    at: ago(65e3),
    heading: 'Out of Africa',
    body: 'A wave of modern humans spreads out across Eurasia and, remarkably early, reaches Australia by boat. Within forty thousand years our species occupies every continent except Antarctica — and is the only kind of human left.',
  },
  {
    at: ago(12e3),
    heading: 'Farming',
    body: 'As the last ice age ends, people in the Fertile Crescent begin planting the seeds they gathered. Food can now be stored, which means surplus, which means settlements, specialists, property and hierarchy. Independently, the same thing happens in China, Mesoamerica, the Andes and New Guinea.',
  },
  {
    at: ago(5.2e3),
    heading: 'Writing',
    body: 'In Uruk, accountants pressing marks into clay to track grain and livestock slowly turn tallies into signs, and signs into language. It is the first time information outlives the person holding it — and the moment history begins to record itself.',
  },
  {
    at: ago(260),
    heading: 'Machines',
    body: 'Britain starts burning coal at scale, and human muscle stops being the limit on what can be built. Within two centuries, population, energy use and atmospheric carbon all bend sharply upward — and humanity becomes a geological force in its own right.',
  },
  {
    at: ago(1),
    heading: 'Today',
    body: 'Thirteen point eight billion years of physics, and a small fraction of the matter produced by it has arranged itself into something that can work out where it came from. The whole of recorded history occupies the last one-thousandth of one percent of that scroll.',
    hint: 'Drag the ribbon to travel back.',
  },
];
