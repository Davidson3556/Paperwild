import './sketch-margins.css';

export type MarginAtmosphere = 'day' | 'dusk';
export type MarginWeather = 'clear' | 'rain';
export type MarginCreature = 'robin' | 'snail' | 'butterfly' | 'bee';

export interface SketchMarginsOptions {
  reducedMotion: boolean;
  atmosphere: MarginAtmosphere;
  weather: MarginWeather;
}

export interface SketchMargins {
  setAtmosphere(atmosphere: MarginAtmosphere): void;
  setWeather(weather: MarginWeather): void;
  setReducedMotion(reducedMotion: boolean): void;
  celebrateCapture(): void;
  greetResident(creature?: MarginCreature): void;
  destroy(): void;
}

// A child has given the notebook's residents an extra pencil outline, a few
// crooked crayon strokes, and some very proud little doodles in the margins.
const svg = (className: string, viewBox: string, drawing: string) =>
  `<svg class="margin-art ${className}" viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${drawing}</svg>`;

const definitions = `<svg class="margin-definitions" width="0" height="0" aria-hidden="true"><defs>
  <filter id="margin-pencil" x="-8%" y="-8%" width="116%" height="116%"><feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="2" seed="11" result="grain"/><feDisplacementMap in="SourceGraphic" in2="grain" scale="1.15" xChannelSelector="R" yChannelSelector="G"/></filter>
  <pattern id="margin-sage" width="8" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)"><path d="m1-1 .6 5L.8 9M5 0l-.7 6 .6 4m-4-5 5 1" stroke="#829663" stroke-width=".72" opacity=".72"/></pattern>
  <pattern id="margin-ochre" width="9" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(25)"><path d="m1-1 .6 5L.9 9M5 0l-.5 5 .9 4m-4-5 6 1" stroke="#c2a14f" stroke-width=".72" opacity=".7"/></pattern>
  <pattern id="margin-blue" width="8" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(18)"><path d="m1-1 .4 6L.6 10M5 0l-.7 7m-4-4 6 1" stroke="#6b86a8" stroke-width=".75" opacity=".72"/></pattern>
  <pattern id="margin-rose" width="8" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(-19)"><path d="m1-1 .5 6L.7 10M5 1l-.7 7m-4-3 6-1" stroke="#bd7975" stroke-width=".75" opacity=".7"/></pattern>
</defs></svg>`;

