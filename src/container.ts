import { PrismaClient } from '@prisma/client';
import { RealDateGenerator } from 'src/core/adapters/real-date-generator';
import { RealIdGenerator } from 'src/core/adapters/real-id-generator';
import { IDateGenerator } from 'src/core/ports/date-generator.interface';
import { IIdGenerator } from 'src/core/ports/id-generator.interface';
import { PrismaWebinarRepository } from 'src/webinars/adapters/webinar-repository.prisma';
import { ChangeSeats } from 'src/webinars/use-cases/change-seats';
import { OrganizeWebinars } from 'src/webinars/use-cases/organize-webinar';

export class AppContainer {
  private prismaClient!: PrismaClient;
  private webinarRepository!: PrismaWebinarRepository;
  private idGenerator!: IIdGenerator;
  private dateGenerator!: IDateGenerator;
  private changeSeatsUseCase!: ChangeSeats;
  private organizeWebinarsUseCase!: OrganizeWebinars;

  init(prismaClient: PrismaClient) {
    this.prismaClient = prismaClient;
    this.webinarRepository = new PrismaWebinarRepository(this.prismaClient);
    this.idGenerator = new RealIdGenerator();
    this.dateGenerator = new RealDateGenerator();
    this.changeSeatsUseCase = new ChangeSeats(this.webinarRepository);
    this.organizeWebinarsUseCase = new OrganizeWebinars(
      this.webinarRepository,
      this.idGenerator,
      this.dateGenerator,
    );
  }

  getPrismaClient() {
    return this.prismaClient;
  }

  getChangeSeatsUseCase() {
    return this.changeSeatsUseCase;
  }

  getOrganizeWebinarsUseCase() {
    return this.organizeWebinarsUseCase;
  }
}

export const container = new AppContainer();