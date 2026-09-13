import { roads, garages, gems, projectSegment } from "./district.js";
import { distance, angleDelta } from "./physics.js";
import { driveableConnector } from "./collision-world.js";

export class RoadGraph {
  constructor(roadData = roads) {
    this.nodes = [];
    this.edges = [];
    this.adjacency = [];
    const keys = new Map();
    const node = (p) => {
      const key = `${p.x.toFixed(3)},${p.z.toFixed(3)},${(p.y || 0).toFixed(2)}`;
      if (keys.has(key)) return keys.get(key);
      const id = this.nodes.length;
      this.nodes.push({ ...p });
      this.adjacency.push([]);
      keys.set(key, id);
      return id;
    };
    const add = (a, b, road) => {
      if (a === b) return;
      const length = Math.hypot(
        distance(this.nodes[a], this.nodes[b]),
        (this.nodes[a].y || 0) - (this.nodes[b].y || 0),
      );
      this.adjacency[a].push({ to: b, cost: length });
      this.adjacency[b].push({ to: a, cost: length });
      this.edges.push({ a, b, length, road });
    };
    const endpoints = [];
    for (const road of roadData) {
      const ids = road.points.map(node);
      for (let i = 0; i < ids.length - 1; i++) add(ids[i], ids[i + 1], road);
      if (road.closed) add(ids.at(-1), ids[0], road);
      else endpoints.push({ id: ids[0], road }, { id: ids.at(-1), road });
    }
    // Service joins project onto circuit segments, not necessarily existing source vertices.
    for (const endpoint of endpoints) {
      const p = this.nodes[endpoint.id];
      let best = -1,
        bestD = 18;
      for (let i = 0; i < this.nodes.length; i++) {
        if (
          i === endpoint.id ||
          this.adjacency[endpoint.id].some((e) => e.to === i)
        )
          continue;
        const d = distance(p, this.nodes[i]);
        if (d < bestD && driveableConnector(p, this.nodes[i])) {
          best = i;
          bestD = d;
        }
      }
      if (best >= 0) add(endpoint.id, best, endpoint.road);
    }
  }
  snap(p, validate = true) {
    const candidates = this.edges
      .map((edge) => ({
        ...projectSegment(p, this.nodes[edge.a], this.nodes[edge.b]),
        edge,
      }))
      .sort((a, b) => a.distance - b.distance);
    for (const c of candidates.slice(0, 40))
      if (!validate || driveableConnector(p, c, 0.1)) return c;
    return null;
  }
  distancesFrom(position) {
    const snap = this.snap(position);
    if (!snap) return null;
    const costs = new Float64Array(this.nodes.length).fill(Infinity),
      previous = new Int32Array(this.nodes.length).fill(-1),
      visited = new Uint8Array(this.nodes.length);
    costs[snap.edge.a] =
      snap.distance + distance(snap, this.nodes[snap.edge.a]);
    costs[snap.edge.b] =
      snap.distance + distance(snap, this.nodes[snap.edge.b]);
    for (let step = 0; step < this.nodes.length; step++) {
      let node = -1,
        minimum = Infinity;
      for (let i = 0; i < costs.length; i++)
        if (!visited[i] && costs[i] < minimum) {
          node = i;
          minimum = costs[i];
        }
      if (node < 0) break;
      visited[node] = 1;
      for (const e of this.adjacency[node])
        if (costs[node] + e.cost < costs[e.to]) {
          costs[e.to] = costs[node] + e.cost;
          previous[e.to] = node;
        }
    }
    return { position: { ...position }, snap, costs, previous };
  }
  routeTo(tree, goal) {
    if (!tree) return null;
    const end = this.snap(goal);
    if (!end) return null;
    if (tree.snap.edge === end.edge && driveableConnector(tree.position, goal))
      return {
        points: [tree.position, { ...goal }],
        distance: distance(tree.position, goal),
      };
    const a = tree.costs[end.edge.a] + distance(this.nodes[end.edge.a], end),
      b = tree.costs[end.edge.b] + distance(this.nodes[end.edge.b], end);
    let cursor = a < b ? end.edge.a : end.edge.b;
    if (!Number.isFinite(Math.min(a, b))) return null;
    const path = [];
    while (cursor >= 0) {
      path.push({ ...this.nodes[cursor] });
      cursor = tree.previous[cursor];
    }
    path.reverse();
    const points = [
      tree.position,
      { x: tree.snap.x, z: tree.snap.z, y: tree.snap.y },
      ...path,
      { x: end.x, z: end.z, y: end.y },
      { ...goal },
    ];
    return {
      points: points.filter(
        (p, i) => i === 0 || distance(p, points[i - 1]) > 0.08,
      ),
      distance: Math.min(a, b) + end.distance,
    };
  }
  route(position, goal) {
    return this.routeTo(this.distancesFrom(position), goal);
  }
}
export const roadGraph = new RoadGraph();
// Reuse the route description for explicitly activated missions as well as gems.
export function describeRoute(position, route, destination, kind) {
  const state = new Guidance();
  state.route = route;
  state.destination = destination;
  state.lastPhase = kind;
  return state.snapshot(position);
}
export class Guidance {
  constructor() {
    this.destination = null;
    this.route = null;
    this.revision = 0;
    this.lastPhase = "";
    this.lastPosition = null;
  }
  update(position, phase, collected, force = false) {
    const kind = phase === "free" ? "gem" : "cooldown";
    const candidates =
      kind === "gem" ? gems.filter((g) => !collected.includes(g.id)) : garages;
    const tree = roadGraph.distancesFrom(position);
    let chosen = null;
    const options = [];
    for (const d of candidates) {
      const path = roadGraph.routeTo(tree, kind === "gem" ? d : d.inside);
      if (path) options.push({ destination: d, route: path });
    }
    options.sort((a, b) => a.route.distance - b.route.distance);
    chosen = options[0];
    const previous = options.find(
      (o) => o.destination.id === this.destination?.id,
    );
    // Stable target unless an alternative saves at least 18% AND 35 metres.
    if (
      !force &&
      kind === this.lastPhase &&
      previous &&
      chosen &&
      previous.route.distance < chosen.route.distance * 1.18 + 35
    )
      chosen = previous;
    if (chosen?.destination.id !== this.destination?.id) this.revision++;
    this.destination = chosen?.destination || null;
    this.route = chosen?.route || null;
    this.lastPhase = kind;
    this.lastPosition = { ...position };
    return this.snapshot(position);
  }
  snapshot(position) {
    if (!this.route)
      return {
        kind: this.lastPhase,
        destination: null,
        points: [],
        distance: Infinity,
        cue: "Return to an access road",
        revision: this.revision,
      };
    let cue = "Continue",
      turnDistance = 0,
      turn = "straight",
      accumulated = 0;
    const pts = this.route.points;
    for (let i = 1; i < pts.length - 1; i++) {
      accumulated += distance(pts[i - 1], pts[i]);
      const previous = pts[Math.max(0, i - 1)],
        next = pts[Math.min(pts.length - 1, i + 2)];
      const a = Math.atan2(pts[i].x - previous.x, -(pts[i].z - previous.z)),
        b = Math.atan2(next.x - pts[i].x, -(next.z - pts[i].z));
      const delta = angleDelta(b, a);
      if (Math.abs(delta) > 0.52 && accumulated > 8) {
        turn = delta > 0 ? "right" : "left";
        turnDistance = accumulated;
        cue = `${turnDistance < 18 ? "Turn" : "Prepare to turn"} ${turn}`;
        break;
      }
    }
    if (this.route.distance < 25) {
      cue =
        this.lastPhase === "cooldown"
          ? "Enter the courtyard and park behind the screen"
          : this.lastPhase === "mission"
            ? "Stop beside the Gem Runner and press E"
            : "Collect the gem";
      turn = "arrive";
    }
    return {
      kind: this.lastPhase,
      destination: this.destination,
      points: pts,
      distance: this.route.distance,
      cue,
      turn,
      turnDistance,
      revision: this.revision,
    };
  }
}
