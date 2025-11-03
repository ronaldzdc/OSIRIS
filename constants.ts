
import { Phase } from './types';

export const PHASE_COLORS: Record<Phase, string> = {
  [Phase.Menstruation]: 'bg-phase-menstruation',
  [Phase.Follicular]: 'bg-phase-follicular',
  [Phase.Ovulation]: 'bg-phase-ovulation',
  [Phase.Luteal]: 'bg-phase-luteal',
  [Phase.Unknown]: 'bg-gray-700',
};

export const PHASE_NAMES: Record<Phase, string> = {
  [Phase.Menstruation]: 'Menstruation',
  [Phase.Follicular]: 'Follicular Phase',
  [Phase.Ovulation]: 'Ovulation',
  [Phase.Luteal]: 'Luteal Phase',
  [Phase.Unknown]: 'Unknown',
};

export const MIN_CYCLES_FOR_PREDICTION = 3;
export const MODEL_STORAGE_KEY = 'indexeddb://osiris-model-v1';

// TF Model constants
export const SEQUENCE_LENGTH = 6; // Use last 6 cycles
export const PREDICTION_HORIZON_DAYS = 60; // Predict for next 60 days
