import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Bans extends Document {
  @Prop({ type: String, ref: 'Users' })
  userId: string;

  @Prop({ type: String, ref: 'Guilds' })
  guildId: string;

  @Prop({ type: String })
  reason: string;

  @Prop({ type: Date })
  updatedAt: Date;

  @Prop({ type: Date })
  createdAt: Date;
}

export const BansSchema = SchemaFactory.createForClass(Bans);
