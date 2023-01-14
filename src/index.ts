import { serveWebhook } from "@blurp/cloudflare";
import commands from "./commands.js";

export default {
  fetch: serveWebhook(commands),
};
