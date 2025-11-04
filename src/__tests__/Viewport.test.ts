import { computeKToSatisfyMaxFill } from '../viewport';

test('computeKToSatisfyMaxFill caps fill to threshold', () => {
  const k = computeKToSatisfyMaxFill(800, 400, 1000, 1000, 0.5);
  expect(k).toBeCloseTo(0.625, 3); // need=max(0.8,0.4)=0.8 => 0.5/0.8
});

test('degenerate inputs return neutral scale', () => {
  expect(computeKToSatisfyMaxFill(0, 0, 1000, 1000, 0.5)).toBe(1);
  expect(computeKToSatisfyMaxFill(100, 100, 0, 0, 0.5)).toBe(1);
});
