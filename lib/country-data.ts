/**
 * Country, province/region, city, and town data for LTC Fast Track.
 * Supports Zambia (ZMB) and Tanzania (TZA).
 */

export interface Town {
  id: string;
  name: string;
}

export interface City {
  id: string;
  name: string;
  towns: Town[];
}

export interface Province {
  id: string;
  name: string;
  cities: City[];
}

export interface Country {
  code: string;       // ISO 3166-1 alpha-3
  name: string;
  flag: string;       // emoji flag
  dialCode: string;   // e.g. "+260"
  phoneDigits: number; // expected local digits after stripping dial code
  phonePlaceholder: string;
  provinces: Province[];
}

// ─── Zambia ───────────────────────────────────────────────────────────────────

const ZAMBIA: Country = {
  code: "ZMB",
  name: "Zambia",
  flag: "🇿🇲",
  dialCode: "+260",
  phoneDigits: 9,
  phonePlaceholder: "97 123 4567",
  provinces: [
    {
      id: "zmb-lusaka",
      name: "Lusaka",
      cities: [
        {
          id: "zmb-lusaka-lusaka",
          name: "Lusaka",
          towns: [
            { id: "zmb-lusaka-lusaka-chelston", name: "Chelston" },
            { id: "zmb-lusaka-lusaka-chilenje", name: "Chilenje" },
            { id: "zmb-lusaka-lusaka-emmasdale", name: "Emmasdale" },
            { id: "zmb-lusaka-lusaka-garden", name: "Garden" },
            { id: "zmb-lusaka-lusaka-kabwata", name: "Kabwata" },
            { id: "zmb-lusaka-lusaka-kalingalinga", name: "Kalingalinga" },
            { id: "zmb-lusaka-lusaka-kanyama", name: "Kanyama" },
            { id: "zmb-lusaka-lusaka-libala", name: "Libala" },
            { id: "zmb-lusaka-lusaka-longacres", name: "Longacres" },
            { id: "zmb-lusaka-lusaka-makeni", name: "Makeni" },
            { id: "zmb-lusaka-lusaka-mtendere", name: "Mtendere" },
            { id: "zmb-lusaka-lusaka-munali", name: "Munali" },
            { id: "zmb-lusaka-lusaka-northmead", name: "Northmead" },
            { id: "zmb-lusaka-lusaka-rhodes-park", name: "Rhodes Park" },
            { id: "zmb-lusaka-lusaka-woodlands", name: "Woodlands" },
          ],
        },
        {
          id: "zmb-lusaka-kafue",
          name: "Kafue",
          towns: [
            { id: "zmb-lusaka-kafue-kafue-town", name: "Kafue Town" },
            { id: "zmb-lusaka-kafue-chirundu", name: "Chirundu" },
          ],
        },
        {
          id: "zmb-lusaka-chongwe",
          name: "Chongwe",
          towns: [
            { id: "zmb-lusaka-chongwe-chongwe-town", name: "Chongwe Town" },
          ],
        },
        {
          id: "zmb-lusaka-luangwa",
          name: "Luangwa",
          towns: [
            { id: "zmb-lusaka-luangwa-luangwa-town", name: "Luangwa Town" },
          ],
        },
      ],
    },
    {
      id: "zmb-copperbelt",
      name: "Copperbelt",
      cities: [
        {
          id: "zmb-copperbelt-kitwe",
          name: "Kitwe",
          towns: [
            { id: "zmb-copperbelt-kitwe-nkana", name: "Nkana" },
            { id: "zmb-copperbelt-kitwe-wusakile", name: "Wusakile" },
            { id: "zmb-copperbelt-kitwe-parklands", name: "Parklands" },
          ],
        },
        {
          id: "zmb-copperbelt-ndola",
          name: "Ndola",
          towns: [
            { id: "zmb-copperbelt-ndola-kansenshi", name: "Kansenshi" },
            { id: "zmb-copperbelt-ndola-kabushi", name: "Kabushi" },
            { id: "zmb-copperbelt-ndola-itawa", name: "Itawa" },
          ],
        },
        {
          id: "zmb-copperbelt-chingola",
          name: "Chingola",
          towns: [
            { id: "zmb-copperbelt-chingola-chingola-town", name: "Chingola Town" },
          ],
        },
        {
          id: "zmb-copperbelt-mufulira",
          name: "Mufulira",
          towns: [
            { id: "zmb-copperbelt-mufulira-mufulira-town", name: "Mufulira Town" },
          ],
        },
        {
          id: "zmb-copperbelt-luanshya",
          name: "Luanshya",
          towns: [
            { id: "zmb-copperbelt-luanshya-luanshya-town", name: "Luanshya Town" },
          ],
        },
      ],
    },
    {
      id: "zmb-central",
      name: "Central",
      cities: [
        {
          id: "zmb-central-kabwe",
          name: "Kabwe",
          towns: [
            { id: "zmb-central-kabwe-makululu", name: "Makululu" },
            { id: "zmb-central-kabwe-mukobeko", name: "Mukobeko" },
          ],
        },
        {
          id: "zmb-central-kapiri-mposhi",
          name: "Kapiri Mposhi",
          towns: [
            { id: "zmb-central-kapiri-mposhi-kapiri-town", name: "Kapiri Town" },
          ],
        },
        {
          id: "zmb-central-mkushi",
          name: "Mkushi",
          towns: [
            { id: "zmb-central-mkushi-mkushi-town", name: "Mkushi Town" },
          ],
        },
      ],
    },
    {
      id: "zmb-southern",
      name: "Southern",
      cities: [
        {
          id: "zmb-southern-livingstone",
          name: "Livingstone",
          towns: [
            { id: "zmb-southern-livingstone-maramba", name: "Maramba" },
            { id: "zmb-southern-livingstone-dambwa", name: "Dambwa" },
          ],
        },
        {
          id: "zmb-southern-choma",
          name: "Choma",
          towns: [
            { id: "zmb-southern-choma-choma-town", name: "Choma Town" },
          ],
        },
        {
          id: "zmb-southern-mazabuka",
          name: "Mazabuka",
          towns: [
            { id: "zmb-southern-mazabuka-mazabuka-town", name: "Mazabuka Town" },
          ],
        },
        {
          id: "zmb-southern-monze",
          name: "Monze",
          towns: [
            { id: "zmb-southern-monze-monze-town", name: "Monze Town" },
          ],
        },
      ],
    },
    {
      id: "zmb-eastern",
      name: "Eastern",
      cities: [
        {
          id: "zmb-eastern-chipata",
          name: "Chipata",
          towns: [
            { id: "zmb-eastern-chipata-chipata-town", name: "Chipata Town" },
            { id: "zmb-eastern-chipata-katete", name: "Katete" },
          ],
        },
        {
          id: "zmb-eastern-petauke",
          name: "Petauke",
          towns: [
            { id: "zmb-eastern-petauke-petauke-town", name: "Petauke Town" },
          ],
        },
      ],
    },
    {
      id: "zmb-western",
      name: "Western",
      cities: [
        {
          id: "zmb-western-mongu",
          name: "Mongu",
          towns: [
            { id: "zmb-western-mongu-mongu-town", name: "Mongu Town" },
            { id: "zmb-western-mongu-limulunga", name: "Limulunga" },
          ],
        },
        {
          id: "zmb-western-kaoma",
          name: "Kaoma",
          towns: [
            { id: "zmb-western-kaoma-kaoma-town", name: "Kaoma Town" },
          ],
        },
      ],
    },
    {
      id: "zmb-northern",
      name: "Northern",
      cities: [
        {
          id: "zmb-northern-kasama",
          name: "Kasama",
          towns: [
            { id: "zmb-northern-kasama-kasama-town", name: "Kasama Town" },
          ],
        },
        {
          id: "zmb-northern-mbala",
          name: "Mbala",
          towns: [
            { id: "zmb-northern-mbala-mbala-town", name: "Mbala Town" },
          ],
        },
      ],
    },
    {
      id: "zmb-muchinga",
      name: "Muchinga",
      cities: [
        {
          id: "zmb-muchinga-chinsali",
          name: "Chinsali",
          towns: [
            { id: "zmb-muchinga-chinsali-chinsali-town", name: "Chinsali Town" },
          ],
        },
        {
          id: "zmb-muchinga-mpika",
          name: "Mpika",
          towns: [
            { id: "zmb-muchinga-mpika-mpika-town", name: "Mpika Town" },
          ],
        },
      ],
    },
    {
      id: "zmb-luapula",
      name: "Luapula",
      cities: [
        {
          id: "zmb-luapula-mansa",
          name: "Mansa",
          towns: [
            { id: "zmb-luapula-mansa-mansa-town", name: "Mansa Town" },
          ],
        },
        {
          id: "zmb-luapula-samfya",
          name: "Samfya",
          towns: [
            { id: "zmb-luapula-samfya-samfya-town", name: "Samfya Town" },
          ],
        },
      ],
    },
    {
      id: "zmb-north-western",
      name: "North-Western",
      cities: [
        {
          id: "zmb-north-western-solwezi",
          name: "Solwezi",
          towns: [
            { id: "zmb-north-western-solwezi-solwezi-town", name: "Solwezi Town" },
            { id: "zmb-north-western-solwezi-kansanshi", name: "Kansanshi" },
          ],
        },
        {
          id: "zmb-north-western-kasempa",
          name: "Kasempa",
          towns: [
            { id: "zmb-north-western-kasempa-kasempa-town", name: "Kasempa Town" },
          ],
        },
      ],
    },
  ],
};