const balloon = svg('margin-balloon', '0 0 250 310', `
  <g class="margin-child-doodle doodle-sun" transform="translate(27 33) rotate(-9)">
    <path d="m-2-25 1 7m16-2-4 5m14-1-7 3m9 11-7-1m1 17-5-6M2 25l-1-8m-16 4 5-7m-15-2 8-4m-10-11 9 1m0-16 5 6" class="doodle-yellow"/>
    <path d="M-14-4q3-13 15-11q16-1 14 15q3 13-12 15q-14 2-16-11Z" fill="url(#margin-ochre)" class="pencil-line"/>
    <path d="m-9-8 2 12m3-16 1 24m5-22-1 23m6-20-1 15" class="doodle-yellow doodle-hatch"/>
    <path d="m-5-2 .1.1m11-1 .1.1" class="pencil-dark"/><path d="M-4 6q6 6 11-1" class="pencil-line"/>
  </g>
  <g class="balloon-drift" filter="url(#margin-pencil)">
    <g class="balloon-leaves">
      <path d="M113 134C56 117 51 51 70 19c35 20 66 69 43 115Z" fill="#b6bd91" fill-opacity=".23"/>
      <path d="M111 136C77 98 91 38 126 9c30 35 29 90-15 127Z" fill="#d6bc77" fill-opacity=".2"/>
      <path d="M113 137c-2-53 31-92 75-100 0 51-30 93-75 100Z" fill="#91a999" fill-opacity=".2"/>
      <path d="M113 134C56 117 51 51 70 19c35 20 66 69 43 115ZM111 136C77 98 91 38 126 9c30 35 29 90-15 127ZM113 137c-2-53 31-92 75-100 0 51-30 93-75 100Z" fill="url(#margin-sage)" stroke="#827c59" stroke-width=".9"/>
      <path d="M71 23c16 34 35 73 42 115M125 13c3 38-2 82-13 125M184 41c-29 27-58 61-72 97M78 51l19 1M83 68l22 2M92 89l17 2M106 50l20 13m-21 7 18 14m-19 6 15 12m28-29 8 22m8-39 6 19m-29 17 6 19" class="pencil-light"/>
    </g>
    <path d="m82 112 12 81m25-62-5 60m46-81-25 82" class="pencil-line"/>
    <path d="m84 114 13 77m65-81-24 80" class="pencil-echo"/>
    <g class="balloon-traveler">
      <path d="M101 180c-2-12 3-23 12-24 9 0 14 11 10 25" fill="#c2a984" fill-opacity=".24" class="pencil-line"/>
      <path d="m104 159-3-12 10 7m5 1 8-10 1 16" class="pencil-line"/>
      <path d="M110 166h.1m9 0h.1m-8 7c2 2 4 2 6 0" class="pencil-dark"/>
      <path d="M112 179v13m8-14 5 13" class="pencil-line"/>
      <path d="m120 181 12-7 4 3" class="traveler-wave pencil-line"/>
      <path d="m103 176-9 8" class="pencil-line"/>
      <path d="m106 156 12-4 2 7" class="pencil-line"/>
    </g>
    <path d="M80 183c17-7 49-7 68 0l-8 42c-14 8-34 10-47-1Z" fill="#e5c8a5" fill-opacity=".35"/>
    <path d="M80 183c17-7 49-7 68 0l-8 42c-14 8-34 10-47-1Z" fill="url(#margin-ochre)" class="pencil-line"/>
    <path d="M81 182c0 7 64 9 67 0m-5 9c29-7 36 21 15 24l-15-1m3-17c18-4 21 12 9 12l-11-1M95 222c12 4 29 4 42 0m-43-31 4 25m5-25 2 29" class="pencil-line"/>
    <path d="M88 232c15 9 44 10 59 1M92 238c10 4 31 6 46 1" class="pencil-echo"/>
    <path d="M79 263c-13 5-22 2-29-2m35 10c-15 6-29 5-36 2m111-111c12-3 21-2 28 2" class="pencil-light"/>
    <g class="balloon-letter"><path d="m175 210 21-6 5 16-21 6Z" fill="#eee3c9" class="pencil-line"/><path d="m177 210 12 5 8-9m-16 17 4-9m14 5-8-4" class="pencil-light"/></g>
  </g>
`);

