import { useEffect, useRef } from 'react';

/**
 * Debug Hook for Class View Persistence
 * 
 * Usage in Home.jsx:
 * 1. Import this hook: import useClassViewPersistenceDebug from '../hooks/useClassViewPersistenceDebug';
 * 2. In Home component, add this line (after all your state declarations):
 *    useClassViewPersistenceDebug(selectedClassId, selectedProgramId, selectedMergeClassId, classes.length, fullScheduleActive, location.pathname);
 * 3. Open browser console (F12) and look for logs starting with "[CLASS_VIEW_DEBUG]"
 * 4. Share the console output with the developer
 * 
 * What it tracks:
 * - When selectedClassId changes and why
 * - localStorage read/write operations
 * - Restoration logic execution step-by-step
 * - State values at key moments
 * - Timing of state updates
 */

const useClassViewPersistenceDebug = (
  selectedClassId,
  selectedProgramId,
  selectedMergeClassId,
  classesLength,
  fullScheduleActive,
  locationPathname,
  hasRestoredClassViewRef
) => {
  const prevStateRef = useRef({
    selectedClassId: null,
    selectedProgramId: null,
    selectedMergeClassId: null,
    classesLength: 0,
    fullScheduleActive: false,
    locationPathname: '',
  });

  const logInitRef = useRef(false);

  // Log initialization
  useEffect(() => {
    if (!logInitRef.current) {
      console.group('%c[CLASS_VIEW_DEBUG] Hook Initialized', 'color: blue; font-weight: bold;');
      console.log('Monitoring class view persistence state changes');
      console.log('Open this console to see real-time updates');
      console.groupEnd();
      logInitRef.current = true;
    }
  }, []);

  // Monitor all state changes
  useEffect(() => {
    const changes = [];

    if (selectedClassId !== prevStateRef.current.selectedClassId) {
      changes.push(`selectedClassId: ${prevStateRef.current.selectedClassId} → ${selectedClassId}`);
    }
    if (selectedProgramId !== prevStateRef.current.selectedProgramId) {
      changes.push(`selectedProgramId: ${prevStateRef.current.selectedProgramId} → ${selectedProgramId}`);
    }
    if (selectedMergeClassId !== prevStateRef.current.selectedMergeClassId) {
      changes.push(`selectedMergeClassId: ${prevStateRef.current.selectedMergeClassId} → ${selectedMergeClassId}`);
    }
    if (classesLength !== prevStateRef.current.classesLength) {
      changes.push(`classesLength: ${prevStateRef.current.classesLength} → ${classesLength}`);
    }
    if (fullScheduleActive !== prevStateRef.current.fullScheduleActive) {
      changes.push(`fullScheduleActive: ${prevStateRef.current.fullScheduleActive} → ${fullScheduleActive}`);
    }
    if (locationPathname !== prevStateRef.current.locationPathname) {
      changes.push(`locationPathname: ${prevStateRef.current.locationPathname} → ${locationPathname}`);
    }

    if (changes.length > 0) {
      console.group(
        `%c[CLASS_VIEW_DEBUG] State Update at ${new Date().toLocaleTimeString()}`,
        'color: green; font-weight: bold;'
      );
      changes.forEach(change => console.log(`  • ${change}`));
      console.log('Current localStorage value:', localStorage.getItem('homePageLastSelectedClassId'));
      console.log('Full state:', {
        selectedClassId,
        selectedProgramId,
        selectedMergeClassId,
        classesLength,
        fullScheduleActive,
        locationPathname,
      });
      console.groupEnd();
    }

    prevStateRef.current = {
      selectedClassId,
      selectedProgramId,
      selectedMergeClassId,
      classesLength,
      fullScheduleActive,
      locationPathname,
    };
  }, [selectedClassId, selectedProgramId, selectedMergeClassId, classesLength, fullScheduleActive, locationPathname]);

  // Monitor localStorage operations
  useEffect(() => {
    const saved = localStorage.getItem('homePageLastSelectedClassId');
    if (selectedClassId) {
      console.log(
        `%c[CLASS_VIEW_DEBUG] localStorage.setItem('homePageLastSelectedClassId', '${selectedClassId}')`,
        'color: orange;'
      );
    }
  }, [selectedClassId]);

  // Restoration check
  useEffect(() => {
    console.group('%c[CLASS_VIEW_DEBUG] Restoration Check', 'color: purple; font-weight: bold;');
    console.log('Conditions:');
    console.log(`  • classesLength > 0: ${classesLength > 0}`);
    console.log(`  • !selectedClassId: ${!selectedClassId}`);
    console.log(`  • !fullScheduleActive: ${!fullScheduleActive}`);
    const saved = localStorage.getItem('homePageLastSelectedClassId');
    console.log(`  • Saved ClassId: ${saved}`);
    console.log(`  • hasRestoredClassViewRef.current: ${hasRestoredClassViewRef?.current}`);
    
    const shouldRestore = classesLength > 0 && !selectedClassId && !fullScheduleActive && saved;
    console.log(`  ✓ Should Restore: ${shouldRestore}`);
    console.log(`Decision: ${shouldRestore ? '✅ WILL RESTORE' : '❌ WILL NOT RESTORE'}`);
    console.groupEnd();
  }, [classesLength, selectedClassId, fullScheduleActive]);
};

export default useClassViewPersistenceDebug;
