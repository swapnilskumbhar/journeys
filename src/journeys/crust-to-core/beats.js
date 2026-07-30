import { D_MOHO, D_CMB, D_ICB, D_KOLA, D_MPONENG, R_EARTH } from './depth.js';

// The stops. `at` is depth below the surface, in metres. Real numbers
// throughout: Mponeng (~4 km, ~60°C rock face) is the deepest mine humans
// have dug; the Kola Superdeep Borehole (12.262 km) is the deepest hole ever
// drilled, still under 0.2% of the way to the centre; continental crust
// averages ~35 km thick; the Mohorovičić discontinuity is a real seismic
// boundary, not folklore; diamonds form 150–200 km down; the transition zone
// (410–660 km) is defined by high-pressure mineral phase changes; the
// core–mantle boundary (2,891 km) is the sharpest change in the planet; the
// inner-core boundary sits at 5,150 km (radius 1,221 km); the inner core is
// solid iron near the Sun's surface temperature, held solid by pressure alone.

export const beats = [
  {
    at: 0.3,
    heading: 'Grass and topsoil',
    body: 'The surface is alive in a way almost nothing beneath it will be again: roots, insects, fungal threads, decayed leaves — a few centimetres of topsoil that took centuries to accumulate and can wash away in one storm.',
    hint: 'Scroll to descend. The axis is depth below the surface, not time.',
  },
  {
    at: 1.5,
    heading: 'The root zone and the soil horizons',
    body: 'Below the topsoil, distinct horizons stack like the pages of a book: darker organic soil, then a paler layer leached of minerals, then a zone where clay and iron have accumulated from everything that ever rained through it.',
  },
  {
    at: 8,
    heading: 'The water table',
    body: 'Below this line the ground is saturated — every pore and crack in the rock full of water, not air. This is the surface aquifers draw from, and it rises and falls with the seasons far more than most of what lies beneath it ever will again.',
  },
  {
    at: 30,
    heading: 'The first solid bedrock',
    body: 'Loose soil gives way to unbroken rock — the first material down here that has to be drilled or blasted rather than dug. Whatever it is locally, granite, limestone, basalt, it has been here for millions of years and will be here for millions more.',
  },
  {
    at: 120,
    heading: 'Weathered rock, joints and fractures',
    body: 'The rock is still cut by joints and fractures inherited from every stress it has been under since it formed — cooling, uplift, ancient earthquakes. Water and roots still reach this far, following the cracks rather than the rock.',
  },
  {
    at: D_MPONENG,
    heading: 'Mponeng: the deepest mine',
    body: 'This is roughly the depth of Mponeng, the deepest gold mine on Earth, where the rock face runs at about sixty degrees Celsius and has to be actively refrigerated for anyone to work it. People go this far down; almost nowhere on the planet has anyone gone farther by hand.',
  },
  {
    at: 9.0e3,
    heading: 'Approaching the deepest hole ever drilled',
    body: 'Beyond any mine, into depths reached only by a drill bit turning at the end of a very long, very hot string of pipe. Temperature is now the limiting factor, not rock strength — the drill ahead is working rock hotter than it was ever designed for.',
  },
  {
    at: D_KOLA,
    heading: 'The Kola Superdeep Borehole',
    body: "Twelve point two six two kilometres: the deepest hole ever drilled, on the Kola Peninsula, over two decades of effort. It is still less than a fifth of one percent of the way to the centre — the honest scale of everything that follows this beat.",
  },
  {
    at: 2.0e4,
    heading: 'Sedimentary strata, time made visible',
    body: 'In a sedimentary basin this deep, each band of rock is a page of a very slow book — sand, mud and lime laid down in order over tens of millions of years, compacted into stone, and never disturbed since. Reading downward here is reading backward in time.',
  },
  {
    at: 3.0e4,
    heading: 'Deep crustal rock, metamorphosed',
    body: 'Heat and pressure at this depth have already recrystallised the rock into something its original sediments or lava never were — the same chemistry, rearranged into denser, harder minerals under conditions no surface process reaches.',
  },
  {
    at: 3.3e4,
    heading: 'Approaching the base of the crust',
    body: 'Continental crust averages about thirty-five kilometres thick, thickest under mountain ranges and thinnest under ocean basins. This is the last few kilometres of it — solid rock still recognisably CRUST, about to give way to something chemically different underneath.',
  },
  {
    at: D_MOHO,
    heading: 'The Mohorovičić discontinuity',
    body: 'Named for the seismologist who found it in 1909 from the way earthquake waves abruptly changed speed here: a real, sharp boundary where crust ends and mantle begins, discovered without ever being seen, purely from how fast the ground rings.',
  },
  {
    at: 3.7e4,
    heading: 'Into the mantle',
    body: 'On the other side of the Moho the rock is already different — denser, greener, richer in magnesium and iron than anything above it. The crust that took its place at the surface is, in bulk terms, a thin scum on top of what this planet is mostly made of.',
  },
  {
    at: 8.0e4,
    heading: 'Upper mantle, peridotite',
    body: 'The upper mantle is mostly peridotite — an olive-green rock rich in the mineral olivine, rarely seen at the surface except where deep faults or volcanoes have dragged pieces of it up intact. Solid, but not still: it moves, just unbelievably slowly.',
  },
  {
    at: 1.5e5,
    heading: 'The asthenosphere',
    body: 'Here the mantle is close enough to its melting point that it flows — not as liquid, but as solid rock creeping like extremely stiff glass over thousands of years. This is the layer the tectonic plates actually slide on; without its slow flow nothing at the surface would move at all.',
  },
  {
    at: 1.9e5,
    heading: 'Where diamonds form',
    body: 'Diamonds crystallise from carbon at pressures and temperatures found reliably only around this depth. They reach the surface at all because of kimberlite — a rare volcanic rock that erupts violently and fast enough to carry them up before they revert to ordinary graphite.',
  },
  {
    at: 5.0e5,
    heading: 'The transition zone',
    body: 'Between 410 and 660 kilometres down, the same mineral — olivine — is squeezed by pressure alone into two denser crystal structures in turn, with no change in chemistry at all. Seismic waves see both jumps clearly; nobody has ever held a piece of either mineral that formed this way.',
  },
  {
    at: 1.2e6,
    heading: 'The lower mantle',
    body: 'Below 660 kilometres the mantle is more uniform than anything above it — mostly a dense, pressure-stable mineral called bridgmanite, the single most abundant mineral in the Earth by volume, and one that had no name until it was finally synthesised and confirmed in a lab.',
  },
  {
    at: 2.85e6,
    heading: 'The D″ layer',
    body: 'Near the base of the mantle lies a strange, seismically patchy zone that appears to be the graveyard of subducted ocean floor — slabs of old crust that sank for a hundred million years and are still, geologically speaking, not finished falling.',
  },
  {
    at: 2.87e6,
    heading: 'Approaching the core–mantle boundary',
    body: 'The rock ahead is approaching the single sharpest change of state anywhere inside the planet: solid silicate mantle giving way, in a matter of kilometres, to liquid metal. Nothing else in the Earth changes this fast, this completely, over this short a distance.',
  },
  {
    at: D_CMB,
    heading: 'The core–mantle boundary',
    body: "Two thousand eight hundred and ninety-one kilometres down: rock ends and molten iron begins. The density jumps by nearly a factor of two in an instant by planetary standards — the most abrupt boundary inside the Earth, more sudden than the ground you are standing on right now feels solid.",
  },
  {
    at: 2.92e6,
    heading: 'Into the outer core',
    body: 'On the other side there is no more rock at all — only liquid metal, mostly iron and nickel, glowing with its own heat rather than reflecting anyone else\'s light. Everything from here to the centre is self-luminous; there has been no honest sunlight down here for 2,891 kilometres.',
  },
  {
    at: 4.0e6,
    heading: 'The liquid outer core, and the magnetic field',
    body: "This molten iron is moving — churning in slow convective currents, further stirred by the planet's own rotation. That motion is a dynamo: it is the entire reason Earth has a magnetic field, and that field is what shields the whole surface, and everything living on it, from the worst of the solar wind.",
  },
  {
    at: 5.10e6,
    heading: 'Approaching the inner-core boundary',
    body: 'The outer core has been cooling for four and a half billion years, and iron is slowly freezing out of it onto the surface of a solid ball at the centre. Ahead lies the edge of that ball — the last boundary, and the last change of state, the planet has left.',
  },
  {
    at: D_ICB,
    heading: 'The inner-core boundary',
    body: "Five thousand one hundred and fifty kilometres down, liquid iron gives way to solid iron — not because it has cooled enough to freeze by any normal measure, but because the pressure here, over three million times sea-level atmospheric pressure, raises iron's melting point higher than even this heat can beat.",
  },
  {
    at: 5.8e6,
    heading: 'The solid inner core',
    body: 'A ball of solid iron the size of the Moon, at roughly the temperature of the Sun\'s own surface, held solid purely by the crushing weight of everything above it — remove that pressure and it would flash back to liquid instantly. Nothing here has ever been touched, seen, or sampled directly.',
  },
  {
    at: R_EARTH - 200,
    heading: 'The centre of the Earth',
    body: "This is the centre: six thousand three hundred and seventy-one kilometres from the grass this journey started on, and every direction from here is now up. The inner core is still growing, a few millimetres a year, as the planet slowly, imperceptibly finishes cooling and crystallising from the inside out.",
  },
];