const cloud = svg('margin-cloud', '0 0 300 260', `
  <g filter="url(#margin-pencil)">
    <g class="margin-child-doodle doodle-cloud-notes">
      <path d="m29 135 3 12 12-1-10 8 4 13-11-7-9 8 3-14-10-6 13-2Z" class="doodle-blue"/>
      <path d="m23 141 7 14m-12-5 13-2m6 8-10 4" class="doodle-blue doodle-hatch"/>
      <path d="M40 198c-13-16-25-5-18 5l20 16 16-20c7-13-12-17-18-1Z" class="doodle-red"/>
      <path d="m27 198 7 12m-3-15 11 17m2-19 3 12m4-13-1 7" class="doodle-red doodle-hatch"/>
      <path d="m264 130 2 7 8 1-7 4 1 8-6-5-6 4 2-8-6-4 8-1Z" class="doodle-yellow"/>
    </g>
    <g class="cloud-drift">
      <path d="M63 89c-20-13-12-41 11-40-3-29 30-40 48-19 12-25 50-16 53 9 27-12 49 7 45 29 25-1 36 26 19 40-25 10-146 9-176-19Z" fill="#c2d0cf" fill-opacity=".18"/>
      <path d="M63 89c-20-13-12-41 11-40-3-29 30-40 48-19 12-25 50-16 53 9 27-12 49 7 45 29 25-1 36 26 19 40-25 10-146 9-176-19Z" class="pencil-line"/>
      <path d="M63 91c30 20 151 20 176 16M73 49c7 0 13 3 16 7m86-17c-1 8-3 14-7 18m51 11-7 7" class="pencil-echo"/>
      <path d="M86 87c35 12 94 14 127 7m-115-2 3-6m8 9 3-8m9 9 3-8m8 9 3-7m10 8 2-7m10 7 2-7m10 7 2-7m11 6 2-6" class="pencil-light"/>
      <g class="resident-blink cloud-eyes"><path d="M112 66c3-3 7-3 10 0m25 2c3-3 7-3 10 0" class="pencil-line"/></g>
      <path d="M132 78c3 3 7 4 10 0" class="pencil-light"/>
      <g class="cloud-boots">
        <path d="m114 110-3 26m39-24 2 29" class="pencil-line"/>
        <path d="m103 131 16 1-1 30c-3 7-28 8-30 1-2-5 5-8 15-9Zm40 7 17-1 1 22c15-2 20 3 16 9-4 5-25 5-31 0Z" fill="#b8b279" fill-opacity=".25"/>
        <path d="m103 131 16 1-1 30c-3 7-28 8-30 1-2-5 5-8 15-9Zm40 7 17-1 1 22c15-2 20 3 16 9-4 5-25 5-31 0Z" fill="url(#margin-sage)" class="pencil-line"/>
        <path d="m104 135 13 1m28 6 13-1m-68 20c7 3 19 2 27 0m30 6c9 2 22 2 28-1" class="pencil-line"/>
      </g>
      <g class="margin-rain"><path d="m75 125-3 13m116-16-3 13m41-9-4 14m-139 7-3 13m113-12-3 13m-123 11-3 13m158-34-3 14"/><path d="m60 124-3 10m145 17-3 10m-98 30-3 10m121-12-3 11"/></g>
    </g>
    <g class="moon-moth">
      <path d="M237 184c-15-9-30-3-26 10 2 7 13 13 25 12m4-22c14-15 30-11 28 3-1 8-12 17-25 18m-6-5c-15 2-23 17-13 21 7 4 14-4 16-13m3-9c15-4 26 7 19 15-5 6-16 1-20-7" fill="#c7ba87" fill-opacity=".23" class="pencil-line"/>
      <path d="m239 183 2 26m-2-27-6-6m7 7 4-9m-25 17 15 7m24-11-13 10" class="pencil-light"/>
      <path d="M233 184c6-3 9-9 7-15 9 4 9 17-1 21-4 1-7-1-6-6Z" fill="#cfb46f" fill-opacity=".46" class="pencil-line"/>
    </g>
    <g class="margin-night-stars"><path d="m34 40 1 6 6 2-6 2-1 6-2-6-5-2 5-2Zm225-21 1 6 5 1-5 2-1 6-2-6-5-2 5-1Zm-9 108 1 4 4 1-4 1-1 4-1-4-4-1 4-1Z"/><circle cx="28" cy="108" r="1"/><circle cx="283" cy="95" r="1.2"/><circle cx="278" cy="236" r="1"/></g>
  </g>
`);

