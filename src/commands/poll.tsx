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
  Modal,
  TextInput,
  ActionRow,
  ChannelMessageWithSource,
  Button,
  UpdateMessage,
  SelectMenu,
  Context,
} from "@blurp/common";
import { Poll } from "../models/poll.js";
import { Env } from "../environment.js";
import { CloudflareContext } from "@blurp/cloudflare";

export const command = {
  name: "poll",
  description: "Create a poll",
  options: [
    {
      name: "simple",
      description: "Poll where you can set the choices",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "num_choices",
          description: "Number of options between 2 and 5",
          required: true,
          type: ApplicationCommandOptionType.Number,
          min_value: 2,
          max_value: 5,
        },
      ],
    },
    {
      name: "user",
      description: "Poll where the choices are users in the server",
      type: ApplicationCommandOptionType.Subcommand,
    },
  ],
} as const satisfies Command;

const EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];

async function handleSlashCommand({
  interaction,
  reply,
  options,
}: Context<typeof command>) {
  if (
    interaction.type !== InteractionType.ApplicationCommand ||
    interaction.data.type !== ApplicationCommandType.ChatInput
  )
    return;
  if (options.pluck("user")) {
    const poll = Poll.create();
    const customId = `poll:${poll.id}`;
    reply(
      <ChannelMessageWithSource>
        <ActionRow>
          <SelectMenu
            custom_id={customId}
            type={ComponentType.UserSelect}
          ></SelectMenu>
        </ActionRow>
      </ChannelMessageWithSource>
    );
    await poll.save();
    return;
  }
  const numOptions = options.pluck("simple", "num_choices")?.value ?? 2;
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
  reply(
    <Modal custom_id="poll:modal" title="New Poll">
      {children}
    </Modal>
  );
}

async function handleModalSubmit({
  interaction,
  reply,
}: Context<typeof command>) {
  if (interaction.type !== InteractionType.ModalSubmit) return;
  const title = interaction.data.components.find((row) =>
    row.components.some((input) => input.custom_id === "poll:title")
  )?.components[0].value;
  const options = interaction.data.components
    .filter((row) =>
      row.components.some((input) => input.custom_id.startsWith("poll:msg"))
    )
    .map((row) => row.components[0].value);
  const poll = Poll.create();
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
  reply(
    <ChannelMessageWithSource content={title}>
      {children}
    </ChannelMessageWithSource>
  );
  await poll.save();
}

async function handleButtonClick({
  interaction,
  reply,
}: Context<typeof command>) {
  if (
    interaction.type !== InteractionType.MessageComponent ||
    interaction.data.component_type !== ComponentType.Button
  )
    return;
  const [_, pollId, choiceKey] = interaction.data.custom_id.split(":");
  const poll = await Poll.get(pollId);
  if (!poll) {
    let content = interaction.message.content.split("\n")[0];
    content += "\n*Poll has ended. Voting is no longer allowed.*";
    const { components } = interaction.message;
    components?.forEach((row) =>
      row.components.forEach((b) => {
        b.disabled = true;
      })
    );
    return reply(<UpdateMessage content={content}>{components}</UpdateMessage>);
  }
  const user = interaction.member?.user || interaction.user;
  if (user == null) {
    let content = interaction.message.content.split("\n")[0];
    content += "\n*Something has gone wrong.*";
    return reply(<UpdateMessage content={content}></UpdateMessage>);
  }
  poll.vote(choiceKey, user.id);
  interaction.message.components?.forEach((row) => {
    row.components.forEach((btn) => {
      if (btn.type === ComponentType.Button && btn.style !== ButtonStyle.Link) {
        const [_, _pollId, i] = btn.custom_id.split(":");
        const spaceIdx = btn.label?.endsWith(")")
          ? btn.label?.lastIndexOf(" ")
          : undefined;
        const voteCount = poll.getTotal(i);
        const labelWithoutCount = btn.label?.substring(0, spaceIdx);
        const labelWithCount = `${labelWithoutCount} (${voteCount})`;
        btn.label = voteCount === 0 ? labelWithoutCount : labelWithCount;
      }
    });
  });
  reply(<UpdateMessage>{interaction.message.components}</UpdateMessage>);
  await poll.save();
}

async function handleUserSelect({
  interaction,
  reply,
}: Context<typeof command>) {
  if (
    interaction.type !== InteractionType.MessageComponent ||
    interaction.data.component_type !== ComponentType.UserSelect
  )
    return;
  const [_, pollId] = interaction.data.custom_id.split(":");
  const poll = await Poll.get<{ name: string }>(pollId);
  if (!poll) {
    reply(<UpdateMessage content="Poll closed!"></UpdateMessage>);
    return;
  }
  const user = interaction.member?.user || interaction.user;
  if (!user) throw new Error("No user");
  const choiceKey = interaction.data.values?.[0];
  const name =
    interaction.data.resolved.members?.[choiceKey]?.nick ||
    interaction.data.resolved.users?.[choiceKey]?.username;
  poll.vote(choiceKey, user?.id, { name });
  const content = `Current leader: ${poll.getLeader()?.metadata?.name}`;
  reply(<UpdateMessage content={content}></UpdateMessage>);
  await poll.save();
}

export default async function PollHandler(interaction: CloudflareContext<Env>) {
  Poll.setNamespace(interaction.environment.POLL);
  await handleSlashCommand(interaction);
  await handleModalSubmit(interaction);
  await handleButtonClick(interaction);
  await handleUserSelect(interaction);
}
