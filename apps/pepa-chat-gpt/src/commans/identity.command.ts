import { ISlashCommand, ISlashCommandArgs } from '@cmnw/shared';
import { SlashCommandBuilder } from '@discordjs/builders';
import { IDENTITY_STATUS_ENUM, PepaIdentityEntity } from '@cmnw/pg';
import { Repository } from 'typeorm';
import { EmbedBuilder } from 'discord.js';

export const Identity: ISlashCommand = {
  name: 'identity',
  description: 'Force use selected identity by default',
  guildOnly: true,
  slashCommand: new SlashCommandBuilder()
    .setName('identity')
    .setDescription('Force using selected identity by default')
    .addStringOption((option) =>
      option
        .setName('identity')
        .setDescription('Set codename')
        .setRequired(true),
    ),

  async executeInteraction({
    interaction,
    logger,
    repository,
  }: ISlashCommandArgs): Promise<void> {
    if (!interaction.isChatInputCommand() || !repository) return;
    logger.warn(
      `User: ${interaction.user.id} | ${interaction.user.username} triggered command ${Identity.name}`,
    );
    try {
      const name = interaction.options.getString('identity');

      let embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`Identity model ${name} not found!`)
        .setFooter({
          text: 'Managed & operated by CMNW. Dedicated to Kristina | LisaeL',
          iconURL: 'https://i.imgur.com/OBDcu7K.png',
        });

      const identityEntity = await (
        repository as Repository<PepaIdentityEntity>
      ).findOneBy({ name });

      if (!identityEntity) {
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      if (identityEntity) {
        await (repository as Repository<PepaIdentityEntity>).update(
          { status: IDENTITY_STATUS_ENUM.ACTIVE },
          { status: IDENTITY_STATUS_ENUM.ENABLED },
        );

        identityEntity.status = IDENTITY_STATUS_ENUM.ACTIVE;

        await (repository as Repository<PepaIdentityEntity>).save(
          identityEntity,
        );
      }

      embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(identityEntity.name)
        .setDescription(
          `Identity model has been set to ${IDENTITY_STATUS_ENUM.ACTIVE} successfully.`,
        )
        .setTimestamp(identityEntity.updatedAt)
        .setThumbnail(identityEntity.avatar)
        .setFooter({
          text: 'Managed & operated by CMNW. Dedicated to Kristina | LisaeL',
          iconURL: 'https://i.imgur.com/OBDcu7K.png',
        });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (errorOrException) {
      console.error(errorOrException);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: 'There was an error while executing this command!',
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: errorOrException.message,
          ephemeral: true,
        });
      }
    }
  },
};