const turtle = svg('margin-turtle', '0 0 330 260', `
  <g filter="url(#margin-pencil)">
    <path d="M5 236c53-7 114-3 168-5s98 3 146-2M27 242c49-2 115 0 162-1" class="pencil-light"/>
    <g class="fern-sway">
      <path d="m56 223-8-34 2-29-8-29 3-30-3-25 6-35M47 49l-2 59 5 53 8 60" class="pencil-line"/>
      <path d="M44 74Q12 78 17 50q25-3 27 24Zm2 28q-4-31 25-34q7 26-25 34Zm-2 33Q8 139 10 109q28-5 34 26Zm5 29q-3-31 34-31q5 27-34 31Zm3 29Q15 203 13 169q29-8 39 24Zm4 20q-1-27 36-31q9 29-36 31Z" fill="url(#margin-sage)" class="pencil-line"/>
      <path d="m21 55 22 19m-19-9 4-10m2 16 4-9m15 38 18-27m-13 21 9 1M15 114l28 20m-19-12 3-9m25 49 26-25m-20 20 10 1m-50 16 31 18m-23-13 3-7m29 40 27-26m-20 20 12 1" class="pencil-light"/>
    </g>
    <g class="turtle-resident">
      <path d="m115 215-3 14c2 7 21 7 24 0l1-14m63 0 3 15c2 5 21 4 21-1l-9-15" fill="#b6bd98" fill-opacity=".3" class="pencil-line"/>
      <path d="M109 217c-13 0-22-6-24-11 10-3 17-2 24 1" class="pencil-line"/>
      <path d="M109 212c1-43 32-67 67-65 38 1 65 28 65 66-31 12-94 16-132-1Z" fill="#bac19b" fill-opacity=".33"/>
      <path d="M109 212c1-43 32-67 67-65 38 1 65 28 65 66-31 12-94 16-132-1Z" fill="url(#margin-sage)" class="pencil-line"/>
      <path d="m139 164 22 20 27-2 17-19m-44 21-6 29m33-31 13 30m-89-12 43 13 46-1 37-15m-99-33-6 32m72-33 11 31M110 214c35 14 95 15 132-1" class="pencil-line"/>
      <g class="turtle-head">
        <path d="M229 202c6-16 27-22 39-11 11 9 3 30-8 32l-25-7" fill="#cad0ab" fill-opacity=".5" class="pencil-line"/>
        <path d="M263 211c4 1 7-1 8-3" class="pencil-line"/>
        <g class="resident-blink"><circle cx="260" cy="198" r="1.25" fill="#6f563e"/></g>
        <path d="m264 192 5-3m-24 29 2 8m6-7 1 8" class="pencil-light"/>
      </g>
      <g class="turtle-cottage">
        <path d="m137 149-1-53 56-1 1 55" fill="#e6dbc0" fill-opacity=".65" class="pencil-line"/>
        <path d="m128 100 39-41 37 39-76 2Z" fill="#b68e7d" fill-opacity=".25"/>
        <path d="m128 100 39-41 37 39-76 2Z" fill="url(#margin-rose)" class="pencil-line"/>
        <path d="m130 103 37-40 39 37m-61-17-2 15m11-25-3 25m10-35-4 35m13-32-6 31m13-22-4 22m12-14-5 14m12-6-5 6" class="pencil-light"/>
        <path d="m179 74 1-20 12 1 1 31m-14-31 14-2m-34 96v-23c0-12 18-12 18 0v24" class="pencil-line"/>
        <path d="m164 125 1 25m-14-37h-10v13h10Zm29 0 10-1v14h-10Zm-34 1v11m-5-5h10m34-6v12m-5-6h10m-19 15h.1" class="pencil-line"/>
        <path d="M133 150c16-3 41-1 64 0m-53-15-4 8m48-7 4 8" class="pencil-light"/>
        <g class="cottage-smoke"><path d="M185 47c-11-12 14-11 3-24m0 18c10-8-11-13-1-24" class="pencil-echo"/></g>
      </g>
    </g>
    <g class="margin-tiny-flower"><path d="m286 233-3-20 2-13m0 22q13-17 15-7-3 10-15 7m-2-8q-19-14-14-3 3 10 15 7" class="pencil-line"/><path d="M284 199q-19-5-12-14 7-7 13 8-4-23 7-19 9 3-3 20 22-15 23-3 0 10-22 7 18 13 6 17-8 2-10-14-8 19-15 10-6-8 13-12Z" fill="url(#margin-rose)" class="doodle-red"/><path d="M281 198q4-5 9-1 5 5-2 8-8 2-7-7Z" fill="#d6bb59" class="pencil-line"/></g>
    <path d="m101 93 2 8 8 1-7 4 1 9-6-6-7 4 3-9-6-4 9-1Z" class="doodle-blue"/>
  </g>
`);

