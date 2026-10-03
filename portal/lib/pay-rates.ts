// Exact amounts supplied in docs/pay-rate-table-requirements.md.
// Store integer AUD cents; do not derive junior/penalty rates by multiplication.
export const payRateVersion = {
  award: 'Restaurant Industry Award MA000119',
  effectiveFrom: '2026-07-01',
  currency: 'AUD',
} as const;
export const payEmploymentTypes = ['Full-time/Part-time', 'Casual'] as const;
export const payAgeGroups = ['Under 17', '17', '18', '19', '20+'] as const;
export const payLevels = [1, 2, 3] as const;
export const payDayTypes = ['Weekday', 'Saturday', 'Sunday', 'Public Holiday'] as const;
export type PayEmploymentType = typeof payEmploymentTypes[number];
export type PayAgeGroup = typeof payAgeGroups[number];
export type PayLevel = typeof payLevels[number];
export type PayDayType = typeof payDayTypes[number];
type RateRow = readonly [number, number, number, number];
type RateTable = Record<PayEmploymentType, Record<PayAgeGroup, Record<PayLevel, RateRow>>>;
const rateCents = {
  "Full-time/Part-time": {
    "20+": {
      "1": [
        2644,
        3305,
        3966,
        5949
      ],
      "2": [
        2708,
        3385,
        4062,
        6093
      ],
      "3": [
        2797,
        3496,
        4196,
        6293
      ]
    },
    "19": {
      "1": [
        2248,
        2810,
        3372,
        5058
      ],
      "2": [
        2302,
        2878,
        3453,
        5180
      ],
      "3": [
        2378,
        2973,
        3567,
        5351
      ]
    },
    "18": {
      "1": [
        1851,
        2314,
        2777,
        4165
      ],
      "2": [
        1896,
        2370,
        2844,
        4266
      ],
      "3": [
        1958,
        2448,
        2937,
        4406
      ]
    },
    "17": {
      "1": [
        1587,
        1984,
        2381,
        3571
      ],
      "2": [
        1625,
        2031,
        2438,
        3656
      ],
      "3": [
        1678,
        2098,
        2517,
        3776
      ]
    },
    "Under 17": {
      "1": [
        1322,
        1653,
        1983,
        2975
      ],
      "2": [
        1354,
        1693,
        2031,
        3047
      ],
      "3": [
        1399,
        1749,
        2099,
        3148
      ]
    }
  },
  "Casual": {
    "20+": {
      "1": [
        3305,
        3966,
        3966,
        6610
      ],
      "2": [
        3385,
        4062,
        4062,
        6770
      ],
      "3": [
        3496,
        4196,
        4895,
        6993
      ]
    },
    "19": {
      "1": [
        2810,
        3372,
        3372,
        5620
      ],
      "2": [
        2878,
        3453,
        3453,
        5755
      ],
      "3": [
        2973,
        3567,
        4162,
        5945
      ]
    },
    "18": {
      "1": [
        2314,
        2777,
        2777,
        4628
      ],
      "2": [
        2370,
        2844,
        2844,
        4740
      ],
      "3": [
        2448,
        2937,
        3427,
        4895
      ]
    },
    "17": {
      "1": [
        1984,
        2381,
        2381,
        3968
      ],
      "2": [
        2031,
        2438,
        2438,
        4063
      ],
      "3": [
        2098,
        2517,
        2937,
        4195
      ]
    },
    "Under 17": {
      "1": [
        1653,
        1983,
        1983,
        3305
      ],
      "2": [
        1693,
        2031,
        2031,
        3385
      ],
      "3": [
        1749,
        2099,
        2448,
        3498
      ]
    }
  }
} as const satisfies RateTable;

export function hourlyRateCents(employment:PayEmploymentType|'Full-time'|'Part-time',level:PayLevel,age:PayAgeGroup,day:PayDayType):number {
  const group=employment==='Full-time'||employment==='Part-time'?'Full-time/Part-time':employment;
  const index=payDayTypes.indexOf(day);
  const row=rateCents[group]?.[age]?.[level];
  if(!row||index<0)throw new Error('Unsupported pay-rate combination.');
  return row[index];
}
export function formatHourlyRate(cents:number):string {
  return `$${(cents/100).toFixed(2)}`;
}
