import {
  PermissionsBitField,
  SlashCommandBuilder,
  TextChannel,
} from 'discord.js';
import { from, lastValueFrom, mergeMap } from 'rxjs';
import { Fefenya, Roles } from '@cmnw/mongo';
import { DateTime } from 'luxon';
import {
  COMMAND_DESCRIPTION_ENUMS,
  COMMAND_ENUMS,
  generateKey,
  GOTD_PARAMS_DESCRIPTION_ENUM,
  GOTD_PARAMS_ENUM,
  SlashCommand,
} from '@cmnw/commands';

import {
  bindChannelTags,
  bindRoleTags,
  FEFENYA_COMMANDS,
  FEFENYA_HOLIDAY,
  getRandomDialog,
  getFlowDialogs,
  TAGS_ENUM,
  waitForDelay,
  randomMixMax,
  getRoleByTags,
  pickRandomFefenyaUser,
  gotdGreeter,
  indexGuild,
  indexRoles,
  indexChannel,
  PROMPT_TYPE_ENUM,
} from '@cmnw/core';

export const gotdCommand: SlashCommand = {
  name: COMMAND_ENUMS.FEFENYA_GOTD,
  description: COMMAND_DESCRIPTION_ENUMS.FEFENYA_GOTD,
  slashCommand: new SlashCommandBuilder()
    .setName(COMMAND_ENUMS.FEFENYA_GOTD)
    .setDescription(COMMAND_DESCRIPTION_ENUMS.FEFENYA_GOTD)
    .addRoleOption((option) =>
      option
        .setName(GOTD_PARAMS_ENUM.ROLE)
        .setDescription(GOTD_PARAMS_DESCRIPTION_ENUM.ROLE)
        .setRequired(false),
    ),

  executeInteraction: async function ({ interaction, logger, models, redis }) {
    if (!interaction.isChatInputCommand()) return;

    const {
      channelsModel,
      guildsModel,
      fefenyaModel,
      promptsModel,
      rolesModel,
    } = models;

    const [gotdRole, guildId, channelId, userId] = [
      interaction.options.getRole(GOTD_PARAMS_ENUM.ROLE, false),
      interaction.guildId,
      interaction.channelId,
      interaction.user.id,
    ];

    const { guildKey, userKey } = generateKey({
      command: COMMAND_ENUMS.FEFENYA_GOTD,
      guildId,
      userId,
    });

    try {
      logger.log(`${FEFENYA_COMMANDS.GOTD} has been triggered`);

      const isCommandInProgress = Boolean(await redis.exists(guildKey));
      if (isCommandInProgress) {
        const isProgressPrompt = await getRandomDialog(
          models.promptsModel,
          PROMPT_TYPE_ENUM.IGNORE,
        );

        return await interaction.reply({
          content: isProgressPrompt.text,
          ephemeral: true,
        });
      }

      await redis.set(guildKey, 1, 'EX', 120);

      const incrGuildMember = await redis.incr(userKey);
      if (incrGuildMember >= 2) {
        const ignorePrompt = await getRandomDialog(
          models.promptsModel,
          PROMPT_TYPE_ENUM.IGNORE,
        );

        return await interaction.reply({
          content: ignorePrompt.text,
          ephemeral: true,
        });
      }

      const tod = DateTime.now()
        .setZone('Europe/Moscow')
        .startOf('day')
        .toJSDate();

      const isFefenyaUserTod = await fefenyaModel.findOne<Fefenya>({
        guildId: guildId,
        isGotd: true,
        updatedAt: { $gte: tod },
      });

      if (isFefenyaUserTod) {
        const commandPrompt = await getRandomDialog(
          models.promptsModel,
          PROMPT_TYPE_ENUM.GOTD,
        );

        return await interaction.reply({
          content: commandPrompt.text,
          ephemeral: isCommandInProgress,
        });
      }

      const tags = [TAGS_ENUM.CONTEST, TAGS_ENUM.FEFENYA];
      let role: Roles | undefined;

      const scannedBy = interaction.client.user.id;

      await Promise.all([
        indexGuild(guildsModel, interaction.guild, interaction.client.user.id),
        indexChannel(
          channelsModel,
          interaction.channel as TextChannel,
          guildId,
          scannedBy,
        ),
      ]);

      await bindChannelTags(channelsModel, guildId, channelId, tags);

      if (gotdRole) {
        const addRole = interaction.guild.roles.cache.get(gotdRole.id);
        await indexRoles(rolesModel, guildId, addRole, scannedBy);

        role = await bindRoleTags(rolesModel, guildId, gotdRole.id, tags);
      }

      const dialogContestFlow = await getFlowDialogs(
        promptsModel,
        FEFENYA_HOLIDAY.GOTD,
      );

      const isInit = !dialogContestFlow.length;
      if (isInit) {
        const commandDialog = await getRandomDialog(
          promptsModel,
          PROMPT_TYPE_ENUM.COMMAND,
        );

        return await interaction.reply(commandDialog.text);
      }

      const reply = dialogContestFlow.shift();
      await interaction.reply(reply.text);

      await lastValueFrom(
        from(dialogContestFlow).pipe(
          await mergeMap(async (flow) => {
            const seconds = randomMixMax(5, 40);
            await waitForDelay(seconds);
            await interaction.channel.send({ content: flow.text });
          }),
        ),
      );

      if (!role) role = await getRoleByTags(rolesModel, guildId, tags);

      const hasPermissions = interaction.guild.members.me.permissions.has(
        PermissionsBitField.Flags.ManageRoles,
      );

      const isRoleExists = role && hasPermissions;

      if (isRoleExists) {
        const fefenyaUser = await fefenyaModel.findOneAndUpdate<Fefenya>(
          {
            guildId: guildId,
            isGotd: true,
          },
          {
            isGotd: false,
          },
        );

        if (fefenyaUser) {
          const gotdGuildMember = interaction.guild.members.cache.get(
            fefenyaUser._id,
          );

          await gotdGuildMember.roles.remove(gotdRole.id);
        }
      }

      const fefenyaUser = await pickRandomFefenyaUser(fefenyaModel, guildId);
      const pickedGuildMember = interaction.guild.members.cache.get(
        fefenyaUser._id,
      );
      if (isRoleExists) {
        await pickedGuildMember.roles.add(gotdRole.id);
      }

      return await interaction.channel.send({
        content: gotdGreeter(pickedGuildMember.user.id),
      });
    } catch (errorOrException) {
      logger.error(errorOrException);

      const errorPrompt = await getRandomDialog(
        promptsModel,
        PROMPT_TYPE_ENUM.ERROR,
      );
      return await interaction.reply({
        content: errorPrompt.text,
        ephemeral: false,
      });
    } finally {
      await redis.del(guildKey);
    }
  },
};
