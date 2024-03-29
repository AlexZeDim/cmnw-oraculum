import { MessageDto } from '@cmnw/core/dto';
import { IChatFlow } from '@cmnw/core/types';
import { isArrayPropertyGuard } from '@cmnw/core/guards';
import { Prompts } from '@cmnw/mongo';

export class ChatFlowDto {
  prompt: Prompts;

  chatFlow: Array<IChatFlow>;

  static fromMessageDto(
    message: MessageDto,
    prompt: Prompts,
    self: string,
  ): ChatFlowDto {
    const dto = new ChatFlowDto();
    dto.prompt = prompt;
    dto.chatFlow = [
      {
        role: message.userId === self ? 'assistant' : 'user',
        name: message.userId === self ? undefined : message.username,
        content: isArrayPropertyGuard(message.attachments)
          ? `${message.text} ${message.attachments[0].url}`
          : message.text,
      },
    ];
    return dto;
  }

  static fromPromptsFlow(prompts: Array<Prompts>): ChatFlowDto {
    const dto = new ChatFlowDto();

    const sortedPrompts = prompts.sort((a, b) => a.position - b.position);
    const [promptModel] = sortedPrompts;

    dto.prompt = promptModel;
    dto.chatFlow = sortedPrompts.map((prompt) => ({
      role: prompt.role,
      content: prompt.text,
    }));

    return dto;
  }
}
