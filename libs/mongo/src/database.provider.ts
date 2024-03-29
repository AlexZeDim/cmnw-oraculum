import * as mongoose from 'mongoose';
import { mongoConfig } from '@cmnw/config';

export const databaseProviders = [
  {
    provide: 'DATABASE_CONNECTION',
    useFactory: (): Promise<typeof mongoose> =>
      mongoose.connect(mongoConfig.connectionString),
  },
];