const teaParty = svg('margin-tea-party', '0 0 390 285', `
  <g filter="url(#margin-pencil)">
    <path d="M15 258c71-9 132-6 197-6s115 3 164-1m-309 11c68-3 135-2 191 0" class="pencil-light"/>
    <g class="tea-umbrella">
      <path d="m204 59-9 160c-1 10 12 11 15 4" class="pencil-line"/>
      <path d="M118 109c6-38 45-59 84-54 38-1 72 24 79 61-14-9-27-8-38 0-14-10-27-9-41 0-14-11-29-11-43-2-15-10-28-10-41-5Z" fill="#c1ad90" fill-opacity=".22"/>
      <path d="M118 109c6-38 45-59 84-54 38-1 72 24 79 61-14-9-27-8-38 0-14-10-27-9-41 0-14-11-29-11-43-2-15-10-28-10-41-5Z" fill="url(#margin-ochre)" class="pencil-line"/>
      <path d="M202 55c-21 11-35 29-43 59m43-59c-3 22-4 41 0 61m0-61c22 12 36 31 41 61m-40-67 1-7" class="pencil-line"/>
    </g>
    <g class="tea-rabbit">
      <path d="M86 149c-18-16-28-36-20-43 9-7 21 15 27 36m9 2c-5-27 2-49 11-46 12 4 3 32-7 48" fill="#eee2cb" fill-opacity=".8" class="pencil-line"/>
      <path d="M88 142c-14 1-24 16-20 31 2 8 10 14 22 15m10-45c16-1 29 11 26 24-1 13-14 17-22 17" fill="#e4d8be" fill-opacity=".5" class="pencil-line"/>
      <path d="m88 150-17-32m30 29 10-36m-10 65 5-2m-3 9c3 1 5 0 7-2m-22-4-14-2m14 7-16 3" class="pencil-light"/>
      <g class="resident-blink"><circle cx="111" cy="161" r="1.4" fill="#6f563e"/></g>
      <path d="M83 185c-21 18-21 43-4 58 11 11 39 9 47-2 4-19-3-40-20-54m-31 55-12 6c-4 7 15 7 31 3m12-7 10 6c14 5 25 3 22-3l-11-6" fill="#d7dfc1" fill-opacity=".36" class="pencil-line"/>
      <path d="M75 192c11 9 23 10 35 2m-38 7c12 8 25 9 42 3m-44 9c15 7 31 7 47 2m-47 8c17 6 32 6 49 1" class="pencil-light"/>
      <path d="M71 221c-16-7-20 5-12 12 5 4 10 1 12-3" fill="#e9e1cd" class="pencil-line"/>
      <g class="rabbit-sip"><path d="M106 204c10-1 17-4 20-12m-17 20c11 0 19-7 20-13" class="pencil-line"/><path d="m120 180 18 1-2 14c-4 4-11 3-14-1Zm17 3c12-4 14 9 2 9" fill="#a2b9b5" fill-opacity=".4" class="pencil-line"/><path d="m122 184 12 1" class="pencil-light"/></g>
    </g>
    <g class="tea-table">
      <path d="M148 213v33c15 9 44 9 57-1l-1-32" fill="#c5af8a" fill-opacity=".3"/>
      <path d="M148 213v33c15 9 44 9 57-1l-1-32" fill="url(#margin-ochre)" class="pencil-line"/>
      <ellipse cx="175" cy="211" rx="47" ry="10" fill="#d3bf98" fill-opacity=".38" class="pencil-line"/>
      <ellipse cx="175" cy="211" rx="36" ry="6" class="pencil-light"/>
      <path d="M155 222v20m7-18 1 18m10-16-1 21m10-22 2 20m11-23-1 17" class="pencil-light"/>
      <path d="m161 193 17 1-2 13c-4 3-10 3-13-1Zm17 3c11-4 12 7 1 8m-27 6c7 5 23 6 32 1" fill="#b5bda1" fill-opacity=".3" class="pencil-line"/>
      <path d="m197 202 10 2-2 4-12-1Zm0-4 6-2 6 5-10 2Z" fill="#d9b476" fill-opacity=".4" class="pencil-line"/>
      <g class="tea-steam"><path d="M168 187c-7-7 8-9 2-17m5 17c7-8-7-11-1-19" class="pencil-echo"/></g>
      <g class="tea-steam tea-steam-second"><path d="M129 173c-7-8 7-9 2-17" class="pencil-echo"/></g>
    </g>
    <g class="tea-hedgehog">
      <path d="m235 233-14-4 10-9-11-8 13-6-5-12 14 1-1-14 12 6 5-13 10 10 10-12 7 15 14-8 3 14 14-2-1 14 14 2-8 12 11 8-13 9 4 9c-31 9-64 8-83-1Z" fill="#c0aa8f" fill-opacity=".36"/>
      <path d="m235 233-14-4 10-9-11-8 13-6-5-12 14 1-1-14 12 6 5-13 10 10 10-12 7 15 14-8 3 14 14-2-1 14 14 2-8 12 11 8-13 9 4 9c-31 9-64 8-83-1Z" fill="url(#margin-ochre)" class="pencil-line"/>
      <path d="m249 201-2-9m12 8-1-11m13 9 3-10m5 15 7-12m1 19 10-12m-4 21 13-11m-12 20 16-8m-33-11 2 9m-14-13-2 12m-7-11-5 9m-5-5-5 8" class="pencil-light"/>
      <path d="M258 223c-10-14-23-16-36-5l-18 10c10 8 24 11 32 17 12 4 25-6 22-22Z" fill="#ebe0c9" class="pencil-line"/>
      <path d="m208 229-5-1 4-3m22 19-2 8m25-7 1 7m41-9 1 8m-68-24c3 4 7 5 10 3" class="pencil-line"/>
      <g class="resident-blink"><circle cx="235" cy="223" r="1.3" fill="#6f563e"/></g>
      <path d="m237 238-7 5m14-5-7 7m47 9 15-1m-74-2 11 1" class="pencil-light"/>
    </g>
    <g class="tea-grass"><path d="m338 254-6-28m6 28 8-35m-8 27 18-16m-14 8 10-2m-17 4-11-8M30 253l-5-20m6 20 7-28m-6 18 14-6" class="pencil-line"/><path d="M349 219c-8-8-2-14 1-7 1-11 9-9 5-2 10-4 12 3 3 6 6 5 2 10-3 5-1 7-7 6-6-2Z" fill="#cda68d" fill-opacity=".5" class="pencil-line"/></g>
    <g class="margin-child-doodle doodle-tea-notes"><path d="M345 162q-14-21-23-8-5 8 22 26 28-24 16-28-10-3-15 10Z" class="doodle-red"/><path d="m330 155 10 17m-3-16 8 15m7-15-4 13" class="doodle-red doodle-hatch"/><path d="m39 162 2 9 10 1-8 6 2 10-8-7-8 5 3-10-8-5 11-1Z" class="doodle-yellow"/></g>
  </g>
`);

