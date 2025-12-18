import { getRuleEditorUiLabels } from '../ruleEditor';

test('rule editor UI labels depend on mode', () => {
  expect(getRuleEditorUiLabels('add')).toEqual({
    saveText: 'Add',
    insertLabel: 'Insert at:',
  });

  expect(getRuleEditorUiLabels('edit')).toEqual({
    saveText: 'Save',
    insertLabel: 'Clone at:',
  });
});
