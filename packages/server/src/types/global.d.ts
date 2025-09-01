declare namespace NodeJS {
  interface ProcessEnv {
    PORT?: string;
    DATABASE_URL?: string;
    SESSION_SECRET?: string;
    NODE_ENV?: 'development' | 'production' | 'test';
    REDIS_URL?: string;
    SEED_ADMIN_EMAIL?: string;
    SEED_ADMIN_PASSWORD?: string;
  }
}

declare module 'express-session' {
  interface SessionData {
    user?: {
      id: string;
      email?: string;
      loginId?: string;
      roles: ('ADMIN' | 'STAFF' | 'TEACHER' | 'STUDENT' | 'GUARDIAN')[];
    };
  }
}