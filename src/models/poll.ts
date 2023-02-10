import { replacer, reviver } from "../util.js";

interface Choice<T> {
  votes: number;
  metadata?: T;
}

const EXPIRATION_TTL = 3600 * 24 * 7; // 1 week

export class Poll<T> {
  static namespace: KVNamespace;
  id: string;
  expiration: number;
  choices = new Map<string, Choice<T>>();
  voters = new Map<string, string>();

  static setNamespace(namespace: KVNamespace) {
    Poll.namespace = namespace;
  }

  static async get<T>(key: string): Promise<Poll<T>> {
    const data = await Poll.namespace.get(key);
    return new Poll(JSON.parse(data!, reviver));
  }

  static create<T>(): Poll<T> {
    return new Poll({
      id: crypto.randomUUID(),
      expiration: Date.now() / 1000 + EXPIRATION_TTL,
    });
  }

  private constructor(obj: Partial<Poll<T>>) {
    if (!obj.id) throw new Error("Missing required id");
    if (!obj.expiration) throw new Error("Missing expiration date");
    this.id = obj.id;
    this.expiration = obj.expiration;
    if (obj.choices) this.choices = obj.choices;
    if (obj.voters) this.voters = obj.voters;
  }

  async save() {
    await Poll.namespace.put(this.id, JSON.stringify(this, replacer), {
      expiration: this.expiration,
    });
  }

  vote(choiceKey: string, voterKey: string, metadata?: T) {
    if (!this.choices.has(choiceKey)) {
      this.choices.set(choiceKey, { votes: 0 });
    }
    const choice = this.choices.get(choiceKey)!; // just checked if exists
    if (metadata) choice.metadata = metadata;

    // Handle if already voted
    const voterChoice = this.voters.get(voterKey);
    if (voterChoice) {
      const oldChoice = this.choices.get(voterChoice);
      if (!oldChoice) throw new Error(`Could not find choice: ${voterChoice}`);
      oldChoice.votes -= 1;
    }

    // Cast new vote
    choice.votes += 1;
    this.voters.set(voterKey, choiceKey);
  }

  getTotal(choiceKey: string): number {
    return this.choices.get(choiceKey)?.votes ?? 0;
  }

  getLeader(): Choice<T> | undefined {
    let max: Choice<T> | undefined;
    for (const c of this.choices.values()) {
      if (!max || c.votes > max.votes) {
        max = c;
      }
    }
    return max;
  }
}
