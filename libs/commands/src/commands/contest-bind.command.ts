import { CONTEST_BIND, CONTEST_BIND_ENUM, SlashCommand } from '@cmnw/commands';
import { Roles } from '@cmnw/mongo';
import { buildContest } from '@cmnw/core';

export const contestBindCommand: SlashCommand = {
  name: CONTEST_BIND_ENUM.NAME,
  description: CONTEST_BIND_ENUM.DESCRIPTION,
  slashCommand: CONTEST_BIND,

  async executeInteraction({ interaction, models, logger }): Promise<unknown> {
    if (!interaction.isChatInputCommand()) return;
    try {
      const { contestModel } = models;
      const { options, user, guildId, channelId } = interaction;

      logger.log(`${CONTEST_BIND_ENUM.NAME} triggered by ${user.id}`);
      // TODO only owner
      const [role, trophy] = [
        options.getRole(CONTEST_BIND_ENUM.ROLE_OPTION, true),
        options.getString(CONTEST_BIND_ENUM.TROPHY_OPTION, false),
      ];

      const description = trophy ? trophy : '';

      const roleEntity = await models.rolesModel.findByIdAndUpdate<Roles>(
        role.id,
        {
          name: role.name,
          guildId: interaction.guildId,
          description,
          role: role.mentionable,
          position: role.position,
          updatedBy: interaction.client.user.id,
        },
      );

      roleEntity.tags.addToSet('trophy');

      await roleEntity.save();

      await buildContest(
        contestModel,
        guildId,
        channelId,
        description,
        user.id,
        role.id,
      );

      // TODO baxnem chto-nit smeshnoe
      const text = 'Погнали бахнем что-нить смешное';
      await interaction.reply({ content: text, ephemeral: true });
    } catch (errorOrException) {
      logger.error(errorOrException);
      await interaction.reply({
        content: errorOrException.message,
        ephemeral: true,
      });
    }
  },
};