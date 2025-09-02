import 'dotenv/config';
import { db } from '../src/db/client';
import { users, userRoles, profiles } from '../src/db/schema/identity';
import { hash as argon2Hash } from '@node-rs/argon2';
import { makeLoginId, randomSecret } from '../src/modules/identity/codegen';

const run = async () => {
  console.log('Creating test users...');
  
  // Create a teacher with email
  const teacherEmail = 'teacher@example.com';
  const teacherPassword = 'TeacherPass123';
  const teacherPasswordHash = await argon2Hash(teacherPassword);
  
  const [teacher] = await db.insert(users).values({
    authMethod: 'EMAIL',
    email: teacherEmail,
    passwordHash: teacherPasswordHash,
    isActive: true
  }).onConflictDoNothing().returning();
  
  if (teacher) {
    await db.insert(userRoles).values({ userId: teacher.id, role: 'TEACHER' });
    await db.insert(profiles).values({ 
      userId: teacher.id, 
      firstName: 'John', 
      lastName: 'Teacher' 
    });
    console.log(`Created teacher: ${teacherEmail} / ${teacherPassword}`);
  } else {
    console.log('Teacher already exists');
  }
  
  // Create a student with loginId
  const studentLoginId = makeLoginId('STUDENT');
  const studentSecret = randomSecret(8);
  const studentPasswordHash = await argon2Hash(studentSecret);
  
  const [student] = await db.insert(users).values({
    authMethod: 'LOGIN_ID',
    loginId: studentLoginId,
    passwordHash: studentPasswordHash,
    isActive: true
  }).onConflictDoNothing().returning();
  
  if (student) {
    await db.insert(userRoles).values({ userId: student.id, role: 'STUDENT' });
    await db.insert(profiles).values({ 
      userId: student.id, 
      firstName: 'Alice', 
      lastName: 'Student' 
    });
    console.log(`Created student: ${studentLoginId} / ${studentSecret}`);
  } else {
    console.log('Student already exists');
  }
  
  // Create a guardian with loginId
  const guardianLoginId = makeLoginId('GUARDIAN');
  const guardianSecret = randomSecret(8);
  const guardianPasswordHash = await argon2Hash(guardianSecret);
  
  const [guardian] = await db.insert(users).values({
    authMethod: 'LOGIN_ID',
    loginId: guardianLoginId,
    passwordHash: guardianPasswordHash,
    isActive: true
  }).onConflictDoNothing().returning();
  
  if (guardian) {
    await db.insert(userRoles).values({ userId: guardian.id, role: 'GUARDIAN' });
    await db.insert(profiles).values({ 
      userId: guardian.id, 
      firstName: 'Bob', 
      lastName: 'Parent' 
    });
    console.log(`Created guardian: ${guardianLoginId} / ${guardianSecret}`);
  } else {
    console.log('Guardian already exists');
  }
  
  console.log('\nTest users created! You can now login with:');
  console.log('Admin (email): admin@example.com / AdminPass123');
  console.log(`Teacher (email): ${teacherEmail} / ${teacherPassword}`);
  console.log(`Student (loginId): ${studentLoginId} / ${studentSecret}`);
  console.log(`Guardian (loginId): ${guardianLoginId} / ${guardianSecret}`);
};

run().catch(e => { console.error(e); process.exit(1); });