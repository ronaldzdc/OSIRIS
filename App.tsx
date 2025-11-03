import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { addMonths, subMonths, format, parseISO } from 'date-fns';
import { useCycleData } from './hooks/useCycleData';
import { useTensorFlowModel } from './hooks/useTensorFlowModel';
import { Cycle, DayInfo, Phase, CycleStats } from './types';
import { MIN_CYCLES_FOR_PREDICTION, PHASE_NAMES } from './constants';
import { formatISODate, formatDisplayDate, daysBetween, formatShortDisplayDate } from './utils/dateUtils';
import Calendar from './components/Calendar';
import Modal from './components/Modal';
import { CalendarIcon, ChartIcon, HistoryIcon, SettingsIcon, TrashIcon, HeartIcon } from './components/Icons';

type View = 'main' | 'insights' | 'history' | 'settings';

// Custom hook to get the previous value of a prop or state
function usePrevious<T>(value: T): T | undefined {
  // Fix for TS2554: The `useRef<T>()` call was missing an argument.
  // Initializing with `undefined` and specifying the type as `T | undefined` resolves the error.
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

// --- Onboarding View ---
const OnboardingView: React.FC<{ onComplete: () => void, onAddCycle: (cycle: Omit<Cycle, 'id'>) => void, cycles: Cycle[] }> = ({ onComplete, onAddCycle, cycles }) => {
    const [selection, setSelection] = useState<{ start: Date | null, end: Date | null }>({ start: null, end: null });
    const [currentDate, setCurrentDate] = useState(new Date());

    const handleDateClick = (date: Date) => {
        if (!selection.start || (selection.start && selection.end)) {
            setSelection({ start: date, end: null });
        } else if (selection.start && !selection.end) {
            const [start, end] = date < selection.start ? [date, selection.start] : [selection.start, date];
            setSelection({ start, end });
        }
    };

    const confirmPeriod = () => {
        if (selection.start && selection.end) {
            onAddCycle({ startDate: formatISODate(selection.start), endDate: formatISODate(selection.end) });
            setSelection({ start: null, end: null });
        }
    };

    const dayInfoMap = useMemo(() => {
        const map = new Map<string, DayInfo>();
        cycles.forEach(cycle => {
            if (cycle.endDate) {
                const start = parseISO(cycle.startDate);
                const end = parseISO(cycle.endDate);
                for (let d = new Date(start.valueOf()); d <= end; d.setDate(d.getDate() + 1)) {
                    map.set(formatISODate(d), { date: formatISODate(d), phase: Phase.Menstruation, isLogged: true, isPredicted: false, isOngoing: false, fertility: 0.1 });
                }
            }
        });
        return map;
    }, [cycles]);
    
    const instructionText = cycles.length < MIN_CYCLES_FOR_PREDICTION
        ? `To get accurate predictions, please log at least ${MIN_CYCLES_FOR_PREDICTION} past periods.`
        : "You've met the minimum! Add more cycles for better accuracy, or start predicting now.";

    return (
        <div className="p-4 bg-brand-background min-h-screen flex flex-col items-center justify-center text-center">
            <h1 className="text-3xl font-bold text-brand-primary mb-2">Welcome to Osiris</h1>
            <p className="text-brand-text-secondary mb-4">{instructionText}</p>
            <p className="text-lg font-semibold mb-4 text-brand-secondary">Cycles Logged: {cycles.length}</p>
            
            <div className="w-full max-w-sm mx-auto bg-brand-surface rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                    <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 rounded-full hover:bg-white/10">&lt;</button>
                    <h2 className="font-bold text-lg">{format(currentDate, 'MMMM yyyy')}</h2>
                    <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 rounded-full hover:bg-white/10">&gt;</button>
                </div>
                <Calendar currentDate={currentDate} dayInfoMap={dayInfoMap} onDateClick={handleDateClick} selection={selection} maxDate={new Date()} />
                <button onClick={confirmPeriod} disabled={!selection.start || !selection.end} className="mt-4 w-full bg-brand-primary text-brand-background font-bold py-2 px-4 rounded-lg disabled:bg-gray-600">
                    Confirm Period
                </button>
            </div>

            {cycles.length >= MIN_CYCLES_FOR_PREDICTION && (
                <button onClick={onComplete} className="mt-8 bg-brand-secondary text-brand-background font-bold py-3 px-6 rounded-lg animate-pulse">
                    Start Predictions!
                </button>
            )}
        </div>
    );
};

// --- Main App Views ---
const MainView: React.FC<{
    dayInfoMap: Map<string, DayInfo>,
    selectedDate: Date,
    onDateSelect: (date: Date) => void,
    onStartPeriod: (date: Date) => void,
    onEndPeriod: (date: Date) => void,
    ongoingCycle: Cycle | null,
    modelConfidence: number
}> = ({ dayInfoMap, selectedDate, onDateSelect, onStartPeriod, onEndPeriod, ongoingCycle, modelConfidence }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isStartModalOpen, setStartModalOpen] = useState(false);
    const [isEndModalOpen, setEndModalOpen] = useState(false);

    // Sync calendar view with selected date
    useEffect(() => {
        setCurrentDate(selectedDate);
    }, [selectedDate]);

    const selectedDayInfo = dayInfoMap.get(formatISODate(selectedDate)) || {
        date: formatISODate(selectedDate),
        phase: Phase.Unknown,
        isLogged: false,
        isPredicted: false,
        isOngoing: false,
        fertility: 0.05, // Default low fertility for unknown days
    };

    return (
      <div className="p-4 space-y-4">
          <div className="bg-brand-surface p-4 rounded-lg shadow-lg text-center">
              <p className="text-brand-text-secondary">{formatDisplayDate(selectedDate)}</p>
              <h2 className="text-2xl font-bold text-brand-primary">{PHASE_NAMES[selectedDayInfo.phase]}</h2>
              <p className="text-brand-text-secondary">Fertility: {`${(selectedDayInfo.fertility * 100).toFixed(0)}%`}</p>
              {selectedDayInfo.isPredicted && (
                <p className="text-xs text-brand-text-secondary mt-1">
                  Confidence: {(modelConfidence * 100).toFixed(0)}%
                </p>
              )}
          </div>

          <div className="flex justify-between items-center px-2">
              <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 rounded-full hover:bg-white/10">&lt;</button>
              <h2 className="font-bold text-xl">{format(currentDate, 'MMMM yyyy')}</h2>
              <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 rounded-full hover:bg-white/10">&gt;</button>
          </div>
          <Calendar currentDate={currentDate} dayInfoMap={dayInfoMap} onDateClick={onDateSelect} selectedDate={selectedDate} />

          <div className="flex gap-4">
              <button onClick={() => setStartModalOpen(true)} disabled={!!ongoingCycle} className="flex-1 bg-brand-primary text-brand-background font-bold py-3 px-4 rounded-lg disabled:bg-gray-600">Start Period</button>
              <button onClick={() => setEndModalOpen(true)} disabled={!ongoingCycle} className="flex-1 bg-brand-secondary text-brand-background font-bold py-3 px-4 rounded-lg disabled:bg-gray-600">End Period</button>
          </div>
          <Modal isOpen={isStartModalOpen} onClose={() => setStartModalOpen(false)} title="Start Period">
                <p>Start a new period on {formatDisplayDate(selectedDate)}?</p>
                <div className="flex justify-end gap-4 mt-4">
                    <button onClick={() => setStartModalOpen(false)} className="py-2 px-4 rounded-lg bg-gray-600">Cancel</button>
                    <button onClick={() => { onStartPeriod(selectedDate); setStartModalOpen(false); }} className="py-2 px-4 rounded-lg bg-brand-primary text-brand-background">Confirm</button>
                </div>
            </Modal>
            <Modal isOpen={isEndModalOpen} onClose={() => setEndModalOpen(false)} title="End Period">
                <p>End your period today, {formatDisplayDate(new Date())}?</p>
                 <div className="flex justify-end gap-4 mt-4">
                    <button onClick={() => setEndModalOpen(false)} className="py-2 px-4 rounded-lg bg-gray-600">Cancel</button>
                    <button onClick={() => { onEndPeriod(new Date()); setEndModalOpen(false); }} className="py-2 px-4 rounded-lg bg-brand-secondary text-brand-background">Confirm</button>
                </div>
            </Modal>
      </div>
    );
};

