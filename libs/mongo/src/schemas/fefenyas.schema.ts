import { Document } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: true })
export class Fefenya extends Document {
  @Prop({ type: String })
  username: string;

  @Prop({ type: String, ref: 'Users', index: true })
  userId: string;

  @Prop({ type: String, ref: 'Guilds', index: true })
  guildId: string;

  @Prop({ type: Number })
  count: number;

  @Prop({ type: String })
  status: string;

  @Prop({ type: Date })
  updatedAt: Date;

  @Prop({ type: Date })
  createdAt: Date;
}

export const FefenyasSchema = SchemaFactory.createForClass(Fefenya);
