module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleNameMapper: {
    '^@shared/types$': '<rootDir>/../shared/src/index.ts'
  }
};