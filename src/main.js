import { logger } from './logger.js';
import { HomeworkSolver } from './core/homework-solver.js';

logger.info('Initializing Homework Solver (ONLUYEN_BOT Edition)...');

const solver = new HomeworkSolver();

window.hwSolver = {
    start: solver.start.bind(solver),
    stop: solver.stop.bind(solver),
    solveOnce: solver.solveOnce.bind(solver),
    help: () => console.log('Use hwSolver.start(), hwSolver.stop(), or hwSolver.solveOnce()')
};

// Guardian Loop for UI Persistence
const startGuardian = () => {
    setInterval(() => {
        if (!document.getElementById('hw-solver-overlay')) {
            logger.warn('UI overlay missing. Re-initializing...');
            solver.overlay.init();
        }
    }, 2000);
};
startGuardian();
