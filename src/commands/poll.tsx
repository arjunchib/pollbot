import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  InteractionType,
  TextInputStyle,
  ButtonStyle,
  ComponentType,
} from "discord-api-types/v10";
import {
  Command,
  Interaction,
  Modal,
  TextInput,
  ActionRow,
  ChannelMessageWithSource,
  Button,
  UpdateMessage,
} from "@blurp/common";
import { Poll, PollData } from "../models/poll.js";
import { Env } from "../environment.js";

export const command: Command = {
  name: "poll",
  description: "Create a poll",
  options: [
    {
      name: "options",
      description: "Number of options between 2 and 5",
      required: true,
      type: ApplicationCommandOptionType.Number,
      min_value: 2,
      max_value: 5,
    },
  ],
};

const EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];

async function handleSlashCommand(interaction: Interaction, env: Env) {
  if (
    interaction.payload.type !== InteractionType.ApplicationCommand ||
    interaction.payload.data.type !== ApplicationCommandType.ChatInput
  )
    return;
  const numOptionsOption = interaction.payload.data.options?.find(
    (opt) => opt.name === "options"
  );
  const numOptions =
    numOptionsOption?.type === ApplicationCommandOptionType.Number
      ? numOptionsOption.value
      : 2;
  const children = [];
  for (let i = 1; i <= numOptions; i++) {
    children.push(
      <ActionRow>
        <TextInput
          custom_id={`poll:msg${i}`}
          label={`Option ${i}`}
          style={TextInputStyle.Short}
          required={false}
        ></TextInput>
      </ActionRow>
    );
  }
  children.unshift(
    <ActionRow>
      <TextInput
        style={TextInputStyle.Short}
        label="Title"
        custom_id="poll:title"
        required={false}
      ></TextInput>
    </ActionRow>
  );
  interaction.reply(
    <Modal custom_id="poll:modal" title="New Poll">
      {children}
    </Modal>
  );
}

async function handleModalSubmit(interaction: Interaction, env: Env) {
  if (interaction.payload.type !== InteractionType.ModalSubmit) return;
  const title = interaction.payload.data.components.find((row) =>
    row.components.some((input) => input.custom_id === "poll:title")
  )?.components[0].value;
  const options = interaction.payload.data.components
    .filter((row) =>
      row.components.some((input) => input.custom_id.startsWith("poll:msg"))
    )
    .map((row) => row.components[0].value);
  const poll = new Poll();
  const buttons = options.map((opt, i) => (
    <Button
      emoji={{ name: EMOJIS[i] }}
      style={ButtonStyle.Secondary}
      custom_id={`poll:${poll.id}:${i}`}
    >
      {opt}
    </Button>
  ));
  const hasLongText = options.some((opt) => opt.length > 20);
  const children = hasLongText ? (
    buttons.map((btn) => <ActionRow>{btn}</ActionRow>)
  ) : (
    <ActionRow>{buttons}</ActionRow>
  );
  interaction.reply(
    <ChannelMessageWithSource content={title}>
      {children}
    </ChannelMessageWithSource>
  );
  await env.POLL.put(poll.id, JSON.stringify(poll), {
    expirationTtl: 3600 * 24 * 7,
  });
}

async function handleButtonClick(interaction: Interaction, env: Env) {
  if (
    interaction.payload.type !== InteractionType.MessageComponent ||
    interaction.payload.data.component_type !== ComponentType.Button
  )
    return;
  const [_, pollId, indexStr] = interaction.payload.data.custom_id.split(":");
  const pollData = await env.POLL.get<PollData>(pollId, { type: "json" });
  if (!pollData) {
    let content = interaction.payload.message.content.split("\n")[0];
    content += "\n*Poll has ended. Voting is no longer allowed.*";
    return interaction.reply(<UpdateMessage content={content}></UpdateMessage>);
  }
  const poll = new Poll(pollData);
  const index = parseInt(indexStr);
  const user = interaction.payload.member?.user || interaction.payload.user;
  if (user == null || index == null || index < 0 || index > 4) {
    let content = interaction.payload.message.content.split("\n")[0];
    content += "\n*Something has gone wrong.*";
    return interaction.reply(<UpdateMessage content={content}></UpdateMessage>);
  }
  poll.vote(index, user.id);
  interaction.payload.message.components?.forEach((row) => {
    row.components.forEach((btn) => {
      if (btn.type === ComponentType.Button && btn.style !== ButtonStyle.Link) {
        const [_, _pollId, iStr] = btn.custom_id.split(":");
        const i = parseInt(iStr);
        const spaceIdx = btn.label?.endsWith(")")
          ? btn.label?.lastIndexOf(" ")
          : undefined;
        const voteCount = poll.tally(i);
        const labelWithoutCount = btn.label?.substring(0, spaceIdx);
        const labelWithCount = `${labelWithoutCount} (${voteCount})`;
        btn.label = voteCount === 0 ? labelWithoutCount : labelWithCount;
      }
    });
  });
  interaction.reply(
    <UpdateMessage>{interaction.payload.message.components}</UpdateMessage>
  );
  await env.POLL.put(poll.id, JSON.stringify(poll), {
    expirationTtl: 3600 * 24 * 7,
  });
}

export default async function PollHandler(interaction: Interaction, env: Env) {
  await handleSlashCommand(interaction, env);
  await handleModalSubmit(interaction, env);
  await handleButtonClick(interaction, env);
}
