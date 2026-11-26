import type { Components } from './business-types.generated';

// Deterministic illustration for the lab. Independent of ticket IDs and server data.
export const exampleAnalytics: Components['DashboardAnalytics'] = {
  evaluated_at:'2026-11-22T16:59:59Z',
  daily:[
    { day:'2026-11-16', accepted:8, active:3, completed:5 },
    { day:'2026-11-17', accepted:12, active:4, completed:8 },
    { day:'2026-11-18', accepted:10, active:3, completed:6 },
    { day:'2026-11-19', accepted:16, active:5, completed:11 },
    { day:'2026-11-20', accepted:14, active:5, completed:9 },
    { day:'2026-11-21', accepted:9, active:4, completed:5 },
    { day:'2026-11-22', accepted:11, active:6, completed:5 },
  ],
  age:[
    { key:'age_lt24', count:11 }, { key:'age_24_72', count:12 }, { key:'age_gte72', count:7 },
  ],
  deadline:[
    { key:'overdue', count:4 }, { key:'due_soon', count:9 }, { key:'on_track', count:12 },
    { key:'paused', count:2 }, { key:'unmeasured', count:3 },
  ],
};