const InsightsView: React.FC<{stats: CycleStats | null, modelConfidence: number}> = ({ stats, modelConfidence }) => (
    <div className="p-4 space-y-4">
        <h1 className="text-2xl font-bold text-brand-primary">Insights</h1>
        {stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-brand-surface p-4 rounded-lg">
                <p className="text-brand-text-secondary">Avg. Cycle Length</p>
                <p className="text-3xl font-bold">{stats.averageCycleLength.toFixed(1)} days</p>
            </div>
            <div className="bg-brand-surface p-4 rounded-lg">
                <p className="text-brand-text-secondary">Avg. Period Length</p>
                <p className="text-3xl font-bold">{stats.averagePeriodLength.toFixed(1)} days</p>
            </div>
            <div className="bg-brand-surface p-4 rounded-lg">
                <p className="text-brand-text-secondary">Cycle Variation</p>
                <p className="text-3xl font-bold">&plusmn;{stats.cycleLengthVariation.toFixed(1)} days</p>
            </div>
            <div className="bg-brand-surface p-4 rounded-lg">
                <p className="text-brand-text-secondary">Model Confidence</p>
                <p className="text-3xl font-bold">{(modelConfidence * 100).toFixed(0)}%</p>
                <div className="w-full bg-gray-700 rounded-full h-2.5 mt-2">
                    <div className="bg-brand-secondary h-2.5 rounded-full" style={{width: `${modelConfidence * 100}%`}}></div>
                </div>
            </div>
        </div>
        ) : <p>Not enough data for insights.</p>}
    </div>
);