// ─── Tanzania ─────────────────────────────────────────────────────────────────

const TANZANIA: Country = {
  code: "TZA",
  name: "Tanzania",
  flag: "🇹🇿",
  dialCode: "+255",
  phoneDigits: 9,
  phonePlaceholder: "74 123 4567",
  provinces: [
    {
      id: "tza-dar-es-salaam",
      name: "Dar es Salaam",
      cities: [
        {
          id: "tza-dar-es-salaam-dar-es-salaam",
          name: "Dar es Salaam",
          towns: [
            { id: "tza-dar-kinondoni", name: "Kinondoni" },
            { id: "tza-dar-ilala", name: "Ilala" },
            { id: "tza-dar-temeke", name: "Temeke" },
            { id: "tza-dar-ubungo", name: "Ubungo" },
            { id: "tza-dar-kigamboni", name: "Kigamboni" },
          ],
        },
      ],
    },
    {
      id: "tza-arusha",
      name: "Arusha",
      cities: [
        {
          id: "tza-arusha-arusha",
          name: "Arusha",
          towns: [
            { id: "tza-arusha-arusha-cbd", name: "Arusha CBD" },
            { id: "tza-arusha-njiro", name: "Njiro" },
            { id: "tza-arusha-sakina", name: "Sakina" },
          ],
        },
        {
          id: "tza-arusha-moshi",
          name: "Moshi",
          towns: [
            { id: "tza-arusha-moshi-town", name: "Moshi Town" },
            { id: "tza-arusha-moshi-shantytown", name: "Shantytown" },
          ],
        },
      ],
    },
    {
      id: "tza-mwanza",
      name: "Mwanza",
      cities: [
        {
          id: "tza-mwanza-mwanza",
          name: "Mwanza",
          towns: [
            { id: "tza-mwanza-ilemela", name: "Ilemela" },
            { id: "tza-mwanza-nyamagana", name: "Nyamagana" },
            { id: "tza-mwanza-butimba", name: "Butimba" },
          ],
        },
        {
          id: "tza-mwanza-musoma",
          name: "Musoma",
          towns: [
            { id: "tza-mwanza-musoma-town", name: "Musoma Town" },
          ],
        },
      ],
    },
    {
      id: "tza-dodoma",
      name: "Dodoma",
      cities: [
        {
          id: "tza-dodoma-dodoma",
          name: "Dodoma",
          towns: [
            { id: "tza-dodoma-dodoma-cbd", name: "Dodoma CBD" },
            { id: "tza-dodoma-chamwino", name: "Chamwino" },
            { id: "tza-dodoma-kondoa", name: "Kondoa" },
          ],
        },
      ],
    },
    {
      id: "tza-mbeya",
      name: "Mbeya",
      cities: [
        {
          id: "tza-mbeya-mbeya",
          name: "Mbeya",
          towns: [
            { id: "tza-mbeya-mbeya-town", name: "Mbeya Town" },
            { id: "tza-mbeya-uyole", name: "Uyole" },
          ],
        },
        {
          id: "tza-mbeya-tukuyu",
          name: "Tukuyu",
          towns: [
            { id: "tza-mbeya-tukuyu-town", name: "Tukuyu Town" },
          ],
        },
      ],
    },
    {
      id: "tza-morogoro",
      name: "Morogoro",
      cities: [
        {
          id: "tza-morogoro-morogoro",
          name: "Morogoro",
          towns: [
            { id: "tza-morogoro-morogoro-town", name: "Morogoro Town" },
            { id: "tza-morogoro-mzumbe", name: "Mzumbe" },
          ],
        },
        {
          id: "tza-morogoro-kilosa",
          name: "Kilosa",
          towns: [
            { id: "tza-morogoro-kilosa-town", name: "Kilosa Town" },
          ],
        },
      ],
    },
    {
      id: "tza-tanga",
      name: "Tanga",
      cities: [
        {
          id: "tza-tanga-tanga",
          name: "Tanga",
          towns: [
            { id: "tza-tanga-tanga-town", name: "Tanga Town" },
            { id: "tza-tanga-muheza", name: "Muheza" },
          ],
        },
        {
          id: "tza-tanga-korogwe",
          name: "Korogwe",
          towns: [
            { id: "tza-tanga-korogwe-town", name: "Korogwe Town" },
          ],
        },
      ],
    },
    {
      id: "tza-zanzibar",
      name: "Zanzibar",
      cities: [
        {
          id: "tza-zanzibar-stone-town",
          name: "Stone Town",
          towns: [
            { id: "tza-zanzibar-stone-town-cbd", name: "Stone Town CBD" },
            { id: "tza-zanzibar-ng-ambo", name: "Ng'ambo" },
          ],
        },
        {
          id: "tza-zanzibar-north-unguja",
          name: "North Unguja",
          towns: [
            { id: "tza-zanzibar-nungwi", name: "Nungwi" },
            { id: "tza-zanzibar-matemwe", name: "Matemwe" },
          ],
        },
        {
          id: "tza-zanzibar-south-unguja",
          name: "South Unguja",
          towns: [
            { id: "tza-zanzibar-paje", name: "Paje" },
            { id: "tza-zanzibar-jambiani", name: "Jambiani" },
          ],
        },
      ],
    },
  ],
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export const COUNTRIES: Country[] = [ZAMBIA, TANZANIA];

export const COUNTRY_MAP: Record<string, Country> = {
  ZMB: ZAMBIA,
  TZA: TANZANIA,
};

/** Return the Country object for a given code, defaulting to Zambia. */
export function getCountry(code: string): Country {
  return COUNTRY_MAP[code] ?? ZAMBIA;
}

/** Return provinces for a given country code. */
export function getProvinces(countryCode: string): Province[] {
  return getCountry(countryCode).provinces;
}

/** Return cities for a given country code + province id. */
export function getCities(countryCode: string, provinceId: string): City[] {
  const country = getCountry(countryCode);
  const province = country.provinces.find((p) => p.id === provinceId);
  return province?.cities ?? [];
}

/** Return towns for a given country code + city id. */
export function getTowns(countryCode: string, cityId: string): Town[] {
  const country = getCountry(countryCode);
  for (const province of country.provinces) {
    const city = province.cities.find((c) => c.id === cityId);
    if (city) return city.towns;
  }
  return [];
}
