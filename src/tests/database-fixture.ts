import { PrismaClient } from '@prisma/client';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { exec } from 'child_process';
import { PrismaWebinarRepository } from 'src/webinars/adapters/webinar-repository.prisma';
import { promisify } from 'util';

const asyncExec = promisify(exec);

export class TestDatabaseFixture {
  private container!: StartedPostgreSqlContainer;
  private prismaClient!: PrismaClient;
  private repository!: PrismaWebinarRepository;

  async init() {
    // Connect to database
    this.container = await new PostgreSqlContainer()
      .withDatabase('test_db')
      .withUsername('user_test')
      .withPassword('password_test')
      .withExposedPorts(5432)
      .start();

    const dbUrl = this.container.getConnectionUri();
    this.prismaClient = new PrismaClient({
      datasources: {
        db: { url: dbUrl },
      },
    });

    // Run migrations to populate the database
    await asyncExec(`DATABASE_URL=${dbUrl} npx prisma migrate deploy`);
    await this.prismaClient.$connect();
  }

  initRepository() {
    this.repository = new PrismaWebinarRepository(this.prismaClient);
    return this.repository;
  }

  getPrismaClient() {
    return this.prismaClient;
  }

  async reset() {
    await this.prismaClient.webinar.deleteMany();
    await this.prismaClient.$executeRawUnsafe('DELETE FROM "Webinar" CASCADE');
  }

  async stop() {
    if (this.prismaClient) await this.prismaClient.$disconnect();
    if (this.container) await this.container.stop({ timeout: 1000 });
  }
}