
export enum Phase {
  Menstruation = 'Menstruation',
  Follicular = 'Follicular',
  Ovulation = 'Ovulation',
  Luteal = 'Luteal',
  Unknown = 'Unknown',
}

export interface Cycle {
  id: string;
  startDate: string; // ISO string
  endDate: string | null; // ISO string, null if ongoing
  predictedEndDate?: string; // ISO string
}

export interface DayInfo {
  date: string; // ISO string
  phase: Phase;
  isLogged: boolean;
  isPredicted: boolean;
  isOngoing: boolean;
  fertility: number; // 0-1 probability
}

export interface CycleStats {
  averageCycleLength: number;
  averagePeriodLength: number;
  cycleLengthVariation: number;
}

export interface PredictionResult {
  [date: string]: {
    phase: Phase;
    fertility: number;
  };
}
