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