export class Poll {
  id: string;
  votes = new Map<number, Set<string>>();

  constructor() {
    this.id = crypto.randomUUID();
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
