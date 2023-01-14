export interface PollData {
  id: string;
  votes: (readonly [number, readonly string[]])[];
}

export class Poll {
  id: string;
  votes: Map<number, Set<string>>;

  constructor(data?: PollData) {
    if (data) {
      this.id = data.id;
      this.votes = new Map(data.votes.map(([k, v]) => [k, new Set(v)]));
    } else {
      this.id = crypto.randomUUID();
      this.votes = new Map<number, Set<string>>();
    }
  }

  toJSON(): PollData {
    const votes = [...this.votes].map(([k, v]) => [k, [...v]] as const);
    return {
      id: this.id,
      votes,
    };
  }

  vote(index: number, voterId: string) {
    this.removeAll(voterId);
    this.add(index, voterId);
  }

  tally(index: number): number {
    return this.votes.get(index)?.size || 0;
  }

  private add(index: number, voterId: string) {
    if (!this.votes.has(index)) {
      this.votes.set(index, new Set());
    }
    this.votes.get(index)?.add(voterId);
  }

  private removeAll(voterId: string) {
    this.votes.forEach((set) => {
      set.delete(voterId);
    });
  }
}
