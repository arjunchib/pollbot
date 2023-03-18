import { CommandModule } from "@blurp/common/core";
import { updateCommands } from "@blurp/node";
import commands from "../src/commands.js";

if (process.env.DEVELOPMENT === "true") {
  await updateCommands(commands as unknown as CommandModule[]);
  await updateCommands({ commands: [], global: true });
} else {
  await updateCommands({
    commands: commands as unknown as CommandModule[],
    global: true,
  });
  await updateCommands({ commands: [], global: false });
}
