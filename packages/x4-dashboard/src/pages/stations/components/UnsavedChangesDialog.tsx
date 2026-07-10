import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";

export function UnsavedChangesDialog({
  isBlocked,
  onReset,
  onProceed,
}: {
  isBlocked: boolean;
  onReset: () => void;
  onProceed: () => void;
}) {
  return (
    <Dialog open={isBlocked} onOpenChange={(open) => { if (!open) onReset(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Leave without saving?</DialogTitle>
          <DialogDescription>You have unsaved changes to this station design. If you leave now, they will be lost.</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={onReset}>Stay</Button>
          <Button variant="destructive" onClick={onProceed}>Leave</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
