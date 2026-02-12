import { Injectable } from '@nestjs/common';
import { InteractionRule } from '../../../entities/interaction-rule.entity';
import { GRAPH_SCORING } from '../constants/scoring-weights';

interface GraphNode {
  name: string;
  tags: string[];
  degree: number;
  centrality: number;
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  ruleDescriptions: string[];
}

export interface GraphResult {
  scores: { power: number; salt: number; fear: number; airtime: number };
  hubs: Array<{ cardName: string; centrality: number }>;
  clusters: Array<{ cards: string[]; theme: string }>;
  nodes: GraphNode[];
  edges: GraphEdge[];
  edgeCount: number;
  density: number;
}

@Injectable()
export class GraphAnalysisService {
  analyzeGraph(
    cardTags: Map<string, string[]>,
    rules: InteractionRule[],
  ): GraphResult {
    const names = Array.from(cardTags.keys());
    const n = names.length;

    if (n < 3) {
      return this.emptyResult();
    }

    // Build adjacency matrix and edge list
    const { adjacency, edges } = this.buildGraph(names, cardTags, rules);

    // Compute betweenness centrality via Floyd-Warshall
    const centrality = this.computeBetweennessCentrality(adjacency, n);

    // Build nodes
    const nodes: GraphNode[] = names.map((name, i) => ({
      name,
      tags: cardTags.get(name) || [],
      degree: adjacency[i].filter((w) => w > 0).length,
      centrality: centrality[i],
    }));

    // Label propagation community detection
    const clusters = this.labelPropagation(adjacency, names);

    // Calculate metrics
    const possibleEdges = (n * (n - 1)) / 2;
    const edgeCount = edges.length;
    const graphDensity = possibleEdges > 0 ? edgeCount / possibleEdges : 0;

    // Get top hubs
    const sortedByHub = [...nodes].sort((a, b) => b.centrality - a.centrality);
    const hubs = sortedByHub.slice(0, Math.min(10, n)).map((node) => ({
      cardName: node.name,
      centrality: node.centrality,
    }));

    // Score
    const scores = this.computeScores(graphDensity, hubs, clusters, nodes);

    return {
      scores,
      hubs,
      clusters,
      nodes,
      edges,
      edgeCount,
      density: graphDensity,
    };
  }

  private buildGraph(
    names: string[],
    cardTags: Map<string, string[]>,
    rules: InteractionRule[],
  ): { adjacency: number[][]; edges: GraphEdge[] } {
    const n = names.length;
    const nameIndex = new Map(names.map((name, i) => [name, i]));
    const adjacency: number[][] = Array.from({ length: n }, () =>
      new Array(n).fill(0),
    );
    const edgeMap = new Map<string, GraphEdge>();

    // Build tag → rules index
    const tagRuleIndex = new Map<string, InteractionRule[]>();
    for (const rule of rules) {
      if (!tagRuleIndex.has(rule.tagA)) tagRuleIndex.set(rule.tagA, []);
      tagRuleIndex.get(rule.tagA)!.push(rule);
      if (rule.tagA !== rule.tagB) {
        if (!tagRuleIndex.has(rule.tagB)) tagRuleIndex.set(rule.tagB, []);
        tagRuleIndex.get(rule.tagB)!.push(rule);
      }
    }

    for (let i = 0; i < n; i++) {
      const tagsA = cardTags.get(names[i]) || [];
      for (let j = i + 1; j < n; j++) {
        const tagsB = cardTags.get(names[j]) || [];
        let weight = 0;
        const ruleDescriptions: string[] = [];

        for (const tagA of tagsA) {
          const candidateRules = tagRuleIndex.get(tagA) || [];
          for (const rule of candidateRules) {
            const otherTag = rule.tagA === tagA ? rule.tagB : rule.tagA;
            if (tagsB.includes(otherTag)) {
              const ruleWeight =
                Math.abs(rule.modifiers.power) +
                Math.abs(rule.modifiers.salt) +
                Math.abs(rule.modifiers.fear) +
                Math.abs(rule.modifiers.airtime);
              weight += ruleWeight;
              if (rule.description) ruleDescriptions.push(rule.description);
            }
          }
        }

        if (weight > 0) {
          adjacency[i][j] = weight;
          adjacency[j][i] = weight;
          const key = `${i}-${j}`;
          edgeMap.set(key, {
            source: names[i],
            target: names[j],
            weight,
            ruleDescriptions: [...new Set(ruleDescriptions)],
          });
        }
      }
    }

    return { adjacency, edges: Array.from(edgeMap.values()) };
  }

