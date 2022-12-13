import { InteractionType, TextInputStyle } from "discord_api_types";
import {
  Command,
  Interaction,
  Modal,
  TextInput,
  ActionRow,
  ChannelMessageWithSource,
} from "disco";

export const command: Command = {
  name: "poll",
  description: "Create a poll",
};

export default function Poll(interaction: Interaction) {
  if (interaction.payload.type === InteractionType.ApplicationCommand) {
    const modal = (
      <Modal custom_id="poll:modal" title="Operation Request">
        <ActionRow>
          <TextInput
            custom_id="poll:msg"
            label="Message"
            style={TextInputStyle.Short}
          ></TextInput>
        </ActionRow>
      </Modal>
    );
    interaction.reply(modal);
  } else if (interaction.payload.type === InteractionType.ModalSubmit) {
    const data = interaction.payload.data.components[0].components[0].value;
    interaction.reply(
      <ChannelMessageWithSource content={data}></ChannelMessageWithSource>
    );
  }
}
