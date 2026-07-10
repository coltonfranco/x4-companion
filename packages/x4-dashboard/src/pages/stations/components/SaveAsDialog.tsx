import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";

export function SaveAsDialog({
  nameDialog,
  onOpenChange,
  onDraftChange,
  onSubmit,
  saving,
}: {
  nameDialog: { asNew: boolean; draft: string } | null;
  onOpenChange: (open: boolean) => void;
  onDraftChange: (draft: string) => void;
  onSubmit: (name: string, asNew: boolean) => void;
  saving: boolean;
}) {
  return (
    <Dialog open={nameDialog !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{nameDialog?.asNew ? "Save as new design" : "Save station design"}</DialogTitle>
        </DialogHeader>
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            const name = (nameDialog?.draft ?? "").trim();
            if (!name) return;
            onSubmit(name, nameDialog?.asNew ?? false);
          }}
        >
          <Input
            autoFocus
            value={nameDialog?.draft ?? ""}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder="Station name"
          />
          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!(nameDialog?.draft ?? "").trim() || saving}>Save</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
