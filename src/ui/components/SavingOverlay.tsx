import { Loader2 } from 'lucide-react';
import { useLayoutEffect,useRef } from 'react';

export function SavingOverlay() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-label="Saving plan"
      aria-busy="true"
      onCancel={(event) => event.preventDefault()}
      className="fixed inset-0 m-0 h-screen w-screen max-h-none max-w-none border-0 bg-slate-950/80 text-slate-100 backdrop-blur-sm"
    >
      <div className="flex h-full flex-col items-center justify-center gap-3" role="status">
        <Loader2 className="h-10 w-10 animate-spin text-sky-400" aria-hidden="true" />
        <p className="text-sm font-medium">Saving plan…</p>
      </div>
    </dialog>
  );
}
