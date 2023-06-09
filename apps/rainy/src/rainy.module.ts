import { Module } from '@nestjs/common';
import { RainyService } from './rainy.service';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { postgresConfig, redisConfig } from '@cmnw/config';
import { RedisModule } from '@nestjs-modules/ioredis';
import { SeederService } from './seeder/seeder.service';
import {
  ChannelsEntity,
  CoreUsersEntity,
  GuildsEntity,
  PermissionsEntity,
  RolesEntity,
  UserPermissionsEntity,
  UsersEntity,
} from '@cmnw/pg';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot(postgresConfig),
    TypeOrmModule.forFeature([
      ChannelsEntity,
      GuildsEntity,
      UsersEntity,
      RolesEntity,
      CoreUsersEntity,
      PermissionsEntity,
      UserPermissionsEntity,
    ]),
    RedisModule.forRoot({
      config: {
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
      },
    }),
  ],
  controllers: [],
  providers: [RainyService, SeederService],
})
export class RainyModule {}
