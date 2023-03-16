import { SlashCommandBuilder } from '@discordjs/builders';
import { Redis } from '@nestjs-modules/ioredis';
import { Interaction } from 'discord.js';
import { Logger } from '@nestjs/common';
import { StorageTypes } from '@cmnw/shared/types/storage.types';

export interface ISlashCommandArgs {
  readonly interaction: Interaction;
  readonly localStorage: StorageTypes;
  readonly logger: Logger;
  readonly redis?: Redis;
}

export interface ISlashCommand {
  readonly name: string;

  readonly description: string;

  readonly guildOnly: boolean;

  readonly slashCommand: Omit<
    SlashCommandBuilder,
    'addSubcommand' | 'addSubcommandGroup'
  >;

  executeInteraction(interactionArgs: ISlashCommandArgs): Promise<void>;
}