const wanderers = svg('margin-wanderers', '0 0 1440 1000', `
  <g class="margin-bird bird-one"><path d="M30 18c-10-9-18-9-27-6 13 2 19 7 27 14 5-10 13-16 25-20-12-2-21 3-25 12Z" fill="#8b9786" fill-opacity=".28" stroke="#7c765d" stroke-width=".7"/><path d="m29 23 8 1m-8 0-7 7" class="pencil-light"/></g>
  <g class="margin-bird bird-two"><path d="M20 12C12 4 6 4 0 6c9 1 14 5 20 11 4-7 9-12 18-15-9-1-15 2-18 10Z" fill="#a9b3a2" fill-opacity=".3" stroke="#7c765d" stroke-width=".7"/></g>
  <g class="margin-dragonfly"><path d="M19 19C2 3-4 10 3 17c4 4 10 5 16 5C5 22 0 33 8 34c6 0 9-6 13-11m2-4c14-18 24-13 18-4-4 5-10 6-18 7 16 1 23 10 15 13-6 2-11-5-15-12" fill="#a5b6ac" fill-opacity=".28" stroke="#7a8c7c" stroke-width=".7"/><path d="m21 16 2 30m-2-31-3-5m4 6 3-6" class="pencil-line"/></g>
  <g class="margin-floating-leaf"><path d="M0 14C12-4 29 0 34 0c-2 17-13 28-30 18Z" fill="#baac7b" fill-opacity=".36" stroke="#8b8866" stroke-width=".7"/><path d="m0 22 27-18m-17 12 1-8m6 4 9 1" class="pencil-light"/></g>
  <g class="capture-moths">
    <g class="capture-moth capture-moth-one"><path d="M12 13C-8-3 1-10 12 6 23-11 33-2 15 13c16 0 15 13 6 10l-8-8c-5 13-17 11-11 4Z" fill="#c9ae70" fill-opacity=".35" class="pencil-line"/><path d="m12 5 2 15" class="pencil-light"/></g>
    <g class="capture-moth capture-moth-two"><path d="M12 13C-8-3 1-10 12 6 23-11 33-2 15 13c16 0 15 13 6 10l-8-8c-5 13-17 11-11 4Z" fill="#9cafa0" fill-opacity=".4" class="pencil-line"/></g>
    <g class="capture-moth capture-moth-three"><path d="M12 13C-8-3 1-10 12 6 23-11 33-2 15 13c16 0 15 13 6 10l-8-8c-5 13-17 11-11 4Z" fill="#b9a4a8" fill-opacity=".4" class="pencil-line"/></g>
  </g>
  <g class="margin-fireflies"><circle cx="61" cy="457" r="1.5"/><circle cx="1375" cy="565" r="1.9"/><circle cx="98" cy="712" r="1.3"/><circle cx="1338" cy="345" r="1.5"/><circle cx="1218" cy="950" r="1.4"/><circle cx="252" cy="922" r="1.5"/></g>
`);

