import { updateCommands } from "@blurp/node";
import commands from "../src/commands.js";

if (process.env.DEVELOPMENT === "true") {
  await updateCommands(commands);
  await updateCommands({ commands: [], global: true });
} else {
  await updateCommands({ commands, global: true });
  await updateCommands({ commands: [], global: false });
}