const HistoryView: React.FC<{cycles: Cycle[], onDelete: (id: string) => void, onAddCycle: () => void}> = ({ cycles, onDelete, onAddCycle }) => (
    <div className="p-4 space-y-4">
        <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-brand-primary">Cycle History</h1>
            <button onClick={onAddCycle} className="bg-brand-secondary text-brand-background font-bold py-2 px-4 rounded-lg text-sm">Add Past Period</button>
        </div>
        <div className="space-y-3">
            {[...cycles].reverse().map(cycle => (
                <div key={cycle.id} className="bg-brand-surface p-3 rounded-lg flex justify-between items-center">
                    <div>
                        <p className="font-semibold">{formatShortDisplayDate(cycle.startDate)} - {cycle.endDate ? formatShortDisplayDate(cycle.endDate) : 'Ongoing'}</p>
                        <p className="text-sm text-brand-text-secondary">
                          {cycle.endDate ? `${daysBetween(cycle.startDate, cycle.endDate)} day period` : ''}
                        </p>
                    </div>
                    <button onClick={() => onDelete(cycle.id)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-full">
                        <TrashIcon className="w-5 h-5" />
                    </button>
                </div>
            ))}
        </div>
    </div>
);

const SettingsView: React.FC<{onResetModel: () => void, onClearData: () => void}> = ({onResetModel, onClearData}) => {
    const [isClearDataModalOpen, setClearDataModalOpen] = useState(false);
    return (
        <div className="p-4 space-y-4">
            <h1 className="text-2xl font-bold text-brand-primary">Settings</h1>
            <div className="bg-brand-surface p-4 rounded-lg space-y-4">
                 <button className="w-full text-left p-3 bg-white/5 hover:bg-white/10 rounded-lg">Export Data (CSV)</button>
                 <button className="w-full text-left p-3 bg-white/5 hover:bg-white/10 rounded-lg">Import Data (CSV)</button>
                 <button onClick={onResetModel} className="w-full text-left p-3 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-300 rounded-lg">Reset Prediction Model</button>
                 <button onClick={() => setClearDataModalOpen(true)} className="w-full text-left p-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg">Delete All Data</button>
            </div>
            <Modal isOpen={isClearDataModalOpen} onClose={() => setClearDataModalOpen(false)} title="Delete All Data">
                <p>Are you sure you want to delete all your cycle data and reset the model? This action cannot be undone.</p>
                <div className="flex justify-end gap-4 mt-4">
                    <button onClick={() => setClearDataModalOpen(false)} className="py-2 px-4 rounded-lg bg-gray-600">Cancel</button>
                    <button onClick={() => { onClearData(); setClearDataModalOpen(false); }} className="py-2 px-4 rounded-lg bg-red-600 text-white">Confirm Deletion</button>
                </div>
            </Modal>
        </div>
    );
};

// --- Main App Component ---
const App: React.FC = () => {
    const [view, setView] = useState<View>('main');
    const { cycles, completedCycles, ongoingCycle, addCycle, deleteCycle, startPeriod, endPeriod, isDataLoaded, clearAllData } = useCycleData();
    const { isTraining, trainModel, predict, predictions, modelConfidence, resetModel } = useTensorFlowModel(completedCycles);
    
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [isInitialTrainDone, setIsInitialTrainDone] = useState(false);
    const prevCyclesLength = usePrevious(completedCycles.length);

    // State for "Add History" modal
    const [isHistoryModalOpen, setHistoryModalOpen] = useState(false);
    const [historySelection, setHistorySelection] = useState<{ start: Date | null, end: Date | null }>({ start: null, end: null });
    const [historyCalendarDate, setHistoryCalendarDate] = useState(new Date());

    // Effect to handle showing onboarding
    useEffect(() => {
        if (isDataLoaded) {
            // Only show onboarding if, on initial load, there isn't enough data.
            // The user will explicitly exit onboarding via the button, it will no longer
            // exit automatically once the minimum is met.
            if (completedCycles.length < MIN_CYCLES_FOR_PREDICTION) {
                setShowOnboarding(true);
            }
        }
    }, [isDataLoaded]);

    // Effect for INITIAL training run
    useEffect(() => {
      if (!showOnboarding && completedCycles.length >= MIN_CYCLES_FOR_PREDICTION && !isInitialTrainDone) {
        console.log("Sufficient data found. Performing initial model training.");
        trainModel(false);
        setIsInitialTrainDone(true);
      }
    }, [showOnboarding, completedCycles.length, isInitialTrainDone, trainModel]);
    
    // Effect for RE-TRAINING on data changes (add/delete)
    useEffect(() => {
        if (isInitialTrainDone && prevCyclesLength !== undefined) {
            if (completedCycles.length > prevCyclesLength) {
                console.log("New cycle added. Fine-tuning model.");
                trainModel(true); // Fine-tune
            } else if (completedCycles.length < prevCyclesLength) {
                console.log("Cycle deleted. Performing full retrain.");
                trainModel(false); // Full retrain
            }
        }
    }, [completedCycles.length, isInitialTrainDone, prevCyclesLength, trainModel]);

    // Effect to run prediction after training or when app loads with enough data
    useEffect(() => {
      if (isInitialTrainDone) {
        predict();
      }
    }, [isInitialTrainDone, predict]);

    const handleOnboardingComplete = () => {
        setShowOnboarding(false); // The useEffect will handle the training
    };
    
    const handleClearAllData = () => {
        clearAllData();
        resetModel();
        setIsInitialTrainDone(false);
        setShowOnboarding(true);
    };

    const handleAddHistoryCycle = () => {
        if (historySelection.start && historySelection.end) {
            addCycle({ startDate: formatISODate(historySelection.start), endDate: formatISODate(historySelection.end) });
            setHistoryModalOpen(false);
            setHistorySelection({ start: null, end: null });
        }
    };

    const dayInfoMap = useMemo(() => {
        const map = new Map<string, DayInfo>();
        cycles.forEach(cycle => {
            const isOngoing = cycle.endDate === null;
            const endDate = cycle.endDate ? parseISO(cycle.endDate) : (ongoingCycle?.predictedEndDate ? parseISO(ongoingCycle.predictedEndDate) : new Date());
            const startDate = parseISO(cycle.startDate);
            for (let d = new Date(startDate.valueOf()); d <= endDate; d.setDate(d.getDate() + 1)) {
                const dateStr = formatISODate(d);
                map.set(dateStr, { date: dateStr, phase: Phase.Menstruation, isLogged: !isOngoing, isPredicted: false, isOngoing: isOngoing, fertility: 0.1 });
            }
        });

        Object.entries(predictions).forEach(([date, pred]) => {
            if (!map.has(date)) {
                map.set(date, { date: date, ...pred, isLogged: false, isPredicted: true, isOngoing: false });
            }
        });
        return map;
    }, [cycles, predictions, ongoingCycle]);

    const cycleStats = useMemo<CycleStats | null>(() => {
        if (completedCycles.length < 2) return null;
        const cycleLengths: number[] = [];
        const periodLengths: number[] = [];
        for (let i = 0; i < completedCycles.length - 1; i++) {
            cycleLengths.push(daysBetween(completedCycles[i].startDate, completedCycles[i+1].startDate));
        }
        completedCycles.forEach(c => {
            if (c.endDate) periodLengths.push(daysBetween(c.startDate, c.endDate));
        });
        
        if (cycleLengths.length === 0 || periodLengths.length === 0) return null;

        const avgCycle = cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length;
        const avgPeriod = periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length;
        const variation = Math.sqrt(cycleLengths.map(x => Math.pow(x - avgCycle, 2)).reduce((a, b) => a + b) / cycleLengths.length);
        
        return { averageCycleLength: avgCycle, averagePeriodLength: avgPeriod, cycleLengthVariation: variation };
    }, [completedCycles]);

    if (!isDataLoaded) {
        return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    }

    if (showOnboarding) {
        return <OnboardingView onComplete={handleOnboardingComplete} onAddCycle={addCycle} cycles={cycles} />;
    }

    const renderView = () => {
        switch (view) {
            case 'main': return <MainView dayInfoMap={dayInfoMap} selectedDate={selectedDate} onDateSelect={setSelectedDate} onStartPeriod={startPeriod} onEndPeriod={endPeriod} ongoingCycle={ongoingCycle} modelConfidence={modelConfidence} />;
            case 'insights': return <InsightsView stats={cycleStats} modelConfidence={modelConfidence} />;
            case 'history': return <HistoryView cycles={cycles} onDelete={deleteCycle} onAddCycle={() => setHistoryModalOpen(true)} />;
            case 'settings': return <SettingsView onResetModel={resetModel} onClearData={handleClearAllData} />;
            default: return null;
        }
    };
    
    return (
        <div className="max-w-md mx-auto bg-brand-background min-h-screen flex flex-col font-sans">
            <header className="flex items-center justify-center p-4 gap-2">
                <h1 className="text-2xl font-bold text-brand-primary tracking-widest">OSIRIS</h1>
                <HeartIcon className="w-6 h-6 text-red-500" />
            </header>
            {isTraining && <div className="bg-yellow-500 text-black text-center text-xs py-1 animate-pulse">Model is training...</div>}
            <main className="flex-grow pb-16">
                {renderView()}
            </main>
            <footer className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-brand-surface border-t border-white/10">
                <nav className="flex justify-around items-center h-16">
                    <button onClick={() => setView('main')} className={`flex flex-col items-center gap-1 ${view === 'main' ? 'text-brand-primary' : 'text-brand-text-secondary'}`}>
                        <CalendarIcon className="w-6 h-6" /><span className="text-xs">Today</span>
                    </button>
                    <button onClick={() => setView('insights')} className={`flex flex-col items-center gap-1 ${view === 'insights' ? 'text-brand-primary' : 'text-brand-text-secondary'}`}>
                        <ChartIcon className="w-6 h-6" /><span className="text-xs">Insights</span>
                    </button>
                    <button onClick={() => setView('history')} className={`flex flex-col items-center gap-1 ${view === 'history' ? 'text-brand-primary' : 'text-brand-text-secondary'}`}>
                        <HistoryIcon className="w-6 h-6" /><span className="text-xs">History</span>
                    </button>
                    <button onClick={() => setView('settings')} className={`flex flex-col items-center gap-1 ${view === 'settings' ? 'text-brand-primary' : 'text-brand-text-secondary'}`}>
                        <SettingsIcon className="w-6 h-6" /><span className="text-xs">Settings</span>
                    </button>
                </nav>
            </footer>
             <Modal isOpen={isHistoryModalOpen} onClose={() => setHistoryModalOpen(false)} title="Add Past Period">
                <div className="w-full max-w-sm mx-auto">
                     <div className="flex justify-between items-center mb-4">
                        <button onClick={() => setHistoryCalendarDate(subMonths(historyCalendarDate, 1))} className="p-2 rounded-full hover:bg-white/10">&lt;</button>
                        <h2 className="font-bold text-lg">{format(historyCalendarDate, 'MMMM yyyy')}</h2>
                        <button onClick={() => setHistoryCalendarDate(addMonths(historyCalendarDate, 1))} className="p-2 rounded-full hover:bg-white/10">&gt;</button>
                    </div>
                     <Calendar 
                        currentDate={historyCalendarDate}
                        dayInfoMap={dayInfoMap}
                        selection={historySelection}
                        onDateClick={(date) => {
                            if (!historySelection.start || (historySelection.start && historySelection.end)) {
                                setHistorySelection({ start: date, end: null });
                            } else {
                                const [start, end] = date < historySelection.start ? [date, historySelection.start] : [historySelection.start, date];
                                setHistorySelection({ start, end });
                            }
                        }}
                        maxDate={new Date()}
                    />
                    <div className="flex justify-end gap-4 mt-4">
                        <button onClick={() => setHistoryModalOpen(false)} className="py-2 px-4 rounded-lg bg-gray-600">Cancel</button>
                        <button onClick={handleAddHistoryCycle} disabled={!historySelection.start || !historySelection.end} className="py-2 px-4 rounded-lg bg-brand-primary text-brand-background disabled:bg-gray-600">Confirm Period</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default App;