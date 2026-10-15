import { describe, expect, it, vi } from 'vitest';
import { FinishWall } from '../../src/application/commands/StructuralCommands';
import { selectedWall } from '../../src/application/queries/SelectionQueries';
import { createEditor } from '../support/editor';
import { rawPlan } from './fixtures';
describe('selected surface presentation', () => {
  it('publishes a new document and resolves the selected ID to the updated wall immediately', () => {
    const editor = createEditor(), document = editor.documents.load(rawPlan());
    editor.selection.select('wall', document.walls[0], 'A');
    const changed = vi.fn(() => selectedWall(editor)); editor.subscribe(changed);
    editor.execute(new FinishWall('wall', { type: 'paint', color: '#f3f1ea' }, 'A'));
    expect(changed).toHaveBeenCalledOnce();
    expect(changed.mock.results[0].value?.finishSideA?.color).toBe('#f3f1ea');
    expect(selectedWall(editor)).toBe(editor.getDocument().walls[0]);
    expect(document.walls[0].finishSideA).toBeUndefined();
  });
});
