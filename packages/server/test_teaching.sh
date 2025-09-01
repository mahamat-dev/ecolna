#!/bin/bash
set -euo pipefail
BASE=http://localhost:4000/api

# Login as admin and save cookies
echo "Logging in as admin..."
curl -sS -c cookies.txt -H "Content-Type: application/json" -X POST "$BASE/auth/login-email" \
  -d '{"email":"admin@example.com","password":"AdminPass123"}' > /dev/null

# Create a teacher user
echo "Creating teacher user..."
TEACHER_RESP=$(curl -sS -b cookies.txt -H "Content-Type: application/json" -X POST "$BASE/admin/users" \
  -d '{"role":"TEACHER","firstName":"John","lastName":"Smith","phone":"555-0456"}')
echo "Teacher response: $TEACHER_RESP"
TEACHER_PROFILE_ID=$(echo "$TEACHER_RESP" | jq -r '.profileId')
echo "Teacher Profile ID: $TEACHER_PROFILE_ID"

if [ "$TEACHER_PROFILE_ID" = "null" ] || [ -z "$TEACHER_PROFILE_ID" ]; then
  echo "Failed to create teacher user"
  exit 1
fi

# Get academic data
echo "Getting academic data..."
YEAR_ID=$(curl -sS -b cookies.txt "$BASE/academics/academic-years" | jq -r '.[0].id')
CLASS_SECTION_ID=$(curl -sS -b cookies.txt "$BASE/academics/class-sections" | jq -r '.[0].id')
SUBJECT_ID=$(curl -sS -b cookies.txt "$BASE/academics/subjects" | jq -r '.[0].id')
echo "Year ID: $YEAR_ID, Section ID: $CLASS_SECTION_ID, Subject ID: $SUBJECT_ID"

if [ "$YEAR_ID" = "null" ] || [ "$CLASS_SECTION_ID" = "null" ] || [ "$SUBJECT_ID" = "null" ]; then
  echo "Failed to get academic data"
  exit 1
fi

# Create teaching assignment
echo "Creating teaching assignment..."
ASSIGNMENT_RESP=$(curl -sS -b cookies.txt -H "Content-Type: application/json" -X POST "$BASE/teaching/assignments" \
  -d "{\"teacherProfileId\":\"$TEACHER_PROFILE_ID\",\"classSectionId\":\"$CLASS_SECTION_ID\",\"subjectId\":\"$SUBJECT_ID\",\"academicYearId\":\"$YEAR_ID\",\"isLead\":true,\"hoursPerWeek\":4}")
echo "Assignment response: $ASSIGNMENT_RESP"
ASSIGNMENT_ID=$(echo "$ASSIGNMENT_RESP" | jq -r '.id')
echo "Assignment ID: $ASSIGNMENT_ID"

if [ "$ASSIGNMENT_ID" = "null" ] || [ -z "$ASSIGNMENT_ID" ]; then
  echo "Failed to create teaching assignment"
  exit 1
fi

# List assignments
echo "Listing assignments..."
ASSIGNMENTS=$(curl -sS -b cookies.txt "$BASE/teaching/assignments?teacherProfileId=$TEACHER_PROFILE_ID")
echo "Assignments: $ASSIGNMENTS"

# Set homeroom teacher
echo "Setting homeroom teacher..."
HOMEROOM_RESP=$(curl -sS -b cookies.txt -H "Content-Type: application/json" -X POST "$BASE/teaching/class-sections/$CLASS_SECTION_ID/homeroom" \
  -d "{\"teacherProfileId\":\"$TEACHER_PROFILE_ID\",\"academicYearId\":\"$YEAR_ID\"}")
echo "Homeroom response: $HOMEROOM_RESP"

# Get homeroom teacher
echo "Getting homeroom teacher..."
HOMEROOM_GET=$(curl -sS -b cookies.txt "$BASE/teaching/class-sections/$CLASS_SECTION_ID/homeroom?yearId=$YEAR_ID")
echo "Homeroom teacher: $HOMEROOM_GET"

# Update assignment
echo "Updating assignment..."
UPDATE_RESP=$(curl -sS -b cookies.txt -H "Content-Type: application/json" -X PATCH "$BASE/teaching/assignments/$ASSIGNMENT_ID" \
  -d '{"hoursPerWeek":6,"notes":"Updated assignment"}')
echo "Update response: $UPDATE_RESP"

echo "\nTeaching assignment test completed successfully!"