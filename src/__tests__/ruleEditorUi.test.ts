import { getRuleEditorOperandUi } from '../ruleEditor';

describe('rule editor operation controls', () => {
  test('TurnToState shows only the state selector', () => {
    expect(getRuleEditorOperandUi('TurnToState')).toEqual({
      showLabel: false,
      showOperand: true,
    });
  });

  test('Die hides the operand controls', () => {
    expect(getRuleEditorOperandUi('Die')).toEqual({
      showLabel: false,
      showOperand: false,
    });
  });

  test('operations with an operand keep the label and state selector', () => {
    expect(getRuleEditorOperandUi('DisconnectFrom')).toEqual({
      showLabel: true,
      showOperand: true,
    });
  });
});
