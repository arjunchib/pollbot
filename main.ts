import { start } from "disco";
import * as Poll from "./commands/poll.tsx";

await start({
  commands: [Poll],
  logs: "DEBUG",
  useWebhooks: true,
});
