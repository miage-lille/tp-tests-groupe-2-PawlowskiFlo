import { PrismaClient } from '@prisma/client';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { exec } from 'child_process';
import { promisify } from 'util';
import { RealIdGenerator } from 'src/core/adapters/real-id-generator';
import { RealDateGenerator } from 'src/core/adapters/real-date-generator';
import { PrismaWebinarRepository } from 'src/webinars/adapters/webinar-repository.prisma';
import { OrganizeWebinars } from 'src/webinars/use-cases/organize-webinar';
import { WebinarDatesTooSoonException } from 'src/webinars/exceptions/webinar-dates-too-soon';
import { WebinarTooManySeatsException } from 'src/webinars/exceptions/webinar-too-many-seats';
import { WebinarNotEnoughSeatsException } from 'src/webinars/exceptions/webinar-not-enough-seats';

const asyncExec = promisify(exec);

describe('OrganizeWebinars Integration Test', () => {
  let container: StartedPostgreSqlContainer;
  let prismaClient: PrismaClient;
  let repository: PrismaWebinarRepository;
  let useCase: OrganizeWebinars;

  beforeAll(async () => {
    // Connect to test database
    container = await new PostgreSqlContainer()
      .withDatabase('test_db')
      .withUsername('user_test')
      .withPassword('password_test')
      .withExposedPorts(5432)
      .start();

    const dbUrl = container.getConnectionUri();
    prismaClient = new PrismaClient({
      datasources: {
        db: { url: dbUrl },
      },
    });

    // Run migrations
    await asyncExec(`DATABASE_URL=${dbUrl} npx prisma migrate deploy`);
    await prismaClient.$connect();

    // Setup repository and use case with real adapters
    repository = new PrismaWebinarRepository(prismaClient);
    const idGenerator = new RealIdGenerator();
    const dateGenerator = new RealDateGenerator();
    useCase = new OrganizeWebinars(repository, idGenerator, dateGenerator);
  });

  beforeEach(async () => {
    // Clean database before each test
    await prismaClient.webinar.deleteMany();
    await prismaClient.$executeRawUnsafe('DELETE FROM "Webinar" CASCADE');
  });

  afterAll(async () => {
    await container.stop({ timeout: 1000 });
    return prismaClient.$disconnect();
  });

  describe('Scenario: successful webinar organization', () => {
    it('should create and persist a webinar to the database', async () => {
      // ARRANGE
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10); // 10 days from now
      
      const payload = {
        userId: 'user-alice-id',
        title: 'Integration Test Webinar',
        seats: 50,
        startDate: futureDate,
        endDate: new Date(futureDate.getTime() + 60 * 60 * 1000), // 1 hour later
      };

      // ACT
      const result = await useCase.execute(payload);

      // ASSERT
      expect(result).toHaveProperty('id');
      expect(typeof result.id).toBe('string');

      // Verify webinar was persisted in database
      const webinarsInDb = await prismaClient.webinar.findMany();
      expect(webinarsInDb).toHaveLength(1);
      
      const persistedWebinar = webinarsInDb[0];
      expect(persistedWebinar.id).toBe(result.id);
      expect(persistedWebinar.organizerId).toBe('user-alice-id');
      expect(persistedWebinar.title).toBe('Integration Test Webinar');
      expect(persistedWebinar.seats).toBe(50);
      expect(persistedWebinar.startDate).toEqual(payload.startDate);
      expect(persistedWebinar.endDate).toEqual(payload.endDate);
    });
  });

  describe('Scenario: webinar with dates too soon', () => {
    it('should throw WebinarDatesTooSoonException and not persist to database', async () => {
      // ARRANGE
      const tomorrowDate = new Date();
      tomorrowDate.setDate(tomorrowDate.getDate() + 1); // Only 1 day from now (too soon)
      
      const payload = {
        userId: 'user-alice-id',
        title: 'Too Soon Webinar',
        seats: 50,
        startDate: tomorrowDate,
        endDate: new Date(tomorrowDate.getTime() + 60 * 60 * 1000),
      };

      // ACT & ASSERT
      await expect(useCase.execute(payload)).rejects.toThrow(WebinarDatesTooSoonException);

      // Verify nothing was persisted
      const webinarsInDb = await prismaClient.webinar.findMany();
      expect(webinarsInDb).toHaveLength(0);
    });
  });

  describe('Scenario: webinar with too many seats', () => {
    it('should throw WebinarTooManySeatsException and not persist to database', async () => {
      // ARRANGE
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      
      const payload = {
        userId: 'user-alice-id',
        title: 'Too Many Seats Webinar',
        seats: 1001, // Too many seats
        startDate: futureDate,
        endDate: new Date(futureDate.getTime() + 60 * 60 * 1000),
      };

      // ACT & ASSERT
      await expect(useCase.execute(payload)).rejects.toThrow(WebinarTooManySeatsException);

      // Verify nothing was persisted
      const webinarsInDb = await prismaClient.webinar.findMany();
      expect(webinarsInDb).toHaveLength(0);
    });
  });

  describe('Scenario: webinar with not enough seats', () => {
    it('should throw WebinarNotEnoughSeatsException and not persist to database', async () => {
      // ARRANGE
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      
      const payload = {
        userId: 'user-alice-id',
        title: 'Not Enough Seats Webinar',
        seats: 0, // Not enough seats
        startDate: futureDate,
        endDate: new Date(futureDate.getTime() + 60 * 60 * 1000),
      };

      // ACT & ASSERT
      await expect(useCase.execute(payload)).rejects.toThrow(WebinarNotEnoughSeatsException);

      // Verify nothing was persisted
      const webinarsInDb = await prismaClient.webinar.findMany();
      expect(webinarsInDb).toHaveLength(0);
    });
  });

  describe('Scenario: multiple webinars', () => {
    it('should create multiple webinars with different IDs', async () => {
      // ARRANGE
      const futureDate1 = new Date();
      futureDate1.setDate(futureDate1.getDate() + 10);
      
      const futureDate2 = new Date();
      futureDate2.setDate(futureDate2.getDate() + 15);

      const payload1 = {
        userId: 'user-alice-id',
        title: 'First Webinar',
        seats: 50,
        startDate: futureDate1,
        endDate: new Date(futureDate1.getTime() + 60 * 60 * 1000),
      };

      const payload2 = {
        userId: 'user-bob-id',
        title: 'Second Webinar',
        seats: 100,
        startDate: futureDate2,
        endDate: new Date(futureDate2.getTime() + 90 * 60 * 1000), // 1.5 hours
      };

      // ACT
      const result1 = await useCase.execute(payload1);
      const result2 = await useCase.execute(payload2);

      // ASSERT
      expect(result1.id).not.toBe(result2.id); // Different IDs
      
      const webinarsInDb = await prismaClient.webinar.findMany();
      expect(webinarsInDb).toHaveLength(2);
      
      const webinarIds = webinarsInDb.map(w => w.id);
      expect(webinarIds).toContain(result1.id);
      expect(webinarIds).toContain(result2.id);
    });
  });
});