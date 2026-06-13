import { NodeState } from '../gum';
import {
  FaceDetectionLink,
  FaceDetectionNode,
  detectFaces,
  majorityNodeStateForFace,
} from '../faceDetection';

function nodes(ids: number[], state: NodeState = NodeState.A): FaceDetectionNode[] {
  return ids.map(id => ({ id, state }));
}

function links(edges: Array<[number, number]>): FaceDetectionLink[] {
  return edges.map(([source, target]) => ({ source, target }));
}

test('detectFaces returns a single quad for a square', () => {
  const faces = detectFaces(
    nodes([1, 2, 3, 4]),
    links([[1, 2], [2, 3], [3, 4], [4, 1]])
  );

  expect(faces).toHaveLength(1);
  expect(faces[0].nodeIds).toHaveLength(4);
  expect(new Set(faces[0].nodeIds)).toEqual(new Set([1, 2, 3, 4]));
});

test('detectFaces finds adjacent quads without the chorded outer perimeter', () => {
  const faces = detectFaces(
    nodes([1, 2, 3, 4, 5, 6]),
    links([
      [1, 2], [2, 5], [5, 4], [4, 1],
      [2, 3], [3, 6], [6, 5],
    ])
  );

  const lengths = faces.map(face => face.nodeIds.length);
  expect(lengths).toEqual([4, 4]);
  expect(faces.map(face => new Set(face.nodeIds))).toEqual(
    expect.arrayContaining([
      new Set([1, 2, 4, 5]),
      new Set([2, 3, 5, 6]),
    ])
  );
});

test('detectFaces ignores a leaf attached to a triangle', () => {
  const faces = detectFaces(
    nodes([1, 2, 3, 4]),
    links([[1, 2], [2, 3], [3, 1], [3, 4]])
  );

  expect(faces).toHaveLength(1);
  expect(faces[0].nodeIds).toHaveLength(3);
  expect(new Set(faces[0].nodeIds)).toEqual(new Set([1, 2, 3]));
});

test('detectFaces supports hex cycles', () => {
  const faces = detectFaces(
    nodes([1, 2, 3, 4, 5, 6]),
    links([[1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 1]])
  );

  expect(faces).toHaveLength(1);
  expect(faces[0].nodeIds).toHaveLength(6);
});

test('detectFaces rejects a chorded square as one big face', () => {
  const faces = detectFaces(
    nodes([1, 2, 3, 4]),
    links([[1, 2], [2, 3], [3, 4], [4, 1], [1, 3]])
  );

  expect(faces.some(face => face.nodeIds.length === 4)).toBe(false);
  expect(faces.map(face => face.nodeIds.length)).toEqual([3, 3]);
});

test('majorityNodeStateForFace uses majority state and deterministic lower-state ties', () => {
  const majorityMap = new Map<number, FaceDetectionNode>([
    [1, { id: 1, state: NodeState.A }],
    [2, { id: 2, state: NodeState.B }],
    [3, { id: 3, state: NodeState.B }],
    [4, { id: 4, state: NodeState.C }],
  ]);
  expect(majorityNodeStateForFace([1, 2, 3, 4], majorityMap)).toBe(NodeState.B);

  const tieMap = new Map<number, FaceDetectionNode>([
    [1, { id: 1, state: NodeState.C }],
    [2, { id: 2, state: NodeState.A }],
    [3, { id: 3, state: NodeState.A }],
    [4, { id: 4, state: NodeState.C }],
  ]);
  expect(majorityNodeStateForFace([1, 2, 3, 4], tieMap)).toBe(NodeState.A);
});

test('detectFaces respects maxFaces cap', () => {
  const faces = detectFaces(
    nodes([1, 2, 3, 4, 5]),
    links([
      [1, 2], [2, 3], [3, 1],
      [1, 3], [3, 4], [4, 1],
      [1, 4], [4, 5], [5, 1],
    ]),
    { maxFaces: 2 }
  );

  expect(faces).toHaveLength(2);
});
