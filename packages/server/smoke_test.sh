#!/bin/bash
set -euo pipefail
BASE=http://localhost:4000/api

# Login as admin and save cookies
echo "Logging in as admin..."
curl -sS -c cookies.txt -H "Content-Type: application/json" -X POST "$BASE/auth/login-email" \
  -d '{"email":"admin@example.com","password":"AdminPass123"}' > /dev/null

# Create a student user
echo "Creating student user..."
STUDENT_RESP=$(curl -sS -b cookies.txt -H "Content-Type: application/json" -X POST "$BASE/admin/users" \
  -d '{"role":"STUDENT","firstName":"Jane","lastName":"Doe","phone":"555-0123"}')
echo "Student response: $STUDENT_RESP"
PROFILE_ID=$(echo "$STUDENT_RESP" | jq -r '.profileId')
echo "Profile ID: $PROFILE_ID"

if [ "$PROFILE_ID" = "null" ] || [ -z "$PROFILE_ID" ]; then
  echo "Failed to create student user"
  exit 1
fi

# Get academic year and class section
echo "Getting academic data..."
YEAR_ID=$(curl -sS -b cookies.txt "$BASE/academics/academic-years" | jq -r '.[0].id')
CLASS_SECTION_ID=$(curl -sS -b cookies.txt "$BASE/academics/class-sections" | jq -r '.[0].id')
echo "Year ID: $YEAR_ID, Section ID: $CLASS_SECTION_ID"

if [ "$YEAR_ID" = "null" ] || [ "$CLASS_SECTION_ID" = "null" ]; then
  echo "Failed to get academic data"
  exit 1
fi

# Enroll the student
echo "Enrolling student..."
ENROLL_RESP=$(curl -sS -b cookies.txt -H "Content-Type: application/json" -X POST "$BASE/enrollment/enrollments" \
  -d "{\"studentProfileId\":\"$PROFILE_ID\",\"classSectionId\":\"$CLASS_SECTION_ID\",\"academicYearId\":\"$YEAR_ID\"}")
echo "Enrollment response: $ENROLL_RESP"

# Get enrollment ID
ENR_ID=$(curl -sS -b cookies.txt "$BASE/enrollment/students/$PROFILE_ID/enrollments?yearId=$YEAR_ID" | jq -r '.[0].id')
echo "Enrollment ID: $ENR_ID"

if [ "$ENR_ID" = "null" ] || [ -z "$ENR_ID" ]; then
  echo "Failed to get enrollment ID"
  exit 1
fi

# Create attendance session
echo "Creating attendance session..."
TODAY=$(date +%F)
SESSION_RESP=$(curl -sS -b cookies.txt -H "Content-Type: application/json" -X POST "$BASE/attendance/sessions" \
  -d "{\"classSectionId\":\"$CLASS_SECTION_ID\",\"academicYearId\":\"$YEAR_ID\",\"date\":\"$TODAY\"}")
echo "Session response: $SESSION_RESP"
SESSION_ID=$(echo "$SESSION_RESP" | jq -r '.id')
echo "Session ID: $SESSION_ID"

if [ "$SESSION_ID" = "null" ] || [ -z "$SESSION_ID" ]; then
  echo "Failed to create attendance session"
  exit 1
fi

# Bulk mark attendance
echo "Marking attendance..."
MARK_RESP=$(curl -sS -b cookies.txt -H "Content-Type: application/json" -X POST "$BASE/attendance/sessions/$SESSION_ID/bulk-mark" \
  -d "{\"records\":[{\"enrollmentId\":\"$ENR_ID\",\"status\":\"PRESENT\"}]}")
echo "Mark response: $MARK_RESP"

# Finalize session
echo "Finalizing session..."
FINAL_RESP=$(curl -sS -b cookies.txt -H "Content-Type: application/json" -X PATCH "$BASE/attendance/sessions/$SESSION_ID/finalize" \
  -d '{"isFinalized":true}')
echo "Finalize response: $FINAL_RESP"

# Get attendance records
echo "Getting attendance records..."
RECORDS=$(curl -sS -b cookies.txt "$BASE/attendance/sessions/$SESSION_ID/records")
echo "Records: $RECORDS"

echo "\nAttendance smoke test completed successfully!"