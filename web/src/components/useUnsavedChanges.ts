import { useCallback, useEffect, useRef } from 'react';
import { useBlocker } from 'react-router';
import { confirm } from './ui';

/**
 * Asks before leaving a form with unsaved changes – inside the app (links, back button) and
 * when the tab is closed or reloaded. Call `allowLeave()` right before navigating away after a save.
 */
export function useUnsavedChanges(dirty: boolean, message = 'Your changes have not been saved.') {
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const allowed = useRef(false);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirtyRef.current && !allowed.current && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    let active = true;
    void confirm({
      title: 'Discard your changes?',
      message,
      confirmLabel: 'Discard',
      cancelLabel: 'Keep editing',
      destructive: true,
    }).then((ok) => {
      if (!active) return;
      if (ok) blocker.proceed();
      else blocker.reset();
    });
    return () => {
      active = false;
    };
  }, [blocker, message]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowed.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  return {
    allowLeave: useCallback(() => {
      allowed.current = true;
    }, []),
  };
}
