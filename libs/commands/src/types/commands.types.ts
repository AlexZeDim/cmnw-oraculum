import { ISlashCommand } from '@cmnw/commands/types/commands.interface';

export type SlashCommand = Readonly<ISlashCommand>;

export type SlashModel = Omit<ISlashCommand, 'slashCommand'>;
