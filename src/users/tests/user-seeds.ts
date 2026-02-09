import { User } from 'src/users/entities/user.entity';

export const testUser = {
  alice: new User({
    id: 'alice-id',
    email: 'alice@gmail.com',
    password: 'azerty',
  }),
  bob: new User({
    id: 'hacker-id',
    email: 'hacker@gmail.com',
    password: 'azerty',
  }),
  charles: new User({
    id: 'charles',
    email: 'charles@gmail.com',
    password: 'azerty',
  }),
  floflo: new User({
    id: 'floflo-id',
    email: 'floflotheescargot@gmail.com',
    password: 'azerty',
  }),
};
