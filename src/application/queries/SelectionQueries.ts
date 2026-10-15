import { Furniture } from '../../domain/elements/Furniture';
import { Opening } from '../../domain/elements/Opening';
import { Room } from '../../domain/elements/Room';
import { Wall } from '../../domain/elements/Wall';
import type { PlanDocument } from '../../domain/model/PlanDocument';
import type { EditorSession } from '../EditorSession';

export function selectedElement(editor: EditorSession) {
  const selected = editor.selection.getSnapshot();
  return selected ? editor.getSnapshot()?.get(selected.id) ?? null : null;
}
export function selectedFurniture(editor: EditorSession) { const element = selectedElement(editor); return element instanceof Furniture ? element : null; }
export function selectedWall(editor: EditorSession) { const element = selectedElement(editor); return element instanceof Wall ? element : null; }
export function selectedRoom(editor: EditorSession) { const element = selectedElement(editor); return element instanceof Room ? element : null; }
export function selectedOpening(editor: EditorSession) {
  const element = selectedElement(editor);
  if (!(element instanceof Opening)) return null;
  const wall = editor.getSnapshot()?.get(element.wallId);
  return wall instanceof Wall ? { opening: element, wall } : null;
}
export function allDoors(document: PlanDocument | null) {
  return document?.walls.flatMap(wall => wall.openings.filter(opening => opening.type === 'door' || opening.type === 'door_coupe').map(opening => ({ opening, wall }))) ?? [];
}
