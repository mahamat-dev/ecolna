import { pgEnum } from 'drizzle-orm/pg-core';

export const disciplineStatus = pgEnum('discipline_status', [
  'OPEN','UNDER_REVIEW','RESOLVED','CANCELLED'
]);

export const disciplineRole = pgEnum('discipline_role', [
  'PERPETRATOR','VICTIM','WITNESS'
]);

export const disciplineActionType = pgEnum('discipline_action_type', [
  'WARNING','DETENTION','SUSPENSION_IN_SCHOOL','SUSPENSION_OUT_OF_SCHOOL','PARENT_MEETING','COMMUNITY_SERVICE'
]);

export const disciplineVisibility = pgEnum('discipline_visibility', [
  'PRIVATE','STUDENT','GUARDIAN'
]);

