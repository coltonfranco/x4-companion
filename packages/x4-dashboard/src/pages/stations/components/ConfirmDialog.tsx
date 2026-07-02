import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";

export type ConfirmState = { title: string; desc: string; confirmLabel: string; destructive?: boolean; onConfirm: () => void };

export function ConfirmDialog({
  confirmState,
  onOpenChange,
  onConfirm,
}: {
  confirmState: ConfirmState | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={confirmState !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{confirmState?.title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{confirmState?.desc}</p>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant={confirmState?.destructive ? "destructive" : "default"}
            onClick={onConfirm}
          >
            {confirmState?.confirmLabel ?? "Confirm"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
