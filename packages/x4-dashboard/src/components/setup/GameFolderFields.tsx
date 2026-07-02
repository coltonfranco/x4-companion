import { FolderField } from "./FolderField";
import type { PathValidation } from "../../lib/setup";

/**
 * The install-folder + save-folder pair of `FolderField`s, shared by the first-run
 * SetupWizard and the Advanced settings "Reload game data" flow.
 */
export function GameFolderFields({
  install,
  onInstallChange,
  onInstallValidated,
  save,
  onSaveChange,
  onSaveValidated,
  forceCheck,
}: {
  install: string;
  onInstallChange: (v: string) => void;
  onInstallValidated: (v: PathValidation | null) => void;
  save: string;
  onSaveChange: (v: string) => void;
  onSaveValidated: (v: PathValidation | null) => void;
  forceCheck?: number;
}) {
  return (
    <>
      <FolderField
        label="Game install folder"
        hint="The folder containing X4.exe and the .cat archives."
        value={install}
        onChange={onInstallChange}
        onValidated={onInstallValidated}
        kind="install"
        forceCheck={forceCheck}
      />
      <FolderField
        label="Save folder"
        hint="The folder with your *.xml.gz saves (…/Egosoft/X4/<id>/save)."
        value={save}
        onChange={onSaveChange}
        onValidated={onSaveValidated}
        kind="save"
        forceCheck={forceCheck}
      />
    </>
  );
}
