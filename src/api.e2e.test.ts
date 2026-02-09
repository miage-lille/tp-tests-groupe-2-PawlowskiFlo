import supertest from 'supertest';
import { TestServerFixture } from 'src/tests/fixtures';

describe('Webinar Routes E2E', () => {
  let fixture: TestServerFixture;

  beforeAll(async () => {
    fixture = new TestServerFixture();
    await fixture.init();
  });

  beforeEach(async () => {
    await fixture.reset();
  });

  afterAll(async () => {
    await fixture.stop();
  });

  describe('POST /webinars', () => {
    it('should create a new webinar', async () => {
      // ARRANGE
      const prisma = fixture.getPrismaClient();
      const server = fixture.getServer();

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10); // 10 days from now
      const endDate = new Date(futureDate.getTime() + 60 * 60 * 1000); // 1 hour later

      const webinarData = {
        title: 'E2E Test Webinar',
        seats: '50',
        startDate: futureDate.toISOString(),
        endDate: endDate.toISOString(),
      };

      // ACT
      const response = await supertest(server)
        .post('/webinars')
        .send(webinarData)
        .expect(201);

      // ASSERT
      expect(response.body).toHaveProperty('id');
      expect(response.body.message).toBe('Webinar created');
      expect(typeof response.body.id).toBe('string');

      // Verify webinar was created in database
      const createdWebinar = await prisma.webinar.findUnique({
        where: { id: response.body.id },
      });
      expect(createdWebinar).not.toBeNull();
      expect(createdWebinar!.title).toBe('E2E Test Webinar');
      expect(createdWebinar!.seats).toBe(50);
      expect(createdWebinar!.organizerId).toBe('test-user');
    });

    it('should return 400 when webinar date is too soon', async () => {
      // ARRANGE
      const server = fixture.getServer();

      const tomorrowDate = new Date();
      tomorrowDate.setDate(tomorrowDate.getDate() + 1); // Only 1 day from now (too soon)
      const endDate = new Date(tomorrowDate.getTime() + 60 * 60 * 1000);

      const webinarData = {
        title: 'Too Soon Webinar',
        seats: '50',
        startDate: tomorrowDate.toISOString(),
        endDate: endDate.toISOString(),
      };

      // ACT & ASSERT
      const response = await supertest(server)
        .post('/webinars')
        .send(webinarData)
        .expect(400);

      expect(response.body).toEqual({
        error: 'Webinar must be scheduled at least 3 days in advance',
      });
    });

    it('should return 400 when webinar has too many seats', async () => {
      // ARRANGE
      const server = fixture.getServer();

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      const endDate = new Date(futureDate.getTime() + 60 * 60 * 1000);

      const webinarData = {
        title: 'Too Many Seats Webinar',
        seats: '1001', // Too many seats
        startDate: futureDate.toISOString(),
        endDate: endDate.toISOString(),
      };

      // ACT & ASSERT
      const response = await supertest(server)
        .post('/webinars')
        .send(webinarData)
        .expect(400);

      expect(response.body).toEqual({
        error: 'Webinar must have at most 1000 seats',
      });
    });

    it('should return 400 when webinar has not enough seats', async () => {
      // ARRANGE
      const server = fixture.getServer();

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      const endDate = new Date(futureDate.getTime() + 60 * 60 * 1000);

      const webinarData = {
        title: 'Not Enough Seats Webinar',
        seats: '0', // Not enough seats
        startDate: futureDate.toISOString(),
        endDate: endDate.toISOString(),
      };

      // ACT & ASSERT
      const response = await supertest(server)
        .post('/webinars')
        .send(webinarData)
        .expect(400);

      expect(response.body).toEqual({
        error: 'Webinar must have at least 1 seat',
      });
    });

    it('should handle invalid date formats', async () => {
      // ARRANGE
      const server = fixture.getServer();

      const webinarData = {
        title: 'Invalid Date Webinar',
        seats: '50',
        startDate: 'invalid-date',
        endDate: 'another-invalid-date',
      };

      // ACT & ASSERT
      const response = await supertest(server)
        .post('/webinars')
        .send(webinarData)
        .expect(500); // Should fail with server error due to invalid date

      expect(response.body).toEqual({
        error: 'An error occurred',
      });
    });
  });

  describe('POST /webinars/:id/seats', () => {
    it('should update webinar seats', async () => {
      // ARRANGE
      const prisma = fixture.getPrismaClient();
      const server = fixture.getServer();

      const webinar = await prisma.webinar.create({
        data: {
          id: 'test-webinar',
          title: 'Webinar Test',
          seats: 10,
          startDate: new Date('2026-12-01T10:00:00Z'),
          endDate: new Date('2026-12-01T11:00:00Z'),
          organizerId: 'test-user',
        },
      });

      // ACT
      const response = await supertest(server)
        .post(`/webinars/${webinar.id}/seats`)
        .send({ seats: '30' })
        .expect(200);

      // ASSERT
      expect(response.body).toEqual({ message: 'Seats updated' });

      const updatedWebinar = await prisma.webinar.findUnique({
        where: { id: webinar.id },
      });
      expect(updatedWebinar?.seats).toBe(30);
    });

    it('should return 404 when webinar is not found', async () => {
      // ARRANGE
      const server = fixture.getServer();

      // ACT & ASSERT
      const response = await supertest(server)
        .post('/webinars/non-existent-webinar/seats')
        .send({ seats: '30' })
        .expect(404);

      expect(response.body).toEqual({
        error: 'Webinar not found',
      });
    });

    it('should return 401 when user is not the organizer', async () => {
      // ARRANGE
      const prisma = fixture.getPrismaClient();
      const server = fixture.getServer();

      const webinar = await prisma.webinar.create({
        data: {
          id: 'test-webinar',
          title: 'Webinar Test',
          seats: 10,
          startDate: new Date('2026-12-01T10:00:00Z'),
          endDate: new Date('2026-12-01T11:00:00Z'),
          organizerId: 'different-user', // Différent de "test-user" utilisé dans les routes
        },
      });

      // ACT & ASSERT
      const response = await supertest(server)
        .post(`/webinars/${webinar.id}/seats`)
        .send({ seats: '30' })
        .expect(401);

      expect(response.body).toEqual({
        error: 'User is not allowed to update this webinar',
      });

      // Vérifier que les places n'ont pas été modifiées
      const unchangedWebinar = await prisma.webinar.findUnique({
        where: { id: webinar.id },
      });
      expect(unchangedWebinar?.seats).toBe(10);
    });
  });
});