export function createSketchMargins(container: HTMLElement, options: SketchMarginsOptions): SketchMargins {
  const root = document.createElement('div');
  root.className = 'sketch-margins';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `${definitions}${balloon}${cloud}${turtle}${teaParty}${wanderers}`;
  // An off-register second attempt is drawn inside the same moving groups.
  // It is deliberately static geometry: no filter or JS animation on the page.
  for (const line of root.querySelectorAll<SVGElement>('.margin-art .pencil-line')) {
    if (line.classList.contains('traveler-wave') || line.parentElement?.classList.contains('moon-moth')) continue;
    const echo = line.cloneNode(false) as SVGElement;
    echo.setAttribute('class', 'pencil-backline');
    echo.setAttribute('fill', 'none');
    echo.setAttribute('transform', 'translate(.85 -.55)');
    line.after(echo);
  }
  container.prepend(root);
  let captureTimer: ReturnType<typeof setTimeout> | undefined;
  let greetingTimer: ReturnType<typeof setTimeout> | undefined;
  let destroyed = false;

  const setAtmosphere = (atmosphere: MarginAtmosphere) => { root.dataset.atmosphere = atmosphere; };
  const setWeather = (weather: MarginWeather) => { root.dataset.weather = weather; };
  const setReducedMotion = (reducedMotion: boolean) => { root.classList.toggle('is-still', reducedMotion); };
  const onVisibility = () => { root.classList.toggle('is-hidden', document.hidden); };
  const restart = (className: string) => {
    root.classList.remove(className);
    // Flush once for an occasional event; ambient life uses CSS rather than a JS loop.
    void root.offsetWidth;
    root.classList.add(className);
  };
  setAtmosphere(options.atmosphere);
  setWeather(options.weather);
  setReducedMotion(options.reducedMotion);
  onVisibility();
  document.addEventListener('visibilitychange', onVisibility);

  return {
    setAtmosphere,
    setWeather,
    setReducedMotion,
    celebrateCapture() {
      if (destroyed) return;
      clearTimeout(captureTimer);
      restart('is-celebrating');
      captureTimer = setTimeout(() => root.classList.remove('is-celebrating'), 2900);
    },
    greetResident(creature: MarginCreature = 'robin') {
      if (destroyed) return;
      clearTimeout(greetingTimer);
      root.dataset.greeting = creature;
      restart('is-greeting');
      greetingTimer = setTimeout(() => root.classList.remove('is-greeting'), 1800);
    },
    destroy() {
      destroyed = true;
      clearTimeout(captureTimer);
      clearTimeout(greetingTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      root.remove();
    },
  };
}
