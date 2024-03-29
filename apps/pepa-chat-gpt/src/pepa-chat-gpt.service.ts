import Redis from 'ioredis';
import { REST } from '@discordjs/rest';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { ChatService } from './chat/chat.service';
import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { DateTime } from 'luxon';
import { Interval } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Keys } from '@cmnw/mongo';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import {
  cryptoCommand,
  messageEmbed,
  SlashCommand,
  votingSanctionsCommand,
} from '@cmnw/commands';

import {
  formatRedisKey,
  STORAGE_KEYS,
  MessageDto,
  ChatFlowDto,
  randomMixMax,
  loadKey,
  ORACULUM_QUEUE,
  oraculumQueue,
  waitForDelay,
  chatQueue,
  VotingCounter,
} from '@cmnw/core';

import {
  Client,
  Collection,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  GuildMember,
  Message,
  PartialGuildMember,
  Partials,
  Routes,
  Snowflake,
  TextChannel,
} from 'discord.js';

@Injectable()
export class PepaChatGptService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PepaChatGptService.name, {
    timestamp: true,
  });
  private readonly rest = new REST({ version: '10' });

  private client: Client;
  private chatUser: Keys;
  private votingStorage = new Collection<string, VotingCounter>();
  private commandsMessage = new Collection<string, SlashCommand>();
  private messageStorage = new Collection<
    Snowflake,
    Collection<Snowflake, MessageDto>
  >();

  constructor(
    private chatService: ChatService,
    private readonly amqpConnection: AmqpConnection,
    @InjectRedis()
    private readonly redisService: Redis,
    @InjectModel(Keys.name)
    private readonly keysModel: Model<Keys>,
  ) {}
  async onApplicationBootstrap() {
    await this.loadBot();
    await this.loadCommands();
    await this.bot();
  }

  private async loadCommands(): Promise<void> {
    this.commandsMessage.set(
      votingSanctionsCommand.name,
      votingSanctionsCommand,
    );
    this.commandsMessage.set(cryptoCommand.name, cryptoCommand);

    const commandsBody = [
      votingSanctionsCommand.slashCommand.toJSON(),
      cryptoCommand.slashCommand.toJSON(),
    ];

    await this.rest.put(Routes.applicationCommands(this.client.user.id), {
      body: commandsBody,
    });
  }

  private async loadBot(resetContext = false) {
    this.client = new Client({
      partials: [Partials.User, Partials.Channel, Partials.GuildMember],
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.MessageContent,
      ],
      presence: {
        status: 'online',
      },
    });

    if (resetContext) {
      await this.redisService.flushall();
      this.logger.warn(`resetContext set to ${resetContext}`);
    }

    this.chatUser = await loadKey(this.keysModel, 'Janisse');

    await this.client.login(this.chatUser.token);
    this.rest.setToken(this.chatUser.token);
  }

  @RabbitSubscribe({
    exchange: oraculumQueue.name,
    queue: oraculumQueue.name,
    routingKey: 'messages.all',
    createQueueIfNotExists: true,
  })
  private async test(message: MessageDto) {
    await waitForDelay(10);
    const channel = this.client.channels.cache.get(
      '1100433314101338202',
    ) as TextChannel;

    const embed = messageEmbed(message);
    await channel.send({ embeds: [embed] });
  }

  private async bot() {
    this.client.on(Events.ClientReady, async () => {
      this.logger.log(`Logged in as ${this.client.user.tag}!`);
      // await this.storage();
    });

    this.client.on(
      Events.GuildMemberUpdate,
      async (
        oldMember: GuildMember | PartialGuildMember,
        newMember: GuildMember,
      ) => {
        // TODO index roles
        const key = formatRedisKey(STORAGE_KEYS.USER, 'PEPA');
        const hasEvent = Boolean(await this.redisService.exists(key));
        if (hasEvent) {
          this.logger.warn(`${oldMember.id} has been triggered already!`);
          return;
        }

        await this.redisService.set(key, oldMember.id, 'EX', 10);
      },
    );

    this.client.on(Events.InteractionCreate, async (interaction) => {
      try {
        if (interaction.isCommand()) {
          const command = this.commandsMessage.get(interaction.commandName);
          if (!command) return;

          await command.executeInteraction({
            interaction,
            logger: this.logger,
          });
        }

        if (interaction.isButton()) {
          const votingId = interaction.message.id;
          const isVotingStorages = this.votingStorage.has(votingId);
          const currentVote = isVotingStorages
            ? this.votingStorage.get(votingId)
            : { yes: 0, no: 0, voters: new Set<string>() };

          if (isVotingStorages) {
            const isUserVote = currentVote.voters.has(interaction.user.id);
            if (isUserVote) {
              await interaction.reply({
                content: 'Вы уже участвовали в данном голосовании!',
                ephemeral: true,
              });

              return;
            }
          }

          const isYes = interaction.customId === 'Yes';
          const currentVoteCount = isYes
            ? (currentVote.yes = currentVote.yes + 1)
            : (currentVote.no = currentVote.no + 1);

          currentVote.voters.add(interaction.user.id);

          this.votingStorage.set(votingId, currentVote);

          const [embed] = interaction.message.embeds;

          const [index, name, space] = isYes
            ? [0, 'За', '⠀⠀⠀⠀⠀']
            : [-1, 'Против', '⠀⠀⠀'];

          const updatedEmbed = new EmbedBuilder(embed).spliceFields(index, 1, {
            name: `───────────────`,
            value: `${space}${name}: ${currentVoteCount}\n───────────────`,
            inline: true,
          });

          await interaction.update({ embeds: [updatedEmbed] });
          await interaction.reply({
            content: 'Ваш голос был учтен!',
            ephemeral: true,
          });
        }
      } catch (errorException) {
        this.logger.error(errorException);
        if (interaction.isCommand()) {
          await interaction.reply({
            content: 'There was an error while executing this command!',
            ephemeral: true,
          });
        }
      }
    });

    this.client.on(Events.MessageCreate, async (message: Message<true>) => {
      let isIgnore: boolean;
      let isMentioned: boolean;

      try {
        /**
         * @description Form dto from message
         * @description and pass it to queue
         */
        const chatMessage = MessageDto.fromDiscordMessage(
          message,
          this.chatUser,
        );
        /**
         * @description create channel message storage
         * @description and extract messages is it exists
         */
        const channelId = message.channel.id;
        const isChannelExists = this.messageStorage.has(channelId);
        const messageStorage = isChannelExists
          ? this.messageStorage.get(channelId)
          : new Collection<Snowflake, MessageDto>([
              [message.author.id, chatMessage],
            ]);

        if (!isChannelExists) {
          this.messageStorage.set(message.channel.id, messageStorage);
        }

        const { isBot, isSelf, isGuild } = this.chatService.isIgnore(
          message,
          this.client,
        );
        if (isSelf || isBot) return;
        // TODO isMultipleQuestions, isCertainQuestion
        // const { isMultipleQuestions, isCertainQuestion } = await this.chatService.isQuestion(message);

        // isIgnore = await this.chatService.isIgnoreTriggered(this.chatUser.name);
        // if (isIgnore) return;

        // await this.chatService.setChannelLastActive(message.channelId);

        const { content } = message;

        isMentioned = await this.chatService.isUserMentioned(
          message.mentions,
          message.mentions.users,
          this.client.user.id,
          content,
        );

        const isText = Boolean(content);
        const hasAttachment = Boolean(message.attachments.size);

        const { flag } = await this.chatService.rollDiceFullHouse({
          isText,
          hasAttachment,
          isMentioned,
        });

        // TODO throw prompt personality flag length context (channel | user)
        const now = DateTime.now().setZone('Europe/Moscow');
        await this.amqpConnection.publish<MessageDto>(
          ORACULUM_QUEUE.MESSAGES,
          'v4',
          chatMessage,
        );

        const n = randomMixMax(1, 7);
        if (n < 6) return;

        const messageCollection = this.messageStorage.get(channelId);
        const dialogFrom = messageCollection
          .last(n)
          .map((message) =>
            ChatFlowDto.fromMessageDto(message, this.client.user.id),
          );

        const response = await this.amqpConnection.request<string>({
          exchange: chatQueue.name,
          routingKey: 'v4',
          payload: dialogFrom,
          timeout: 60 * 1000,
        });

        console.log(response);

        await message.channel.send({ content: response });
      } catch (errorOrException) {
        this.logger.error(errorOrException);
      }
    });
  }

  @Interval(10_000)
  async eventManagement() {
    const now = DateTime.now().setZone('Europe/Moscow');
    // TODO check current event at a moment of time

    // TODO increase chance of inactivity for each period

    // TODO Redis Pepa inactivity flag value

    // TODO check chance
    // const questions = await this.chatService.answerQuestion();
  }
}