  /**
   * Simplified betweenness centrality via Floyd-Warshall.
   * For ~65 nodes this is O(N^3) ≈ 275k operations, <10ms.
   */
  private computeBetweennessCentrality(
    adjacency: number[][],
    n: number,
  ): number[] {
    // Build shortest path distance and count matrices
    const INF = Infinity;
    const dist: number[][] = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => {
        if (i === j) return 0;
        return adjacency[i][j] > 0 ? 1 / adjacency[i][j] : INF; // inverse weight = distance
      }),
    );
    const next: number[][] = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (adjacency[i][j] > 0 ? j : -1)),
    );
    const pathCount: number[][] = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => {
        if (i === j) return 1;
        return adjacency[i][j] > 0 ? 1 : 0;
      }),
    );

    // Floyd-Warshall
    for (let k = 0; k < n; k++) {
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (dist[i][k] + dist[k][j] < dist[i][j]) {
            dist[i][j] = dist[i][k] + dist[k][j];
            next[i][j] = next[i][k];
            pathCount[i][j] = pathCount[i][k] * pathCount[k][j];
          } else if (
            dist[i][k] + dist[k][j] === dist[i][j] &&
            dist[i][j] < INF
          ) {
            pathCount[i][j] += pathCount[i][k] * pathCount[k][j];
          }
        }
      }
    }

    // Count shortest paths through each node
    const betweenness = new Array(n).fill(0);
    for (let s = 0; s < n; s++) {
      for (let t = s + 1; t < n; t++) {
        if (dist[s][t] === INF || pathCount[s][t] === 0) continue;
        for (let v = 0; v < n; v++) {
          if (v === s || v === t) continue;
          if (dist[s][v] + dist[v][t] === dist[s][t]) {
            const contribution =
              (pathCount[s][v] * pathCount[v][t]) / pathCount[s][t];
            betweenness[v] += contribution;
          }
        }
      }
    }

    // Normalize by (n-1)(n-2)/2
    const norm = ((n - 1) * (n - 2)) / 2;
    if (norm > 0) {
      for (let i = 0; i < n; i++) {
        betweenness[i] /= norm;
      }
    }

    return betweenness;
  }

  /**
   * Label propagation community detection.
   * Each node starts with its own label. Iteratively, each node adopts the
   * most common label among its weighted neighbors.
   */
  private labelPropagation(
    adjacency: number[][],
    names: string[],
  ): Array<{ cards: string[]; theme: string }> {
    const n = names.length;
    const labels = Array.from({ length: n }, (_, i) => i);

    // Iterate until convergence or max iterations
    const MAX_ITER = 15;
    for (let iter = 0; iter < MAX_ITER; iter++) {
      let changed = false;

      // Process nodes in random order
      const order = Array.from({ length: n }, (_, i) => i);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }

      for (const node of order) {
        const labelWeights = new Map<number, number>();

        for (let neighbor = 0; neighbor < n; neighbor++) {
          if (adjacency[node][neighbor] > 0) {
            const label = labels[neighbor];
            labelWeights.set(
              label,
              (labelWeights.get(label) || 0) + adjacency[node][neighbor],
            );
          }
        }

        if (labelWeights.size === 0) continue;

        // Find the label with highest weight
        let bestLabel = labels[node];
        let bestWeight = 0;
        for (const [label, weight] of labelWeights) {
          if (weight > bestWeight) {
            bestWeight = weight;
            bestLabel = label;
          }
        }

        if (bestLabel !== labels[node]) {
          labels[node] = bestLabel;
          changed = true;
        }
      }

      if (!changed) break;
    }

    // Group nodes by label
    const groups = new Map<number, string[]>();
    for (let i = 0; i < n; i++) {
      if (!groups.has(labels[i])) groups.set(labels[i], []);
      groups.get(labels[i])!.push(names[i]);
    }

    // Convert to clusters (only include groups with 2+ cards)
    return Array.from(groups.values())
      .filter((cards) => cards.length >= 2)
      .map((cards) => ({
        cards,
        theme: `synergy-cluster-${cards.length}`,
      }));
  }

  private computeScores(
    graphDensity: number,
    hubs: Array<{ cardName: string; centrality: number }>,
    clusters: Array<{ cards: string[]; theme: string }>,
    nodes: GraphNode[],
  ): { power: number; salt: number; fear: number; airtime: number } {
    const g = GRAPH_SCORING;

    // Power from graph density
    let power = Math.min(graphDensity * g.densityMultiplier, g.densityCap);

    // Power from hub quality
    const topHubs = hubs.slice(0, 3);
    const avgHubCentrality =
      topHubs.length > 0
        ? topHubs.reduce((sum, h) => sum + h.centrality, 0) / topHubs.length
        : 0;
    if (avgHubCentrality > g.hubHighCentralityThreshold) {
      power += g.hubHighBonus;
    } else if (avgHubCentrality > g.hubCentralityThreshold) {
      power += g.hubBonus;
    }

    // Power from cluster focus
    const significantClusters = clusters.filter((c) => c.cards.length >= 3);
    if (significantClusters.length === 1) {
      power += g.veryFocusedClusterBonus;
    } else if (significantClusters.length >= 2 && significantClusters.length <= 3) {
      power += g.focusedClusterBonus;
    }

    // Fear from hub quality (high-centrality cards are high-value targets)
    let fear = 0;
    if (avgHubCentrality > g.hubCentralityThreshold) {
      fear += g.hubBonus;
    }

    // Airtime from dense engine clusters
    let airtime = 0;
    const engineClusters = clusters.filter(
      (c) => c.cards.length >= g.engineClusterMinSize,
    );
    airtime += Math.min(
      engineClusters.length * g.engineClusterAirtimeBonus,
      g.engineClusterCap,
    );

    return { power, salt: 0, fear, airtime };
  }

  private emptyResult(): GraphResult {
    return {
      scores: { power: 0, salt: 0, fear: 0, airtime: 0 },
      hubs: [],
      clusters: [],
      nodes: [],
      edges: [],
      edgeCount: 0,
      density: 0,
    };
  }
}
